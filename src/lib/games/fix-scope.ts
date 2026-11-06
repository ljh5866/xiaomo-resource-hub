import { get, run } from "@/db/client";
import { TAG_KIND_HOME } from "@/lib/taxonomy";
import { refreshTagCounts } from "@/lib/games/bulk";

/**
 * 清理跨分类的标签关联。
 *
 * 历史事故：后台批量设置游戏时没限定分类，821 条资源（galgame、开源项目都在内）
 * 全被挂上「我的世界」。这里按标签域规则把越界关联删掉，并重算 use_count。
 */
export function fixTagScope(): { deleted: number; detail: { kind: string; n: number }[] } {
  const detail: { kind: string; n: number }[] = [];
  let deleted = 0;

  for (const [kind, home] of Object.entries(TAG_KIND_HOME)) {
    const row = get<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM resource_tags rt
         JOIN tags t ON t.id = rt.tag_id
         JOIN resources r ON r.id = rt.resource_id
         JOIN categories c ON c.id = r.category_id
        WHERE t.kind = ? AND c.slug <> ?`,
      kind,
      home,
    );
    const n = row?.n ?? 0;
    if (n === 0) continue;

    run(
      `DELETE FROM resource_tags
        WHERE tag_id IN (SELECT id FROM tags WHERE kind = ?)
          AND resource_id IN (
            SELECT r.id FROM resources r JOIN categories c ON c.id = r.category_id WHERE c.slug <> ?
          )`,
      kind,
      home,
    );
    detail.push({ kind, n });
    deleted += n;
  }

  if (deleted > 0) refreshTagCounts();
  return { deleted, detail };
}

/** 统计当前有多少越界关联（后台入口提示用） */
export function countOutOfScope(): number {
  let total = 0;
  for (const [kind, home] of Object.entries(TAG_KIND_HOME)) {
    const row = get<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM resource_tags rt
         JOIN tags t ON t.id = rt.tag_id
         JOIN resources r ON r.id = rt.resource_id
         JOIN categories c ON c.id = r.category_id
        WHERE t.kind = ? AND c.slug <> ?`,
      kind,
      home,
    );
    total += row?.n ?? 0;
  }
  return total;
}
