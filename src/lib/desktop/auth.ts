import { get } from "@/db/client";
import { verifyToken } from "./token";

/**
 * 桌面端请求鉴权：Bearer token → 用户行。
 * 每次请求都回表校验 token_version，改密码后旧令牌立刻失效。
 */

export type DesktopUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  createdAt: number;
};

type Row = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  avatar_url: string | null;
  token_version: number;
  status: string;
  created_at: number;
};

export function bearer(req: Request): string {
  const raw = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1].trim() : "";
}

/** 校验令牌并取用户；失败返回 null（调用方给 401） */
export function desktopUser(req: Request): DesktopUser | null {
  const payload = verifyToken(bearer(req));
  if (!payload) return null;

  const row = get<Row>(
    "SELECT id, email, name, role, avatar_url, token_version, status, created_at FROM users WHERE id = ?",
    payload.uid,
  );
  if (!row) return null;
  if ((row.status ?? "active") !== "active") return null;
  if (Number(row.token_version) !== Number(payload.tv)) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email.split("@")[0],
    role: row.role,
    avatarUrl: row.avatar_url,
    createdAt: Number(row.created_at) * 1000,
  };
}

/** 统一的 401 响应 */
export function unauthorized(message = "登录已失效，请重新登录") {
  return Response.json({ ok: false, message, needLogin: true }, { status: 401 });
}

/** 取请求 IP（限流用），与网站其余接口保持一致 */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desktop"
  );
}
