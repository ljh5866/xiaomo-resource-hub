"use client";

import { Check, Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { providerOf } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type LinkRowData = {
  id: number;
  provider: string;
  url: string;
  extractCode: string | null;
  label: string | null;
  status: string;
  clickCount: number;
};

/**
 * 下载链接行。侧栏只有 360px，所以固定为上下结构：
 * 第一行 = 来源 + 提取码 + 状态；第二行 = 两个等宽按钮。
 */
export function LinkRow({ link }: { link: LinkRowData }) {
  const [copied, setCopied] = useState(false);
  const meta = providerOf(link.provider);
  const status = (link.status as LinkStatus) ?? "unknown";
  const dead = status === "invalid";

  async function copy() {
    const text = link.extractCode
      ? `${link.url}  提取码：${link.extractCode}`
      : link.url;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className={cn(
        "border border-line bg-canvas p-3.5",
        dead && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="size-2 shrink-0"
            style={{ backgroundColor: meta.tint }}
          />
          <span className="truncate text-[14px] font-medium text-ink">
            {meta.name}
          </span>
          {link.label && (
            <span className="shrink-0 border border-line px-1.5 text-[11px] leading-5 text-dim">
              {link.label}
            </span>
          )}
        </div>
        <StatusDot status={status} size="sm" />
      </div>

      <p className="mt-2 flex items-center gap-2 font-mono text-[11px] text-dim">
        <span>{link.extractCode ? `提取码 ${link.extractCode}` : "无需提取码"}</span>
        <span className="text-line-strong">|</span>
        <span>{link.clickCount} 次下载</span>
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border border-line text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? (
            <Check className="size-3.5 text-ok" strokeWidth={2} aria-hidden />
          ) : (
            <Copy className="size-3.5" strokeWidth={1.5} aria-hidden />
          )}
          {copied ? "已复制" : "复制"}
        </button>

        {dead ? (
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-1.5 border border-danger/40 text-[13px] text-danger"
          >
            <TriangleAlert className="size-3.5" strokeWidth={1.5} aria-hidden />
            待修复
          </button>
        ) : (
          <a
            href={`/go/${link.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 bg-accent text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
          >
            打开
            <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
