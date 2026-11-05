import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSessionUser, requireAdmin } from "@/lib/auth";
import { SessionRevoked } from "@/components/auth/session-revoked";
import { AdminNav, type NavGroup } from "@/components/admin/admin-nav";
import { RefreshCacheButton } from "@/components/admin/refresh-cache-button";

export const metadata: Metadata = {
  title: "控制台",
  robots: { index: false, follow: false },
};

const NAV: NavGroup[] = [
  {
    group: "内容",
    items: [
      { href: "/admin", label: "概览", icon: "dashboard" },
      { href: "/admin/resources", label: "资源", icon: "resources" },
      { href: "/admin/games", label: "游戏分类", icon: "games" },
      { href: "/admin/taxonomy", label: "分类与标签", icon: "taxonomy" },
    ],
  },
  {
    group: "运营",
    items: [
      { href: "/admin/submissions", label: "投稿", icon: "submissions" },
      { href: "/admin/reports", label: "举报", icon: "reports" },
      { href: "/admin/links", label: "链接巡检", icon: "links" },
    ],
  },
  {
    group: "系统",
    items: [
      { href: "/admin/imports", label: "批量导入", icon: "imports" },
      { href: "/admin/users", label: "用户", icon: "users" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // middleware 已拦一次；这里再做一次服务端校验（纵深防御）
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/admin");

  // 登录了但不是管理员：JWT 还在 → 说明角色被降级，走"会话失效"页
  const user = await requireAdmin();
  if (!user) return <SessionRevoked />;

  return (
    <div className="admin-scope min-h-screen">
      <div className="flex min-h-screen">
        {/* ───── 侧栏（桌面） ───── */}
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-line bg-surface md:flex">
          <div className="flex h-14 items-center border-b border-line px-4">
            <Link href="/admin" className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold text-ink">小莫控制台</span>
              <span className="font-mono text-[10px] tracking-wider text-dim">ADMIN</span>
            </Link>
          </div>

          <AdminNav nav={NAV} />

          <div className="mt-auto border-t border-line p-3">
            <p className="truncate text-[12px] text-muted">{user.name || user.email}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-dim">
              {user.role}
            </p>
            <a
              href="/api/logout"
              className="mt-2 inline-flex min-h-8 w-full items-center gap-1.5 rounded-[6px] border border-line px-2 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <LogOut className="size-3.5" strokeWidth={1.5} aria-hidden />
              退出
            </a>
          </div>
        </aside>

        {/* ───── 主区 ───── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm md:px-6">
            <AdminNav nav={NAV} variant="mobile" />

            <span className="hidden text-[12px] text-dim lg:inline">
              维护后台 · 操作直接写库
            </span>

            <div className="ml-auto flex items-center gap-2">
              <RefreshCacheButton />
              <Link
                href="/"
                target="_blank"
                className="inline-flex min-h-8 items-center rounded-[6px] border border-line px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                查看前台 ↗
              </Link>
              <a
                href="/api/logout"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] bg-ink px-2.5 text-[12px] text-white transition-opacity hover:opacity-90"
              >
                <LogOut className="size-3.5" strokeWidth={1.5} aria-hidden />
                退出
              </a>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
