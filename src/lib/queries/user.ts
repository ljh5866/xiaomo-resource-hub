import { all } from "@/db/client";

/**
 * 用户中心用的查询：收藏、投稿
 *
 * 注意：DB 里 platforms 存的是 JSON 字符串，ResourceCard 要的是 string[]，
 * 所以这里统一在查询层解析，避免页面再各写一遍。
 */
export type FavoriteCard = {
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  platforms: string[];
  sizeLabel: string | null;
  isFeatured: boolean;
  updatedAt: number;
  categoryName: string;
  provider: string | null;
  linkStatus: string | null;
  coverUrl: string | null;
  coverBlur: string | null;
};

type RawCard = Omit<FavoriteCard, "platforms" | "isFeatured"> & {
  platforms: string | null;
  isFeatured: number;
};

const CARD_SQL = `
  SELECT r.code, r.slug, r.title, r.subtitle, r.platforms,
         r.size_label AS sizeLabel, r.is_featured AS isFeatured,
         r.updated_at AS updatedAt, r.cover_url AS coverUrl, r.cover_blur AS coverBlur,
         c.name AS categoryName, l.provider, l.status AS linkStatus
  FROM resources r
  JOIN categories c ON c.id = r.category_id
  LEFT JOIN resource_links l ON l.resource_id = r.id AND l.is_primary = 1
`;

function parsePlatforms(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // 兼容早期用逗号分隔的数据
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

const toCard = (r: RawCard): FavoriteCard => ({
  ...r,
  platforms: parsePlatforms(r.platforms),
  isFeatured: Boolean(r.isFeatured),
});

/** 登录用户的收藏（只取已发布） */
export function listUserFavorites(userId: number, limit = 60): FavoriteCard[] {
  const rows = all<RawCard>(
    `${CARD_SQL}
     JOIN favorites f ON f.resource_id = r.id AND f.user_id = ?
     WHERE r.status = 'published'
     ORDER BY f.created_at DESC
     LIMIT ?`,
    userId,
    limit,
  );
  return rows.map(toCard);
}

/** 游客 cookie 收藏 */
export function listFavoritesByIds(ids: number[]): FavoriteCard[] {
  if (!ids.length) return [];
  const rows = all<RawCard>(
    `${CARD_SQL}
     WHERE r.id IN (${ids.map(() => "?").join(",")}) AND r.status = 'published'
     ORDER BY r.updated_at DESC`,
    ...ids,
  );
  return rows.map(toCard);
}

export type UserSubmission = {
  id: number;
  title: string;
  url: string;
  status: string;
  createdAt: number;
  note: string | null;
};

export function listUserSubmissions(userId: number, limit = 30): UserSubmission[] {
  return all<UserSubmission>(
    `SELECT id, title, url, status, created_at AS createdAt, note
     FROM submissions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    userId,
    limit,
  );
}
