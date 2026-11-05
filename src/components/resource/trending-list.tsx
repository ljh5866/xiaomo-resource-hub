import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";

export type TrendingItem = {
  rank: number;
  fullName: string;
  url: string;
  starsWeek: number | null;
  starsTotal: number | null;
  language: string | null;
  description: string | null;
  slug: string | null;
};

const fmt = (n: number | null) =>
  n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

/**
 * 本周热门：GitHub Trending 周榜的独立视图。
 *
 * 站内已收录的项目点进详情页；没收录的直接外链 GitHub，
 * 保证任何一天点开都有内容，不用等站内导入。
 */
export function TrendingList({ items }: { items: TrendingItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-[14px] border border-dashed border-line p-12 text-center">
        <p className="text-[16px] font-semibold text-ink">周榜还没同步</p>
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted">
          每天 03:20 会抓一次 GitHub Trending，也可以在后台手动跑
          <span className="mx-1 font-mono text-[12px]">scripts/sync-github-trending.mjs</span>。
        </p>
      </div>
    );
  }

  return (
    <ol className="mt-6 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
      {items.map((it) => {
        const inner = (
          <div className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2">
            <span className="mt-0.5 w-6 shrink-0 font-mono text-[13px] text-dim">
              {String(it.rank).padStart(2, "0")}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium text-ink">{it.fullName}</span>
                {it.language && (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                    {it.language}
                  </span>
                )}
                {it.slug && (
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    站内已收录
                  </span>
                )}
              </div>
              {it.description && (
                <p className="mt-1 line-clamp-1 text-[12px] text-muted">{it.description}</p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="flex items-center justify-end gap-1 font-mono text-[12px] text-ink">
                <Star className="size-3" strokeWidth={1.6} aria-hidden />+{fmt(it.starsWeek)}
                <span className="text-[10px] text-dim">/周</span>
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-dim">总 {fmt(it.starsTotal)}</p>
            </div>

            <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-dim" strokeWidth={1.6} aria-hidden />
          </div>
        );

        const href = it.slug ? `/r/${it.slug}` : it.url;
        return (
          <li key={it.fullName}>
            {it.slug ? (
              <Link href={href} className="block">
                {inner}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer" className="block">
                {inner}
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}
