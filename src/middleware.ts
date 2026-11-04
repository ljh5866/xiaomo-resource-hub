import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/lib/auth/config";

/**
 * 只保护后台，且只放行管理员。
 *
 * 后台地址可通过 ADMIN_PATH 改成一个只有你知道的路径（默认 admin）：
 *   ADMIN_PATH=console-x7k2  →  https://站点/console-x7k2
 * 前台没有任何地方链接到它，robots 里也 Disallow。
 *
 * 这里不引入数据库（middleware 跑在边缘运行时），角色来自 JWT 里的 role 声明；
 * 真正的纵深防御在 /admin/layout.tsx 里用 requireAdmin() 再做一次。
 */
const { auth } = NextAuth(authConfig);

const ADMIN_PATH = (process.env.ADMIN_PATH ?? "admin").replace(/^\/+|\/+$/g, "");
const ADMIN_PREFIX = `/${ADMIN_PATH}`;
const ADMIN_REAL = "/admin";

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isAlias = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  const isReal = pathname === ADMIN_REAL || pathname.startsWith(`${ADMIN_REAL}/`);

  if (!isAlias && !isReal) return NextResponse.next();

  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  // 未登录 → 登录页（带回跳）
  if (!req.auth?.user) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", isAlias ? pathname + search : pathname + search);
    return NextResponse.redirect(url);
  }

  // 登录了但不是管理员 → 当作不存在，直接回首页
  if (role !== "admin") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (isAlias && ADMIN_PREFIX !== ADMIN_REAL) {
    const url = req.nextUrl.clone();
    url.pathname = ADMIN_REAL + pathname.slice(ADMIN_PREFIX.length);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
});

export const config = {
  // 排除静态资源与文件流，其余路径都过一遍（后台路径可配置，无法写死 matcher）
  matcher: ["/((?!_next/static|_next/image|favicon.ico|files/|.*\\..*).*)"],
};
