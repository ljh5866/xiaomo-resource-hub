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

/**
 * 子域名下的友好别名：管理员习惯直接打 /submit、/users 这类前台路径，
 * 以前会被拼成 /admin/submit → 404。这里映射到真正的后台页面。
 */
const ALIASES: Record<string, string> = {
  "/submit": "/admin/submissions",
  "/submissions": "/admin/submissions",
  "/reports": "/admin/reports",
  "/users": "/admin/users",
  "/games": "/admin/games",
  "/taxonomy": "/admin/taxonomy",
  "/imports": "/admin/imports",
  "/import": "/admin/imports",
  "/links": "/admin/links",
  "/resources": "/admin/resources",
};

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
    // 后台自己的登录页：和前台登录分开（前台是给收藏/投稿的用户，后台是给管理员的）
    if (pathname === "/login") {
      return { kind: "rewrite", pathname: "/admin-login" };
    }

    // 后台子域不开放注册，直接把想注册的人送回前台
    if (pathname === "/register") {
      return { kind: "redirect", to: `https://${siteHost}/register` };
    }

    // 框架资源 / 鉴权接口 / 登录页本身原样放行
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/files/") ||
      pathname === "/favicon.ico" ||
      pathname === "/robots.txt" ||
      pathname === "/admin-login"
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

    // 常用别名 → 对应后台页，避免拼成 /admin/submit 这种不存在的路径
    const alias = ALIASES[pathname.replace(/\/+$/, "") || "/"];
    if (alias) return { kind: "rewrite", pathname: alias };

    // 首页进控制台
    if (pathname === "/" || pathname === "") return { kind: "rewrite", pathname: REAL };

    // 其余未知路径统一回控制台，而不是给一个 404
    return { kind: "redirect", to: REAL };
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
