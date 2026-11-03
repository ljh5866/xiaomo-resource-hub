import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { site } from "@/content/site";
import { getSessionUser } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { SessionRevoked } from "@/components/auth/session-revoked";

export const metadata: Metadata = {
  title: "后台",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "概览" },
  { href: "/admin/resources", label: "资源" },
  { href: "/admin/taxonomy", label: "分类标签" },
  { href: "/admin/submissions", label: "投稿" },
  { href: "/admin/reports", label: "举报" },
  { href: "/admin/imports", label: "批量导入" },
  { href: "/admin/links", label: "链接巡检" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // middleware 已拦一次；这里再做一次服务端校验（纵深防御）
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin");

  const user = await getSessionUser();
  // JWT 还在但版本对不上 → 账号被改密码/强制下线
  if (!user) return <SessionRevoked />;

  return (
    <div className="container-page py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <span className="font-serif text-[20px] font-bold text-ink">后台</span>
          <span className="font-mono text-[10px] tracking-[0.18em] text-dim">
            {site.latin}
          </span>
        </div>

        <nav aria-label="后台导航" className="flex flex-wrap items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="inline-flex min-h-11 items-center border border-line px-3 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/"
            className="inline-flex min-h-11 items-center px-3 text-[13px] text-dim transition-colors hover:text-accent"
          >
            回前台
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-[12px] text-muted sm:inline">
            {user.name || user.email}
            {user.role === "admin" && (
              <span className="ml-1.5 border border-accent/40 px-1 text-[10px] text-accent">
                管理员
              </span>
            )}
          </span>
          <a
            href="/api/logout"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 border border-line px-3 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <LogOut className="size-3.5" strokeWidth={1.5} aria-hidden />
            退出
          </a>
        </div>
      </div>

      <div className="pt-6">{children}</div>
    </div>
  );
}
