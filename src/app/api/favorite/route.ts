import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { get, run } from "@/db/client";
import { getSessionUser } from "@/lib/auth";
import { FAV_COOKIE, readFavIds, serializeFavIds } from "@/lib/favorites";

export const runtime = "nodejs";

/** GET /api/favorite?id=25 → 当前是否已收藏（登录看表，游客看 cookie） */
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, favorited: false }, { status: 400 });
  }

  const user = await getSessionUser();

  if (user) {
    const had = get<{ resource_id: number }>(
      "SELECT resource_id FROM favorites WHERE user_id = ? AND resource_id = ?",
      user.id,
      id,
    );
    return NextResponse.json({ ok: true, favorited: Boolean(had), mode: "account" });
  }

  const ids = await readFavIds();
  return NextResponse.json({ ok: true, favorited: ids.includes(id), mode: "guest" });
}

/**
 * 切换收藏。
 * 已登录 → 写 favorites 表；未登录 → 写 cookie（游客也能收藏，登录后不自动合并）。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: number } | null;
  const id = Number(body?.id);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "参数不对" }, { status: 400 });
  }

  const exists =
    get<{ id: number }>("SELECT id FROM resources WHERE id = ? AND status = 'published'", id) !==
    null;
  if (!exists) {
    return NextResponse.json({ ok: false, message: "资源不存在" }, { status: 404 });
  }

  const user = await getSessionUser();

  if (user) {
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

    return NextResponse.json({ ok: true, favorited: !had, count, mode: "account" });
  }

  const current = await readFavIds();
  const has = current.includes(id);
  const next = has ? current.filter((x) => x !== id) : [...current, id];

  const store = await cookies();
  store.set(FAV_COOKIE, serializeFavIds(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, favorited: !has, count: next.length, mode: "guest" });
}
