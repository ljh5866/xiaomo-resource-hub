import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { registrationOpen } from "@/lib/flags";

export const metadata: Metadata = {
  title: "注册",
  description: "注册小莫资源网账号，收藏与同步你关注的资源。",
  robots: { index: false },
};

export default function RegisterPage() {
  const open = registrationOpen();

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-[380px]">
        <p className="font-mono text-[11px] tracking-[0.2em] text-dim">XIAOMO INDEX</p>
        <h1 className="mt-2 text-[26px] font-bold text-ink">创建账号</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          注册需要邮箱验证码，用来确认真实可收信。除此之外不发任何邮件，也不做营销。
        </p>

        <div className="mt-8">
          {open ? (
            <RegisterForm />
          ) : (
            <div className="rounded-[10px] border border-line bg-surface-2 px-4 py-4 text-[13px] leading-relaxed text-muted">
              站点当前关闭了公开注册。
              <br />
              需要账号请联系管理员开通。
            </div>
          )}
        </div>

        <p className="mt-8 text-[12px] leading-relaxed text-dim">
          继续即表示同意
          <Link href="/about" className="mx-1 text-muted underline decoration-line hover:text-accent">
            站点说明
          </Link>
          中的内容规范。本站只做索引，不托管文件。
        </p>
      </div>
    </div>
  );
}
