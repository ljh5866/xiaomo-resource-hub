/**
 * 夸克扫码登录（走夸克自己的 CAS，不逆向签名）。
 *
 * 实测（2026-11-06）：
 *   ① GET uop.quark.cn/cas/ajax/getTokenForQrcodeLogin?client_id=532&v=1.2&request_id=<uuid>
 *        → {"status":2000000,"data":{"members":{"token":"sta33…"}}}
 *   ② 二维码内容 = https://su.quark.cn/4_eMHBJ?token=<token>&client_id=532&ssb=weblogin&uc_param_str=&uc_biz_str=…
 *   ③ GET …/getServiceTicketByQrcodeToken?client_id=532&v=1.2&request_id=<uuid>&token=<token>
 *        未扫码 → {"status":50004001,"message":"Query result is empty"}
 *   ④ GET uop.quark.cn/cas/login?service=<回调>&ticket=<ST> → 302 + Set-Cookie
 *
 * token 与 request_id 都只在服务端保存，前端只拿二维码字符串和一个 sessionId。
 */

import { verifyCookie } from "./quark";
import { panRequest } from "./http";

const UOP = "https://uop.quark.cn";
const CLIENT_ID = "532";
const QR_HOST = "https://su.quark.cn/4_eMHBJ";
const UC_BIZ_STR =
  "S%3Acustom%7COPT%3ASAREA%400%7COPT%3AIMMERSIVE%401%7COPT%3ABACK_BTN_STYLE%400";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36";

export type QrSession = { requestId: string; token: string; createdAt: number; jar: string };

const sessions = new Map<string, QrSession>();
const TTL = 10 * 60 * 1000;

function uuid(): string {
  return crypto.randomUUID();
}

function sweep() {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (now - v.createdAt > TTL) sessions.delete(k);
  }
}

/** ① 拿 token，拼出二维码内容 */
export async function startQrLogin(): Promise<{
  sessionId: string;
  qrContent: string;
} | null> {
  sweep();
  const requestId = uuid();
  const url = `${UOP}/cas/ajax/getTokenForQrcodeLogin?client_id=${CLIENT_ID}&v=1.2&request_id=${requestId}`;
  const res = await panRequest(url, {
    headers: { "user-agent": UA, referer: "https://pan.quark.cn/" },
  }).catch(() => null);
  if (!res || res.status === 0) return null;

  type TokenResp = { status?: number; data?: { members?: { token?: string } } };
  let json: TokenResp | null = null;
  try {
    json = JSON.parse(res.text) as TokenResp;
  } catch {
    json = null;
  }
  const token = json?.data?.members?.token;
  if (!token) return null;

  const sessionId = uuid();
  sessions.set(sessionId, { requestId, token, createdAt: Date.now(), jar: "" });

  const qrContent =
    `${QR_HOST}?token=${encodeURIComponent(token)}&client_id=${CLIENT_ID}` +
    `&ssb=weblogin&uc_param_str=&uc_biz_str=${UC_BIZ_STR}`;

  return { sessionId, qrContent };
}

export type QrState =
  | { state: "waiting" }
  | { state: "scanned" }
  | { state: "expired" }
  | { state: "ok"; cookie: string; nickname: string | null }
  | { state: "error"; message: string };

