import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/lib/auth/config";
import { decideAdminRoute } from "@/lib/admin/route-map";

/**
 * 后台路由：两种模式，由 ADMIN_HOST 决定（决策逻辑是纯函数，见 lib/admin/route-map.ts）
 *
 * A. 路径模式（默认）      https://ttals.com/admin
 * B. 子域名模式（推荐）    ADMIN_HOST=admin.ttals.com
 *      https://admin.ttals.com/        → 概览
 *      https://admin.ttals.com/users   → 用户
 *      https://ttals.com/admin         → 301 到子域名
 *
 * 真正的权限校验在 /admin/layout.tsx（requireAdmin 查库），这里只做路由与粗粒度放行。
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const decision = decideAdminRoute({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    host: req.headers.get("host") ?? "",
    authenticated: Boolean(req.auth?.user),
    role: (req.auth?.user as { role?: string } | undefined)?.role,
    adminHost: process.env.ADMIN_HOST,
    adminPath: process.env.ADMIN_PATH,
    siteHost: process.env.SITE_HOST ?? req.headers.get("host"),
  });

  if (decision.kind === "pass") return NextResponse.next();

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.nextUrl.origin));
  }

  const url = req.nextUrl.clone();
  url.pathname = decision.pathname;
  return NextResponse.rewrite(url);
});

export const config = {
  // 排除静态资源、文件流与 API：
  //   /api/* 的鉴权在各 route 里自己做（auth() / requireAdmin），
  //   而 middleware 包着 NextAuth 会在每个请求上重写会话 cookie ——
  //   那会把 /api/logout 刚刚清掉的 cookie 又写回去，表现就是"点退出没反应"。
  matcher: ["/((?!_next/static|_next/image|favicon.ico|files/|api/|.*\\..*).*)"],
};
