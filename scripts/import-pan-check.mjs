/**
 * 把本地巡检结果写进服务器库（服务器无法直连夸克时用这条通道）。
 *
 *   node --import tsx scripts/import-pan-check.mjs data/import/pan-check.json --dry
 *   node --import tsx scripts/import-pan-check.mjs data/import/pan-check.json
 *
 * 幂等：按 link id 覆盖 status / last_error / checked_at。
 */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
if (!file) {
  console.error("用法: node --import tsx scripts/import-pan-check.mjs <result.json> [--dry]");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const rows = Array.isArray(payload) ? payload : (payload.results ?? []);
if (!rows.length) {
  console.error("结果为空");
  process.exit(1);
}

const db = new DatabaseSync(process.env.DATABASE_URL ?? "./data/app.db");
const upd = db.prepare(
  `UPDATE resource_links SET status = ?, last_error = ?, checked_at = unixepoch() WHERE id = ?`,
);
const exists = db.prepare(`SELECT 1 AS ok FROM resource_links WHERE id = ?`);

let ok = 0;
let skip = 0;
for (const r of rows) {
  if (!r?.id || !r.status) {
    skip += 1;
    continue;
  }
  if (!exists.get(r.id)) {
    skip += 1;
    continue;
  }
  if (!dry) upd.run(r.status, r.error ?? null, r.id);
  ok += 1;
}

const dist = dry
  ? null
  : db
      .prepare(
        `SELECT status, COUNT(*) AS n FROM resource_links WHERE status <> 'unknown' GROUP BY status ORDER BY n DESC`,
      )
      .all();

console.log(`${dry ? "[dry-run] " : ""}更新 ${ok} 条 · 跳过 ${skip} 条（巡检时间 ${payload.checkedAt ? new Date(payload.checkedAt).toISOString() : "未知"}）`);
if (dist) console.log("当前链接状态分布：", JSON.stringify(dist));
