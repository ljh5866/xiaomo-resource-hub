import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/header";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "登录",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string; email?: string }>;
}) {
  const { next, registered, email } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  // 后台子域名下，登录后应该回后台首页（"/" 会被 middleware 重写到 /admin），
  // 而不是前台的 /favorites —— 否则会落到 /admin/favorites 这个不存在的页面
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase().split(":")[0];
  const adminHost = (process.env.ADMIN_HOST ?? "").toLowerCase().split(":")[0];
  const onAdminHost = Boolean(adminHost) && host === adminHost;
  const fallback = onAdminHost ? "/" : "/favorites";

  const user = await getSessionUser();
  if (user) redirect(safeNext ?? (user.role === "admin" ? (onAdminHost ? "/" : "/admin") : fallback));

  return (
    <div className="container-page grid place-items-center py-20">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="mt-8 rounded-[14px] border border-line bg-surface p-6 shadow-[var(--card-shadow)]">
          <h1 className="font-sans text-[20px] font-semibold text-ink">登录</h1>
          <p className="mt-1 text-[13px] text-muted">
            {safeNext ? "这个页面需要登录后访问。" : "登录后可以收藏资源、提交推荐。"}
          </p>

          {registered === "1" && (
            <p className="mt-3 rounded-[10px] border border-ok/30 bg-ok/5 px-3 py-2 text-[12px] text-ok">
              注册成功，用刚才的邮箱和密码登录即可。
            </p>
          )}

          <Suspense fallback={null}>
            <LoginForm next={safeNext ?? fallback} defaultEmail={email} />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-[12px] text-muted">
          还没有账号？
          <Link href="/register" className="ml-1 text-accent hover:text-accent-strong">
            注册一个
          </Link>
        </p>
      </div>
    </div>
  );
}
