import Link from "next/link";
import { cn } from "@/lib/utils";

export type RailItem = {
  slug: string;
  name: string;
  count?: number;
};

export function CategoryRail({
  items,
  activeSlug,
  title = "分类",
  className,
}: {
  items: RailItem[];
  activeSlug?: string;
  title?: string;
  className?: string;
}) {
  return (
    <nav aria-label={title} className={cn("lg:sticky lg:top-24", className)}>
      <p className="mb-3 font-mono text-[11px] tracking-[0.18em] text-dim">
        {title.toUpperCase()}
      </p>
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = item.slug === activeSlug;
          return (
            <li key={item.slug} className="shrink-0 lg:shrink">
              <Link
                href={`/c/${item.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 border-l-2 px-3 text-[14px] transition-colors duration-160",
                  active
                    ? "border-accent bg-surface-2 text-ink"
                    : "border-transparent text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                <span className="whitespace-nowrap">{item.name}</span>
                {typeof item.count === "number" && (
                  <span className="font-mono text-[11px] text-dim">{item.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
