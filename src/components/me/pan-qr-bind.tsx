"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, QrCode, RefreshCw, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";

type Phase = "idle" | "loading" | "waiting" | "scanned" | "ok" | "expired" | "error";

/**
 * 扫码绑定：二维码由服务端生成（内容取自夸克 CAS 的 token），
 * 手机夸克 App 扫一下就在手机上确认，本站拿到 Cookie 后加密落库。
 */
export function PanQrBind() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const sessionRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    stopPolling();
    setPhase("loading");
    setMessage("");
    setDataUrl(null);
    setNickname(null);
    try {
      const res = await fetch("/api/pan/qr/start", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; sessionId?: string; dataUrl?: string; error?: string };
      if (!res.ok || !json.ok || !json.sessionId || !json.dataUrl) {
        setPhase("error");
        setMessage(json.error ?? "生成二维码失败");
        return;
      }
      sessionRef.current = json.sessionId;
      setDataUrl(json.dataUrl);
      setPhase("waiting");

      timerRef.current = window.setInterval(async () => {
        const sid = sessionRef.current;
        if (!sid) return;
        try {
          const r = await fetch("/api/pan/qr/poll", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId: sid }),
          });
          const j = (await r.json()) as { state?: Phase; nickname?: string; message?: string };
          if (j.state === "ok") {
            stopPolling();
            setPhase("ok");
            setNickname(j.nickname ?? null);
          } else if (j.state === "scanned") {
            setPhase("scanned");
          } else if (j.state === "expired") {
            stopPolling();
            setPhase("expired");
          } else if (j.state === "error") {
            stopPolling();
            setPhase("error");
            setMessage(j.message ?? "登录失败");
          }
        } catch {
          /* 单次轮询失败不影响整体 */
        }
      }, 2000);
    } catch {
      setPhase("error");
      setMessage("网络异常");
    }
  }, [stopPolling]);

  useEffect(() => {
    void start();
    return () => stopPolling();
  }, [start, stopPolling]);

  if (phase === "ok") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <ShieldCheck className="size-8 text-ok" strokeWidth={1.5} aria-hidden />
        <p className="text-[14px] font-medium text-ink">绑定成功{nickname ? `：${nickname}` : ""}</p>
        <p className="text-[12px] text-muted">刷新页面即可看到账号状态，之后解析和下载都用这个账号。</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] bg-accent px-4 text-[12px] font-medium text-on-accent hover:bg-accent-strong"
        >
          完成
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative flex size-[240px] items-center justify-center rounded-[10px] border border-line bg-white">
        {phase === "loading" && (
          <Loader2 className="size-6 animate-spin text-dim" strokeWidth={2} aria-hidden />
        )}
        {dataUrl && phase !== "loading" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="夸克登录二维码" width={240} height={240} className="rounded-[8px]" />
        )}
        {phase === "scanned" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[10px] bg-white/95">
            <Smartphone className="size-7 text-accent" strokeWidth={1.5} aria-hidden />
            <p className="text-[13px] font-medium text-ink">已扫码</p>
            <p className="text-[11px] text-muted">请在手机上点「确认登录」</p>
          </div>
        )}
        {(phase === "expired" || phase === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[10px] bg-white/95 px-4 text-center">
            <TriangleAlert className="size-6 text-danger" strokeWidth={1.5} aria-hidden />
            <p className="text-[12px] text-danger">{message || "二维码已过期"}</p>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <QrCode className="size-3.5" strokeWidth={1.5} aria-hidden />
        用手机夸克 App 扫码登录
      </p>

      {(phase === "expired" || phase === "error") && (
        <button
          type="button"
          onClick={() => void start()}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] border border-line px-3 text-[12px] text-muted hover:border-accent hover:text-accent"
        >
          <RefreshCw className="size-3.5" strokeWidth={1.5} aria-hidden />
          重新生成
        </button>
      )}
    </div>
  );
}
