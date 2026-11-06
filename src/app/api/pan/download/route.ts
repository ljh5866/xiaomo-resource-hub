import { getSessionUser } from "@/lib/auth";
import { get } from "@/db/client";
import { isPanProvider, SHARE_PARSERS, type PanFile } from "@/lib/pan/types";
import { getDirectLink, providerReady } from "@/lib/pan";
import { quarkCdnHeaders } from "@/lib/pan/quark";
import { openRangeStream } from "@/lib/pan/fast-download";
import { resolveCookie } from "@/lib/pan/credentials";

/**
 * GET /api/pan/download?linkId=&fid=&name=&size=
 *
 * 为什么必须由服务器转发：夸克直链绑定了账号 Cookie，用户浏览器直接打开是 412。
 * 所以这里带 Cookie 拉流，边下边转给浏览器，并支持 Range（断点续传）。
 *
 * 限速：默认 2 MB/s，可在 .env 用 PAN_DOWNLOAD_RATE 调整（字节/秒，0 = 不限）。
 */
const RATE = Number(process.env.PAN_DOWNLOAD_RATE ?? 2 * 1024 * 1024);

function throttle(bytesPerSec: number): TransformStream<Uint8Array, Uint8Array> {
  if (!bytesPerSec || bytesPerSec <= 0) {
    return new TransformStream();
  }
  let startedAt = 0;
  let sent = 0;
  return new TransformStream({
    start() {
      startedAt = Date.now();
    },
    async transform(chunk, controller) {
      sent += chunk.byteLength;
      const target = (sent / bytesPerSec) * 1000;
      const wait = target - (Date.now() - startedAt);
      if (wait > 4) await new Promise((r) => setTimeout(r, wait));
      controller.enqueue(chunk);
    },
  });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("请先登录", { status: 401 });

  const url = new URL(req.url);
  const linkId = Number(url.searchParams.get("linkId") ?? 0);
  const fid = url.searchParams.get("fid") ?? "";
  const name = url.searchParams.get("name") ?? "download";
  const size = Number(url.searchParams.get("size") ?? 0);
  const pdirFid = url.searchParams.get("pdir") ?? "0";
  const token = url.searchParams.get("token");

  if (!Number.isFinite(linkId) || linkId <= 0 || !fid) {
    return new Response("缺少参数", { status: 400 });
  }

  const link = get<{
    id: number;
    provider: string;
    url: string;
    extractCode: string | null;
    status: string;
  }>(
    `SELECT l.id, l.provider, l.url, l.extract_code AS extractCode, r.status
       FROM resource_links l JOIN resources r ON r.id = l.resource_id
      WHERE l.id = ?`,
    linkId,
  );
  if (!link || link.status !== "published") return new Response("链接不存在", { status: 404 });

  const provider = link.provider;
  if (!isPanProvider(provider) || !providerReady(provider)) {
    return new Response("这个来源暂不支持", { status: 400 });
  }

  const parsed = SHARE_PARSERS[provider](link.url, link.extractCode);
  if (!parsed) return new Response("链接格式无法识别", { status: 400 });

  const file: PanFile = { fid, name, size, isDir: false, token };

  const cred = resolveCookie(user.id ?? null, provider);
  if (!cred) return new Response("还没有绑定网盘账号", { status: 400 });

  let direct;
  try {
    direct = await getDirectLink(link.id, provider, parsed.shareId, parsed.passcode, file, cred.cookie, pdirFid);
  } catch (err) {
    const message = err instanceof Error ? err.message : "取直链失败";
    return new Response(message, { status: 502 });
  }

  const range = req.headers.get("range");

  /**
   * 多连接并发拉取（照抄云析的分片并发思路）：
   * 夸克限速是按单连接算的，开 6 条 Range 连接能叠加到 ~6 倍。
   * 服务器忽略 Range 时会自动回退单流，所以这里不用先判断。
   */
  let result;
  try {
    result = await openRangeStream(direct.url, quarkCdnHeaders(range, cred.cookie), {
      concurrency: Number(process.env.PAN_RANGE_CONCURRENCY ?? 6),
      targetSeconds: 5,
      retries: 3,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "拉流失败";
    if (/range-ignored/.test(message)) {
      // 服务器不支持 Range：回退单流
      const res = await fetch(direct.url, {
        headers: quarkCdnHeaders(range, cred.cookie),
        cache: "no-store",
      }).catch(() => null);
      if (!res?.body) return new Response("连不上网盘 CDN", { status: 502 });
      return new Response(res.body.pipeThrough(throttle(RATE)), {
        status: res.status,
        headers: buildHeaders(direct.fileName || name, res.headers.get("content-length")),
      });
    }
    return new Response(`网盘拉流失败：${message}`, { status: 502 });
  }

  return new Response(result.stream.pipeThrough(throttle(RATE)), {
    status: 200,
    headers: buildHeaders(direct.fileName || name, result.total ? String(result.total) : null),
  });
}

function buildHeaders(fileName: string, contentLength: string | null): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/octet-stream");
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("accept-ranges", "none");
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  headers.set("cache-control", "no-store");
  return headers;
}
