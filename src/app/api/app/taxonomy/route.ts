import { all } from "@/db/client";
import { corsOptions } from "@/lib/app-cors";

/**
 * GET /api/app/taxonomy
 *
 * 桌面端启动时拉一次：分类 + 每个分类的筛选标签。
 * 一起返回能省掉首屏的多次往返。
 */
export async function GET() {
  const categories = all<{
    slug: string;
    name: string;
    description: string | null;
    count: number;
  }>(
    `SELECT c.slug, c.name, c.description,
            (SELECT COUNT(*) FROM resources r WHERE r.category_id = c.id AND r.status = 'published') AS count
       FROM categories c
      WHERE c.is_visible = 1
      ORDER BY c.sort_order`,
  );

  const tags = all<{ slug: string; name: string; kind: string; category: string | null; count: number }>(
    `SELECT t.slug, t.name, t.kind,
            (SELECT c.slug FROM categories c
              WHERE (t.kind = 'game' AND c.slug = 'mods')
                 OR (t.kind = 'genre' AND c.slug = 'games')
                 OR (t.kind = 'gh' AND c.slug = 'opensource')
                 OR (t.kind = 'soft' AND c.slug = 'software')
              LIMIT 1) AS category,
            (SELECT COUNT(*) FROM resource_tags rt JOIN resources r ON r.id = rt.resource_id
              WHERE rt.tag_id = t.id AND r.status = 'published') AS count
       FROM tags t
      WHERE t.kind IN ('game','genre','gh','soft')
      ORDER BY count DESC`,
  );

  return Response.json({
    ok: true,
    categories: categories.map((c) => ({ ...c })),
    tags: tags.filter((t) => t.count > 0),
  });
}

export const OPTIONS = corsOptions;
