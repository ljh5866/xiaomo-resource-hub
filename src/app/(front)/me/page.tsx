import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Inbox, Settings } from "lucide-react";
import { Avatar } from "@/components/user/avatar";
import { ResourceCard } from "@/components/resource/resource-card";
import { ButtonLink } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { get } from "@/db/client";
import { listUserFavorites, listUserSubmissions } from "@/lib/queries/user";
import { formatCount } from "@/lib/utils";
import { normalizeAvatarUrl } from "@/lib/user/avatar-url";

export const metadata: Metadata = {
  title: "我的",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const TABS = [
  { key: "favorites", label: "收藏", icon: Bookmark },
  { key: "submissions", label: "投稿", icon: Inbox },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * 用户页：资料 + 收藏 + 投稿。
 * 设置是独立页面（/me/settings），不放在 tab 里。
 */
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "favorites";

  const user = await getSessionUser();
  // 收藏只对登录用户开放：未登录直接去登录页，登录后回到这里
  if (!user) redirect("/login?next=/me");

  /* 已登录 */
  const row = get<{ avatar_url: string | null; created_at: number; role: string }>(
    "SELECT avatar_url, created_at, role FROM users WHERE id = ?",
    user.id,
  );

  const favorites = listUserFavorites(user.id);
  const submissions = listUserSubmissions(user.id);
  const displayName = user.name ?? user.email.split("@")[0];
  const joined = row ? new Date(row.created_at * 1000).toISOString().slice(0, 10) : "—";

  return (
    <div className="container-page py-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} src={normalizeAvatarUrl(row?.avatar_url)} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold text-ink">{displayName}</h1>
              {row?.role === "admin" && (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink">管理员</span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted">{user.email}</p>
            <p className="mt-0.5 font-mono text-[11px] text-dim">
              注册于 {joined} · 收藏 {formatCount(favorites.length)} · 投稿 {submissions.length}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/me/settings"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink transition-colors hover:border-line-strong"
          >
            <Settings className="size-3.5" strokeWidth={1.5} aria-hidden />
            账号设置
          </Link>
          <ButtonLink href="/" variant="secondary" size="sm">
            回到首页
          </ButtonLink>
        </div>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/me?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={
                "-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-[13px] transition-colors " +
                (active
                  ? "border-accent font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink")
              }
            >
              <Icon className="size-3.5" strokeWidth={1.5} aria-hidden />
              {t.label}
              {t.key === "favorites" && favorites.length > 0 && (
                <span className="font-mono text-[11px] text-dim">{favorites.length}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {tab === "favorites" &&
          (favorites.length === 0 ? (
            <EmptyState
              title="还没有收藏"
              desc="在资源页点「收藏」会出现在这里，换设备登录也一样。"
              href="/"
              hrefLabel="去逛逛"
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {favorites.map((r) => (
                <ResourceCard key={r.code} data={r} />
              ))}
            </div>
          ))}

        {tab === "submissions" &&
          (submissions.length === 0 ? (
            <EmptyState
              title="还没有投稿"
              desc="发现好资源可以提交，审核通过后会出现在站内。"
              href="/submit"
              hrefLabel="去投稿"
            />
          ) : (
            <ul className="divide-y divide-line rounded-[14px] border border-line bg-surface">
              {submissions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">{s.title}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-dim">{s.url}</p>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] " +
                      (s.status === "approved"
                        ? "bg-ok/10 text-ok"
                        : s.status === "rejected"
                          ? "bg-danger/10 text-danger"
                          : "bg-surface-2 text-muted")
                    }
                  >
                    {s.status === "approved" ? "已通过" : s.status === "rejected" ? "未通过" : "待审核"}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  desc,
  href,
  hrefLabel,
}: {
  title: string;
  desc: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <div className="mt-4 rounded-[14px] border border-dashed border-line px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-2 text-[13px] text-muted">{desc}</p>
      <div className="mt-5 flex justify-center">
        <ButtonLink href={href} size="sm">
          {hrefLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
