import { get } from "@/db/client";

/**
 * GET /api/soft/download?linkId=123
 *
 * 3DM 的软件直链（provider='direct'）挂在腾讯云 CDN 上，带 Referer ACL：
 * 只有 Referer 是 soft.3dmgame.com 才放行，别的站引用一律 403 denied by Referer ACL。
 * 浏览器无法把 Referer 伪装成第三方域名，所以只能由服务端代拉。
 *
 * 链路上有 302：down.wsyhn.com/23_xxx → soft.wsyhn.com/soft/xxx.exe，
 * fetch 默认跟随跳转，最终拿到文件。
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36";
const REFERER = "https://soft.3dmgame.com/";

export async function GET(req: Request) {
  const linkId = Number(new URL(req.url).searchParams.get("linkId") ?? 0);
  if (!Number.isFinite(linkId) || linkId <= 0) {
    return new Response("缺少参数", { status: 400 });
  }

  const row = get<{ url: string; provider: string; title: string }>(
    `SELECT l.url, l.provider, r.title
       FROM resource_links l JOIN resources r ON r.id = l.resource_id
      WHERE l.id = ? AND r.status = 'published'`,
    linkId,
  );
  if (!row) return new Response("链接不存在", { status: 404 });
  if (row.provider !== "direct") return new Response("这条链接不支持直连下载", { status: 400 });

  const res = await fetch(row.url, {
    headers: { "user-agent": UA, referer: REFERER, accept: "*/*" },
    redirect: "follow",
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok || !res.body) {
    return new Response(`源站返回 ${res?.status ?? "无响应"}`, { status: 502 });
  }

  // 文件名优先取最终 URL 的最后一段，退化用资源标题
  const finalName = decodeURIComponent(new URL(res.url).pathname.split("/").pop() || "");
  const fileName = /\.\w{2,5}$/.test(finalName) ? finalName : `${row.title}.exe`;

  const headers = new Headers();
  headers.set("content-type", res.headers.get("content-type") ?? "application/octet-stream");
  const len = res.headers.get("content-length");
  if (len) headers.set("content-length", len);
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  headers.set("cache-control", "no-store");

  return new Response(res.body as ReadableStream<Uint8Array>, { status: 200, headers });
}
