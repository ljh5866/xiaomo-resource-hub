import { NextResponse, type NextRequest } from "next/server";
import { get, run } from "@/db/client";
import { hashIp } from "@/lib/links";
import { getSessionUser } from "@/lib/auth";

/**
 * 下载跳板（docs/02 §7）
 * 站内所有下载都经过这里：登录校验、统计、防盗链、失效可替换。
 *
 * 跳转一律用「相对 Location」：
 * 反向代理后面 req.url 是 http://localhost:3100/...，用 new URL() 拼绝对地址会
 * 把内网主机名写进 Location，用户浏览器打不开。相对地址由浏览器按当前域名补全。
 */
function redirectTo(path: string, status = 302) {
  return new NextResponse(null, {
    status,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const linkId = Number(id);

  if (!Number.isFinite(linkId)) return redirectTo("/");

  const row = get<{
    url: string;
    status: string;
    resourceId: number;
    slug: string;
  }>(
    `SELECT l.url, l.status, l.resource_id AS resourceId, r.slug
     FROM resource_links l
     JOIN resources r ON r.id = l.resource_id
     WHERE l.id = ? LIMIT 1`,
    linkId,
  );

  if (!row) return redirectTo("/404");

  // 下载必须登录：回跳到资源详情页，登录后用户能直接再点一次
  const user = await getSessionUser();
  if (!user) return redirectTo(`/login?next=${encodeURIComponent(`/r/${row.slug}`)}`);

  if (row.status === "invalid") return redirectTo(`/r/${row.slug}`);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0";

  // 统计不阻塞跳转
  try {
    run(
      `INSERT INTO download_events (resource_id, link_id, ip_hash, ua_family, referer_host, created_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())`,
      row.resourceId,
      linkId,
      hashIp(ip),
      req.headers.get("user-agent")?.slice(0, 60) ?? null,
      req.headers.get("referer") ? new URL(req.headers.get("referer")!).host : null,
    );
    run(`UPDATE resource_links SET click_count = click_count + 1 WHERE id = ?`, linkId);
    run(`UPDATE resources SET download_count = download_count + 1 WHERE id = ?`, row.resourceId);
  } catch {
    /* 统计失败静默 */
  }

  return redirectTo(row.url, 303);
}
