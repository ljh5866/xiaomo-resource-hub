import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { get, run } from "@/db/client";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/password";
import { clientKey, hit, reset } from "@/lib/rate-limit";
import authConfig from "./config";

/**
 * 完整鉴权（Node 运行时）：邮箱 + 密码。
 *
 * 为什么自己存密码而不是接邮箱验证码：本地/离线环境没有 SMTP，
 * 而验证码方案一旦发不出邮件，后台就彻底进不去。这里用 scrypt + 单表，
 * 后续要加"邮箱验证码"或"微信登录"，在 providers 里追加即可。
 */

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  password_hash: string | null;
  token_version: number;
  status: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "邮箱密码",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // 同 IP 10 分钟内最多 5 次尝试，超过锁 10 分钟
        const key = `${clientKey(request, "login")}:${email}`;
        const rl = hit(key, { limit: 5, windowMs: 10 * 60_000 });
        if (!rl.ok) {
          console.warn(`[auth] rate limited ${email} (retry ${rl.retryAfterSec}s)`);
          return null;
        }

        const user = get<UserRow>(
          "SELECT id, email, name, role, password_hash, token_version, status FROM users WHERE lower(email) = ? LIMIT 1",
          email,
        );

        if (!user?.password_hash) return null;

        // 只允许 active 账号登录：pending 待审核、banned 封禁都拒绝
        if ((user.status ?? "active") !== "active") return null;
        if (!verifyPassword(password, user.password_hash)) return null;

        // 老格式（bcrypt，从 Supabase 迁过来的）登录成功后顺手升级成 scrypt：
        // 用户无感，下次登录就是新格式
        if (needsRehash(user.password_hash)) {
          try {
            run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), user.id);
          } catch (e) {
            console.warn("[auth] rehash failed", e);
          }
        }

        reset(key);

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
          role: user.role,
          tokenVersion: user.token_version,
        } as { id: string; email: string; name: string; role: string; tokenVersion: number };
      },
    }),
  ],
});

/**
 * 取当前登录用户，并校验会话版本。
 * token_version 与库里不一致（改密码 / 被 revoke）时视为未登录 —— 这是 JWT 的吊销方案。
 */
export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const id = Number(session.user.id);
  if (!Number.isFinite(id)) return null;

  const row = get<{ id: number; email: string; name: string | null; role: string; token_version: number }>(
    "SELECT id, email, name, role, token_version FROM users WHERE id = ?",
    id,
  );

  if (!row) return null;

  const tokenVer = Number((session.user as { ver?: number }).ver ?? 0);
  if (process.env.AUTH_DEBUG === "1") {
    console.log("[auth:debug] uid", id, "tokenVer", tokenVer, "dbVer", row.token_version);
  }
  if (row.token_version !== tokenVer) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email.split("@")[0],
    role: row.role,
  };
}

export async function requireAdmin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}
