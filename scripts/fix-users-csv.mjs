/**
 * 修正导出文件里的域名笔误（如 qq.con → qq.com）
 *   node scripts/fix-users-csv.mjs <in.csv> <out.csv> qq.con=qq.com [更多=更多]
 */
import fs from "node:fs";

const [inFile, outFile, ...rules] = process.argv.slice(2);
if (!inFile || !outFile || rules.length === 0) {
  console.error("用法: node scripts/fix-users-csv.mjs in.csv out.csv qq.con=qq.com");
  process.exit(1);
}

const map = new Map(
  rules.map((r) => {
    const [from, to] = r.split("=");
    return [from.toLowerCase(), to.toLowerCase()];
  }),
);

const text = fs.readFileSync(inFile, "utf8").replace(/^\uFEFF/, "");
const lines = text.trim().split(/\r?\n/);

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

function quote(v) {
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

const header = splitCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
const emailIdx = header.indexOf("email");
if (emailIdx < 0) {
  console.error("找不到 email 列，表头是：" + header.join(","));
  process.exit(1);
}

let fixed = 0;
const out = [lines[0]];
const seen = new Set();
let dropped = 0;

for (const line of lines.slice(1)) {
  const cells = splitCsvLine(line);
  const email = (cells[emailIdx] ?? "").trim();
  const at = email.lastIndexOf("@");
  if (at > 0) {
    const local = email.slice(0, at);
    const domain = email.slice(at + 1).toLowerCase();
    if (map.has(domain)) {
      const next = `${local}@${map.get(domain)}`;
      console.log(`修正: ${local.slice(0, 2)}***@${domain} → ${map.get(domain)}`);
      cells[emailIdx] = next;
      fixed++;
    }
  }

  // 修正后可能与已有邮箱撞车（同一个人注册两次），去重时保留先出现的那条
  const key = (cells[emailIdx] ?? "").trim().toLowerCase();
  if (seen.has(key)) {
    console.log(`去重: 丢弃重复账号 ${key.slice(0, 2)}***@${key.split("@")[1]}`);
    dropped++;
    continue;
  }
  seen.add(key);

  out.push(cells.map(quote).join(","));
}

fs.writeFileSync(outFile, out.join("\n") + "\n", "utf8");
console.log(`\n修正 ${fixed} 条，丢弃重复 ${dropped} 条，输出：${outFile}`);
