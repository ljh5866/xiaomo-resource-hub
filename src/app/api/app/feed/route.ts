import { all, get } from "@/db/client";
import { providerOf } from "@/lib/constants";
import { corsOptions } from "@/lib/app-cors";

/**
 * GET /api/app/feed?category=&kind=&page=&q=&limit=
 *
 * 桌面端专用只读接口。桌面端不内嵌数据库，所有内容都从这里取，
 * 这样网站发什么，桌面端就显示什么（"互通"的最小实现）。
 *
 * 返回结构刻意保持轻量：列表只给卡片需要的字段，详情单独取，
 * 免得一次拉几百 KB。
 */
const PAGE = 20;

type Row = {
  id: number;
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  coverUrl: string | null;
  categorySlug: string;
  categoryName: string;
  updatedAt: number;
  provider: string | null;
  sizeLabel: string | null;
  version: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? "";
  const kind = url.searchParams.get("kind") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") ?? PAGE) || PAGE));

  const where: string[] = ["r.status = 'published'"];
  const params: (string | number)[] = [];

  if (category) {
    where.push("c.slug = ?");
    params.push(category);
  }
  if (kind) {
    // 标签筛选：桌面端传标签 slug（如 xtgj / minecraft / galgame）
    where.push(
      "EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ?)",
    );
    params.push(kind);
  }
  if (q) {
    where.push("(r.title LIKE ? OR r.summary LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = where.join(" AND ");

  const rows = all<Row>(
    `SELECT r.id, r.code, r.slug, r.title, r.subtitle, r.summary, r.cover_url AS coverUrl,
            c.slug AS categorySlug, c.name AS categoryName, r.updated_at AS updatedAt,
            r.size_label AS sizeLabel, r.version,
            (SELECT l.provider FROM resource_links l
              WHERE l.resource_id = r.id AND l.is_primary = 1 LIMIT 1) AS provider
       FROM resources r JOIN categories c ON c.id = r.category_id
      WHERE ${whereSql}
      ORDER BY r.published_at DESC, r.id DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );

  const total = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM resources r JOIN categories c ON c.id = r.category_id WHERE ${whereSql}`,
    ...params,
  )?.n ?? 0;

  return Response.json({
    ok: true,
    page,
    limit,
    total,
    hasMore: page * limit < total,
    items: rows.map((r) => ({
      id: r.id,
      code: r.code,
      slug: r.slug,
      title: r.title,
      subtitle: r.subtitle,
      summary: r.summary,
      cover: r.coverUrl,
      category: r.categorySlug,
      categoryName: r.categoryName,
      provider: r.provider,
      providerName: r.provider ? providerOf(r.provider).name : null,
      size: r.sizeLabel,
      version: r.version,
      updatedAt: r.updatedAt,
    })),
  });
}

export const OPTIONS = corsOptions;
