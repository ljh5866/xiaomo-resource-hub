"use client";

import Link from "next/link";
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
 * 第一行 = 来源 + 提取码 + 状态；第二行 = 复制 / 打开。
 *
 * 两个按钮的边界：
 *   - 复制：纯前端，永远不跳转（未登录也能复制真实网盘地址）
 *   - 打开：走 /go/xxx，需要登录；未登录时直接显示「登录后下载」并去登录页
 */
export function LinkRow({
  link,
  loggedIn = true,
  loginHref = "/login",
}: {
  link: LinkRowData;
  loggedIn?: boolean;
  loginHref?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const meta = providerOf(link.provider);
  const status = (link.status as LinkStatus) ?? "unknown";
  const dead = status === "invalid";

  const copyText = link.extractCode ? `${link.url}  提取码：${link.extractCode}` : link.url;

  async function copy() {
    // 兜底：任何异常都不能让页面跳走，最差也要把地址亮出来让人手动复制
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        throw new Error("no clipboard api");
      }
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = copyText;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        setFailed(false);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        setFailed(true);
      }
    }
  }

  return (
    <div className={cn("border border-line bg-canvas p-3.5", dead && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="size-2 shrink-0" style={{ backgroundColor: meta.tint }} />
          <span className="truncate text-[14px] font-medium text-ink">{meta.name}</span>
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
        {loggedIn ? (
          <button
            type="button"
            onClick={(e) => {
              // 按钮不承担任何导航职责：显式阻止冒泡与默认行为
              e.preventDefault();
              e.stopPropagation();
              void copy();
            }}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border border-line text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
          >
            {copied ? (
              <Check className="size-3.5 text-ok" strokeWidth={2} aria-hidden />
            ) : (
              <Copy className="size-3.5" strokeWidth={1.5} aria-hidden />
            )}
            {copied ? "已复制" : "复制"}
          </button>
        ) : (
          // 复制同样要登录：未登录直接去登录页，登录后回到本页
          <Link
            href={loginHref}
            title="登录后可复制下载地址"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 border border-line text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <Copy className="size-3.5" strokeWidth={1.5} aria-hidden />
            复制
          </Link>
        )}

        {dead ? (
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-1.5 border border-danger/40 text-[13px] text-danger"
          >
            <TriangleAlert className="size-3.5" strokeWidth={1.5} aria-hidden />
            待修复
          </button>
        ) : loggedIn ? (
          <a
            href={`/go/${link.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 bg-accent text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
          >
            打开
            <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
          </a>
        ) : (
          <Link
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 bg-accent text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
          >
            登录后下载
            <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
          </Link>
        )}
      </div>

      {failed && (
        <p className="mt-2 select-all break-all rounded-[6px] bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted">
          {copyText}
        </p>
      )}
    </div>
  );
}
