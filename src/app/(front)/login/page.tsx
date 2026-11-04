import type { Metadata } from "next";
import Link from "next/link";
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

  const user = await getSessionUser();
  if (user) redirect(safeNext ?? (user.role === "admin" ? "/admin" : "/favorites"));

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
            <LoginForm next={safeNext ?? "/favorites"} defaultEmail={email} />
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
