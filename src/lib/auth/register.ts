"use server";

import { headers } from "next/headers";
import { createAccount } from "@/lib/auth/register-core";

export type RegisterResult = { ok: true; message: string } | { ok: false; message: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/**
 * 网页注册入口。校验与落库都在 `register-core.ts`，与桌面端 API 共用同一套规则。
 */
export async function registerAccount(input: {
  email: string;
  password: string;
  password2: string;
  name?: string;
  code: string;
}): Promise<RegisterResult> {
  if (input.password !== input.password2) return { ok: false, message: "两次输入的密码不一致" };

  const result = await createAccount({
    email: input.email,
    password: input.password,
    code: input.code,
    name: input.name,
    ip: await clientIp(),
  });

  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "注册成功，正在跳转登录…" };
}
