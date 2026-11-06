/**
 * 多连接 Range 并发下载（服务端版）。
 *
 * 手法照抄 tidain/YunX-Desktop 的 ChunkDownloader / DownloadManager：
 *   · 并行阈值 4 MB —— 太小的文件开并发反而更慢
 *   · 弹性分片：块大小 ≈ 单连接跑 TARGET_SECONDS(5s) 的量，夹在 256KB–4MB
 *   · Range 分片 + 有序合并：分片乱序拉回，但**按字节顺序**吐给客户端
 *   · 服务器忽略 Range（返回 200 整文件）时立刻回退单流，绝不为一个分片下整文件
 *   · 分片失败重试 3 次（指数退避）
 *
 * 为什么这对网盘有效：夸克的限速是**单连接**限速，多开几条能叠加。
 * 单连接 115 KB/s × 6 ≈ 700 KB/s。
 */

export type RangeDownloadOptions = {
  /** 同时在飞的分片数 */
  concurrency?: number;
  /** 分片下限 256 KB */
  minChunk?: number;
  /** 分片上限 4 MB */
  maxChunk?: number;
  /** 目标：块大小 ≈ 单连接跑这么久的数据量 */
  targetSeconds?: number;
  /** 分片重试次数 */
  retries?: number;
  /** 低于这个大小直接单流 */
  parallelMinBytes?: number;
  /**
   * 已知文件大小（来自分享列表页）。给了就**跳过探测请求** ——
   * 跨境链路上那次 probe 要 3–6 秒，纯浪费。
   */
  knownTotal?: number | null;
};

const DEFAULTS: Required<Omit<RangeDownloadOptions, "knownTotal">> = {
  concurrency: 6,
  minChunk: 256 * 1024,
  maxChunk: 4 * 1024 * 1024,
  targetSeconds: 5,
  retries: 3,
  parallelMinBytes: 4 * 1024 * 1024,
};

export type RangePlan = {
  total: number | null;
  chunkSize: number;
  chunkCount: number;
  parallel: boolean;
};

/** 用一个 0-0 的 Range 探测总大小；服务器忽略 Range 时返回 null */
export async function probeSize(
  url: string,
  headers: Record<string, string>,
): Promise<{ total: number | null; acceptsRange: boolean; status: number }> {
  const res = await fetch(url, {
    headers: { ...headers, range: "bytes=0-0" },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { total: null, acceptsRange: false, status: 0 };
  // 丢掉这一字节
  if (res.body) await res.body.cancel().catch(() => {});

  const cr = res.headers.get("content-range");
  const total = cr ? Number(/\/(\d+)$/.exec(cr)?.[1] ?? 0) || null : null;
  return { total, acceptsRange: res.status === 206 && !!total, status: res.status };
}

/** 规划分片：块大小随并发数和目标秒数夹逼 */
export function planRanges(total: number, opts?: RangeDownloadOptions): RangePlan {
  const o = { ...DEFAULTS, ...opts };
  if (total < o.parallelMinBytes) {
    return { total, chunkSize: total, chunkCount: 1, parallel: false };
  }
  /**
   * 分片策略（比云析保守，因为这是跨境链路）：
   * 每片按 maxChunk（4MB）算，至少开 concurrency 片。
   * 片太小会让「每片一次握手（3–6 秒）」的开销盖过并发收益。
   */
  // 并发 <= 1 表示强制单流（排查用：PAN_RANGE_CONCURRENCY=1）
  if (o.concurrency <= 1) {
    return { total, chunkSize: total, chunkCount: 1, parallel: false };
  }
  const byTarget = Math.ceil(total / o.maxChunk);
  const chunkCount = Math.max(o.concurrency, byTarget, 2);
  const raw = Math.ceil(total / chunkCount);
  const chunkSize = Math.min(Math.max(raw, o.minChunk), o.maxChunk);
  return {
    total,
    chunkSize,
    chunkCount: Math.ceil(total / chunkSize),
    parallel: chunkCount > 1,
  };
}

async function fetchRange(
  url: string,
  headers: Record<string, string>,
  start: number,
  end: number,
  retries: number,
): Promise<Uint8Array> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { ...headers, range: `bytes=${start}-${end}` },
        cache: "no-store",
      });
      if (res.status !== 206) {
        // 200 = 服务器忽略了 Range，交给上层回退单流
        throw new Error(`range-ignored:${res.status}`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength !== end - start + 1) {
        throw new Error(`short-read:${buf.byteLength}!==${end - start + 1}`);
      }
      return buf;
    } catch (e) {
      lastErr = e;
      if (String(e).includes("range-ignored")) throw e;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("分片下载失败");
}

