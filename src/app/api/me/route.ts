import { NextResponse } from "next/server";
import { get } from "@/db/client";
import { getSessionUser } from "@/lib/auth";
import { normalizeAvatarUrl } from "@/lib/user/avatar-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 当前账号的展示信息（顶部头像/昵称用）。
 *
 * 为什么不直接用 session：JWT 里的 name/picture 是登录那一刻的快照，
 * 用户改了昵称或上传头像后不会变，要等重新登录。这个接口每次读库，实时准确。
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const row = get<{ name: string | null; avatar_url: string | null; role: string }>(
    "SELECT name, avatar_url, role FROM users WHERE id = ?",
    user.id,
  );

  return NextResponse.json(
    {
      ok: true,
      email: user.email,
      name: row?.name ?? user.email.split("@")[0],
      avatarUrl: normalizeAvatarUrl(row?.avatar_url),
      role: row?.role ?? "user",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
