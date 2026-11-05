"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { refreshFrontCache } from "@/lib/admin/cache-actions";

/** 后台顶栏的「刷新缓存」：首页是 ISR，导入/改数据后点一下立即生效 */
export function RefreshCacheButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await refreshFrontCache();
            setMsg(res.message);
            window.setTimeout(() => setMsg(null), 2200);
          })
        }
        className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
        title="刷新首页与分类页缓存"
      >
        <RefreshCw
          className={"size-3.5 " + (pending ? "animate-spin" : "")}
          strokeWidth={1.6}
          aria-hidden
        />
        刷新缓存
      </button>
      {msg && (
        <span className="absolute right-0 top-9 z-10 whitespace-nowrap rounded-[6px] bg-ink px-2 py-1 text-[11px] text-white">
          {msg}
        </span>
      )}
    </span>
  );
}
