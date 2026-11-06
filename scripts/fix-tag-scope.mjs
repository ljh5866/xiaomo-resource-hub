/**
 * 清理「跨分类」的标签关联，并重算 use_count。
 *
 *   node --import tsx scripts/fix-tag-scope.mjs --dry
 *   node --import tsx scripts/fix-tag-scope.mjs
 *
 * 背景：后台批量设置游戏时没有限定分类，导致 821 条资源（含 galgame、开源项目）
 * 全被挂上「我的世界」。本脚本按标签域规则清掉越界关联：
 *   game 只能挂在 mods 分类；genre 只能挂在 games；gh 只能挂在 opensource。
 */
import { DatabaseSync } from "node:sqlite";

const dry = process.argv.includes("--dry");
const db = new DatabaseSync(process.env.DATABASE_URL ?? "./data/app.db");

const SCOPE = {
  game: "mods",
  genre: "games",
  gh: "opensource",
};

let totalDeleted = 0;

for (const [kind, home] of Object.entries(SCOPE)) {
  const rows = db
    .prepare(
      `SELECT rt.resource_id, rt.tag_id, t.name AS tag, r.title, c.slug AS category
         FROM resource_tags rt
         JOIN tags t ON t.id = rt.tag_id
         JOIN resources r ON r.id = rt.resource_id
         JOIN categories c ON c.id = r.category_id
        WHERE t.kind = ? AND c.slug <> ?
        ORDER BY r.id`,
    )
    .all(kind, home);

  const byCategory = {};
  for (const r of rows) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;

  console.log(
    `[${kind}] 越界关联 ${rows.length} 条` +
      (rows.length ? `（${Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join(" · ")}）` : ""),
  );
  if (rows.length && rows.length <= 10) {
    for (const r of rows.slice(0, 10)) console.log(`    ${r.title} → ${r.tag}`);
  }

  if (!dry && rows.length) {
    const del = db.prepare(
      `DELETE FROM resource_tags
        WHERE tag_id IN (SELECT id FROM tags WHERE kind = ?)
          AND resource_id IN (
            SELECT r.id FROM resources r JOIN categories c ON c.id = r.category_id WHERE c.slug <> ?
          )`,
    );
    del.run(kind, home);
    totalDeleted += rows.length;
  }
}

if (!dry) {
  db.prepare(
    `UPDATE tags SET use_count = (SELECT COUNT(*) FROM resource_tags rt WHERE rt.tag_id = tags.id)`,
  ).run();
  const dist = db
    .prepare(
      `SELECT t.kind, t.slug, t.use_count AS n FROM tags t WHERE t.use_count > 0 ORDER BY t.kind, n DESC`,
    )
    .all();
  console.log(`\n删除 ${totalDeleted} 条越界关联`);
  console.log("当前有效标签：");
  for (const d of dist) console.log(`  [${d.kind}] ${d.slug} = ${d.n}`);
} else {
  console.log("\n[dry-run] 未写入");
}
