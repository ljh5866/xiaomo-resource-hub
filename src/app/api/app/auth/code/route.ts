import { issueCode } from "@/lib/auth/email-code";
import { clientKey, hit } from "@/lib/rate-limit";
import { corsOptions } from "@/lib/app-cors";

/**
 * POST /api/app/auth/code { email }
 *
 * 桌面端用的「发登录验证码」。复用网站的 issueCode（同样的 6 位码、
 * sha256 落库、10 分钟过期、60 秒冷却），只是换成 JSON 接口。
 */
export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return Response.json({ ok: false, error: "请求格式不对" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ ok: false, error: "邮箱格式不对" }, { status: 400 });
  }

  // 额外一层：同 IP 10 分钟最多 5 次发码（issueCode 内部还有按邮箱的 60 秒冷却）
  const key = `${clientKey(req, "app-code")}`;
  const rl = hit(key, { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: `发送过于频繁，请 ${rl.retryAfterSec} 秒后再试` },
      { status: 429 },
    );
  }

  const r = await issueCode(email, clientKey(req, "ip"), "login");
  return Response.json({ ok: r.ok, error: r.ok ? undefined : r.message });
}

export const OPTIONS = corsOptions;
