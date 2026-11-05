"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
import { Avatar } from "@/components/user/avatar";

/**
 * 顶部账号区：头像 + 昵称（点进用户页）+ 设置 + 退出。
 * 导航里不再放「我的」，避免和这里重复。
 */
export function UserMenu() {
  const { data, status } = useSession();
  const user = data?.user as
    | { name?: string | null; email?: string | null; image?: string | null }
    | undefined;

  if (status === "loading") {
    return (
      <span className="inline-flex min-h-11 w-16 items-center justify-center" aria-hidden>
        <span className="h-8 w-8 animate-pulse rounded-full bg-surface-2" />
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
    <span className="flex items-center gap-0.5">
      <Link
        href="/me"
        title={user.email ?? undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-full pl-1 pr-2 text-sm text-ink transition-colors hover:text-accent"
      >
        <Avatar name={user.name ?? user.email ?? "我"} src={user.image ?? null} size="sm" />
        <span className="hidden max-w-[7em] truncate sm:inline">{user.name ?? "我的"}</span>
      </Link>

      <Link
        href="/me/settings"
        title="设置"
        aria-label="设置"
        className="inline-flex min-h-11 w-9 cursor-pointer items-center justify-center text-muted transition-colors hover:text-ink"
      >
        <Settings className="size-4" strokeWidth={1.5} aria-hidden />
      </Link>

      <a
        href="/api/logout"
        title="退出登录"
        aria-label="退出登录"
        className="inline-flex min-h-11 w-9 cursor-pointer items-center justify-center text-muted transition-colors hover:text-danger"
      >
        <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
      </a>
    </span>
  );
}
