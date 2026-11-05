import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AvatarUploader } from "@/components/user/avatar-uploader";
import { ProfileForms } from "@/components/user/profile-forms";
import { SitePrefs } from "@/components/user/site-prefs";
import { GithubSection } from "@/components/user/github-section";
import { getSessionUser } from "@/lib/auth";
import { get } from "@/db/client";

export const metadata: Metadata = {
  title: "账号设置",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** 设置页：和用户页分开，只放「头像 / 昵称 / 密码」三件事 */
export default async function MeSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me/settings");

  const row = get<{ avatar_url: string | null; password_hash: string | null; created_at: number }>(
    "SELECT avatar_url, password_hash, created_at FROM users WHERE id = ?",
    user.id,
  );

  const displayName = user.name ?? user.email.split("@")[0];

  return (
    <div className="container-page max-w-3xl py-10">
      <Link
        href="/me"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden />
        返回我的
      </Link>

      <header className="mt-3 border-b border-line pb-5">
        <h1 className="text-[24px] font-bold text-ink">账号设置</h1>
        <p className="mt-1 text-[13px] text-muted">
          {user.email} · 注册于{" "}
          {row ? new Date(row.created_at * 1000).toISOString().slice(0, 10) : "—"}
        </p>
      </header>

      <section className="mt-6 rounded-[14px] border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold text-ink">头像</h2>
        <p className="mt-1 text-[12px] text-muted">显示在顶部菜单和你的投稿里</p>
        <div className="mt-4">
          <AvatarUploader name={displayName} src={row?.avatar_url ?? null} />
        </div>
      </section>

      <div className="mt-4">
        <GithubSection userId={user.id} />
      </div>

      <div className="mt-4">
        <SitePrefs />
      </div>

      <div className="mt-4">
        <ProfileForms name={displayName} hasPassword={Boolean(row?.password_hash)} />
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-dim">
        以后会在这里加邮箱换绑、通知偏好、删除账号等选项，目前只保留最常用的三项。
      </p>
    </div>
  );
}
