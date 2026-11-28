import { get, run } from "@/db/client";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/password";
import { hit, reset } from "@/lib/rate-limit";
import { issueToken } from "@/lib/desktop/token";
import { clientIp } from "@/lib/desktop/auth";

export const runtime = "nodejs";

type Row = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  avatar_url: string | null;
  password_hash: string | null;
  token_version: number;
  status: string;
  created_at: number;
};

/** POST /api/desktop/login { email, password } → { token, user } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return Response.json({ ok: false, message: "请填写邮箱和密码" }, { status: 400 });
  }

  const ip = clientIp(req);
  const key = `desktop:login:${ip}:${email}`;
  const rl = hit(key, { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return Response.json(
      { ok: false, message: `尝试过于频繁，请 ${Math.ceil(rl.retryAfterSec / 60)} 分钟后再试` },
      { status: 429 },
    );
  }

  const row = get<Row>(
    "SELECT id, email, name, role, avatar_url, password_hash, token_version, status, created_at FROM users WHERE lower(email) = ? LIMIT 1",
    email,
  );
  if (!row || (row.status ?? "active") !== "active" || !row.password_hash) {
    return Response.json({ ok: false, message: "邮箱或密码不对" }, { status: 401 });
  }
  if (!verifyPassword(password, row.password_hash)) {
    return Response.json({ ok: false, message: "邮箱或密码不对" }, { status: 401 });
  }
  if (needsRehash(row.password_hash)) {
    try {
      run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), row.id);
    } catch {
      /* 升级失败不影响登录 */
    }
  }
  reset(key);

  return Response.json({
    ok: true,
    token: issueToken(row.id, row.token_version),
    user: {
      id: row.id,
      email: row.email,
      name: row.name ?? row.email.split("@")[0],
      role: row.role,
      avatarUrl: row.avatar_url,
      createdAt: Number(row.created_at) * 1000,
    },
  });
}
