import type { Metadata } from "next";
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
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(next && next.startsWith("/") ? next : "/admin");

  return (
    <div className="container-page grid place-items-center py-20">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="mt-8 border border-line bg-surface p-6">
          <h1 className="font-serif text-[20px] font-semibold text-ink">登录</h1>
          <p className="mt-1 text-[13px] text-muted">
            后台与收藏需要账号。账号由站长创建，暂不支持自助注册。
          </p>

          <Suspense fallback={null}>
            <LoginForm next={next && next.startsWith("/") ? next : "/admin"} />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-dim">
          没有账号？本地可用
          <code className="mx-1 font-mono text-ink">pnpm user:add 你的邮箱 你的密码 --admin</code>
          创建。
        </p>
      </div>
    </div>
  );
}
