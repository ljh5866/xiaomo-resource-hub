import { all, get, run } from "@/db/client";
import { desktopUser, unauthorized } from "@/lib/desktop/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 桌面端收藏：与网站**同一张表**。
 * 网页收藏的东西桌面端能看到，桌面端收藏的网页也立刻能看到。
 *
 * GET  /api/desktop/favorites        → 收藏列表
 * POST /api/desktop/favorites { id } → 切换收藏
 */

type FavRow = {
  id: number;
  code: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  category: string | null;
  created_at: number;
};

export function GET(req: Request) {
  const user = desktopUser(req);
  if (!user) return unauthorized();

  const items = all<FavRow>(
    `SELECT r.id, r.code, r.slug, r.title, r.summary, r.cover_url,
            c.slug AS category, f.created_at
       FROM favorites f
       JOIN resources r ON r.id = f.resource_id
       LEFT JOIN categories c ON c.id = r.category_id
      WHERE f.user_id = ? AND r.status = 'published'
      ORDER BY f.created_at DESC
      LIMIT 300`,
    user.id,
  );

  return Response.json({ ok: true, total: items.length, items });
}

export async function POST(req: Request) {
  const user = desktopUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as { id?: number } | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ ok: false, message: "参数不对" }, { status: 400 });
  }

  const exists = get<{ id: number }>(
    "SELECT id FROM resources WHERE id = ? AND status = 'published'",
    id,
  );
  if (!exists) return Response.json({ ok: false, message: "资源不存在" }, { status: 404 });

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

  const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?", user.id)?.n ?? 0;
  return Response.json({ ok: true, favorited: !had, count });
}
