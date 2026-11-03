import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Suspense } from "react";
import { site } from "@/content/site";
import { SearchField } from "@/components/layout/search-field";
import { CategoryIcon } from "@/components/layout/category-icon";
import { ResourceCard } from "@/components/resource/resource-card";
import { Chip } from "@/components/ui/chip";
import { getSiteStats, listCategories, listResources, listTags } from "@/lib/queries";
import { formatCount } from "@/lib/utils";

export const revalidate = 600;

export default async function HomePage() {
  const [categories, featured, latest, stats, tags] = await Promise.all([
    listCategories(),
    listResources({ featured: true, limit: 3 }),
    listResources({ limit: 9, excludeFeatured: true }),
    getSiteStats(),
    listTags(10),
  ]);

  const { hero, sections, trust } = site;

  return (
    <>
      {/* ───────────── HERO：全站唯一的黄铜焦点 ───────────── */}
      <section className="border-b border-line">
        <div className="container-page py-14 lg:py-20">
          <div className="animate-index-in max-w-3xl">
            <p className="font-mono text-[11px] tracking-[0.22em] text-dim">
              {site.latin} · {hero.eyebrow}
            </p>
            <h1 className="mt-5 text-[34px] font-bold leading-[1.1] tracking-tight text-ink sm:text-[44px] lg:text-[56px]">
              {hero.titleLines.map((line, i) => (
                <span key={line} className={i > 0 ? "block" : "inline"}>
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
              {hero.lead}
              <span className="text-ink">{hero.leadEmphasis}</span>
            </p>

            <div className="mt-8 max-w-2xl">
              <Suspense
                fallback={<div className="h-12 w-full border border-line bg-surface-2" />}
              >
                <SearchField placeholder={site.search.hero(formatCount(stats.total || 0))} />
              </Suspense>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[12px] text-dim">{hero.hotLabel}</span>
              {hero.hotKeywords.map((k) => (
                <Link key={k} href={`/search?q=${encodeURIComponent(k)}`} className="group">
                  <Chip className="transition-colors group-hover:border-accent group-hover:text-accent">
                    {k}
                  </Chip>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── 分类网格 ───────────── */}
      <section className="container-page py-14">
        <SectionHead
          title={sections.categories.title}
          note={`共 ${categories.length} 个分类`}
          href={sections.categories.moreHref}
          hrefLabel={sections.categories.more}
        />

        {categories.length === 0 ? (
          <EmptyBlock
            title="内容筹备中"
            desc="数据库还没有资源。先跑 pnpm db:seed 灌入种子数据，或在 /admin 里录第一条。"
          />
        ) : (
          <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/c/${c.slug}`}
                className="group flex flex-col justify-between gap-6 bg-surface p-5 transition-colors hover:bg-surface-2"
              >
                <CategoryIcon
                  slug={c.slug}
                  className="size-6 text-muted transition-colors group-hover:text-accent"
                />
                <div>
                  <p className="font-serif text-[15px] font-semibold text-ink">{c.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-dim">{c.count} 项</p>
                </div>
              </Link>
            ))}
            {/* 补满网格：让 7 个分类也能凑成整齐的 4×2 */}
            <Link
              href={sections.categories.moreHref}
              className="group flex flex-col justify-between gap-6 bg-surface p-5 transition-colors hover:bg-surface-2"
            >
              <ArrowRight
                className="size-6 text-muted transition-colors group-hover:text-accent"
                strokeWidth={1.5}
                aria-hidden
              />
              <div>
                <p className="font-serif text-[15px] font-semibold text-ink">全部资源</p>
                <p className="mt-1 font-mono text-[11px] text-dim">按时间浏览</p>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* ───────────── 本周精选 ───────────── */}
      {featured.length > 0 && (
        <section className="container-page pb-14">
          <SectionHead title={sections.featured.title} note={sections.featured.note} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((r) => (
              <ResourceCard key={r.code} data={r} priority />
            ))}
          </div>
        </section>
      )}

      {/* ───────────── 最新收录 ───────────── */}
      <section className="container-page pb-14">
        <SectionHead
          title={sections.latest.title}
          note={sections.latest.note}
          href={sections.latest.moreHref}
          hrefLabel={sections.latest.more}
        />
        {latest.length === 0 ? (
          <EmptyBlock
            title="还没有已发布的资源"
            desc="在 /admin 新建资源，状态设为 published 即可出现在这里。"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {latest.map((r) => (
              <ResourceCard key={r.code} data={r} />
            ))}
          </div>
        )}
      </section>

      {/* ───────────── 标签 ───────────── */}
      {tags.length > 0 && (
        <section className="container-page pb-14">
          <SectionHead title={sections.tags.title} note={sections.tags.note} />
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link key={t.slug} href={`/t/${t.slug}`} className="group">
                <Chip className="h-8 px-3 transition-colors group-hover:border-accent group-hover:text-accent">
                  {t.name}
                  <span className="ml-1.5 font-mono text-[10px] text-dim">{t.useCount}</span>
                </Chip>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── 信任条：把负面指标公开 ───────────── */}
      <section className="border-y border-line bg-surface">
        <div className="container-page grid grid-cols-1 gap-6 py-8 sm:grid-cols-3">
          <Stat label={trust.total} value={formatCount(stats.total)} unit="个" />
          <Stat label={trust.dead} value={String(stats.deadRate)} unit="%" tone="ok" />
          <Stat label={trust.fresh} value={String(stats.updatedThisWeek)} unit="条" />
        </div>
      </section>
    </>
  );
}

function SectionHead({
  title,
  note,
  href,
  hrefLabel = "查看全部",
}: {
  title: string;
  note?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-[24px] font-semibold text-ink">{title}</h2>
        {note && <p className="mt-1 font-mono text-[11px] tracking-wide text-dim">{note}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1 text-[13px] text-muted transition-colors hover:text-accent"
        >
          {hrefLabel}
          <ArrowRight className="size-3.5" strokeWidth={1.5} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "ok";
}) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-[0.14em] text-dim">{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span
          className={
            "font-mono text-[30px] font-medium leading-none " +
            (tone === "ok" ? "text-ok" : "text-ink")
          }
        >
          {value}
        </span>
        <span className="text-[13px] text-muted">{unit}</span>
      </p>
    </div>
  );
}

function EmptyBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border border-dashed border-line bg-surface/40 p-10 text-center">
      <p className="font-serif text-[18px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted">{desc}</p>
    </div>
  );
}
