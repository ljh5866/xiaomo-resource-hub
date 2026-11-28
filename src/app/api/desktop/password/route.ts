import { get, run } from "@/db/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/auth/register-core";
import { issueToken } from "@/lib/desktop/token";
import { desktopUser, unauthorized } from "@/lib/desktop/auth";

export const runtime = "nodejs";

/** POST /api/desktop/password { oldPassword, newPassword } → 新 token（旧 token 自动失效） */
export async function POST(req: Request) {
  const user = desktopUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as
    | { oldPassword?: string; newPassword?: string }
    | null;
  const newPassword = String(body?.newPassword ?? "");
  const oldPassword = String(body?.oldPassword ?? "");

  const problem = passwordProblem(newPassword);
  if (problem) return Response.json({ ok: false, message: problem }, { status: 400 });

  const row = get<{ password_hash: string | null; token_version: number }>(
    "SELECT password_hash, token_version FROM users WHERE id = ?",
    user.id,
  );
  if (!row) return Response.json({ ok: false, message: "账号不存在" }, { status: 404 });

  // 验证码注册/迁移过来的账号可能没有本地密码，允许直接设置
  if (row.password_hash && !verifyPassword(oldPassword, row.password_hash)) {
    return Response.json({ ok: false, message: "当前密码不对" }, { status: 401 });
  }

  run(
    "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
    hashPassword(newPassword),
    user.id,
  );

  const next = get<{ token_version: number }>("SELECT token_version FROM users WHERE id = ?", user.id);
  return Response.json({
    ok: true,
    message: "密码已更新",
    token: issueToken(user.id, Number(next?.token_version ?? 0)),
  });
}
