import { get } from "@/db/client";
import { verifyCode } from "@/lib/auth/email-code";
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
  token_version: number;
  status: string;
  created_at: number;
};

/** POST /api/desktop/login-code { email, code } → { token, user }（免密登录） */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string; code?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const code = String(body?.code ?? "").trim();

  if (!email || !/^\d{6}$/.test(code)) {
    return Response.json({ ok: false, message: "请填写邮箱和 6 位验证码" }, { status: 400 });
  }

  const ip = clientIp(req);
  const key = `desktop:login-code:${ip}:${email}`;
  const rl = hit(key, { limit: 8, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return Response.json({ ok: false, message: "尝试过于频繁，请稍后再试" }, { status: 429 });
  }

  const checked = await verifyCode(email, code, "login");
  if (!checked.ok) {
    return Response.json({ ok: false, message: checked.message }, { status: 401 });
  }

  const row = get<Row>(
    "SELECT id, email, name, role, avatar_url, token_version, status, created_at FROM users WHERE lower(email) = ? LIMIT 1",
    email,
  );
  if (!row || (row.status ?? "active") !== "active") {
    return Response.json({ ok: false, message: "这个账号当前不可登录" }, { status: 403 });
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
