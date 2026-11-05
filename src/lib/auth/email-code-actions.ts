"use server";

import { headers } from "next/headers";
import { issueCode } from "@/lib/auth/email-code";

async function ip(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** 注册前发送邮箱验证码 */
export async function sendRegisterCode(email: string): Promise<{ ok: boolean; message: string }> {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return { ok: false, message: "邮箱格式不对" };
  return issueCode(value, await ip(), "register");
}

/** 免密登录：给已注册邮箱发验证码 */
export async function sendLoginCode(email: string): Promise<{ ok: boolean; message: string }> {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return { ok: false, message: "邮箱格式不对" };
  // 不暴露"这个邮箱是否注册过"：无论存不存在都返回相同提示
  return issueCode(value, await ip(), "login");
}
