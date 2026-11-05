import { all, get, ts } from "@/db/client";
import type { ResourceCardData } from "@/components/resource/resource-card";
import type { LinkStatus } from "@/components/ui/status-dot";

/* ------------------------------------------------------------------ */
/* 行类型                                                              */
/* ------------------------------------------------------------------ */

type CardRow = {
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  platforms: string | null;
  sizeLabel: string | null;
  isFeatured: number;
  updatedAt: number;
  categoryName: string | null;
  provider: string | null;
  linkStatus: string | null;
  coverUrl: string | null;
  coverBlur: string | null;
};

function toCard(r: CardRow): ResourceCardData {
  let platforms: string[] = [];
  try {
    platforms = JSON.parse(r.platforms ?? "[]") as string[];
  } catch {
    platforms = [];
  }

  return {
    code: r.code,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    categoryName: r.categoryName ?? undefined,
    platforms,
    sizeLabel: r.sizeLabel,
    provider: r.provider,
    status: (r.linkStatus as LinkStatus) ?? "unknown",
    updatedAt: ts(r.updatedAt),
    isFeatured: Boolean(r.isFeatured),
    coverUrl: r.coverUrl,
    coverBlur: r.coverBlur,
  };
}

const CARD_SELECT = `
  SELECT r.code, r.slug, r.title, r.subtitle, r.platforms,
         r.size_label AS sizeLabel, r.is_featured AS isFeatured,
         r.updated_at AS updatedAt, r.cover_url AS coverUrl, r.cover_blur AS coverBlur,
         c.name AS categoryName, l.provider, l.status AS linkStatus
  FROM resources r
  JOIN categories c ON c.id = r.category_id
  LEFT JOIN resource_links l ON l.resource_id = r.id AND l.is_primary = 1
`;

/* ------------------------------------------------------------------ */
/* 分类                                                                */
/* ------------------------------------------------------------------ */

export type CategoryView = {
  slug: string;
  name: string;
  icon: string;
  description: string | null;
  count: number;
};

export async function listCategories(): Promise<CategoryView[]> {
  return all<CategoryView>(`
    SELECT c.slug, c.name, c.icon, c.description,
           (SELECT COUNT(*) FROM resources r
             WHERE r.category_id = c.id AND r.status = 'published') AS count
    FROM categories c
    WHERE c.is_visible = 1
    ORDER BY c.sort_order ASC
  `);
}

/* ------------------------------------------------------------------ */
/* 资源列表                                                            */
/* ------------------------------------------------------------------ */

