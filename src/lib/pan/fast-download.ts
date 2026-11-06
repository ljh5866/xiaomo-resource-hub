/**
 * 多连接 Range 并发下载（服务端版）。
 *
 * 手法参考 tidain/YunX-Desktop 的 ChunkDownloader / DownloadManager：
 *   · 并行阈值 4 MB —— 太小的文件开并发反而更慢
 *   · 分片 + 有序合并：分片乱序拉回，但按字节顺序吐给客户端
 *   · 服务器忽略 Range（返回 200 整文件）时立刻回退单流
 *   · 分片失败重试 3 次（指数退避）
 *
 * 新增（2026-11-06）：**首片流式输出**。
 * 之前是「整片下完才吐」，首片 4MB 在 115 KB/s 的链路上要 35 秒，
 * 浏览器进度条会停在 0 B/s 假装卡死。现在首片边读边吐，1–2 秒就能看到速度；
 * 其余分片照旧并发缓冲，首片结束后基本已经就绪，衔接是连续的。
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
  /** 已知文件大小（来自分享列表页），给了就跳过探测请求 */
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
  // 并发 <= 1 表示强制单流（排查用：PAN_RANGE_CONCURRENCY=1）
  if (o.concurrency <= 1) {
    return { total, chunkSize: total, chunkCount: 1, parallel: false };
  }
  /**
   * 分片策略（比云析保守，因为这是跨境链路）：
   * 每片按 maxChunk（4MB）算，至少开 concurrency 片。
   * 片太小会让「每片一次握手（3–6 秒）」的开销盖过并发收益。
   */
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
      if (res.status !== 206) throw new Error(`range-ignored:${res.status}`);
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

async function singleStream(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.body) throw new Error(`网盘返回 ${res.status}，没有内容`);
  return res.body as ReadableStream<Uint8Array>;
}

/**
 * 打开一条「多连接并发、按顺序输出、首片流式」的字节流。
 */
export async function openRangeStream(
  url: string,
  headers: Record<string, string>,
  opts?: RangeDownloadOptions,
): Promise<RangeStreamResult> {
  const o = { ...DEFAULTS, ...opts };

  let total: number | null = o.knownTotal && o.knownTotal > 0 ? o.knownTotal : null;
  let acceptsRange = total !== null;

  if (total === null) {
    const probe = await probeSize(url, headers);
    total = probe.total;
    acceptsRange = probe.acceptsRange;
  }

  if (!acceptsRange || !total) {
    return {
      stream: await singleStream(url, headers),
      total,
      parallel: false,
      chunkSize: 0,
      chunkCount: 1,
    };
  }

  const plan = planRanges(total, opts);
  if (!plan.parallel) {
    return {
      stream: await singleStream(url, headers),
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

  /**
   * 首片单独走「流式」：拿 reader 逐块读，边读边 enqueue。
   * 这样第一批字节 1–2 秒就到，进度条能动，而不是等整片下完。
   */
  const [firstStart, firstEnd] = ranges[0];
  let firstReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let firstBytesLeft = firstEnd - firstStart + 1;
  try {
    const res = await fetch(url, {
      headers: { ...headers, range: `bytes=${firstStart}-${firstEnd}` },
      cache: "no-store",
    });
    if (res.status === 206 && res.body) {
      firstReader = res.body.getReader();
    }
  } catch {
    firstReader = null;
  }

  // 其余分片照常并发缓冲
  let nextToStart = firstReader ? 1 : 0;
  let nextToEmit = firstReader ? 1 : 0;
  const inflight = new Map<number, Promise<Uint8Array>>();
  let failed: Error | null = null;

  const startChunk = (i: number) => {
    const [s, e] = ranges[i];
    inflight.set(i, fetchRange(url, headers, s, e, o.retries));
  };

  // 预填窗口（首片占一个位置）
  const windowSize = Math.max(o.concurrency, 1);
  let started = nextToStart;
  while (started < ranges.length && inflight.size + (firstReader ? 1 : 0) < windowSize) {
    startChunk(started);
    started += 1;
  }
  nextToStart = started;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (failed) {
        controller.error(failed);
        return;
      }

      // ① 首片流式阶段
      if (firstReader) {
        try {
          const { done, value } = await firstReader.read();
          if (!done && value) {
            firstBytesLeft -= value.byteLength;
            controller.enqueue(value);
            return;
          }
        } catch {
          /* 首片流式失败，退化到整片重取 */
        }
        firstReader = null;
        if (firstBytesLeft > 0) {
          // 首片没读全：退回整片重取一次
          try {
            const buf = await fetchRange(url, headers, firstStart, firstEnd, 2);
            controller.enqueue(buf);
          } catch (e) {
            failed = e instanceof Error ? e : new Error(String(e));
            controller.error(failed);
            return;
          }
        }
        return;
      }

      // ② 其余分片按序输出
      if (nextToEmit >= ranges.length) {
        controller.close();
        return;
      }

      if (!inflight.has(nextToEmit)) startChunk(nextToEmit);

      try {
        const buf = await inflight.get(nextToEmit)!;
        inflight.delete(nextToEmit);
        nextToEmit += 1;

        while (nextToStart < ranges.length && inflight.size < windowSize) {
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
      firstReader?.cancel().catch(() => {});
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
