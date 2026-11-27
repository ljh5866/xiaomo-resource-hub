import { all, get } from "@/db/client";
import { getAppUser, unauthorized } from "@/lib/app-auth";
import { corsOptions } from "@/lib/app-cors";

/**
 * GET /api/app/me —— 桌面端拉当前用户 + 收藏 + 投稿统计
 * 没有收藏数据时也返回空数组，前端不用判空。
 */
export async function GET(req: Request) {
  const user = getAppUser(req);
  if (!user) return unauthorized();

  const favorites = all<{
    id: number;
    slug: string;
    title: string;
    cover: string | null;
    category: string;
    categoryName: string;
    createdAt: number;
  }>(
    `SELECT r.id, r.slug, r.title, r.cover_url AS cover,
            c.slug AS category, c.name AS categoryName, f.created_at AS createdAt
       FROM favorites f
       JOIN resources r ON r.id = f.resource_id
       JOIN categories c ON c.id = r.category_id
      WHERE f.user_id = ? AND r.status = 'published'
      ORDER BY f.created_at DESC`,
    user.id,
  );

  const submissions = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM submissions WHERE user_id = ?",
    user.id,
  )?.n ?? 0;

  return Response.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    favorites: favorites.map((f) => ({ ...f })),
    stats: { favorites: favorites.length, submissions },
  });
}

export const OPTIONS = corsOptions;
