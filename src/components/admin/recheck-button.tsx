"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/** 一键复测：只测待校验/失效的链接，跑完刷新列表 */
export function RecheckButton({ limit = 20 }: { limit?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      try {
        const res = await fetch("/api/admin/recheck-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          checked?: number;
          okCount?: number;
          invalid?: number;
          unknown?: number;
          skipped?: number;
          message?: string;
        };

        if (!json.ok) {
          setMsg(json.message ?? "复测失败");
          return;
        }

        setMsg(
          json.checked === 0
            ? `没有需要复测的链接（跳过示例域名 ${json.skipped ?? 0} 条）`
            : `已复测 ${json.checked} 条：有效 ${json.okCount} / 失效 ${json.invalid} / 待复检 ${json.unknown}`,
        );
        router.refresh();
      } catch {
        setMsg("网络异常");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-accent bg-accent px-3 text-[13px] text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} aria-hidden />
        ) : (
          <RefreshCw className="size-3.5" strokeWidth={1.5} aria-hidden />
        )}
        {pending ? "复测中…" : `复测 ${limit} 条`}
      </button>
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
    </div>
  );
}
