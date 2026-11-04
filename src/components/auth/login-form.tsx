"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

const inputCls =
  "min-h-11 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

export function LoginForm({ next, defaultEmail }: { next: string; defaultEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    start(async () => {
      const res = await signIn("credentials", { email, password, redirect: false });

      if (res?.error) {
        const n = fails + 1;
        setFails(n);
        setError(
          n >= 3
            ? "邮箱或密码不对。连续失败多次会被锁定 10 分钟。"
            : "邮箱或密码不对",
        );
        return;
      }

      router.push(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <label className="block">
        <span className="mb-1 block text-[12px] text-muted">邮箱</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted">密码</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="至少 8 位"
          className={inputCls}
        />
      </label>

      {error && (
        <p className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 bg-accent text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />}
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
