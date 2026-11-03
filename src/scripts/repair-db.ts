/**
 * 一次性修复：drizzle-kit push 把 FTS 影子表删了一半，导致库处于半残状态。
 * 做三件事：清干净所有 resources_fts* 残留 → 补 users.password_hash → 重建索引。
 */
import { all, exec, run } from "../db/client";
import { ensureFts, reindexAll } from "../lib/search/fts";

const cols = all<{ name: string }>("PRAGMA table_info(users)");
if (!cols.some((c) => c.name === "password_hash")) {
  exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  console.log("✓ 已补 users.password_hash");
} else {
  console.log("· users.password_hash 已存在");
}

const ftsTables = all<{ name: string }>(
  "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name LIKE 'resources_fts%'",
);
for (const t of ftsTables) {
  exec(`DROP TABLE IF EXISTS "${t.name}"`);
  console.log("· 清理残留表", t.name);
}

exec("DROP TABLE IF EXISTS blog.dummy"); // 无操作，确保连接可用
ensureFts();
const n = reindexAll();
console.log(`✓ 索引已重建：${n} 条`);

run("SELECT 1");
