"use client";

import { useSearchParams } from "next/navigation";
import { CategoryChips, platformKeysOf } from "./category-chips";
import { ResourceFeed } from "./resource-feed";
import type { ResourceCardData } from "./resource-card";

/**
 * 分类页主体：平台筛选 + 列表 + 加载更多。
 * 筛选与分页都在客户端，页面本身保持静态（SSG + ISR）。
 */
export function CategoryFilter({
  items,
  total,
  categorySlug,
}: {
  items: ResourceCardData[];
  total: number;
  categorySlug: string;
}) {
  const params = useSearchParams();
  const platform = params.get("platform") ?? "";

  return (
    <>
      <CategoryChips
        categorySlug={categorySlug}
        platformKeys={platformKeysOf(items)}
        active={platform}
      />
      <ResourceFeed
        initialItems={items}
        initialTotal={total}
        categorySlug={categorySlug}
        platformFilter
      />
    </>
  );
}
