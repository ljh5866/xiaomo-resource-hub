"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Puzzle, RefreshCw, TriangleAlert } from "lucide-react";

const REQ = "XM_PAN_BIND_REQUEST";
const RESULT = "XM_PAN_BIND_RESULT";
const READY = "XM_PAN_EXT_READY";

type Phase = "probing" | "no-ext" | "ready" | "working" | "done" | "failed";

/**
 * 一键绑定：靠浏览器扩展读 httpOnly cookie（网页 JS 读不到，只有扩展 API 能读）。
 *
 * 流程：页面 postMessage(REQ) → content.js → background chrome.cookies.getAll
 *       → postMessage(RESULT) → 这里 POST /api/pan/bind 落库
 */
export function PanExtensionBind({ onDone }: { onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>("probing");
  const [message, setMessage] = useState("");
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const onReady = (e: MessageEvent) => {
      if (e.source !== window || e.data?.type !== READY) return;
      setPhase((p) => (p === "probing" || p === "no-ext" ? "ready" : p));
    };
    window.addEventListener("message", onReady);

    // 扩展不在时，1.8 秒后判定为「未安装」
    const timer = window.setTimeout(() => {
      setPhase((p) => (p === "probing" ? "no-ext" : p));
    }, 1800);

    return () => {
      window.removeEventListener("message", onReady);
      window.clearTimeout(timer);
    };
  }, []);

  /**
   * 重新检测：扩展只在页面加载时广播一次 READY，之后再装扩展本页是收不到的。
   * 所以这里主动发一个探测请求 —— 有回包就说明扩展装好并生效了。
   */
  const redetect = useCallback(() => {
    setPhase("probing");
    setMessage("");
    const requestId = `ping-${Date.now()}`;
    const onResult = (e: MessageEvent) => {
      if (e.source !== window || e.data?.type !== RESULT) return;
      if (e.data.requestId !== requestId) return;
      window.removeEventListener("message", onResult);
      setPhase("ready");
    };
    window.addEventListener("message", onResult);
    window.postMessage({ type: REQ, requestId }, "*");
    window.setTimeout(() => {
      window.removeEventListener("message", onResult);
      setPhase((p) => (p === "probing" ? "no-ext" : p));
    }, 2500);
  }, []);

  const bind = useCallback(() => {
    setPhase("working");
    setMessage("");
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const onResult = async (e: MessageEvent) => {
      if (e.source !== window || e.data?.type !== RESULT) return;
      if (e.data.requestId !== requestId) return;
      window.removeEventListener("message", onResult);

      const payload = e.data as { ok?: boolean; cookie?: string; error?: string; hasLogin?: boolean };
      if (!payload.hasLogin || !payload.cookie) {
        setPhase("failed");
        setMessage(payload.error || "扩展没找到夸克登录态，请先在本浏览器登录 pan.quark.cn");
        return;
      }

      try {
        const res = await fetch("/api/pan/bind", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cookie: payload.cookie }),
        });
        const json = (await res.json()) as { ok?: boolean; nickname?: string; error?: string };
        if (!res.ok || !json.ok) {
          setPhase("failed");
          setMessage(json.error ?? "绑定失败");
          return;
        }
        setPhase("done");
        setNickname(json.nickname ?? null);
        onDone?.();
      } catch {
        setPhase("failed");
        setMessage("网络异常，稍后再试");
      }
    };

    window.addEventListener("message", onResult);
    window.postMessage({ type: REQ, requestId }, "*");

    window.setTimeout(() => {
      window.removeEventListener("message", onResult);
      setPhase((p) => (p === "working" ? "failed" : p));
      setMessage((m) => m || "扩展没有响应，确认已安装并启用");
    }, 8000);
  }, [onDone]);

  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 rounded-[8px] border border-ok/40 bg-ok/5 px-3 py-2.5 text-[12px] text-ink">
        <CheckCircle2 className="size-4 shrink-0 text-ok" strokeWidth={2} aria-hidden />
        一键绑定成功{nickname ? `：${nickname}` : ""}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
        >
          <RefreshCw className="size-3" strokeWidth={1.5} aria-hidden />
          刷新
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Puzzle className="size-4 text-accent" strokeWidth={1.5} aria-hidden />
        <p className="text-[12px] font-medium text-ink">一键绑定（需装浏览器扩展）</p>

        {phase === "ready" && (
          <button
            type="button"
            onClick={bind}
            className="ml-auto inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] bg-accent px-3 text-[12px] font-medium text-on-accent hover:bg-accent-strong"
          >
            <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
            读取并绑定
          </button>
        )}
        {phase === "working" && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted">
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden />
            正在读取夸克登录态…
          </span>
        )}
        {phase === "probing" && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-dim">
            <Loader2 className="size-3 animate-spin" strokeWidth={2} aria-hidden />
            检测扩展…
          </span>
        )}
        {phase === "no-ext" && (
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={redetect}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-[6px] border border-line px-2 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
              title="如果刚装完扩展，点这里重新检测"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.5} aria-hidden />
              重新检测
            </button>
            <a
              href="/xiaomo-pan-helper.zip"
              className="inline-flex min-h-8 items-center rounded-[6px] bg-accent px-3 text-[12px] font-medium text-on-accent hover:bg-accent-strong"
            >
              下载扩展
            </a>
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        用之前先在同一个浏览器登录{" "}
        <a
          href="https://pan.quark.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          pan.quark.cn
        </a>
        。
      </p>

      {phase === "failed" && (
        <p className="mt-2 flex items-start gap-1.5 rounded-[6px] border border-danger/40 bg-danger/5 px-2 py-1.5 text-[11px] text-danger">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" strokeWidth={2} aria-hidden />
          {message || "绑定失败"}
        </p>
      )}
    </div>
  );
}
