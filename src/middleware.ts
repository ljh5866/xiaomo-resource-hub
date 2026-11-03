import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/lib/auth/config";

/**
 * 只保护 /admin。未登录跳 /login 并带回跳地址。
 * 这里刻意不引入数据库（middleware 跑在边缘运行时）。
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (req.auth?.user) return NextResponse.next();

  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
