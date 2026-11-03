/**
 * 创建/更新账号：
 *   pnpm user:add admin@xiaomo.local 我的密码 --admin
 *   pnpm user:add user@example.com 另一个密码
 */
import { get, run } from "../db/client";
import { hashPassword } from "../lib/password";

const [email, password, ...flags] = process.argv.slice(2);
const isAdmin = flags.includes("--admin");

if (!email || !password) {
  console.error("用法：pnpm user:add <email> <password> [--admin]");
  process.exit(1);
}

if (password.length < 8) {
  console.error("密码至少 8 位");
  process.exit(1);
}

const normalized = email.trim().toLowerCase();
const hash = hashPassword(password);
const role = isAdmin ? "admin" : "user";

const existing = get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ?", normalized);

if (existing) {
  run("UPDATE users SET password_hash = ?, role = ? WHERE id = ?", hash, role, existing.id);
  console.log(`✓ 已更新 ${normalized}（role=${role}）`);
} else {
  run(
    "INSERT INTO users (email, name, role, password_hash, created_at) VALUES (?,?,?,?,unixepoch())",
    normalized,
    normalized.split("@")[0],
    role,
    hash,
  );
  console.log(`✓ 已创建 ${normalized}（role=${role}）`);
}

const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")?.n ?? 0;
console.log(`  当前管理员账号数：${count}`);
