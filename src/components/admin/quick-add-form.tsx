"use client";

import { useState, useTransition } from "react";
import { ClipboardPaste, Loader2, Sparkles } from "lucide-react";
import { quickAddLinks, type QuickResult } from "@/lib/admin/quick-add";

/**
 * 批量贴链接建草稿：
 * 一行一个 URL，服务端自动识别网盘/站点、生成 slug、能抓的抓标题和简介。
 */
export function QuickAddForm({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState(categories[0]?.slug ?? "software");
  const [publishReady, setPublishReady] = useState(false);
  const [result, setResult] = useState<QuickResult | null>(null);
  const [pending, start] = useTransition();

  const count = text.split(/\r?\n/).filter((l) => /^https?:\/\//i.test(l.trim())).length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="quick-urls" className="block text-[12px] font-medium text-ink">
          链接（一行一个，支持网盘分享 / 3DM 详情页 / 任意网址）
        </label>
        <textarea
          id="quick-urls"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={"https://soft.3dmgame.com/down/400380.html\nhttps://pan.quark.cn/s/xxxxxxxx\nhttps://pan.xunlei.com/s/xxxx?pwd=abcd"}
          className="w-full resize-y rounded-[8px] border border-line bg-surface px-3 py-2 font-mono text-[12px] leading-[1.7] text-ink outline-none focus:border-accent"
        />
        <p className="text-[11px] text-muted">
          识别到 <strong className="text-ink">{count}</strong> 条链接。自动做的事：
          推断网盘类型、生成 slug、3DM 页面会顺带抓标题/简介/封面/版本/大小。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="quick-category" className="block text-[12px] font-medium text-ink">
            分类
          </label>
          <select
            id="quick-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 h-9 rounded-[8px] border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex min-h-9 items-center gap-2 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={publishReady}
            onChange={(e) => setPublishReady(e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          简介够长就直接发布（否则存草稿）
        </label>

        <button
          type="button"
          disabled={pending || count === 0}
          onClick={() =>
            start(async () => {
              const r = await quickAddLinks(text, category, publishReady);
              setResult(r);
            })
          }
          className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[8px] bg-accent px-4 text-[12px] font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden />
          ) : (
            <Sparkles className="size-3.5" strokeWidth={1.5} aria-hidden />
          )}
          {pending ? "正在建草稿…" : "批量创建"}
        </button>
      </div>

      {result && (
        <div className="space-y-3 rounded-[8px] border border-line bg-surface-2 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <ClipboardPaste className="size-3.5" strokeWidth={1.5} aria-hidden />
            {result.message}
          </p>
          {result.created.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-auto text-[11px] text-muted">
              {result.created.map((c) => (
                <li key={c.slug} className="flex gap-2">
                  <span className="text-ok">✓</span>
                  <span className="truncate">{c.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-dim">{c.provider}</span>
                </li>
              ))}
            </ul>
          )}
          {result.failed.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-auto text-[11px] text-danger">
              {result.failed.map((f) => (
                <li key={f.url} className="truncate">
                  ✗ {f.url} — {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
