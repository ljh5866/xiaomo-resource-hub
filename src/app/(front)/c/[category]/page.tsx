import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryRail } from "@/components/layout/category-rail";
import { GameChips } from "@/components/resource/game-chips";
import { ResourceCard } from "@/components/resource/resource-card";
import { Pagination } from "@/components/ui/pagination";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { listCategories, listResources, countResources, listGameTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; game?: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const { page, game } = await searchParams;
  const all = await listCategories();
  const meta = all.find((c) => c.slug === category);
  if (!meta) return { title: "分类不存在" };

  const p = Math.max(1, Number(page) || 1);
  const qs = new URLSearchParams();
  if (game) qs.set("game", game);
  if (p > 1) qs.set("page", String(p));
  const canonical = `/c/${meta.slug}${qs.toString() ? `?${qs}` : ""}`;

  return {
    title: p > 1 ? `${meta.name} · 第 ${p} 页` : meta.name,
    description: meta.description ?? `${meta.name} 分类下的全部资源，共 ${meta.count} 项。`,
    alternates: { canonical },
    robots: p > 1 ? { index: true, follow: true } : undefined,
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
  searchParams: Promise<{ page?: string; game?: string }>;
}) {
  const { category } = await params;
  const { page: pageRaw, game } = await searchParams;

  const categories = await listCategories();
  const current = categories.find((c) => c.slug === category);
  if (!current) notFound();

  const total = await countResources({ categorySlug: category, gameSlug: game });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const [items, games] = await Promise.all([
    listResources({
      categorySlug: category,
      gameSlug: game,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
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
              {totalPages > 1 && ` · 第 ${page} / ${totalPages} 页`}
            </p>
          </header>

          <GameChips categorySlug={category} games={games} active={game ?? ""} />

          {items.length === 0 ? (
            <div className="mt-8 rounded-[14px] border border-dashed border-line p-12 text-center">
              <p className="font-sans text-[18px] font-semibold text-ink">
                {game ? "这个游戏下还没有资源" : "这里还没有内容"}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
                {game ? (
                  "换一个游戏，或者看看全部。"
                ) : (
                  <>
                    资源正在陆续上架。发现好东西的话，欢迎
                    <a href="/submit" className="mx-1 text-accent">
                      投稿
                    </a>
                    推荐给我。
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => (
                <ResourceCard key={r.code} data={r} />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            basePath={`/c/${category}`}
            query={{ game }}
          />
        </div>
      </div>
    </div>
  );
}
