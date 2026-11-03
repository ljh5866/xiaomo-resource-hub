/**
 * 备份：数据库快照 + 封面目录打包。
 *   node scripts/backup.mjs            # 写到 data/backups/<时间戳>/
 *   node scripts/backup.mjs --keep 7   # 只保留最近 7 份
 *
 * SQLite 用 VACUUM INTO 做一致性快照（WAL 下也安全），不直接 copy 文件。
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB = process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.db");
const UPLOADS = path.join(process.cwd(), "data", "uploads");
const ROOT = path.join(process.cwd(), "data", "backups");

const args = process.argv.slice(2);
const keepIdx = args.indexOf("--keep");
const KEEP = keepIdx >= 0 ? Number(args[keepIdx + 1]) || 7 : 7;

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(ROOT, stamp);

fs.mkdirSync(outDir, { recursive: true });

/* 1. 数据库快照 */
const snapshot = path.join(outDir, "app.db");
if (fs.existsSync(DB)) {
  const db = new DatabaseSync(DB);
  db.exec(`VACUUM INTO '${snapshot.replace(/\\/g, "/").replace(/'/g, "''")}'`);
  db.close();
  console.log(`✓ 数据库快照 ${(fs.statSync(snapshot).size / 1024).toFixed(0)} KB`);
} else {
  console.log("· 没有数据库文件，跳过");
}

/* 2. 封面目录（递归拷贝，保留结构） */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) n += copyDir(s, d);
    else {
      fs.copyFileSync(s, d);
      n += 1;
    }
  }
  return n;
}

const files = copyDir(UPLOADS, path.join(outDir, "uploads"));
console.log(`✓ 封面文件 ${files} 个`);

/* 3. 轮转 */
const dirs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .reverse();

for (const old of dirs.slice(KEEP)) {
  fs.rmSync(path.join(ROOT, old), { recursive: true, force: true });
  console.log(`· 清理旧备份 ${old}`);
}

console.log(`✓ 完成：${outDir}（保留最近 ${KEEP} 份）`);
