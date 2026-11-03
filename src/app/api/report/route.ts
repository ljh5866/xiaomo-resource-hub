import { NextResponse } from "next/server";
import { get, run } from "@/db/client";
import { clientKey, hit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const REASONS = new Set(["link-dead", "wrong-content", "virus", "other"]);

/** 举报失效/异常链接：无需登录，限流 5 次/小时/IP */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    resourceId?: number;
    linkId?: number | null;
    reason?: string;
    contact?: string;
  } | null;

  const resourceId = Number(body?.resourceId);
  const reason = String(body?.reason ?? "link-dead");
  const contact = String(body?.contact ?? "").trim().slice(0, 120);

  if (!Number.isFinite(resourceId) || resourceId <= 0) {
    return NextResponse.json({ ok: false, message: "参数不对" }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ ok: false, message: "举报类型不对" }, { status: 400 });
  }

  const rl = hit(clientKey(req, "report"), { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: `提交太频繁，请 ${Math.ceil(rl.retryAfterSec / 60)} 分钟后再试` },
      { status: 429 },
    );
  }

  const resource = get<{ id: number }>(
    "SELECT id FROM resources WHERE id = ? AND status = 'published'",
    resourceId,
  );
  if (!resource) {
    return NextResponse.json({ ok: false, message: "资源不存在" }, { status: 404 });
  }

  const linkId = Number(body?.linkId);
  const validLinkId = Number.isFinite(linkId) && linkId > 0 ? linkId : null;

  run(
    `INSERT INTO reports (resource_id, link_id, reason, contact, status, created_at)
     VALUES (?,?,?,?, 'open', unixepoch())`,
    resourceId,
    validLinkId,
    reason,
    contact || null,
  );

  // 同一条链接被举报满 3 次（且仍未处理）→ 自动标记失效，前台立刻降权
  let autoInvalidated = false;
  if (validLinkId) {
    const open = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM reports WHERE link_id = ? AND status = 'open'",
      validLinkId,
    )?.n ?? 0;

    if (open >= 3) {
      run(
        "UPDATE resource_links SET status = 'invalid', fail_count = MAX(fail_count, ?), checked_at = unixepoch() WHERE id = ?",
        open,
        validLinkId,
      );
      autoInvalidated = true;
    }
  }

  return NextResponse.json({ ok: true, autoInvalidated });
}
