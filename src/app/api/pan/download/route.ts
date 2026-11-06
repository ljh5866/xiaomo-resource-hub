import { getSessionUser } from "@/lib/auth";
import { get } from "@/db/client";
import { isPanProvider, SHARE_PARSERS, type PanFile } from "@/lib/pan/types";
import { getDirectLink, providerReady } from "@/lib/pan";
import { quarkCdnHeaders } from "@/lib/pan/quark";
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
  const upstream = await fetch(direct.url, {
    headers: quarkCdnHeaders(range, cred.cookie),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) return new Response("连不上网盘 CDN", { status: 502 });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`网盘返回 ${upstream.status}（直链可能已过期，刷新重试）`, {
      status: 502,
    });
  }
  if (!upstream.body) return new Response("网盘没有返回内容", { status: 502 });

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("content-range", cr);
  headers.set("accept-ranges", "bytes");
  headers.set(
    "content-disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(direct.fileName || name)}`,
  );
  headers.set("cache-control", "no-store");

  return new Response(upstream.body.pipeThrough(throttle(RATE)), {
    status: upstream.status,
    headers,
  });
}
