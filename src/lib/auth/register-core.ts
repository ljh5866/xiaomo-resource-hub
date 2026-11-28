import { get, run } from "@/db/client";
import { hashPassword } from "@/lib/password";
import { hit } from "@/lib/rate-limit";
import { registrationOpen } from "@/lib/flags";
import { randomNickname } from "@/lib/nickname";
import { verifyCode } from "@/lib/auth/email-code";

/**
 * 注册的公共实现：网页（server action）与桌面端 API 共用同一套规则。
 * 这里刻意不写 "use server"：它只是普通函数，谁都能调。
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordProblem(pwd: string): string | null {
  if (pwd.length < 8) return "密码至少 8 位";
  if (pwd.length > 72) return "密码太长（最多 72 位）";
  if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return "密码需要同时包含字母和数字";
  return null;
}

export type CreateResult =
  | { ok: true; message: string; userId: number }
  | { ok: false; message: string };

export async function createAccount(input: {
  email: string;
  password: string;
  code: string;
  name?: string;
  ip: string;
}): Promise<CreateResult> {
  if (!registrationOpen()) {
    return { ok: false, message: "站点当前关闭了注册，请联系管理员开通账号" };
  }

  const email = input.email.trim().toLowerCase();
  const name = (input.name ?? "").trim().slice(0, 24);

  if (!EMAIL_RE.test(email)) return { ok: false, message: "邮箱格式不对" };

  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, message: problem };

  if (!/^\d{6}$/.test(input.code.trim())) return { ok: false, message: "请输入 6 位验证码" };

  const codeCheck = await verifyCode(email, input.code);
  if (!codeCheck.ok) return { ok: false, message: codeCheck.message };

  const ipLimit = hit(`register:ip:${input.ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!ipLimit.ok) {
    return { ok: false, message: `注册太频繁，请 ${Math.ceil(ipLimit.retryAfterSec / 60)} 分钟后再试` };
  }
  const mailLimit = hit(`register:mail:${email}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!mailLimit.ok) return { ok: false, message: "这个邮箱注册太频繁，请稍后再试" };

  const exists = get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ? LIMIT 1", email);
  if (exists) return { ok: false, message: "这个邮箱已经注册过了，直接登录即可" };

  try {
    run(
      `INSERT INTO users (email, name, role, password_hash, token_version, status)
       VALUES (?, ?, 'user', ?, 0, 'active')`,
      email,
      name || randomNickname(),
      hashPassword(input.password),
    );
  } catch (err) {
    const msg = String((err as Error).message ?? "");
    if (msg.includes("UNIQUE")) return { ok: false, message: "这个邮箱已经注册过了，直接登录即可" };
    console.error("[register] failed", err);
    return { ok: false, message: "注册失败，请稍后再试" };
  }

  const row = get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ? LIMIT 1", email);
  if (!row) return { ok: false, message: "注册成功但读取账号失败，请直接登录" };

  return { ok: true, message: "注册成功", userId: row.id };
}
