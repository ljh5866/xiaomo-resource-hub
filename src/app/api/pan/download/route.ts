import { getSessionUser } from "@/lib/auth";
import { get } from "@/db/client";
import { isPanProvider, SHARE_PARSERS, type PanFile } from "@/lib/pan/types";
import { getDirectLink, providerReady } from "@/lib/pan";
import { quarkCdnHeaders } from "@/lib/pan/quark";
import { resolveCookie } from "@/lib/pan/credentials";
import { openRangeStream } from "@/lib/pan/fast-download";
import { takePrepared } from "@/lib/pan/prepared";

/**
 * GET /api/pan/download?linkId=&fid=&name=&size=&token=&pdir=
 *
 * 为什么必须由服务器转发：夸克直链绑定了账号 Cookie，用户浏览器直接打开是
 * 412 / ERR_INVALID_RESPONSE（实测）。所以服务端带 Cookie 拉流，再转给浏览器。
 *
 * 关键设计：**先返回响应头，把准备工作放进流里**。
 * 取链要串行跑 token → detail → save → task → download 五步，跨境每步 3–6 秒；
 * 如果等这些都做完再 return Response，浏览器会白转 20–40 秒。现在它立刻进入下载态，
 * 拿到第一批字节就开始写盘。
 */
const RATE = Number(process.env.PAN_DOWNLOAD_RATE ?? 2 * 1024 * 1024);

function throttle(bytesPerSec: number): TransformStream<Uint8Array, Uint8Array> {
  if (!bytesPerSec || bytesPerSec <= 0) return new TransformStream();
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
  const ticket = url.searchParams.get("ticket") ?? "";

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

  const cred = resolveCookie(user.id ?? null, provider);
  if (!cred) return new Response("还没有绑定网盘账号", { status: 400 });

  const file: PanFile = { fid, name, size, isDir: false, token };
  const rangeHeader = req.headers.get("range");

  // 准备工作全放进流里：浏览器立刻进入下载态，而不是白等 20–40 秒
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // 前端已经用 ticket 把直链取好了 —— 直接用，省掉 token→detail→save→task 这一串
        const prepared = ticket ? takePrepared(ticket) : null;

        let cdnUrl: string;
        let cdnHeaders: Record<string, string>;

        if (prepared) {
          cdnUrl = prepared.url;
          cdnHeaders = quarkCdnHeaders(rangeHeader, prepared.cookie);
        } else {
          const direct = await getDirectLink(
            link.id,
            provider,
            parsed.shareId,
            parsed.passcode,
            file,
            cred.cookie,
            pdirFid,
          );
          cdnUrl = direct.url;
          cdnHeaders = quarkCdnHeaders(rangeHeader, cred.cookie);
        }

        const result = await openRangeStream(cdnUrl, cdnHeaders, {
          concurrency: Number(process.env.PAN_RANGE_CONCURRENCY ?? 24),
          retries: 3,
          // 列表里已经有大小，省掉一次跨境探测
          knownTotal: size > 0 ? size : null,
        });

        const reader = result.stream.getReader();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "拉流失败";
        console.error("[pan/download]", message);
        controller.error(new Error(message));
      }
    },
  });

  const headers = new Headers();
  headers.set("content-type", "application/octet-stream");
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  headers.set("cache-control", "no-store");
  headers.set("x-pan-provider", provider);
  // 不设 content-length：走 chunked，浏览器立刻开始收，不会因为长度对不上而失败

  return new Response(body.pipeThrough(throttle(RATE)), { status: 200, headers });
}
