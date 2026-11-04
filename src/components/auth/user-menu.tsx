"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogOut } from "lucide-react";

/**
 * 登录态放在客户端：服务端页面因此可以继续静态化 / ISR。
 * 前台不提供后台入口——管理员直接访问管理地址即可。
 */
export function UserMenu() {
  const { data, status } = useSession();
  const user = data?.user;

  if (status === "loading") {
    return (
      <span className="inline-flex min-h-11 w-16 items-center justify-center" aria-hidden>
        <span className="h-3 w-10 animate-pulse rounded bg-surface-2" />
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center px-3 text-sm text-muted transition-colors hover:text-accent"
      >
        登录
      </Link>
    );
  }

  return (
    <a
      href="/api/logout"
      title={user.email ?? undefined}
      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-3 text-sm text-muted transition-colors hover:text-accent"
    >
      <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
      <span className="hidden sm:inline">退出</span>
    </a>
  );
}
