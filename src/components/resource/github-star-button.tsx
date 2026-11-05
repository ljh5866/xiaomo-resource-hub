"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";

/**
 * 站内 Star 按钮。
 *
 * 三种状态：
 *   未登录 / 未授权 → 引导去 /api/github/authorize（授权后回到当前页）
 *   已授权 → 直接调 GitHub API 点星，成功后按钮变实心
 */
export function GithubStarButton({ resourceId }: { resourceId: number }) {
  const [state, setState] = useState<{
    linked: boolean;
    starred: boolean;
    login?: string;
    needLogin?: boolean;
  } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/github/star?resourceId=${resourceId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.needLogin) setState({ linked: false, starred: false, needLogin: true });
        else setState({ linked: Boolean(j.linked), starred: Boolean(j.starred), login: j.login });
      })
      .catch(() => alive && setState({ linked: false, starred: false }));
    return () => {
      alive = false;
    };
  }, [resourceId]);

  function toggle() {
    if (!state) return;
    if (!state.linked) {
      // 未授权：走 OAuth，回到当前页
      window.location.href = `/api/github/authorize?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const next = !state.starred;
    setState({ ...state, starred: next });

    start(async () => {
      setError(null);
      const res = await fetch("/api/github/star", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId, star: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        starred?: boolean;
        message?: string;
        needLink?: boolean;
      };
      if (!res.ok || !json.ok) {
        setState({ ...state, starred: !next });
        if (json.needLink) {
          window.location.href = `/api/github/authorize?next=${encodeURIComponent(window.location.pathname)}`;
        } else {
          setError(json.message ?? "操作失败");
        }
        return;
      }
      setState({ ...state, starred: Boolean(json.starred) });
    });
  }

  const starred = Boolean(state?.starred);
  const label = !state
    ? "Star"
    : !state.linked
      ? state.needLogin
        ? "登录后 Star"
        : "授权 GitHub Star"
      : starred
        ? "已 Star"
        : "Star 项目";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={starred}
        className={
          "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[13px] transition-colors " +
          (starred
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-line text-muted hover:border-line-strong hover:text-ink")
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={1.6} aria-hidden />
        ) : (
          <Star
            className={"size-3.5 " + (starred ? "fill-amber-400 text-amber-500" : "")}
            strokeWidth={1.6}
            aria-hidden
          />
        )}
        {label}
      </button>
      {state?.linked && state.login && (
        <span className="text-[10px] text-dim">已授权 @{state.login}</span>
      )}
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
