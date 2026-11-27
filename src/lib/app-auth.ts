import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { get } from "@/db/client";

/**
 * 桌面端 token 认证。
 *
 * 为什么不用 NextAuth 的 session cookie：
 * 桌面端页面跑在 tauri://localhost，调 https://ttals.com 是跨站请求，
 * SameSite=Lax 的 session cookie 根本带不上。所以给桌面端单独发一个 Bearer token。
 *
 * token = base64url(payload) + "." + base64url(HMAC-SHA256)
 * payload = { uid, tv, exp }
 *   tv 是 users.token_version —— 改密码 / 强制下线时 +1，旧 token 立刻失效。
 */
const TTL_DAYS = 30;

function secret(): Buffer {
  const base = process.env.AUTH_SECRET ?? "dev-only-insecure-secret";
  return createHash("sha256").update(`${base}:app-token:v1`).digest();
}

type Payload = { uid: number; tv: number; exp: number };

export function signAppToken(uid: number, tokenVersion: number): string {
  const payload: Payload = {
    uid,
    tv: tokenVersion,
    exp: Math.floor(Date.now() / 1000) + TTL_DAYS * 86400,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyAppToken(token: string): Payload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expect = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let p: Payload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }
  if (!p?.uid || typeof p.exp !== "number" || p.exp < Math.floor(Date.now() / 1000)) return null;
  return p;
}

export type AppUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  tokenVersion: number;
};

/** 从 Authorization: Bearer 头解析用户；token 里的 tv 必须与库里一致 */
export function getAppUser(req: Request): AppUser | null {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const payload = verifyAppToken(token);
  if (!payload) return null;

  const row = get<{
    id: number;
    email: string;
    name: string | null;
    role: string;
    token_version: number;
    status: string;
  }>("SELECT id, email, name, role, token_version, status FROM users WHERE id = ?", payload.uid);

  if (!row) return null;
  if ((row.status ?? "active") !== "active") return null;
  if (row.token_version !== payload.tv) return null; // 已吊销

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tokenVersion: row.token_version,
  };
}

/** 未登录时的标准响应 */
export function unauthorized(): Response {
  return Response.json({ ok: false, error: "unauthorized", needLogin: true }, { status: 401 });
}
