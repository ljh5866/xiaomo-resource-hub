import Link from "next/link";
import { Chip } from "@/components/ui/chip";

/**
 * 分类页筛选条：按标签筛（游戏 / 游戏类型都走这一套）
 *
 * 纯展示、无 hooks：服务端 fallback 与客户端共用同一份结构，
 * 高度一致，不会因为 hydration 顶动布局。
 */
export function FilterChips({
  categorySlug,
  label,
  param,
  items,
  active = "",
}: {
  categorySlug: string;
  label: string;
  param: "game" | "genre" | "gh";
  items: { slug: string; name: string; count: number }[];
  active?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-dim">{label}</span>
      <Link href={`/c/${categorySlug}`} scroll={false}>
        <Chip tone={!active ? "accent" : "default"} className="h-8 cursor-pointer px-3">
          全部
        </Chip>
      </Link>
      {items.map((g) => (
        <Link key={g.slug} href={`/c/${categorySlug}?${param}=${g.slug}`} scroll={false}>
          <Chip tone={active === g.slug ? "accent" : "default"} className="h-8 cursor-pointer px-3">
            {g.name}
            <span className="ml-1 font-mono text-[10px] text-dim">{g.count}</span>
          </Chip>
        </Link>
      ))}
    </div>
  );
}
