"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { sendLoginCode } from "@/lib/auth/email-code-actions";

const inputCls =
  "min-h-11 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

/**
 * 登录：两种方式
 *   密码登录 —— 老用户（含 Supabase 迁过来的 bcrypt 密码）
 *   验证码登录 —— 免密；没有密码哈希的用户也能进
 */
export function LoginForm({ next, defaultEmail }: { next: string; defaultEmail?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "code">("password");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [pending, start] = useTransition();
  const [sending, startSend] = useTransition();

  function tick() {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(timer);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }

  function requestCode() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("先填邮箱");
      return;
    }
    startSend(async () => {
      const res = await sendLoginCode(email);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setNotice(res.message);
      tick();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    start(async () => {
      const res = await signIn("credentials", {
        email,
        password: mode === "password" ? password : "",
        code: mode === "code" ? code : "",
        redirect: false,
      });

      if (res?.error) {
        const n = fails + 1;
        setFails(n);
        setError(
          mode === "code"
            ? "验证码不对或已过期"
            : n >= 3
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
    <div className="mt-5">
      <div className="mb-4 flex rounded-[10px] border border-line bg-surface-2 p-1 text-[13px]">
        {(
          [
            ["password", "密码登录"],
            ["code", "验证码登录"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setError(null);
              setNotice(null);
            }}
            className={
              "flex-1 cursor-pointer rounded-[7px] px-3 py-1.5 transition-colors " +
              (mode === key ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
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

        {mode === "password" ? (
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
        ) : (
          <div>
            <span className="mb-1 block text-[12px] text-muted">验证码</span>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 位数字"
                className={`${inputCls} tracking-[0.3em]`}
              />
              <button
                type="button"
                onClick={requestCode}
                disabled={sending || countdown > 0}
                className="min-h-11 w-[110px] shrink-0 cursor-pointer rounded-[10px] border border-line bg-surface text-[12px] text-ink transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:text-dim"
              >
                {sending ? "发送中…" : countdown > 0 ? `${countdown}s` : "获取验证码"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-dim">
              老用户没有密码也能用这种方式登录
            </p>
          </div>
        )}

        {notice && (
          <p className="rounded-[10px] border border-info/30 bg-info/5 px-3 py-2 text-[12px] text-info">
            {notice}
          </p>
        )}

        {error && (
          <p className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />}
          {pending ? "登录中…" : mode === "code" ? "验证码登录" : "登录"}
        </button>
      </form>
    </div>
  );
}
