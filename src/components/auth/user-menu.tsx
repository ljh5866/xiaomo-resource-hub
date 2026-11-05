"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogOut, UserRound } from "lucide-react";
import { Avatar } from "@/components/user/avatar";

/**
 * 登录态放在客户端：服务端页面因此可以继续静态化 / ISR。
 * 前台不提供后台入口——管理员直接访问管理地址即可。
 */
export function UserMenu() {
  const { data, status } = useSession();
  const user = data?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;

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
    <span className="flex items-center">
      <Link
        href="/me"
        title={user.email ?? undefined}
        className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-muted transition-colors hover:text-accent"
      >
        <Avatar name={user.name ?? user.email ?? "我"} src={user.image ?? null} size="sm" />
        <span className="hidden max-w-[8em] truncate sm:inline">{user.name ?? "我的"}</span>
      </Link>

      <a
        href="/api/logout"
        title="退出登录"
        className="inline-flex min-h-11 cursor-pointer items-center px-2 text-muted transition-colors hover:text-danger"
      >
        <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
        <span className="sr-only">退出</span>
      </a>
    </span>
  );
}
