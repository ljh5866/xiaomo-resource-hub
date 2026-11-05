"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ResourceCard, type ResourceCardData } from "./resource-card";

/**
 * 列表 + 「加载更多」。
 *
 * 首屏由服务端渲染，后续页走 /api/resources?offset=…&game=…
 * 切换游戏时页面会用 key 重建本组件，所以这里不需要监听参数变化。
 */
export function ResourceFeed({
  initialItems,
  initialTotal,
  categorySlug,
  gameSlug,
  pageSize = 12,
}: {
  initialItems: ResourceCardData[];
  initialTotal: number;
  categorySlug?: string;
  gameSlug?: string;
  pageSize?: number;
}) {
  const [items, setItems] = useState<ResourceCardData[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialItems.length < initialTotal ? initialItems.length : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (nextOffset === null || loading) return;
    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams({ offset: String(nextOffset), limit: String(pageSize) });
      if (categorySlug) qs.set("category", categorySlug);
      if (gameSlug) qs.set("game", gameSlug);

      const res = await fetch(`/api/resources?${qs.toString()}`);
      const json = (await res.json()) as {
        ok: boolean;
        total: number;
        nextOffset: number | null;
        items: ResourceCardData[];
        message?: string;
      };

      if (!json.ok) throw new Error(json.message ?? "加载失败");

      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.code));
        return [...prev, ...json.items.filter((i) => !seen.has(i.code))];
      });
      setTotal(json.total);
      setNextOffset(json.nextOffset);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {items.length === 0 ? (
        <div className="border border-dashed border-line p-12 text-center">
          {gameSlug ? (
            <>
              <p className="font-sans text-[18px] font-semibold text-ink">这个游戏下还没有资源</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted">换一个游戏，或者看看全部。</p>
            </>
          ) : (
            <>
              <p className="font-sans text-[18px] font-semibold text-ink">这里还没有内容</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
                资源正在陆续上架。发现好东西的话，欢迎
                <a href="/submit" className="mx-1 text-accent">
                  投稿
                </a>
                推荐给我。
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => (
            <ResourceCard key={r.code} data={r} />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="font-mono text-[11px] text-dim">
            已显示 {items.length} / 共 {total} 项
          </p>

          {error && <p className="text-[12px] text-danger">{error}</p>}

          {nextOffset !== null ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line-strong px-6 text-[13px] text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} aria-hidden />}
              {loading ? "加载中…" : "加载更多"}
            </button>
          ) : (
            items.length > pageSize && (
              <p className="font-mono text-[11px] text-dim">—— 没有更多了 ——</p>
            )
          )}
        </div>
      )}
    </>
  );
}
