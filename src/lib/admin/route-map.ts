/**
 * 后台路由决策（纯函数，便于单测）。
 * middleware 只负责把决策翻译成 NextResponse。
 */
export type AdminRouteInput = {
  pathname: string;
  search?: string;
  host: string;
  authenticated: boolean;
  role?: string;
  /** 配置了它才启用子域名模式 */
  adminHost?: string | null;
  /** 路径模式下的后台前缀，默认 admin */
  adminPath?: string | null;
  /** 非管理员访问子域名时回落到哪个站点 */
  siteHost?: string | null;
};

export type AdminRouteDecision =
  | { kind: "pass" }
  | { kind: "redirect"; to: string }
  | { kind: "rewrite"; pathname: string };

const REAL = "/admin";

function normHost(host: string) {
  return host.toLowerCase().split(":")[0];
}

export function decideAdminRoute(input: AdminRouteInput): AdminRouteDecision {
  const pathname = input.pathname;
  const search = input.search ?? "";
  const host = normHost(input.host);
  const adminHost = input.adminHost ? normHost(input.adminHost) : "";
  const adminPath = (input.adminPath ?? "admin").replace(/^\/+|\/+$/g, "");
  const prefix = `/${adminPath}`;
  const siteHost = input.siteHost ? normHost(input.siteHost) : "localhost";

  const isReal = pathname === REAL || pathname.startsWith(`${REAL}/`);
  const isAlias = adminPath !== "admin" && (pathname === prefix || pathname.startsWith(`${prefix}/`));

  /* ───── 子域名模式 ───── */
  if (adminHost && host === adminHost) {
    // 框架资源 / 鉴权接口 / 登录注册页原样放行
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/files/") ||
      pathname === "/favicon.ico" ||
      pathname === "/robots.txt" ||
      pathname === "/login" ||
      pathname === "/register"
    ) {
      return { kind: "pass" };
    }

    if (!input.authenticated) {
      return { kind: "redirect", to: `/login?next=${encodeURIComponent(pathname + search)}` };
    }

    if (input.role !== "admin") {
      return { kind: "redirect", to: `https://${siteHost}/` };
    }

    // 页面里的绝对路径 /admin/xxx：不要再加一层前缀
    if (isReal) return { kind: "pass" };

    return { kind: "rewrite", pathname: REAL + (pathname === "/" ? "" : pathname) };
  }

  /* ───── 主域访问后台路径：统一跳到子域名 ───── */
  if (adminHost && (isReal || isAlias)) {
    const base = isReal ? REAL : prefix;
    const rest = pathname === base ? "/" : pathname.slice(base.length);
    return { kind: "redirect", to: `https://${adminHost}${rest}${search}` };
  }

  /* ───── 路径模式 ───── */
  if (!isReal && !isAlias) return { kind: "pass" };

  if (!input.authenticated) {
    return { kind: "redirect", to: `/login?next=${encodeURIComponent(pathname + search)}` };
  }

  if (input.role !== "admin") {
    return { kind: "redirect", to: "/" };
  }

  if (isAlias) {
    return { kind: "rewrite", pathname: REAL + pathname.slice(prefix.length) };
  }

  return { kind: "pass" };
}
