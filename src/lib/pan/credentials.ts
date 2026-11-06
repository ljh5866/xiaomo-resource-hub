/**
 * 用户网盘凭证：加密存取。
 *
 * 只存密文（AES-256-GCM），密钥由 AUTH_SECRET 通过 HKDF 派生 —— 不额外引入密钥，
 * 但换 AUTH_SECRET 会让所有已绑定的凭证失效（用户重新绑一次即可，属于预期行为）。
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { get, run } from "@/db/client";
import type { PanProvider } from "./types";

const SALT = "xiaomo:pan-credential:v1";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret) throw new Error("AUTH_SECRET 未设置，无法加解密网盘凭证");
  return Buffer.from(hkdfSync("sha256", secret, SALT, "aes-256-gcm", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), enc.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function decryptSecret(blob: string): string | null {
  try {
    const [v, ivB64, encB64, tagB64] = blob.split(".");
    if (v !== "v1" || !ivB64 || !encB64 || !tagB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

type Row = { secret_enc: string; nickname: string | null; status: string; last_error: string | null };

export function getCredentialRow(userId: number, provider: PanProvider): Row | null {
  return (
    get<Row>(
      `SELECT secret_enc, nickname, status, last_error
         FROM user_pan_credentials WHERE user_id = ? AND provider = ? AND status = 'active'`,
      userId,
      provider,
    ) ?? null
  );
}

/** 只使用用户自己的凭证：站点不代持任何网盘账号。 */
export type ResolvedCredential = { cookie: string; source: "user" };

/**
 * 解析用户自己的网盘凭证。
 *
 * 设计决定（2026-11-06）：**不再回退站点公共账号**。
 * 站点不代持任何网盘登录态，未绑定的人只能用「查看分享目录」之外的什么都不行 ——
 * 这样风控、转存垃圾、带宽都分散到各用户自己的账号上。
 */
export function resolveCookie(userId: number | null, provider: PanProvider): ResolvedCredential | null {
  if (!userId) return null;
  const row = getCredentialRow(userId, provider);
  if (!row) return null;
  const plain = decryptSecret(row.secret_enc);
  return plain ? { cookie: plain, source: "user" } : null;
}

export function saveCredential(
  userId: number,
  provider: PanProvider,
  cookie: string,
  nickname: string | null,
): void {
  run(
    `INSERT INTO user_pan_credentials (user_id, provider, secret_enc, nickname, status, updated_at)
     VALUES (?, ?, ?, ?, 'active', unixepoch())
     ON CONFLICT(user_id, provider) DO UPDATE SET
       secret_enc = excluded.secret_enc,
       nickname   = excluded.nickname,
       status     = 'active',
       last_error = NULL,
       updated_at = unixepoch()`,
    userId,
    provider,
    encryptSecret(cookie),
    nickname,
  );
}

export function dropCredential(userId: number, provider: PanProvider): void {
  run(`DELETE FROM user_pan_credentials WHERE user_id = ? AND provider = ?`, userId, provider);
}

export function markCredentialError(userId: number, provider: PanProvider, message: string): void {
  run(
    `UPDATE user_pan_credentials SET last_error = ?, status = 'invalid', updated_at = unixepoch()
      WHERE user_id = ? AND provider = ?`,
    message,
    userId,
    provider,
  );
}
