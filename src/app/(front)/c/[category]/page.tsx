import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryRail } from "@/components/layout/category-rail";
import { FilterChips } from "@/components/resource/filter-chips";
import { TrendingList } from "@/components/resource/trending-list";
import { ResourceCard } from "@/components/resource/resource-card";
import { Pagination } from "@/components/ui/pagination";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import {
  listCategories,
  listResources,
  countResources,
  listTagsByKind,
  listTagsOfKind,
  listWeeklyHotRepos,
  listTrendingRepos,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

/** 分类 → 用哪一类标签做筛选条 */
const FILTER_KIND: Record<
  string,
  { kind: "game" | "genre" | "gh" | "soft"; label: string; param: "game" | "genre" | "gh" | "soft" }
> = {
  mods: { kind: "game", label: "游戏", param: "game" },
  games: { kind: "genre", label: "类型", param: "genre" },
  opensource: { kind: "gh", label: "端", param: "gh" },
  software: { kind: "soft", label: "分类", param: "soft" },
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; game?: string; genre?: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const { page, game, genre } = await searchParams;
  const all = await listCategories();
  const meta = all.find((c) => c.slug === category);
  if (!meta) return { title: "分类不存在" };

  const p = Math.max(1, Number(page) || 1);
  const qs = new URLSearchParams();
  if (game) qs.set("game", game);
  if (genre) qs.set("genre", genre);
  if (p > 1) qs.set("page", String(p));

  return {
    title: p > 1 ? `${meta.name} · 第 ${p} 页` : meta.name,
    description: meta.description ?? `${meta.name} 分类下的全部资源，共 ${meta.count} 项。`,
    alternates: { canonical: `/c/${meta.slug}${qs.toString() ? `?${qs}` : ""}` },
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
  searchParams: Promise<{ page?: string; game?: string; genre?: string; gh?: string; soft?: string; hot?: string }>;
}) {
  const { category } = await params;
  const { page: pageRaw, game, genre, gh, soft, hot: hotRaw } = await searchParams;
  const hot = hotRaw === "1";

  const categories = await listCategories();
  const current = categories.find((c) => c.slug === category);
  if (!current) notFound();

  const filter = FILTER_KIND[category];
  const activeSlug =
    filter?.param === "genre" ? genre : filter?.param === "gh" ? gh : filter?.param === "soft" ? soft : game;

  const total = await countResources({
    categorySlug: category,
    gameSlug: filter?.param === "game" ? game : undefined,
    genreSlug: filter?.param === "genre" ? genre : undefined,
    ghSlug: gh,
    softSlug: filter?.param === "soft" ? soft : undefined,
    hot,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const [itemsRaw, filterItems] = await Promise.all([
    listResources({
      categorySlug: category,
      gameSlug: filter?.param === "game" ? game : undefined,
      genreSlug: filter?.param === "genre" ? genre : undefined,
      ghSlug: gh,
      softSlug: filter?.param === "soft" ? soft : undefined,
      hot,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    filter
      ? filter.kind === "game"
        ? listTagsByKind("game", category)
        : listTagsOfKind(filter.kind)
      : Promise.resolve([]),
  ]);

  // 「本周热门」是独立视图：直接读 GitHub Trending 周榜，不参与站内筛选
  const trending = hot ? await listTrendingRepos(30) : [];
  const items = hot ? [] : itemsRaw;

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
              {hot ? "本周热门 · GitHub Trending 周榜（按本周新增 star）" : `共 ${total} 项`}
              {!hot && totalPages > 1 && ` · 第 ${page} / ${totalPages} 页`}
            </p>
          </header>

          {hot && (
            <div className="mt-5">
              <Link
                href={`/c/${category}`}
                scroll={false}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-3 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                ← 返回全部项目
              </Link>
            </div>
          )}

          {filter && !hot && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterChips
                categorySlug={category}
                label={filter.label}
                param={filter.param}
                items={filterItems}
                active={activeSlug ?? ""}
              />
              {category === "opensource" && (
                <Link
                  href={hot ? "/c/opensource" : "/c/opensource?hot=1"}
                  scroll={false}
                  className="mt-5 inline-flex min-h-8 items-center rounded-full border px-3 text-[12px] transition-colors "
                >
                  {hot ? "取消本周热门" : "本周热门项目"}
                </Link>
              )}
            </div>
          )}

          {hot ? (
            <TrendingList items={trending} />
          ) : items.length === 0 ? (
            <div className="mt-8 rounded-[14px] border border-dashed border-line p-12 text-center">
              <p className="font-sans text-[18px] font-semibold text-ink">
                {activeSlug ? "这个筛选下还没有资源" : "这里还没有内容"}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
                {activeSlug ? (
                  "换一个筛选，或者看看全部。"
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
              {items.map((r, i) => (
                <ResourceCard key={r.code} data={r} priority={i < 4} />
              ))}
            </div>
          )}

          {!hot && (
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath={`/c/${category}`}
              query={{ game, genre }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
