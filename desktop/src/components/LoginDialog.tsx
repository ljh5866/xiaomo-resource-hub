"use client";

import { useState } from "react";
import { useAuth } from "../lib/auth";

/**
 * 登录弹窗：邮箱 + 密码，或邮箱 + 验证码（与网站同一套账号）。
 * 验证码走网站已有的发送接口，桌面端只是换个 UI。
 */
export function LoginDialog({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  const [mode, setMode] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), mode === "password" ? { password } : { code: code.trim() });
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>登录小莫资源网</h2>
        <p className="modal-sub">和网站同一个账号，收藏会在两边同步。</p>

        <div className="seg">
          <button
            type="button"
            className={mode === "password" ? "on" : ""}
            onClick={() => setMode("password")}
          >
            密码
          </button>
          <button type="button" className={mode === "code" ? "on" : ""} onClick={() => setMode("code")}>
            邮箱验证码
          </button>
        </div>

        <form onSubmit={submit} className="form">
          <label>
            邮箱
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              required
            />
          </label>

          {mode === "password" ? (
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
          ) : (
            <label>
              验证码
              <div className="row">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6 位数字"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    setErr(null);
                    try {
                      const { apiBase } = await import("../lib/api");
                      const r = await fetch(`${apiBase()}/api/app/auth/code`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ email: email.trim() }),
                      });
                      const j = (await r.json()) as { ok?: boolean; error?: string };
                      if (!r.ok || !j.ok) throw new Error(j.error ?? "发送失败");
                      setSent(true);
                    } catch (e2) {
                      setErr(e2 instanceof Error ? e2.message : "发送失败");
                    }
                  }}
                >
                  {sent ? "已发送" : "获取验证码"}
                </button>
              </div>
            </label>
          )}

          {err && <p className="form-err">{err}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "登录中…" : "登录"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
