/**
 * 让某个账号的所有旧会话立即失效：
 *   pnpm user:revoke admin@xiaomo.local
 * 顺带改密码也是不行的（密码单独存），所以提供这个命令。
 */
import { get, run } from "../db/client";

const email = process.argv[2];

if (!email) {
  console.error("用法：pnpm user:revoke <email>");
  process.exit(1);
}

const normalized = email.trim().toLowerCase();
const user = get<{ id: number; token_version: number }>(
  "SELECT id, token_version FROM users WHERE lower(email) = ?",
  normalized,
);

if (!user) {
  console.error(`找不到账号：${normalized}`);
  process.exit(1);
}

run("UPDATE users SET token_version = token_version + 1 WHERE id = ?", user.id);

const after = get<{ token_version: number }>(
  "SELECT token_version FROM users WHERE id = ?",
  user.id,
)?.token_version;

console.log(`✓ ${normalized} 的会话版本 ${user.token_version} → ${after}`);
console.log("  该账号所有已登录设备会在下次请求后台时被要求重新登录。");
