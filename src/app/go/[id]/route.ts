import { NextResponse, type NextRequest } from "next/server";
import { get, run } from "@/db/client";
import { hashIp } from "@/lib/links";

/**
 * 下载跳板（docs/02 §7）
 * 站内所有下载都经过这里：统计、防盗链、失效可替换。
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const linkId = Number(id);

  if (!Number.isFinite(linkId)) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

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

  if (!row) {
    return NextResponse.redirect(new URL("/404", req.url), 302);
  }

  if (row.status === "invalid") {
    return NextResponse.redirect(new URL(`/r/${row.slug}`, req.url), 302);
  }

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
    run(
      `UPDATE resource_links SET click_count = click_count + 1 WHERE id = ?`,
      linkId,
    );
    run(
      `UPDATE resources SET download_count = download_count + 1 WHERE id = ?`,
      row.resourceId,
    );
  } catch {
    /* 统计失败静默 */
  }

  return NextResponse.redirect(row.url, 302);
}
