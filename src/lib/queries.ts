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
    featured?: boolean;
    excludeFeatured?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ResourceCardData[]> {
  const { categorySlug, featured, excludeFeatured, limit = 12, offset = 0 } = opts;
  const where: string[] = ["r.status = 'published'"];
  const params: (string | number)[] = [];

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
  opts: { categorySlug?: string } = {},
): Promise<number> {
  const { categorySlug } = opts;
  const where = ["r.status = 'published'"];
  const params: string[] = [];

  if (categorySlug) {
    where.push("c.slug = ?");
    params.push(categorySlug);
  }

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

  const tags = all<{ slug: string; name: string }>(
    `SELECT t.slug, t.name FROM tags t
     JOIN resource_tags rt ON rt.tag_id = t.id
     WHERE rt.resource_id = ?`,
    resource.id,
  );

  return { resource, category, links, tags };
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
