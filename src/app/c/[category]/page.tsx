import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryRail } from "@/components/layout/category-rail";
import { CategoryChips, platformKeysOf } from "@/components/resource/category-chips";
import { CategoryFilter } from "@/components/resource/category-filter";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { listCategories, listResources, countResources } from "@/lib/queries";

export const revalidate = 600;

export async function generateStaticParams() {
  return (await listCategories()).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const all = await listCategories();
  const meta = all.find((c) => c.slug === category);
  if (!meta) return { title: "分类不存在" };

  return {
    title: meta.name,
    description: meta.description ?? `${meta.name} 分类下的全部资源，共 ${meta.count} 项。`,
    alternates: { canonical: `/c/${meta.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  const categories = await listCategories();
  const current = categories.find((c) => c.slug === category);
  if (!current) notFound();

  const PAGE_SIZE = 24;
  const [items, total] = await Promise.all([
    listResources({ categorySlug: category, limit: PAGE_SIZE }),
    countResources({ categorySlug: category }),
  ]);

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <CategoryRail
          items={categories.map((c) => ({ slug: c.slug, name: c.name, count: c.count }))}
          activeSlug={category}
          className="-mx-1 lg:mx-0"
        />

        <div className="min-w-0">
          <header className="border-b border-line pb-6">
            <h1 className="font-serif text-[30px] font-bold text-ink lg:text-[38px]">
              {current.name}
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
              {current.description ?? "该分类下的全部资源，按更新时间排序。"}
            </p>
            <p className="mt-3 font-mono text-[11px] tracking-wide text-dim">
              共 {total} 项
            </p>
          </header>

          <Suspense
            fallback={
              // 与客户端组件同结构、同高度：避免 hydration 时把下面的内容顶下去（CLS）
              <>
                <CategoryChips
                  categorySlug={category}
                  platformKeys={platformKeysOf(items)}
                  active=""
                />
                <div className="mt-8">
                  <CardGridSkeleton count={Math.min(items.length, 9)} />
                </div>
                <div className="mt-8 flex flex-col items-center gap-2">
                  <span className="font-mono text-[11px] text-dim">
                    已显示 {items.length} / 共 {total} 项
                  </span>
                  <span className="min-h-11" aria-hidden />
                </div>
              </>
            }
          >
            <CategoryFilter items={items} total={total} categorySlug={category} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
