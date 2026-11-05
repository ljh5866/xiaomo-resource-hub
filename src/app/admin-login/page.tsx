import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "控制台登录",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * 后台专用登录页（admin.ttals.com/login）。
 *
 * 和前台 /login 分开放的原因：
 *   - 前台登录是给用户的：收藏、投稿，注册即可用
 *   - 后台登录是给管理员的：账号不发出去，也没有注册入口
 *   - 两边的视觉语言也不同（前台白底蓝调，后台灰底石墨）
 *
 * 地址栏仍然是 /login（middleware 内部重写到 /admin-login），
 * 所以对使用者来说就是"后台子域的登录页"。
 */
export default async function AdminLoginPage() {
  const user = await getSessionUser();
  // 已登录的管理员直接进控制台（子域下 / 会被 middleware 重写到 /admin）
  if (user?.role === "admin") redirect(process.env.ADMIN_HOST ? "/" : "/admin");

  return (
    <div className="admin-scope grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-[6px] bg-ink text-[14px] font-semibold text-white">
            莫
          </span>
          <div>
            <p className="text-[14px] font-semibold leading-tight text-ink">小莫控制台</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
              admin console
            </p>
          </div>
        </div>

        <div className="rounded-[6px] border border-line bg-surface p-5">
          <h1 className="text-[15px] font-semibold text-ink">管理员登录</h1>
          <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            仅限管理员账号。普通用户请到前台登录。
          </p>

          <Suspense fallback={null}>
            <LoginForm next={process.env.ADMIN_HOST ? "/" : "/admin"} />
          </Suspense>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-dim">
          <Link href="https://ttals.com" className="hover:text-ink">
            ← 返回前台
          </Link>
          <span>连续失败 5 次将锁定 10 分钟</span>
        </div>
      </div>
    </div>
  );
}
