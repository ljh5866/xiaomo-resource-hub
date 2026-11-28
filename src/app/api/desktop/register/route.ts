import { get } from "@/db/client";
import { createAccount } from "@/lib/auth/register-core";
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
  created_at: number;
};

/** POST /api/desktop/register { email, password, code, name } → { token, user } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; code?: string; name?: string }
    | null;

  const result = await createAccount({
    email: String(body?.email ?? ""),
    password: String(body?.password ?? ""),
    code: String(body?.code ?? ""),
    name: body?.name,
    ip: clientIp(req),
  });

  if (!result.ok) return Response.json(result, { status: 400 });

  const row = get<Row>(
    "SELECT id, email, name, role, avatar_url, token_version, created_at FROM users WHERE id = ?",
    result.userId,
  );
  if (!row) return Response.json({ ok: true, message: result.message }, { status: 200 });

  return Response.json({
    ok: true,
    message: result.message,
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
