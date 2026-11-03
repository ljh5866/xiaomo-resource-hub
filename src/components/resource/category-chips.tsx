import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { PLATFORMS } from "@/lib/constants";

/**
 * 平台筛选条：纯展示，无 hooks。
 * 服务端 fallback 与客户端组件共用同一份结构，高度一致 → 不会因为 hydration 顶动布局。
 */
export function CategoryChips({
  categorySlug,
  platformKeys,
  active = "",
}: {
  categorySlug: string;
  platformKeys: string[];
  active?: string;
}) {
  if (platformKeys.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-dim">平台</span>
      <Link href={`/c/${categorySlug}`} scroll={false}>
        <Chip tone={!active ? "accent" : "default"} className="h-8 cursor-pointer px-3">
          全部
        </Chip>
      </Link>
      {platformKeys.map((p) => (
        <Link key={p} href={`/c/${categorySlug}?platform=${p}`} scroll={false}>
          <Chip tone={active === p ? "accent" : "default"} className="h-8 cursor-pointer px-3">
            {PLATFORMS[p] ?? p}
          </Chip>
        </Link>
      ))}
    </div>
  );
}

export function platformKeysOf(items: { platforms?: string[] }[]) {
  return Array.from(new Set(items.flatMap((r) => r.platforms ?? []))).slice(0, 6);
}
