import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * 退出登录：删除会话 cookie 后回首页。
 *
 * 三个踩过的坑（都记在 docs/08）：
 * 1) next-auth 的 signOut 在 Server Action 里 Set-Cookie 会丢
 * 2) 用裸 Response + cookies().delete() 不会带上 Set-Cookie（必须用 NextResponse）
 * 3) NextResponse.redirect(new URL(...)) 会把 host 规范成 localhost，导致跨源
 *    → 用 NextResponse + 手写相对 Location
 */
async function logout() {
  const store = await cookies();
  for (const c of store.getAll()) {
    if (c.name.includes("session-token") || c.name.includes("callback-url")) {
      store.delete(c.name);
    }
  }

  const res = new NextResponse(null, { status: 303 });
  res.headers.set("Location", "/");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST() {
  return logout();
}

export async function GET() {
  return logout();
}
