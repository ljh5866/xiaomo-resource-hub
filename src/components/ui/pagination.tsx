import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 数字分页。
 *
 * 页码用 URL 表达（?page=2），所以每页都是可直接分享/被收录的地址；
 * 首尾页始终显示，中间用省略号，最多 7 个位置。
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  query = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v) qs.set(k, v);
    }
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  // 1 … (p-1) p (p+1) … last
  const pages: (number | "gap")[] = [];
  const push = (v: number | "gap") => {
    if (pages[pages.length - 1] !== v) pages.push(v);
  };

  push(1);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p > 1 && p < totalPages) push(p);
  }
  if (totalPages > 1) push(totalPages);

  // 用 gap 填掉跳号
  const withGaps: (number | "gap")[] = [];
  for (let i = 0; i < pages.length; i++) {
    const cur = pages[i];
    const prev = withGaps[withGaps.length - 1];
    if (typeof cur === "number" && typeof prev === "number" && cur - prev > 1) withGaps.push("gap");
    withGaps.push(cur);
  }

  const item =
    "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[10px] border px-3 font-mono text-[13px] transition-colors";
  const idle = "border-line bg-surface text-muted hover:border-line-strong hover:text-ink";
  const active = "border-ink bg-ink text-white";
  const disabled = "border-line bg-surface text-dim opacity-50";

  return (
    <nav aria-label="分页" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${item} ${idle} gap-1`} rel="prev">
          <ChevronLeft className="size-3.5" strokeWidth={1.6} aria-hidden />
          上一页
        </Link>
      ) : (
        <span className={`${item} ${disabled} gap-1`} aria-disabled>
          <ChevronLeft className="size-3.5" strokeWidth={1.6} aria-hidden />
          上一页
        </span>
      )}

      {withGaps.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-[13px] text-dim" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${item} ${p === page ? active : idle}`}
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={href(page + 1)} className={`${item} ${idle} gap-1`} rel="next">
          下一页
          <ChevronRight className="size-3.5" strokeWidth={1.6} aria-hidden />
        </Link>
      ) : (
        <span className={`${item} ${disabled} gap-1`} aria-disabled>
          下一页
          <ChevronRight className="size-3.5" strokeWidth={1.6} aria-hidden />
        </span>
      )}
    </nav>
  );
}
