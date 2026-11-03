import { all, exec, run } from "../../db/client";
import type { ResourceCardData } from "@/components/resource/resource-card";
import type { LinkStatus } from "@/components/ui/status-dot";
import { toMatchExpr, tokenize, tokenizeToIndex } from "./tokenize";

/**
 * FTS5 索引层。两列分开存，才能让 bm25 给"标题命中"更高权重：
 *   title_tokens —— code + 标题 + 副标题 + 标签
 *   body_tokens  —— 摘要 + 正文
 *
 * 资源增删改后调用 reindexOne / reindexAll。查询侧无感。
 */

const TABLE = "resources_fts";

const CREATE_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS ${TABLE} USING fts5(
    title_tokens,
    body_tokens,
    resource_id UNINDEXED,
    tokenize = 'unicode61'
  )
`;

let ensured = false;

export function ensureFts(): boolean {
  if (ensured) return true;

  // 结构升级：老表只有 tokens 列，检测到就直接重建（内容由 reindexAll 补）
  const cols = all<{ name: string }>(`PRAGMA table_info(${TABLE})`);
  if (cols.length > 0 && !cols.some((c) => c.name === "title_tokens")) {
    exec(`DROP TABLE ${TABLE}`);
  }

  const ok = exec(CREATE_SQL);
  if (ok) ensured = true;
  return ok;
}

export function ftsCount(): number {
  if (!ensureFts()) return 0;
  return all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${TABLE}`)[0]?.n ?? 0;
}

type SourceRow = {
  id: number;
  code: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  contentMd: string | null;
  tags: string | null;
};

function tokensFor(r: SourceRow) {
  return {
    title: tokenizeToIndex([r.code, r.title, r.subtitle ?? "", r.tags ?? ""].join(" ")),
    body: tokenizeToIndex([r.summary ?? "", (r.contentMd ?? "").slice(0, 1200)].join(" ")),
  };
}

const SOURCE_SELECT = `
  SELECT r.id, r.code, r.title, r.subtitle, r.summary,
         substr(coalesce(r.content_md, ''), 1, 1200) AS contentMd,
         (SELECT group_concat(t.name, ' ')
            FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id
           WHERE rt.resource_id = r.id) AS tags
  FROM resources r
`;

export function reindexAll(): number {
  if (!ensureFts()) return 0;
  if (!exec(`DELETE FROM ${TABLE}`)) return 0;

  const rows = all<SourceRow>(
    `${SOURCE_SELECT} WHERE r.status = 'published'`,
  );

  for (const r of rows) {
    const { title, body } = tokensFor(r);
    run(
      `INSERT INTO ${TABLE} (title_tokens, body_tokens, resource_id) VALUES (?, ?, ?)`,
      title,
      body,
      r.id,
    );
  }

  return rows.length;
}

export function reindexOne(resourceId: number): void {
  if (!ensureFts()) return;
  run(`DELETE FROM ${TABLE} WHERE resource_id = ?`, resourceId);

  const r = all<SourceRow>(`${SOURCE_SELECT} WHERE r.id = ?`, resourceId)[0];
  if (!r) return;

  const { title, body } = tokensFor(r);
  run(
    `INSERT INTO ${TABLE} (title_tokens, body_tokens, resource_id) VALUES (?, ?, ?)`,
    title,
    body,
    resourceId,
  );
}

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
    updatedAt: r.updatedAt ? new Date(r.updatedAt * 1000) : null,
    isFeatured: Boolean(r.isFeatured),
    coverUrl: r.coverUrl,
    coverBlur: r.coverBlur,
  };
}

export function searchFts(
  q: string,
  opts: { categorySlug?: string; limit?: number } = {},
): ResourceCardData[] {
  if (!ensureFts()) return [];

  const expr = toMatchExpr(q);
  if (!expr) return [];

  const queryTokens = tokenize(q);

  const { categorySlug, limit = 40 } = opts;
  const where = [`${TABLE} MATCH ?`, "r.status = 'published'"];
  const params: (string | number)[] = [expr];

  if (categorySlug) {
    where.push("c.slug = ?");
    params.push(categorySlug);
  }
  params.push(limit);

  const rows = all<
    CardRow & { allTokens: string | null }
  >(
    `SELECT r.code, r.slug, r.title, r.subtitle, r.platforms,
            r.size_label AS sizeLabel, r.is_featured AS isFeatured,
            r.updated_at AS updatedAt, r.cover_url AS coverUrl, r.cover_blur AS coverBlur,
            c.name AS categoryName, l.provider, l.status AS linkStatus,
            (${TABLE}.title_tokens || ' ' || ${TABLE}.body_tokens) AS allTokens,
            bm25(${TABLE}, 8.0, 1.0) AS rank
     FROM ${TABLE}
     JOIN resources r ON r.id = ${TABLE}.resource_id
     JOIN categories c ON c.id = r.category_id
     LEFT JOIN resource_links l ON l.resource_id = r.id AND l.is_primary = 1
     WHERE ${where.join(" AND ")}
     ORDER BY rank ASC, r.download_count DESC
     LIMIT ?`,
    ...params,
  );

  // 覆盖度过滤：OR 召回会把只命中一个 2-gram 的无关结果带进来。
  // 查询词 ≥3 个 token 时，要求命中至少 1/3，否则丢弃。
  const tokens = queryTokens;
  const filtered =
    tokens.length >= 2
      ? rows.filter((r) => {
          const hay = ` ${r.allTokens ?? ""} `;
          const hit = tokens.filter((t) => hay.includes(` ${t} `)).length;
          return tokens.length < 3 ? hit > 0 : hit / tokens.length >= 1 / 3;
        })
      : rows;

  return filtered.map(toCard);
}