export type RangeStreamResult = {
  stream: ReadableStream<Uint8Array>;
  total: number | null;
  parallel: boolean;
  chunkSize: number;
  chunkCount: number;
};

/**
 * 打开一条「多连接并发、按顺序输出」的字节流。
 * 调用方负责设置 Content-Disposition 等响应头。
 */
export async function openRangeStream(
  url: string,
  headers: Record<string, string>,
  opts?: RangeDownloadOptions,
): Promise<RangeStreamResult> {
  const o = { ...DEFAULTS, ...opts };

  // 已知大小就直接用，省掉一次跨境探测（3–6 秒）
  let total: number | null = o.knownTotal && o.knownTotal > 0 ? o.knownTotal : null;
  let acceptsRange = total !== null;

  if (total === null) {
    const probe = await probeSize(url, headers);
    total = probe.total;
    acceptsRange = probe.acceptsRange;
  }

  // 不知道大小或服务器不支持 Range → 单流
  if (!acceptsRange || !total) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.body) throw new Error(`网盘返回 ${res.status}，没有内容`);
    return {
      stream: res.body as ReadableStream<Uint8Array>,
      total: total,
      parallel: false,
      chunkSize: 0,
      chunkCount: 1,
    };
  }

  const plan = planRanges(total, opts);
  if (!plan.parallel) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.body) throw new Error(`网盘返回 ${res.status}，没有内容`);
    return {
      stream: res.body as ReadableStream<Uint8Array>,
      total,
      parallel: false,
      chunkSize: plan.chunkSize,
      chunkCount: 1,
    };
  }

  const ranges: Array<[number, number]> = [];
  for (let start = 0; start < total; start += plan.chunkSize) {
    ranges.push([start, Math.min(start + plan.chunkSize - 1, total - 1)]);
  }

  let nextToStart = 0;
  let nextToEmit = 0;
  const inflight = new Map<number, Promise<Uint8Array>>();
  let failed: Error | null = null;

  const startChunk = (i: number) => {
    const [s, e] = ranges[i];
    inflight.set(i, fetchRange(url, headers, s, e, o.retries));
  };

  // 预填窗口
  while (nextToStart < ranges.length && nextToStart < o.concurrency) {
    startChunk(nextToStart);
    nextToStart += 1;
  }

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (failed) {
        controller.error(failed);
        return;
      }
      if (nextToEmit >= ranges.length) {
        controller.close();
        return;
      }

      const pending = inflight.get(nextToEmit);
      if (!pending) {
        startChunk(nextToEmit);
      }

      try {
        const buf = await inflight.get(nextToEmit)!;
        inflight.delete(nextToEmit);
        nextToEmit += 1;

        // 补窗口
        while (nextToStart < ranges.length && inflight.size < o.concurrency) {
          startChunk(nextToStart);
          nextToStart += 1;
        }

        controller.enqueue(buf);
      } catch (e) {
        failed = e instanceof Error ? e : new Error(String(e));
        for (const p of inflight.values()) p.catch(() => {});
        inflight.clear();
        controller.error(failed);
      }
    },
    cancel() {
      inflight.clear();
    },
  });

  return {
    stream,
    total,
    parallel: true,
    chunkSize: plan.chunkSize,
    chunkCount: ranges.length,
  };
}
