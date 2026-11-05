/**
 * 检查并清理重复（资源 / 链接）
 *
 *   node scripts/check-dup.mjs            # 只看报告
 *   node scripts/check-dup.mjs --fix      # 顺手清理
 *
 * 会被判定为重复的情况：
 *   1. 同一分类里标题完全相同、且源站不同 → 只保留编号小的那条
 *   2. 同一个资源下链接重复（同 url_hash）→ 只留一条
 *   3. 同一个资源下有多条「源站」链接 → 只留一条
 */
import { DatabaseSync } from "node:sqlite";

const fix = process.argv.includes("--fix");
const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

/* 1. 同分类同标题 */
const dupTitles = db
  .prepare(
    `SELECT category_id, title, COUNT(*) n, GROUP_CONCAT(id) ids, GROUP_CONCAT(code) codes
       FROM resources WHERE status = 'published'
      GROUP BY category_id, title HAVING n > 1 ORDER BY n DESC`,
  )
  .all();

console.log(`\n同分类同标题：${dupTitles.length} 组`);
for (const d of dupTitles.slice(0, 10)) {
  console.log(`  ${d.title} ×${d.n}（${d.codes}）`);
}

/* 2. 重复链接 */
const dupLinks = db
  .prepare(
    `SELECT resource_id, url_hash, COUNT(*) n, GROUP_CONCAT(id) ids
       FROM resource_links GROUP BY resource_id, url_hash HAVING n > 1`,
  )
  .all();

/* 3. 多条源站 */
const multiSelf = db
  .prepare(
    `SELECT resource_id, COUNT(*) n, GROUP_CONCAT(id) ids
       FROM resource_links WHERE provider = 'self'
      GROUP BY resource_id HAVING n > 1`,
  )
  .all();

console.log(`\n重复链接：${dupLinks.length} 组 ｜ 多条源站：${multiSelf.length} 组`);

let removedResources = 0;
let removedLinks = 0;

if (fix) {
  db.exec("BEGIN");
  try {
    // 同标题只留最早的一条
    for (const d of dupTitles) {
      const ids = d.ids.split(",").map(Number).sort((a, b) => a - b);
      const keep = ids[0];
      for (const id of ids.slice(1)) {
        db.prepare("DELETE FROM resource_links WHERE resource_id = ?").run(id);
        db.prepare("DELETE FROM resource_tags WHERE resource_id = ?").run(id);
        db.prepare("DELETE FROM favorites WHERE resource_id = ?").run(id);
        db.prepare("DELETE FROM resources WHERE id = ?").run(id);
        removedResources++;
      }
      console.log(`  ✓ 保留 #${keep}，删除 ${ids.slice(1).join(",")}（${d.title}）`);
    }

    // 重复链接
    for (const d of dupLinks) {
      const ids = d.ids.split(",").map(Number).sort((a, b) => a - b);
      for (const id of ids.slice(1)) {
        db.prepare("DELETE FROM resource_links WHERE id = ?").run(id);
        removedLinks++;
      }
    }

    // 多条源站
    for (const d of multiSelf) {
      const ids = d.ids.split(",").map(Number).sort((a, b) => a - b);
      for (const id of ids.slice(1)) {
        db.prepare("DELETE FROM resource_links WHERE id = ?").run(id);
        removedLinks++;
      }
    }

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    console.error("清理失败：", e.message);
  }
}

/* 汇总 */
const cats = db.prepare("SELECT id, slug FROM categories").all();
console.log("\n各分类资源数：");
for (const c of cats) {
  const n = db.prepare("SELECT COUNT(*) n FROM resources WHERE category_id = ? AND status='published'").get(c.id).n;
  console.log(`  ${c.slug.padEnd(11)} ${n}`);
}

db.close();

if (fix) {
  console.log(`\n✓ 删除重复资源 ${removedResources} 条，重复链接 ${removedLinks} 条`);
} else {
  console.log("\n（只检查未修改，加 --fix 执行清理）");
}
