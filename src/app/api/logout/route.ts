import { NextResponse } from "next/server";

/**
 * 退出登录：清掉会话 cookie 后回首页。
 *
 * 踩过的四个坑（docs/08 + docs/24）：
 * 1) next-auth 的 signOut 在 Server Action 里 Set-Cookie 会丢
 * 2) 裸 Response + cookies().delete() 不带 Set-Cookie（必须用 NextResponse）
 * 3) NextResponse.redirect(new URL(...)) 会把 host 规范成 localhost
 * 4) **HTTPS 下 next-auth 用的是 `__Secure-authjs.session-token`；浏览器规定
 *    覆盖 `__Secure-` 开头的 cookie 时 Set-Cookie 里必须带 Secure，
 *    否则整条 Set-Cookie 被丢弃 —— 表现就是"点退出没反应"。**
 *
 * 所以这里不用 cookies().delete()，而是按请求里实际出现的 cookie 名逐个下发
 * 显式过期指令，并且对 `__Secure-` 前缀补上 Secure。
 */

function clearCookies(req: Request) {
  const header = req.headers.get("cookie") ?? "";
  const names = new Set<string>();

  for (const part of header.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name) continue;
    // 会话、回调地址、CSRF 三件套；分块 cookie（name.0 / name.1）也算
    if (
      name.includes("session-token") ||
      name.includes("callback-url") ||
      name.includes("csrf-token")
    ) {
      names.add(name);
    }
  }

  const res = new NextResponse(null, { status: 303 });
  res.headers.set("Location", "/");
  res.headers.set("Cache-Control", "no-store");

  for (const name of names) {
    const secure = name.startsWith("__Secure-");
    const host = name.startsWith("__Host-");

    // 手动拼：需要 Secure 时必须显式带上，否则浏览器丢弃这条指令
    const attrs = [
      `${name}=`,
      "Path=/",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      secure || host ? "Secure" : "",
      "HttpOnly",
      "SameSite=Lax",
    ].filter(Boolean);

    res.headers.append("Set-Cookie", attrs.join("; "));
  }

  return res;
}

export async function POST(req: Request) {
  return clearCookies(req);
}

export async function GET(req: Request) {
  return clearCookies(req);
}
