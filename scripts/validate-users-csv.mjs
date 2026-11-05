/**
 * 校验 Supabase 导出（只输出统计，不打印任何哈希）
 *   node scripts/validate-users-csv.mjs <path>
 */
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("用法: node scripts/validate-users-csv.mjs <file.csv|file.json>");
  process.exit(1);
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

const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");

let rows;
if (file.toLowerCase().endsWith(".json")) {
  const json = JSON.parse(text);
  rows = Array.isArray(json) ? json : (json.users ?? json.data ?? []);
} else {
  const lines = text.trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => (row[h] = (cells[i] ?? "").replace(/^"|"$/g, "")));
    return row;
  });
}

const mask = (email) => {
  const [name, domain] = email.split("@");
  if (!domain) return "(无效)";
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
};

const stats = {
  total: rows.length,
  bcrypt: 0,
  scrypt: 0,
  noPassword: 0,
  badHash: 0,
  badEmail: 0,
  dupInFile: 0,
  withName: 0,
  domains: {},
  earliest: null,
  latest: null,
};

const seen = new Set();
const problems = [];

for (const row of rows) {
  const email = String(row.email ?? "").trim().toLowerCase();
  const hash = String(row.password_hash ?? row.encrypted_password ?? "");
  const meta = row.meta ?? row.raw_user_meta_data ?? "";
  const createdAt = row.created_at ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    stats.badEmail++;
    problems.push(`邮箱无效: ${email || "(空)"}`);
    continue;
  }
  if (seen.has(email)) {
    stats.dupInFile++;
    problems.push(`文件内重复: ${mask(email)}`);
    continue;
  }
  seen.add(email);

  if (!hash) stats.noPassword++;
  else if (/^\$2[aby]\$/.test(hash)) stats.bcrypt++;
  else if (hash.startsWith("scrypt$")) stats.scrypt++;
  else {
    stats.badHash++;
    problems.push(`哈希格式不认识: ${mask(email)}`);
  }

  const domain = email.split("@")[1];
  stats.domains[domain] = (stats.domains[domain] ?? 0) + 1;

  let name = "";
  if (typeof meta === "string" && meta.trim().startsWith("{")) {
    try {
      const m = JSON.parse(meta);
      name = m.name ?? m.full_name ?? "";
    } catch {
      /* ignore */
    }
  } else if (meta && typeof meta === "object") {
    name = meta.name ?? meta.full_name ?? "";
  }
  if (String(name).trim()) stats.withName++;

  const ts = createdAt ? new Date(createdAt).getTime() : NaN;
  if (Number.isFinite(ts)) {
    if (!stats.earliest || ts < stats.earliest) stats.earliest = ts;
    if (!stats.latest || ts > stats.latest) stats.latest = ts;
  }
}

const d = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : "—");

console.log(`\n文件：${file}`);
console.log(`总行数：${stats.total}`);
console.log(`  bcrypt 密码（可用原密码登录）：${stats.bcrypt}`);
console.log(`  scrypt 密码（已是本站格式）：${stats.scrypt}`);
console.log(`  无密码（只能验证码登录）：${stats.noPassword}`);
console.log(`  哈希格式异常：${stats.badHash}`);
console.log(`  邮箱无效：${stats.badEmail}`);
console.log(`  文件内重复：${stats.dupInFile}`);
console.log(`  带昵称：${stats.withName}`);
console.log(`注册时间范围：${d(stats.earliest)} → ${d(stats.latest)}`);

const topDomains = Object.entries(stats.domains)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
console.log(`邮箱域名 Top5：${topDomains.map(([k, v]) => `${k}(${v})`).join("  ")}`);

if (problems.length) {
  console.log(`\n问题前 5 条：`);
  for (const p of problems.slice(0, 5)) console.log("  · " + p);
}

const importable = stats.bcrypt + stats.scrypt + stats.noPassword - stats.dupInFile - stats.badEmail - stats.badHash;
console.log(`\n可导入：约 ${Math.max(0, importable)} 条`);
