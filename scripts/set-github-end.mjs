/**
 * 整理「GitHub 开源项目」的端标签
 *
 *   node scripts/set-github-end.mjs --dry
 *   node scripts/set-github-end.mjs
 *
 * 做两件事：
 *   1. 没有端标签的项目 → 挂「工具库」（库、清单、教程、网页服务都归这里）
 *   2. 挂了多个端标签的项目 → 只保留优先级最高的一个（安卓 > iOS > 桌面 > 工具库）
 *
 * 这样分类页每个 chip 的数字加起来正好等于总数，不会出现 3+1+12 ≠ 80。
 */
import { DatabaseSync } from "node:sqlite";

const dry = process.argv.includes("--dry");
const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const PRIORITY = ["android-app", "ios-app", "desktop-app", "tool-lib"];

const cat = db.prepare("SELECT id FROM categories WHERE slug = 'opensource'").get();
if (!cat) {
  console.error("找不到 opensource 分类");
  process.exit(1);
}

const tag = (slug) => db.prepare("SELECT id FROM tags WHERE slug = ?").get(slug)?.id;

for (const slug of PRIORITY) {
  if (!tag(slug)) {
    console.error(`缺少标签 ${slug}，先跑：node node_modules/tsx/dist/cli.mjs src/scripts/seed-taxonomy.ts`);
    process.exit(1);
  }
}

const rows = db
  .prepare(
    `SELECT r.id, r.title, GROUP_CONCAT(t.slug) AS slugs
       FROM resources r
       LEFT JOIN resource_tags rt ON rt.resource_id = r.id
       LEFT JOIN tags t ON t.id = rt.tag_id AND t.kind = 'gh'
      WHERE r.category_id = ? AND r.status = 'published'
      GROUP BY r.id`,
  )
  .all(cat.id);

let added = 0;
let deduped = 0;

for (const r of rows) {
  const current = (r.slugs ?? "").split(",").filter(Boolean);

  if (!current.length) {
    if (!dry) {
      db.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)").run(
        r.id,
        tag("tool-lib"),
      );
    }
    added++;
    continue;
  }

  if (current.length > 1) {
    const keep = PRIORITY.find((p) => current.includes(p));
    for (const slug of current) {
      if (slug === keep) continue;
      if (!dry) {
        db.prepare(
          "DELETE FROM resource_tags WHERE resource_id = ? AND tag_id = (SELECT id FROM tags WHERE slug = ?)",
        ).run(r.id, slug);
      }
    }
    deduped++;
  }
}

const dist = db
  .prepare(
    `SELECT t.slug, t.name, COUNT(*) AS n
       FROM resource_tags rt
       JOIN tags t ON t.id = rt.tag_id AND t.kind = 'gh'
       JOIN resources r ON r.id = rt.resource_id AND r.category_id = ?
      GROUP BY t.id
      ORDER BY n DESC`,
  )
  .all(cat.id);

db.close();

console.log(`\n${dry ? "（预演）" : ""}补「工具库」${added} 条 · 去重 ${deduped} 条`);
console.log("当前分布：");
for (const d of dist) console.log(`  ${d.name} ${d.n}`);
const total = dist.reduce((a, b) => a + b.n, 0);
console.log(`  合计 ${total}`);