/** 从 302/200 响应里把 Set-Cookie 拼成 Cookie 头 */
function collectCookies(headers: Headers): string {
  const raw =
    typeof (headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (headers as { getSetCookie: () => string[] }).getSetCookie()
      : [headers.get("set-cookie") ?? ""];
  const jar = new Map<string, string>();
  for (const line of raw) {
    for (const part of line.split(/,(?=[^;]+=)/)) {
      const first = part.split(";")[0]?.trim();
      if (!first) continue;
      const eq = first.indexOf("=");
      if (eq <= 0) continue;
      jar.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function mergeCookieLocal(a: string, b: string): string {
  const jar = new Map<string, string>();
  for (const part of `${a};${b}`.split(";")) {
    const t = part.trim();
    if (!t) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    jar.set(t.slice(0, eq), t.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * ④ 用 service_ticket 换 Cookie —— 夸克是**多跳**下发：
 *   第 1 跳 `/cas/login?ticket=…` → 302 + Set-Cookie(CASTGC)
 *   第 2 跳跟到 Location（带 CASTGC）→ 302/200 + Set-Cookie(__pus/__puus…)
 * undici 不维护 cookie jar，所以必须手动跟跳并合并。
 */
export async function exchangeTicket(
  ticket: string,
  diag?: string[],
): Promise<string | null> {
  let jar = "";
  let url = `${UOP}/cas/login?service=${encodeURIComponent("https://pan.quark.cn/")}&ticket=${encodeURIComponent(ticket)}`;

  for (let hop = 0; hop < 5; hop += 1) {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        referer: "https://pan.quark.cn/",
        accept: "text/html,application/xhtml+xml,*/*",
        ...(jar ? { cookie: jar } : {}),
      },
      redirect: "manual",
      cache: "no-store",
    }).catch(() => null);

    if (!res) {
      diag?.push(`hop${hop} fetch failed`);
      break;
    }

    const rawCookies =
      typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
        : [res.headers.get("set-cookie") ?? ""];
    const names = rawCookies
      .flatMap((l) => l.split(/,(?=[^;]+=)/))
      .map((l) => l.split(";")[0]?.split("=")[0]?.trim())
      .filter(Boolean);

    jar = mergeCookieLocal(jar, collectCookies(res.headers));
    const loc = res.headers.get("location");
    diag?.push(`hop${hop} ${res.status} set=[${names.join(",") || "-"}] next=${loc ? loc.slice(0, 70) : "-"}`);

    if (!loc) break;
    let next: URL;
    try {
      next = new URL(loc, url);
    } catch {
      break;
    }
    if (!next.hostname.endsWith("quark.cn")) {
      diag?.push(`hop${hop} 跳出夸克域 ${next.hostname}，停止`);
      break;
    }
    url = next.toString();
  }

  return jar || null;
}


/** ③ 轮询扫码状态；成功后自动换 Cookie 并验证 */
export async function pollQrLogin(sessionId: string, diag?: string[]): Promise<QrState> {
  const s = sessions.get(sessionId);
  if (!s) return { state: "expired" };
  if (Date.now() - s.createdAt > TTL) {
    sessions.delete(sessionId);
    return { state: "expired" };
  }

  const url =
    `${UOP}/cas/ajax/getServiceTicketByQrcodeToken?client_id=${CLIENT_ID}&v=1.2` +
    `&request_id=${encodeURIComponent(s.requestId)}&token=${encodeURIComponent(s.token)}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      referer: "https://pan.quark.cn/",
      ...(s.jar ? { cookie: s.jar } : {}),
    },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { state: "error", message: "连不上夸克" };

  /**
   * 实测（2026-11-06 抓包）：扫码确认后**没有 CAS 换票跳转**，
   * 登录态是由 getServiceTicketByQrcodeToken 这个响应自己 Set-Cookie 下发的
   * （ctoken / b-user-id / isQuark / _UP_*），所以这里必须累积 cookie jar。
   */
  const setNow = collectCookies(res.headers);
  if (setNow) {
    s.jar = s.jar ? mergeCookieLocal(s.jar, setNow) : setNow;
    diag?.push(`poll set-cookie=[${setNow.split(";").map((x) => x.trim().split("=")[0]).join(",")}]`);
  }

  const json = (await res.json().catch(() => null)) as {
    status?: number;
    message?: string;
    data?: { members?: { service_ticket?: string }; service_ticket?: string };
  } | null;

  const status = json?.status ?? 0;
  const ticket = json?.data?.members?.service_ticket ?? json?.data?.service_ticket;

  // ① 优先用本轮累计到的 cookie 直接验（正常路径）
  if (s.jar) {
    const verified = await verifyCookie(s.jar);
    if (verified) {
      sessions.delete(sessionId);
      return { state: "ok", cookie: verified.cookie, nickname: verified.nickname };
    }
  }

  if (status === 50004001) return { state: "waiting" };

  if (ticket) {
    // ② 兜底：若 CAS 侧另有换票入口，再试一次多跳
    const exchanged = await exchangeTicket(ticket, diag);
    if (exchanged) {
      const merged = s.jar ? mergeCookieLocal(s.jar, exchanged) : exchanged;
      const verified2 = await verifyCookie(merged);
      if (verified2) {
        sessions.delete(sessionId);
        return { state: "ok", cookie: verified2.cookie, nickname: verified2.nickname };
      }
    }
    return { state: "error", message: "已扫码，但拿到的 Cookie 无效（夸克可能改了字段）" };
  }

  // 已扫码待手机确认
  if (status === 2000000 || /scan/i.test(json?.message ?? "")) return { state: "scanned" };
  return { state: "waiting" };
}
