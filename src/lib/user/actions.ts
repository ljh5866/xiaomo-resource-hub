"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, run } from "@/db/client";
import { getSessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

export type ProfileResult = { ok: true; message: string } | { ok: false; message: string };

async function current() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me");
  return user;
}

/** 改昵称 */
export async function updateProfile(input: { name: string; bio?: string }): Promise<ProfileResult> {
  const user = await current();
  const name = input.name.trim().slice(0, 24);
  if (!name) return { ok: false, message: "昵称不能为空" };

  run("UPDATE users SET name = ? WHERE id = ?", name, user.id);
  revalidatePath("/me");
  return { ok: true, message: "已保存" };
}

/** 改密码：验证旧密码 + 强度 + 踢掉其它会话 */
export async function changePassword(input: {
  oldPassword: string;
  newPassword: string;
  confirm: string;
}): Promise<ProfileResult> {
  const user = await current();

  if (input.newPassword.length < 8) return { ok: false, message: "新密码至少 8 位" };
  if (!/[a-zA-Z]/.test(input.newPassword) || !/[0-9]/.test(input.newPassword)) {
    return { ok: false, message: "新密码需要同时包含字母和数字" };
  }
  if (input.newPassword !== input.confirm) return { ok: false, message: "两次输入的新密码不一致" };

  const row = get<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ?", user.id);
  if (!row) return { ok: false, message: "账号不存在" };

  // 没有本地密码（Supabase 迁移或验证码注册的用户）可以直接设置
  if (row.password_hash) {
    if (!verifyPassword(input.oldPassword, row.password_hash)) {
      return { ok: false, message: "当前密码不对" };
    }
  }

  run(
    "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
    hashPassword(input.newPassword),
    user.id,
  );

  return { ok: true, message: "密码已更新，请重新登录" };
}

/** 删除头像，回到首字母 */
export async function removeAvatar(): Promise<ProfileResult> {
  const user = await current();
  run("UPDATE users SET avatar_url = NULL WHERE id = ?", user.id);
  revalidatePath("/me");
  return { ok: true, message: "头像已移除" };
}
