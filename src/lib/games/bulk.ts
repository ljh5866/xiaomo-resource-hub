import { all, get, run } from "@/db/client";

/**
 * 批量设置「所属游戏」。
 *
 * 规则：一个资源只认一个游戏标签 —— 设置新游戏时，会先删掉它身上其它 kind='game' 的标签，
 * 再挂上目标游戏。这样分类页的筛选计数才不会重复。
 */

export type GameScope =
  | { kind: "all" }
  | { kind: "unassigned" }
  | { kind: "category"; slug: string }
  | { kind: "game"; slug: string }
  | { kind: "ids"; ids: number[] };

export type BulkPreview = {
  gameTagId: number;
  gameName: string;
  total: number;
  willChange: number;
  sample: { id: number; code: string; title: string; current: string | null }[];
};

function scopeWhere(scope: GameScope): { sql: string; params: (string | number)[] } {
  switch (scope.kind) {
    case "all":
      return { sql: "1=1", params: [] };
    case "unassigned":
      return {
        sql: `NOT EXISTS (SELECT 1 FROM resource_tags rt2 JOIN tags t2 ON t2.id = rt2.tag_id
                          WHERE rt2.resource_id = r.id AND t2.kind = 'game')`,
        params: [],
      };
    case "category":
      return { sql: "c.slug = ?", params: [scope.slug] };
    case "game":
      return {
        sql: `EXISTS (SELECT 1 FROM resource_tags rt3 JOIN tags t3 ON t3.id = rt3.tag_id
                        WHERE rt3.resource_id = r.id AND t3.slug = ?)`,
        params: [scope.slug],
      };
    case "ids":
      return {
        sql: `r.id IN (${scope.ids.length ? scope.ids.map(() => "?").join(",") : "0"})`,
        params: scope.ids,
      };
  }
}

/** 预览：会动多少条、前 8 条长什么样 */
export function previewBulkGame(gameSlug: string, scope: GameScope): BulkPreview | null {
  const game = get<{ id: number; name: string }>(
    "SELECT id, name FROM tags WHERE slug = ? AND kind = 'game'",
    gameSlug,
  );
  if (!game) return null;

  const { sql, params } = scopeWhere(scope);

  const rows = all<{ id: number; code: string; title: string; current: string | null }>(
    `SELECT r.id, r.code, r.title,
            (SELECT GROUP_CONCAT(t.name, '、')
               FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id
              WHERE rt.resource_id = r.id AND t.kind = 'game') AS current
       FROM resources r
       JOIN categories c ON c.id = r.category_id
      WHERE r.status = 'published' AND ${sql}
      ORDER BY r.id`,
    ...params,
  );

  const willChange = rows.filter((r) => r.current !== game.name).length;

  return {
    gameTagId: game.id,
    gameName: game.name,
    total: rows.length,
    willChange,
    sample: rows.slice(0, 8),
  };
}

/** 执行：把范围内资源的游戏标签统一换成 gameSlug */
export function applyBulkGame(
  gameSlug: string,
  scope: GameScope,
): { ok: true; updated: number; gameName: string } | { ok: false; message: string } {
  const preview = previewBulkGame(gameSlug, scope);
  if (!preview) return { ok: false, message: "游戏标签不存在（或不是 game 类型）" };

  const { sql, params } = scopeWhere(scope);
  const ids = all<{ id: number }>(
    `SELECT r.id FROM resources r JOIN categories c ON c.id = r.category_id
      WHERE r.status = 'published' AND ${sql}`,
    ...params,
  ).map((r) => r.id);

  if (!ids.length) return { ok: true, updated: 0, gameName: preview.gameName };

  const inClause = ids.map(() => "?").join(",");
  run(
    `DELETE FROM resource_tags
      WHERE tag_id IN (SELECT id FROM tags WHERE kind = 'game')
        AND resource_id IN (${inClause})`,
    ...ids,
  );

  for (const id of ids) {
    run(
      "INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?, ?)",
      id,
      preview.gameTagId,
    );
  }

  refreshTagCounts();
  return { ok: true, updated: ids.length, gameName: preview.gameName };
}

/** 标签的 use_count 是列表排序用的，批量改完顺手重算 */
export function refreshTagCounts() {
  run(
    `UPDATE tags SET use_count = (
       SELECT COUNT(*) FROM resource_tags rt WHERE rt.tag_id = tags.id
     )`,
  );
}

/** 每个游戏当前的资源数（后台列表用） */
export function gameCounts(): { slug: string; name: string; count: number }[] {
  return all<{ slug: string; name: string; count: number }>(
    `SELECT t.slug, t.name, COUNT(rt.resource_id) AS count
       FROM tags t
       LEFT JOIN resource_tags rt ON rt.tag_id = t.id
      WHERE t.kind = 'game'
      GROUP BY t.id
      ORDER BY count DESC, t.id`,
  );
}
