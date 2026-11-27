import { get, run } from "@/db/client";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/password";
import { verifyCode } from "@/lib/auth/email-code";
import { clientKey, hit, reset } from "@/lib/rate-limit";
import { signAppToken } from "@/lib/app-auth";
import { corsOptions } from "@/lib/app-cors";

/**
 * POST /api/app/auth/login
 * { email, password } 或 { email, code }
 *
 * 桌面端专用登录：校验逻辑与网站 NextAuth 一致（同样的限流、状态检查、
 * bcrypt→scrypt 自动升级），但返回 Bearer token 而不是 Set-Cookie。
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string; code?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "请求格式不对" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const code = String(body.code ?? "").trim();
  if (!email || (!password && !code)) {
    return Response.json({ ok: false, error: "请填邮箱和密码（或验证码）" }, { status: 400 });
  }

  // 与网站一致的限流：同 IP 同邮箱 10 分钟 5 次
  const key = `${clientKey(req, "app-login")}:${email}`;
  const rl = hit(key, { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: `尝试过于频繁，请 ${rl.retryAfterSec} 秒后再试` },
      { status: 429 },
    );
  }

  const user = get<{
    id: number;
    email: string;
    name: string | null;
    role: string;
    password_hash: string | null;
    token_version: number;
    status: string;
  }>(
    "SELECT id, email, name, role, password_hash, token_version, status FROM users WHERE lower(email) = ? LIMIT 1",
    email,
  );

  if (!user) return Response.json({ ok: false, error: "邮箱或密码不对" }, { status: 401 });
  if ((user.status ?? "active") !== "active") {
    return Response.json(
      { ok: false, error: user.status === "pending" ? "账号待审核" : "账号已被封禁" },
      { status: 403 },
    );
  }

  if (code) {
    const checked = await verifyCode(email, code, "login");
    if (!checked.ok) return Response.json({ ok: false, error: checked.message }, { status: 401 });
  } else {
    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
      return Response.json({ ok: false, error: "邮箱或密码不对" }, { status: 401 });
    }
    if (needsRehash(user.password_hash)) {
      try {
        run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), user.id);
      } catch {
        /* 升级失败不影响登录 */
      }
    }
  }

  reset(key);

  return Response.json({
    ok: true,
    token: signAppToken(user.id, user.token_version),
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email.split("@")[0],
      role: user.role,
    },
  });
}

export const OPTIONS = corsOptions;
