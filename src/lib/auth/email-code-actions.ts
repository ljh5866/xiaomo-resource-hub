"use server";

import { headers } from "next/headers";
import { issueCode } from "@/lib/auth/email-code";

/** 注册前发送邮箱验证码（QQ 邮箱 SMTP） */
export async function sendRegisterCode(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return { ok: false, message: "邮箱格式不对" };
  }

  const h = await headers();
  const ip =
    (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "local";

  return issueCode(value, ip);
}
