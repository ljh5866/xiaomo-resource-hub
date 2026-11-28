import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 桌面端 token（无状态签名令牌）
 *
 * 为什么不用 NextAuth 的 cookie：
 *   桌面端不是浏览器，拿不到也不该拿 JWT cookie；而且桌面端要用同一个账号体系，
 *   最省事的做法是复用 AUTH_SECRET 签发一个自包含令牌。
 *
 * 令牌结构：base64url(payload).base64url(HMAC-SHA256(secret, payloadB64))
 * payload = { uid: number, tv: number, exp: number(秒) }
 *
 * 吊销沿用网站那套：users.token_version 变化（改密码 / 后台 revoke）后，旧令牌自动失效。
 */

const TTL_SEC = 30 * 24 * 60 * 60; // 30 天

export type DesktopPayload = { uid: number; tv: number; exp: number };

function secret(): string {
  const s = process.env.AUTH_SECRET ?? "";
  if (!s) throw new Error("AUTH_SECRET 未配置，无法签发桌面端令牌");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function issueToken(uid: number, tokenVersion: number): string {
  const payload: DesktopPayload = {
    uid,
    tv: Number(tokenVersion) || 0,
    exp: Math.floor(Date.now() / 1000) + TTL_SEC,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string): DesktopPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: DesktopPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DesktopPayload;
  } catch {
    return null;
  }
  if (!Number.isFinite(payload?.uid) || !Number.isFinite(payload?.exp)) return null;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}
