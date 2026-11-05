import { createHash, randomInt } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * 邮件发送：QQ 邮箱 SMTP（也兼容任何标准 SMTP）
 *
 * QQ 邮箱配置步骤：
 *   1. 登录 mail.qq.com → 设置 → 账号
 *   2. 开启「POP3/SMTP 服务」（需要短信验证）
 *   3. 生成「授权码」——这就是 SMTP_PASS，不是 QQ 密码
 *
 * 环境变量：
 *   SMTP_HOST=smtp.qq.com
 *   SMTP_PORT=465            # 465 = SSL，587 = STARTTLS
 *   SMTP_USER=xxx@qq.com
 *   SMTP_PASS=授权码
 *   SMTP_FROM="小莫资源网 <xxx@qq.com>"
 */

export type MailPayload = { to: string; subject: string; text: string; html: string };

let cached: Transporter | null = null;

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport(): Transporter {
  if (cached) return cached;

  const port = Number(process.env.SMTP_PORT ?? 465);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 用 SSL，587 用 STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // QQ 邮箱偶尔慢，给足超时，避免注册页卡住
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return cached;
}

export async function sendMail(payload: MailPayload): Promise<void> {
  if (!smtpConfigured()) throw new Error("SMTP_NOT_CONFIGURED");

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  await transport().sendMail({ from, ...payload });
}

/** 验证码哈希：库泄露也拿不到明文码 */
export function hashCode(code: string): string {
  return createHash("sha256")
    .update(`${code}:${process.env.AUTH_SECRET ?? "dev"}`)
    .digest("hex");
}

/** 6 位数字，用 crypto 随机，不用 Math.random */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function registerCodeMail(
  code: string,
  siteName: string,
  purpose: "register" | "login" = "register",
) {
  const action = purpose === "login" ? "登录" : "注册";
  return {
    subject: `【${siteName}】${action}验证码 ${code}`,
    text: `你的${action}验证码是 ${code}，10 分钟内有效。如果不是你本人操作，忽略这封邮件即可。`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18181b">
        <p style="margin:0 0 16px;font-size:14px;color:#52525b">${siteName}</p>
        <div style="border:1px solid #ececef;border-radius:8px;padding:24px">
          <p style="margin:0 0 8px;font-size:15px">${action}验证码</p>
          <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,Consolas,monospace">${code}</p>
          <p style="margin:0;font-size:13px;color:#52525b">10 分钟内有效，请勿转发给他人。</p>
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#71717a">如果这不是你本人的操作，忽略这封邮件即可，不会有任何影响。</p>
      </div>
    `,
  };
}
