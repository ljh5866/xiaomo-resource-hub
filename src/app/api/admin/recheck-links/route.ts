import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { checkLinks } from "@/lib/link-check";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 一键复测：只测「待校验 / 失效」的链接，默认 20 条，避免一次请求跑太久 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "需要管理员登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { limit?: number } | null;
  const limit = Math.min(Math.max(1, Number(body?.limit ?? 20) || 20), 50);

  const summary = await checkLinks({
    limit,
    statuses: ["unknown", "invalid"],
  });

  return NextResponse.json({
    ok: true,
    candidates: summary.candidates,
    checked: summary.checked,
    skipped: summary.skipped,
    okCount: summary.ok,
    invalid: summary.invalid,
    unknown: summary.unknown,
  });
}
