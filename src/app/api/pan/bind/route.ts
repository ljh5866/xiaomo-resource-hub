import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { saveCredential } from "@/lib/pan/credentials";
import { verifyCookie } from "@/lib/pan/quark";
import { extractCookie } from "@/lib/pan/cookie-input";

/**
 * POST /api/pan/bind { cookie }
 *
 * 浏览器扩展（或手动粘贴）拿到的夸克 Cookie，验证有效后加密落库。
 * 与 Server Action 走同一套逻辑，只是给扩展用 —— 扩展不能调 Server Action。
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "请先登录本站" }, { status: 401 });

  let raw = "";
  try {
    const body = (await req.json()) as { cookie?: string };
    raw = String(body.cookie ?? "");
  } catch {
    return Response.json({ error: "请求格式不对" }, { status: 400 });
  }

  const cookie = extractCookie(raw);
  if (cookie.length < 40) {
    return Response.json({ error: "Cookie 太短，可能没取到登录态" }, { status: 400 });
  }

  const info = await verifyCookie(cookie);
  if (!info) {
    return Response.json(
      { error: "夸克拒绝了这串 Cookie（可能已过期，或浏览器里没登录夸克）" },
      { status: 400 },
    );
  }

  saveCredential(user.id, "quark", info.cookie, info.nickname);
  revalidatePath("/me/pan");
  revalidatePath("/me");

  return Response.json({ ok: true, nickname: info.nickname });
}
