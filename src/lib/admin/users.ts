"use server";

import { get, run } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export type UserActionResult = { ok: true; message: string } | { ok: false; message: string };

async function guard(): Promise<{ id: number } | UserActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "需要管理员登录" };
  return { id: Number(admin.id) };
}

function isDenied(x: { id: number } | UserActionResult): x is UserActionResult {
  return "ok" in x;
}

export async function setUserStatus(id: number, status: "active" | "pending" | "banned"): Promise<UserActionResult> {
  const me = await guard();
  if (isDenied(me)) return me;

  if (id === me.id) return { ok: false, message: "不能改自己的状态" };

  const row = get<{ role: string }>("SELECT role FROM users WHERE id = ?", id);
  if (!row) return { ok: false, message: "用户不存在" };

  if (row.role === "admin" && status !== "active") {
    const admins = get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")?.n ?? 0;
    if (admins <= 1) return { ok: false, message: "至少要保留一个可用管理员" };
  }

  // token_version +1：封禁后旧会话立刻失效
  run(
    "UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?",
    status,
    id,
  );
  return { ok: true, message: status === "banned" ? "已封禁，旧会话已失效" : "已更新" };
}

export async function setUserRole(id: number, role: "admin" | "user"): Promise<UserActionResult> {
  const me = await guard();
  if (isDenied(me)) return me;

  if (id === me.id) return { ok: false, message: "不能改自己的角色" };

  if (role === "user") {
    const admins = get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")?.n ?? 0;
    if (admins <= 1) return { ok: false, message: "至少要保留一个管理员" };
  }

  run("UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?", role, id);
  return { ok: true, message: role === "admin" ? "已设为管理员" : "已降为普通用户" };
}

export async function resetUserPassword(id: number, password: string): Promise<UserActionResult> {
  const me = await guard();
  if (isDenied(me)) return me;

  if (password.length < 8) return { ok: false, message: "密码至少 8 位" };
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, message: "密码需要同时包含字母和数字" };
  }

  run(
    "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
    hashPassword(password),
    id,
  );
  return { ok: true, message: "密码已重置，该用户需重新登录" };
}
