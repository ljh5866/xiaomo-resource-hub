/**
 * 从 Supabase 导入用户
 *
 *   node scripts/import-supabase-users.mjs users.json --dry
 *   node scripts/import-supabase-users.mjs users.json
 *
 * 导出方式（Supabase → SQL Editor，用 service_role 跑，或直接 CSV 导出）：
 *
 *   select
 *     u.id::text            as id,
 *     u.email,
 *     u.encrypted_password  as password_hash,
 *     u.created_at,
 *     u.raw_user_meta_data  as meta
 *   from auth.users u
 *   order by u.created_at;
 *
 * 把结果导出成 JSON（右上角 Export → JSON），或 CSV（列名同上）。
 *
 * 说明：
 *   - Supabase 密码是 bcrypt（$2a$10$...），本站登录已支持 bcrypt 校验，
 *     并且用户第一次登录成功后会自动升级成 scrypt，用户无感。
 *   - 只导入 email / 密码哈希 / 昵称 / 创建时间；role 统一 user，status 统一 active。
 *   - 已存在的邮箱会跳过（不会覆盖你现有账号）。
 */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const file = process.argv[2];
const dry = process.argv.includes("--dry");

if (!file) {
  console.error("用法: node scripts/import-supabase-users.mjs <users.json|users.csv> [--dry]");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`文件不存在: ${file}`);
  process.exit(1);
}

/* ───────── 解析：JSON 或 CSV ───────── */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").replace(/^"|"$/g, "");
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const raw = fs.readFileSync(file, "utf8");
let rows;
if (file.endsWith(".json")) {
  const json = JSON.parse(raw);
  rows = Array.isArray(json) ? json : (json.users ?? json.data ?? []);
} else {
  rows = parseCsv(raw);
}

/* ───────── 归一化 ───────── */
const pick = (row, ...names) => {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null && row[n] !== "") return row[n];
  }
  return undefined;
};

const users = [];
const skipped = [];

for (const row of rows) {
  const email = String(pick(row, "email", "Email") ?? "").trim().toLowerCase();
  const hash = String(pick(row, "password_hash", "encrypted_password", "encryptedPassword") ?? "");
  const meta = pick(row, "meta", "raw_user_meta_data", "user_metadata") ?? {};
  const createdAt = pick(row, "created_at", "createdAt");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    skipped.push({ email: email || "(空)", reason: "邮箱无效" });
    continue;
  }
  if (!/^\$2[aby]\$/.test(hash) && !hash.startsWith("scrypt$")) {
    skipped.push({ email, reason: "密码哈希格式不认识" });
    continue;
  }

  let name = "";
  if (typeof meta === "string" && meta.trim().startsWith("{")) {
    try {
      name = JSON.parse(meta).name ?? JSON.parse(meta).full_name ?? "";
    } catch {
      /* 忽略 */
    }
  } else if (meta && typeof meta === "object") {
    name = meta.name ?? meta.full_name ?? "";
  }
  name = String(name).trim().slice(0, 24) || email.split("@")[0];

  const ts = createdAt ? Math.floor(new Date(createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000);

  users.push({ email, hash, name, createdAt: Number.isFinite(ts) ? ts : Math.floor(Date.now() / 1000) });
}

/* ───────── 去重（文件内重复） ───────── */
const seen = new Set();
const unique = [];
for (const u of users) {
  if (seen.has(u.email)) {
    skipped.push({ email: u.email, reason: "文件内重复" });
    continue;
  }
  seen.add(u.email);
  unique.push(u);
}

/* ───────── 写库 ───────── */
const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");
const exists = db.prepare("SELECT id FROM users WHERE lower(email) = ? LIMIT 1");
const insert = db.prepare(
  `INSERT INTO users (email, name, role, password_hash, token_version, status, created_at)
   VALUES (?, ?, 'user', ?, 0, 'active', ?)`,
);

let inserted = 0;
const existed = [];

if (!dry) db.exec("BEGIN");
try {
  for (const u of unique) {
    if (exists.get(u.email)) {
      existed.push(u.email);
      continue;
    }
    if (!dry) insert.run(u.email, u.name, u.hash, u.createdAt);
    inserted++;
  }
  if (!dry) db.exec("COMMIT");
} catch (e) {
  if (!dry) db.exec("ROLLBACK");
  console.error("导入失败：", e.message);
  process.exit(1);
} finally {
  db.close();
}

/* ───────── 报告 ───────── */
console.log(`\n来源：${file}`);
console.log(`读取 ${rows.length} 行 → 有效 ${unique.length} 条`);
console.log(`${dry ? "（预演，未写库）将导入" : "已导入"}：${inserted}`);
console.log(`邮箱已存在跳过：${existed.length}`);
if (existed.length) console.log("  " + existed.slice(0, 5).join(", ") + (existed.length > 5 ? " …" : ""));
if (skipped.length) {
  console.log(`无效跳过：${skipped.length}`);
  for (const s of skipped.slice(0, 5)) console.log(`  ${s.email} — ${s.reason}`);
}
console.log(
  inserted > 0
    ? "\n✓ 完成。这些用户可以直接用原密码登录，首次登录后哈希会自动升级为 scrypt。"
    : "\n没有新用户需要导入。",
);
