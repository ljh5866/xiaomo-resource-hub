"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error.message, error.digest);
  }, [error]);

  return (
    <div className="container-page grid place-items-center py-24">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] tracking-[0.22em] text-dim">500 · INDEX ERROR</p>
        <h1 className="mt-4 font-serif text-[28px] font-bold text-ink">索引出了点问题</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          页面没能加载出来。可以重试一次；如果一直这样，说明是服务端的事，不是你的问题。
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button onClick={reset} variant="primary">重试</Button>
          <Button onClick={() => (window.location.href = "/")} variant="secondary">
            回首页
          </Button>
        </div>
        {error.digest && (
          <p className="mt-6 font-mono text-[11px] text-dim">trace: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
