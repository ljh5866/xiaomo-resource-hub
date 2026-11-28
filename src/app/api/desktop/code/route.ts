import { issueCode } from "@/lib/auth/email-code";
import { EMAIL_RE } from "@/lib/auth/register-core";
import { hit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/desktop/auth";

export const runtime = "nodejs";

/** POST /api/desktop/code { email, purpose } → 发送 6 位验证码（register / login） */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; purpose?: string }
    | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const purpose = body?.purpose === "login" ? "login" : "register";

  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, message: "邮箱格式不对" }, { status: 400 });
  }

  const ip = clientIp(req);
  const rl = hit(`desktop:code:${ip}`, { limit: 20, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return Response.json({ ok: false, message: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const result = await issueCode(email, ip, purpose);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
