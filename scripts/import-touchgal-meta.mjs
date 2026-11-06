/**
 * 把 fetch-touchgal-detail.mjs 导出的补丁文件写进库（纯 Node，服务器上可直接跑）。
 *
 *   node scripts/import-touchgal-meta.mjs data/import/touchgal-meta.json --dry
 *   node scripts/import-touchgal-meta.mjs data/import/touchgal-meta.json
 *
 * 幂等：按 slug 覆盖 meta_json / summary / content_md，未知 slug 跳过。
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file) {
  console.error("用法: node scripts/import-touchgal-meta.mjs <patch.json> [--dry]");
  process.exit(1);
}

const patch = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(patch) || patch.length === 0) {
  console.error("补丁文件为空");
  process.exit(1);
}

const db = new DatabaseSync(process.env.DATABASE_URL ?? "./data/app.db");
const upd = db.prepare(
  `UPDATE resources SET meta_json = ?, summary = ?, content_md = ? WHERE slug = ?`,
);
const exists = db.prepare(`SELECT 1 AS ok FROM resources WHERE slug = ?`);

let ok = 0;
let skip = 0;
for (const row of patch) {
  if (!row?.slug) {
    skip += 1;
    continue;
  }
  if (!exists.get(row.slug)) {
    skip += 1;
    continue;
  }
  if (!dry) {
    upd.run(
      row.meta ? JSON.stringify(row.meta) : null,
      row.summary ?? null,
      row.contentMd ?? null,
      row.slug,
    );
  }
  ok += 1;
}

console.log(`${dry ? "[dry-run] " : ""}更新 ${ok} 条 · 跳过 ${skip} 条 · 共 ${patch.length} 条`);
