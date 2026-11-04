"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { registerAccount } from "@/lib/auth/register";

const field =
  "min-h-11 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

export function RegisterForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const password2 = String(fd.get("password2") ?? "");
    const name = String(fd.get("name") ?? "");

    start(async () => {
      const res = await registerAccount({ email, password, password2, name });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone(true);
      const next = new URLSearchParams(window.location.search).get("next");
      setTimeout(() => {
        router.push(
          `/login?registered=1&email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
        );
      }, 600);
    });
  }

  if (done) {
    return (
      <p className="rounded-[10px] border border-ok/30 bg-ok/5 px-4 py-3 text-[13px] text-ok">
        注册成功，正在跳转登录…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] text-muted">
          邮箱
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-[13px] text-muted">
          昵称 <span className="text-dim">（选填）</span>
        </label>
        <input id="name" name="name" maxLength={24} autoComplete="nickname" className={field} />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] text-muted">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={field}
          placeholder="至少 8 位，含字母和数字"
        />
      </div>

      <div>
        <label htmlFor="password2" className="mb-1.5 block text-[13px] text-muted">
          确认密码
        </label>
        <input
          id="password2"
          name="password2"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={field}
        />
      </div>

      {error && (
        <p className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 bg-accent text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />}
        {pending ? "注册中…" : "注册"}
      </button>

      <p className="text-center text-[13px] text-muted">
        已有账号？
        <Link href="/login" className="ml-1 text-accent hover:text-accent-strong">
          去登录
        </Link>
      </p>
    </form>
  );
}
