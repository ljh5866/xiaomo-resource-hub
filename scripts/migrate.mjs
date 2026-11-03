/**
 * 极简迁移器：按文件名顺序执行 src/db/sql/*.sql，已执行的记在 _migrations。
 *   node scripts/migrate.mjs
 *
 * 为什么不再用 drizzle-kit push：push 会与手工创建的 FTS5 虚表打架
 * （它认为 shadow 表是"多余的表"，直接 DROP，把搜索索引删成半残）。
 * 迁移文件是显式的，只做我们写下来的事。
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.db");
const SQL_DIR = path.join(process.cwd(), "src", "db", "sql");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
)`);

const applied = new Set(
  db.prepare("SELECT name FROM _migrations").all().map((r) => r.name),
);

const files = fs
  .readdirSync(SQL_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let ran = 0;

for (const file of files) {
  if (applied.has(file)) {
    console.log(`· 跳过 ${file}（已应用）`);
    continue;
  }

  const raw = fs.readFileSync(path.join(SQL_DIR, file), "utf8");

  // 先去掉整行注释，再按分号切分 —— 否则"-- 标题"会把紧跟其后的第一条语句一起吞掉
  const sql = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    db.exec("BEGIN");
    for (const stmt of statements) {
      try {
        db.exec(stmt);
      } catch (err) {
        const msg = String(err.message ?? "");
        // 幂等容错：列/表已存在时视为已生效
        if (/duplicate column name|already exists/i.test(msg)) continue;
        throw err;
      }
    }
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    db.exec("COMMIT");
    console.log(`✓ 应用 ${file}（${statements.length} 条语句）`);
    ran += 1;
  } catch (err) {
    db.exec("ROLLBACK");
    console.error(`✗ ${file} 失败：`, err.message);
    process.exit(1);
  }
}

console.log(ran ? `✓ 完成，应用了 ${ran} 个迁移` : "✓ 数据库已是最新");
