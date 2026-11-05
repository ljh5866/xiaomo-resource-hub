/**
 * 把「昵称等于邮箱前缀」的账号改成随机昵称（如 安静的鼠标）
 *
 *   node scripts/randomize-names.mjs --dry
 *   node scripts/randomize-names.mjs
 *
 * 只处理三类，不动手写过昵称的人：
 *   1. name 为空
 *   2. name 等于邮箱 @ 前面的部分
 *   3. name 形如 reg-xxxx / user-xxxx 的自动生成名
 */
import { DatabaseSync } from "node:sqlite";
import { randomNickname } from "../src/lib/nickname.ts";

const dry = process.argv.includes("--dry");
const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const rows = db
  .prepare("SELECT id, email, name FROM users ORDER BY id")
  .all();

const targets = rows.filter((r) => {
  const name = (r.name ?? "").trim();
  const local = r.email.split("@")[0];
  if (!name) return true;
  if (name.toLowerCase() === local.toLowerCase()) return true;
  if (/^(reg|user|me|code)-[a-z0-9]+$/i.test(name)) return true;
  return false;
});

console.log(`\n共 ${rows.length} 个账号，其中 ${targets.length} 个使用默认昵称`);

const used = new Set(rows.map((r) => (r.name ?? "").trim()));
const updates = [];

for (const t of targets) {
  let nickname = randomNickname();
  let guard = 0;
  while (used.has(nickname) && guard++ < 20) nickname = randomNickname();
  used.add(nickname);
  updates.push({ id: t.id, email: t.email, from: t.name ?? "(空)", to: nickname });
}

for (const u of updates.slice(0, 10)) {
  console.log(`  ${u.email}  ${u.from} → ${u.to}`);
}
if (updates.length > 10) console.log(`  … 还有 ${updates.length - 10} 个`);

if (dry) {
  console.log("\n（预演，未写库）");
  process.exit(0);
}

const stmt = db.prepare("UPDATE users SET name = ? WHERE id = ?");
db.exec("BEGIN");
try {
  for (const u of updates) stmt.run(u.to, u.id);
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  console.error("失败：", e.message);
  process.exit(1);
} finally {
  db.close();
}

console.log(`\n✓ 已更新 ${updates.length} 个昵称`);
