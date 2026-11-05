import { NextResponse } from "next/server";
import { get, run } from "@/db/client";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * 收藏：只对登录用户开放。
 * 游客调用返回 401，前端收到后跳 /login?next=当前资源页。
 */

/** GET /api/favorite?id=25 → 是否已收藏 */
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, favorited: false }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, favorited: false, needLogin: true }, { status: 401 });
  }

  const had = get<{ resource_id: number }>(
    "SELECT resource_id FROM favorites WHERE user_id = ? AND resource_id = ?",
    user.id,
    id,
  );

  return NextResponse.json({ ok: true, favorited: Boolean(had) });
}

/** POST /api/favorite { id } → 切换收藏 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: number } | null;
  const id = Number(body?.id);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "参数不对" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, needLogin: true, message: "登录后才能收藏" }, { status: 401 });
  }

  const exists =
    get<{ id: number }>("SELECT id FROM resources WHERE id = ? AND status = 'published'", id) !== null;
  if (!exists) {
    return NextResponse.json({ ok: false, message: "资源不存在" }, { status: 404 });
  }

  const had = get<{ resource_id: number }>(
    "SELECT resource_id FROM favorites WHERE user_id = ? AND resource_id = ?",
    user.id,
    id,
  );

  if (had) {
    run("DELETE FROM favorites WHERE user_id = ? AND resource_id = ?", user.id, id);
  } else {
    run(
      "INSERT OR IGNORE INTO favorites (user_id, resource_id, created_at) VALUES (?,?,unixepoch())",
      user.id,
      id,
    );
  }

  const count =
    get<{ n: number }>("SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?", user.id)?.n ?? 0;

  return NextResponse.json({ ok: true, favorited: !had, count });
}
