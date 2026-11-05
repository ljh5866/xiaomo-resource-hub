"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { registerAccount } from "@/lib/auth/register";
import { sendRegisterCode } from "@/lib/auth/email-code-actions";

const field =
  "min-h-11 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none transition-colors focus:border-accent";

export function RegisterForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);

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

  function sendCode() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("先填邮箱");
      return;
    }
    startSend(async () => {
      const res = await sendRegisterCode(email);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setNotice(res.message);
      tick();
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);

    start(async () => {
      const res = await registerAccount({
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        password2: String(fd.get("password2") ?? ""),
        name: String(fd.get("name") ?? ""),
        code: String(fd.get("code") ?? ""),
      });

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
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="用于接收验证码"
        />
      </div>

      <div>
        <label htmlFor="code" className="mb-1.5 block text-[13px] text-muted">
          验证码
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            className={`${field} tracking-[0.3em]`}
            placeholder="6 位数字"
          />
          <button
            type="button"
            onClick={sendCode}
            disabled={sending || countdown > 0}
            className="min-h-11 w-[118px] shrink-0 cursor-pointer rounded-[10px] border border-line bg-surface text-[13px] text-ink transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:text-dim"
          >
            {sending ? "发送中…" : countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
          </button>
        </div>
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

      {notice && (
        <p className="rounded-[10px] border border-info/30 bg-info/5 px-3 py-2 text-[13px] text-info">
          {notice}
        </p>
      )}

      {error && (
        <p className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
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
