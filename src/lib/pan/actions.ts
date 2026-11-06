"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { dropCredential, saveCredential } from "@/lib/pan/credentials";
import { verifyCookie } from "@/lib/pan/quark";

export type BindState = { ok: boolean; message: string };

/**
 * 绑定用户自己的夸克账号。
 *
 * 顺序：先拿这串 Cookie 去 account/info 验一次，拿到昵称才落库 ——
 * 验不过的不写，避免用户粘错一串之后还显示「已绑定」。
 */
export async function bindQuarkAction(_prev: BindState, formData: FormData): Promise<BindState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "请先登录" };

  const raw = String(formData.get("cookie") ?? "");
  const cookie = raw.replace(/^cookie:\s*/i, "").replace(/\s*\n\s*/g, " ").trim();

  if (cookie.length < 40) {
    return { ok: false, message: "这串 Cookie 太短了，确认复制的是整行（通常 500 字符以上）" };
  }
  if (!/(__puus|__pus|__kp)=/.test(cookie)) {
    return { ok: false, message: "没在内容里找到夸克的登录字段（__puus / __pus），可能复制错了" };
  }

  const info = await verifyCookie(cookie);
  if (!info) {
    return { ok: false, message: "夸克拒绝了这串 Cookie（可能已过期，或不是登录态）" };
  }

  saveCredential(user.id, "quark", cookie, info.nickname);

  revalidatePath("/me/pan");
  revalidatePath("/me");

  return { ok: true, message: `绑定成功：${info.nickname}` };
}

export async function unbindQuarkAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  dropCredential(user.id, "quark");
  revalidatePath("/me/pan");
  revalidatePath("/me");
}