export async function listResources(
  opts: {
    categorySlug?: string;
    gameSlug?: string;
    genreSlug?: string;
    ghSlug?: string;
    hot?: boolean;
    featured?: boolean;
    excludeFeatured?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ResourceCardData[]> {
  const { categorySlug, gameSlug, genreSlug, ghSlug, hot, featured, excludeFeatured, limit = 12, offset = 0 } = opts;
  const where: string[] = ["r.status = 'published'"];
  const params: (string | number)[] = [];

  if (gameSlug) {
    where.push("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ?)");
    params.push(gameSlug);
  }
  if (genreSlug) {
    where.push("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ? AND t.kind = 'genre')");
    params.push(genreSlug);
  }
  if (ghSlug) {
    where.push("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ? AND t.kind = 'gh')");
    params.push(ghSlug);
  }
  if (hot) where.push("r.updated_at >= unixepoch() - 7 * 86400");

  if (categorySlug) {
    where.push("c.slug = ?");
    params.push(categorySlug);
  }
  if (featured) where.push("r.is_featured = 1");
  if (excludeFeatured) where.push("r.is_featured = 0");
  params.push(limit, offset);

  const rows = all<CardRow>(
    `${CARD_SELECT} WHERE ${where.join(" AND ")}
     ORDER BY r.is_featured DESC, r.published_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
  );

  return rows.map(toCard);
}

/** 列表页总数：给"加载更多"判断是否还有下一页 */
export async function countResources(
  opts: {
    categorySlug?: string;
    gameSlug?: string;
    genreSlug?: string;
    ghSlug?: string;
    hot?: boolean;
  } = {},
): Promise<number> {
  const { categorySlug, gameSlug, genreSlug, ghSlug, hot } = opts;
  const where = ["r.status = 'published'"];
  const params: string[] = [];

  if (categorySlug) {
    where.push("c.slug = ?");
    params.push(categorySlug);
  }
  if (gameSlug) {
    where.push("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ?)");
    params.push(gameSlug);
  }
  if (genreSlug) {
    where.push("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ? AND t.kind = 'genre')");
    params.push(genreSlug);
  }
  if (genreSlug) {
    where.push("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ? AND t.kind = 'genre')");
    params.push(genreSlug);
  }
  if (ghSlug) {
    where.push("EXISTS (SELECT 1 FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.resource_id = r.id AND t.slug = ? AND t.kind = 'gh')");
    params.push(ghSlug);
  }
  if (hot) where.push("r.updated_at >= unixepoch() - 7 * 86400");

  return (
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM resources r
       JOIN categories c ON c.id = r.category_id
       WHERE ${where.join(" AND ")}`,
      ...params,
    )?.n ?? 0
  );
}

export async function searchResources(
  q: string,
  opts: { categorySlug?: string; limit?: number } = {},
): Promise<ResourceCardData[]> {
  const term = q.trim();
  if (!term) return listResources({ limit: opts.limit, categorySlug: opts.categorySlug });

  const { categorySlug, limit = 40 } = opts;
  const needle = `%${term}%`;
  const where = [
    "r.status = 'published'",
    "(r.title LIKE ? OR r.subtitle LIKE ? OR r.summary LIKE ? OR r.code LIKE ?)",
  ];
  const params: (string | number)[] = [needle, needle, needle, needle];

  if (categorySlug) {
    where.push("c.slug = ?");
    params.push(categorySlug);
  }
  params.push(limit);

  const rows = all<CardRow>(
    `${CARD_SELECT} WHERE ${where.join(" AND ")}
     ORDER BY r.download_count DESC
     LIMIT ?`,
    ...params,
  );

  return rows.map(toCard);
}

/** 标签是否存在（用来决定 404，而不是渲染一个空标签页） */
export async function getTagBySlug(
  slug: string,
): Promise<{ slug: string; name: string; useCount: number } | null> {
  const row = get<{ slug: string; name: string; useCount: number }>(
    "SELECT slug, name, use_count AS useCount FROM tags WHERE slug = ? LIMIT 1",
    slug,
  );
  return row ?? null;
}

export async function listResourcesByTag(
  tagSlug: string,
  limit = 40,
): Promise<ResourceCardData[]> {
  const rows = all<CardRow>(
    `${CARD_SELECT}
     JOIN resource_tags rt ON rt.resource_id = r.id
     JOIN tags t ON t.id = rt.tag_id
     WHERE r.status = 'published' AND t.slug = ?
     ORDER BY r.published_at DESC
     LIMIT ?`,
    tagSlug,
    limit,
  );

  return rows.map(toCard);
}

/* ------------------------------------------------------------------ */
/* 详情                                                                */
/* ------------------------------------------------------------------ */

export type ResourceDetail = {
  id: number;
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  contentMd: string | null;
  kind: string;
  platforms: string;
  version: string | null;
  sizeLabel: string | null;
  language: string | null;
  licenseLabel: string | null;
  downloadCount: number;
  viewCount: number;
  seoTitle: string | null;
  seoDesc: string | null;
  coverUrl: string | null;
  coverBlur: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  verifiedAt: Date | null;
};

export type LinkDetail = {
  id: number;
  provider: string;
  url: string;
  extractCode: string | null;
  label: string | null;
  status: string;
  isPrimary: number;
  clickCount: number;
};

export async function getResourceBySlug(slug: string) {
  const row = get<Omit<ResourceDetail, "updatedAt" | "verifiedAt"> & {
    updatedAt: number;
    verifiedAt: number | null;
  }>(
    `SELECT id, code, slug, title, subtitle, summary, content_md AS contentMd,
            kind, platforms, version, size_label AS sizeLabel, language,
            license_label AS licenseLabel, download_count AS downloadCount,
            view_count AS viewCount, seo_title AS seoTitle, seo_desc AS seoDesc,
            cover_url AS coverUrl, cover_blur AS coverBlur, published_at AS publishedAt,
            updated_at AS updatedAt, verified_at AS verifiedAt
     FROM resources
     WHERE slug = ? AND status = 'published'
     LIMIT 1`,
    slug,
  );

  if (!row) return null;

  const resource: ResourceDetail = {
    ...row,
    updatedAt: ts(row.updatedAt),
    publishedAt: ts(row.publishedAt ?? null),
    verifiedAt: ts(row.verifiedAt),
  };

  const category = get<{ slug: string; name: string }>(
    `SELECT c.slug, c.name FROM categories c
     JOIN resources r ON r.category_id = c.id WHERE r.id = ?`,
    resource.id,
  ) ?? { slug: "all", name: "全部" };

  const links = all<LinkDetail>(
    `SELECT id, provider, url, extract_code AS extractCode, label,
            status, is_primary AS isPrimary, click_count AS clickCount
     FROM resource_links WHERE resource_id = ?
     ORDER BY is_primary DESC, sort_order ASC`,
    resource.id,
  );

  const tags = all<{ slug: string; name: string; kind: string }>(
    `SELECT t.slug, t.name, t.kind FROM tags t
     JOIN resource_tags rt ON rt.tag_id = t.id
     WHERE rt.resource_id = ?
     ORDER BY (t.kind = 'game') DESC, t.use_count DESC`,
    resource.id,
  );

  // 游戏标签单独拎出来，详情页顶部展示
  const gameTag = tags.find((t) => t.kind === "game") ?? null;

  return { resource, category, links, tags, gameTag };
}

export async function listTags(limit = 24) {
  return all<{ slug: string; name: string; useCount: number }>(
    `SELECT slug, name, use_count AS useCount FROM tags
     WHERE use_count > 0 ORDER BY use_count DESC LIMIT ?`,
    limit,
  );
}

/* ------------------------------------------------------------------ */
/* 站点统计（信任条）                                                   */
/* ------------------------------------------------------------------ */

export type SiteStats = { total: number; deadRate: number; updatedThisWeek: number };

export async function getSiteStats(): Promise<SiteStats> {
  const total =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM resources WHERE status = 'published'`,
    )?.n ?? 0;

  const links =
    get<{ n: number }>(`SELECT COUNT(*) AS n FROM resource_links`)?.n ?? 0;

  const dead =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM resource_links WHERE status = 'invalid'`,
    )?.n ?? 0;

  const fresh =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM resources
       WHERE status = 'published' AND updated_at >= unixepoch() - 7 * 86400`,
    )?.n ?? 0;

  return {
    total,
    deadRate: links ? Math.round((dead / links) * 1000) / 10 : 0,
    updatedThisWeek: fresh,
  };
}

export async function listAdminRows(limit = 50) {
  const rows = all<{
    id: number;
    code: string;
    slug: string;
    title: string;
    status: string;
    updatedAt: number;
    downloadCount: number;
    categoryName: string;
    linkStatus: string | null;
  }>(
    `SELECT r.id, r.code, r.slug, r.title, r.status,
            r.updated_at AS updatedAt, r.download_count AS downloadCount,
            c.name AS categoryName, l.status AS linkStatus
     FROM resources r
     JOIN categories c ON c.id = r.category_id
     LEFT JOIN resource_links l ON l.resource_id = r.id AND l.is_primary = 1
     ORDER BY r.updated_at DESC
     LIMIT ?`,
    limit,
  );

  return rows.map((r) => ({ ...r, updatedAt: ts(r.updatedAt) }));
}

/** 某个分类下出现过的指定类型标签（game/genre），给分类页筛选条用 */
export async function listTagsByKind(kind: string, categorySlug?: string) {
  const params: string[] = [kind];
  let where = "t.kind = ? AND r.status = 'published'";
  if (categorySlug) {
    where += " AND c.slug = ?";
    params.push(categorySlug);
  }
  return all<{ slug: string; name: string; count: number }>(
    `SELECT t.slug, t.name, COUNT(DISTINCT r.id) AS count
     FROM tags t
     JOIN resource_tags rt ON rt.tag_id = t.id
     JOIN resources r ON r.id = rt.resource_id
     JOIN categories c ON c.id = r.category_id
     WHERE ${where}
     GROUP BY t.id
     ORDER BY count DESC, t.id`,
    ...params,
  );
}

/** 某个分类下出现过的游戏标签（kind='game'），给分类页筛选条用 */
export async function listGameTags(categorySlug?: string): Promise<{ slug: string; name: string; count: number }[]> {
  const params: string[] = [];
  let where = "t.kind = 'game' AND r.status = 'published'";
  if (categorySlug) {
    where += " AND c.slug = ?";
    params.push(categorySlug);
  }
  return all<{ slug: string; name: string; count: number }>(
    `SELECT t.slug, t.name, COUNT(DISTINCT r.id) AS count
     FROM tags t
     JOIN resource_tags rt ON rt.tag_id = t.id
     JOIN resources r ON r.id = rt.resource_id
     JOIN categories c ON c.id = r.category_id
     WHERE ${where}
     GROUP BY t.id
     ORDER BY count DESC`,
    ...params,
  );
}
/** 某类标签全量（含 0 条资源的），给「类型」这种固定入口用 */
export async function listTagsOfKind(kind: string): Promise<{ slug: string; name: string; count: number }[]> {
  return all<{ slug: string; name: string; count: number }>(
    `SELECT t.slug, t.name, COUNT(rt.resource_id) AS count
       FROM tags t
       LEFT JOIN resource_tags rt ON rt.tag_id = t.id
      WHERE t.kind = ?
      GROUP BY t.id
      ORDER BY t.id`,
    kind,
  );
}
/**
 * 本周热门开源项目：最近 7 天 star 增长最多的资源。
 *
 * 数据来自 repo_stars 每日快照（脚本 sync-github-stars.mjs 写入）。
 * 快照不足两条时无法算增量，退化为按仓库当前 star 总量排序，
 * 保证「本周热门」第一天也有内容，不会空白。
 */
export async function listWeeklyHotRepos(limit = 24): Promise<ResourceCardData[]> {
  const hot = all<CardRow>(
    `${CARD_SELECT}
     JOIN (
       SELECT resource_id,
              MAX(stars) - MIN(stars) AS gained,
              MAX(stars) AS current
         FROM repo_stars
        WHERE day >= date('now', '-7 day')
        GROUP BY resource_id
     ) s ON s.resource_id = r.id
     WHERE r.status = 'published' AND s.gained > 0
     ORDER BY s.gained DESC, s.current DESC
     LIMIT ?`,
    limit,
  );

  if (hot.length) return hot.map(toCard);

  // 兜底：还没有一周的数据，先按 star 总量取最热的
  const fallback = all<CardRow>(
    `${CARD_SELECT}
     JOIN (
       SELECT resource_id, MAX(stars) AS current
         FROM repo_stars
        GROUP BY resource_id
     ) s ON s.resource_id = r.id
     WHERE r.status = 'published'
     ORDER BY s.current DESC
     LIMIT ?`,
    limit,
  );
  return fallback.map(toCard);
}
/**
 * 本周热门（独立视图）：GitHub 官方 Trending 周榜。
 *
 * 读 trending_repos（sync-github-trending.mjs 每天写入），
 * 如果站内已收录同仓库项目，则带上 slug，卡片可以直接点进详情页。
 */
export async function listTrendingRepos(limit = 30) {
  return all<{
    rank: number;
    fullName: string;
    url: string;
    starsWeek: number | null;
    starsTotal: number | null;
    language: string | null;
    description: string | null;
    slug: string | null;
  }>(
    `SELECT t.rank, t.full_name AS fullName, t.url,
            t.stars_week AS starsWeek, t.stars_total AS starsTotal,
            t.language, t.description, r.slug
       FROM trending_repos t
       LEFT JOIN resources r ON r.source_url = t.url AND r.status = 'published'
      WHERE t.day = (SELECT MAX(day) FROM trending_repos)
      ORDER BY t.rank
      LIMIT ?`,
    limit,
  );
}