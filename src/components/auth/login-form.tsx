"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const inputCls =
  "min-h-11 w-full border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    start(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

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
          autoComplete="email"
          required
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
          autoComplete="current-password"
          required
          minLength={8}
          placeholder="至少 8 位"
          className={inputCls}
        />
      </label>

      {error && (
        <p className="border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "登录中…" : "登录"}
      </Button>
    </form>
  );
}
