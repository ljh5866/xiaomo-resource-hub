import fs from "node:fs";
import { get, run } from "@/db/client";
import { clientKey, hit, reset } from "@/lib/rate-limit";
import { generateCode, hashCode, registerCodeMail, sendMail, smtpConfigured } from "@/lib/email/mailer";

/**
 * 邮箱验证码（注册用，将来找回密码复用）
 *
 * 规则：
 *   - 6 位数字，10 分钟有效
 *   - 同一邮箱 60 秒内只能发一次，每小时最多 5 次；同 IP 每小时 10 次
 *   - 库里只存哈希；校验失败累计 5 次即作废
 *   - 校验成功立即标记 consumed_at，不可重复使用
 *
 * 开发模式（EMAIL_DEV_MODE=1 或未配置 SMTP 且非生产）：
 *   不真的发邮件，把验证码写到 data/.dev-emails.log，供本地 e2e 读取
 */

const TTL_SEC = 10 * 60;
const MAX_ATTEMPTS = 5;

const devMode = () => process.env.EMAIL_DEV_MODE === "1";

function logDevCode(email: string, code: string) {
  const line = `${new Date().toISOString()}\t${email}\t${code}\n`;
  try {
    fs.appendFileSync("data/.dev-emails.log", line, "utf8");
  } catch {
    /* 目录不存在就忽略 */
  }
  console.log(`[email-code] ${email} → ${code}`);
}

export type IssueResult = { ok: true; message: string } | { ok: false; message: string };

export async function issueCode(email: string, ip: string): Promise<IssueResult> {
  const mailLimit = hit(`code:mail:${email}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!mailLimit.ok) {
    return { ok: false, message: `发送太频繁，请 ${Math.ceil(mailLimit.retryAfterSec / 60)} 分钟后再试` };
  }

  const ipLimit = hit(`code:ip:${ip}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!ipLimit.ok) return { ok: false, message: "请求过于频繁，请稍后再试" };

  // 60 秒冷却（查库，重启也不丢）
  const last = get<{ at: number }>(
    "SELECT created_at AS at FROM email_codes WHERE email = ? AND purpose = 'register' ORDER BY id DESC LIMIT 1",
    email,
  );
  if (last && Date.now() / 1000 - last.at < 60) {
    const wait = Math.ceil(60 - (Date.now() / 1000 - last.at));
    return { ok: false, message: `请 ${wait} 秒后再获取验证码` };
  }

  const code = generateCode();
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SEC;

  run(
    `INSERT INTO email_codes (email, code_hash, purpose, expires_at, ip_hash)
     VALUES (?, ?, 'register', ?, NULL)`,
    email,
    hashCode(code),
    expiresAt,
  );

  if (!smtpConfigured() || devMode()) {
    if (process.env.NODE_ENV === "production" && !devMode()) {
      return { ok: false, message: "邮件服务未配置，请联系管理员" };
    }
    logDevCode(email, code);
    return { ok: true, message: "开发模式：验证码已写入服务端日志" };
  }

  try {
    await sendMail({
      to: email,
      ...registerCodeMail(code, process.env.SITE_NAME ?? "小莫资源网"),
    });
  } catch (err) {
    console.error("[email-code] send failed", err);
    return { ok: false, message: "验证码发送失败，请稍后重试或联系管理员" };
  }

  return { ok: true, message: "验证码已发送，请查收邮件（含垃圾箱）" };
}

export async function verifyCode(email: string, code: string): Promise<{ ok: boolean; message: string }> {
  const row = get<{ id: number; code_hash: string; expires_at: number; attempts: number }>(
    `SELECT id, code_hash, expires_at, attempts FROM email_codes
     WHERE email = ? AND purpose = 'register' AND consumed_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    email,
  );

  if (!row) return { ok: false, message: "请先获取验证码" };

  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    return { ok: false, message: "验证码已过期，请重新获取" };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: "验证码错误次数过多，请重新获取" };
  }

  if (row.code_hash !== hashCode(code.trim())) {
    run("UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?", row.id);
    return { ok: false, message: "验证码不对" };
  }

  run("UPDATE email_codes SET consumed_at = unixepoch() WHERE id = ?", row.id);
  reset(`code:mail:${email}`);
  return { ok: true, message: "ok" };
}

/** 定时清理：过期超过 1 天的记录 */
export function pruneCodes() {
  run("DELETE FROM email_codes WHERE created_at < unixepoch() - 86400");
}
