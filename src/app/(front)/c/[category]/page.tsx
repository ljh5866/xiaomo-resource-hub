import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryRail } from "@/components/layout/category-rail";
import { GameChips } from "@/components/resource/game-chips";
import { ResourceFeed } from "@/components/resource/resource-feed";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { listCategories, listResources, countResources, listGameTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

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
    openGraph: {
      title: `${meta.name} · 小莫资源网`,
      description: meta.description ?? undefined,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(meta.name)}&sub=${encodeURIComponent(meta.description ?? "")}&tag=${encodeURIComponent(`分类 · 共 ${meta.count} 项`)}`,
          width: 1200,
          height: 630,
          alt: meta.name,
        },
      ],
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const { category } = await params;
  const { game } = await searchParams;

  const categories = await listCategories();
  const current = categories.find((c) => c.slug === category);
  if (!current) notFound();

  const PAGE_SIZE = 24;
  const [items, total, games] = await Promise.all([
    listResources({ categorySlug: category, gameSlug: game, limit: PAGE_SIZE }),
    countResources({ categorySlug: category, gameSlug: game }),
    listGameTags(category),
  ]);

  return (
    <div className="container-page py-8 lg:py-12">
      <JsonLd
        data={[
          collectionJsonLd({
            name: current.name,
            description: current.description,
            path: `/c/${category}`,
            items: items.map((i) => ({ title: i.title, path: `/r/${i.slug}` })),
          }),
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: current.name, path: `/c/${category}` },
          ]),
        ]}
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <CategoryRail
          items={categories.map((c) => ({ slug: c.slug, name: c.name, count: c.count }))}
          activeSlug={category}
          className="-mx-1 lg:mx-0"
        />

        <div className="min-w-0">
          <header className="border-b border-line pb-6">
            <h1 className="font-sans text-[30px] font-bold text-ink lg:text-[38px]">
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
              <>
                <GameChips categorySlug={category} games={games} active={game ?? ""} />
                <div className="mt-8">
                  <CardGridSkeleton count={Math.min(items.length, 9)} />
                </div>
              </>
            }
          >
            <GameChips categorySlug={category} games={games} active={game ?? ""} />
            <div className="mt-8">
              <ResourceFeed
                key={`${category}-${game ?? "all"}`}
                initialItems={items}
                initialTotal={total}
                categorySlug={category}
                gameSlug={game}
              />
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
