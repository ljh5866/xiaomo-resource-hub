"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
import { Avatar } from "@/components/user/avatar";

type Me = { name: string; avatarUrl: string | null; email: string };

/**
 * 顶部账号区：头像 + 昵称（点进用户页）+ 设置 + 退出。
 *
 * 头像和昵称来自 /api/me（实时读库），而不是 session——
 * JWT 里的快照在改名/换头像后不会更新，会导致"换了头像不显示"。
 */
export function UserMenu() {
  const { data, status } = useSession();
  const sessionUser = data?.user as { email?: string | null } | undefined;
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setMe(null);
      return;
    }
    let alive = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: Me | null) => {
        if (alive && json?.name) setMe(json);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  if (status === "loading") {
    return (
      <span className="inline-flex min-h-11 w-16 items-center justify-center" aria-hidden>
        <span className="h-8 w-8 animate-pulse rounded-full bg-surface-2" />
      </span>
    );
  }

  if (!sessionUser) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center px-3 text-sm text-muted transition-colors hover:text-accent"
      >
        登录
      </Link>
    );
  }

  const displayName = me?.name ?? "我的";
  const avatar = me?.avatarUrl ?? null;

  return (
    <span className="flex items-center gap-0.5">
      <Link
        href="/me"
        title={me?.email ?? sessionUser.email ?? undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-full pl-1 pr-2 text-sm text-ink transition-colors hover:text-accent"
      >
        <Avatar name={displayName} src={avatar} size="sm" />
        <span className="hidden max-w-[7em] truncate sm:inline">{displayName}</span>
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
