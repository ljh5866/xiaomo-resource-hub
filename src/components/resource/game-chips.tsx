import Link from "next/link";
import { Chip } from "@/components/ui/chip";

/**
 * 游戏筛选条：按「游戏」标签筛（我的世界 / 只狼 / 赛博朋克…）
 *
 * 纯展示、无 hooks：服务端 fallback 与客户端共用同一份结构，
 * 高度一致，不会因为 hydration 顶动布局。
 */
export function GameChips({
  categorySlug,
  games,
  active = "",
}: {
  categorySlug: string;
  games: { slug: string; name: string; count: number }[];
  active?: string;
}) {
  if (games.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-dim">游戏</span>
      <Link href={`/c/${categorySlug}`} scroll={false}>
        <Chip tone={!active ? "accent" : "default"} className="h-8 cursor-pointer px-3">
          全部
        </Chip>
      </Link>
      {games.map((g) => (
        <Link key={g.slug} href={`/c/${categorySlug}?game=${g.slug}`} scroll={false}>
          <Chip tone={active === g.slug ? "accent" : "default"} className="h-8 cursor-pointer px-3">
            {g.name}
            <span className="ml-1 font-mono text-[10px] text-dim">{g.count}</span>
          </Chip>
        </Link>
      ))}
    </div>
  );
}
