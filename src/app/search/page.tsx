import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { ResourceCard } from "@/components/resource/resource-card";
import { listCategories } from "@/lib/queries";
import { search } from "@/lib/search";

export const metadata: Metadata = {
  title: "搜索",
  robots: { index: false, follow: true },
};

const SUGGESTIONS = ["效率工具", "单机游戏", "汉化 MOD", "开源项目", "Docker"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q = "", cat } = await searchParams;
  const [results, categories] = await Promise.all([
    search(q, { categorySlug: cat }),
    listCategories(),
  ]);

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="mx-auto max-w-3xl">
        {/* 搜索框已在吸顶 Header 里，这里不再重复；只放分类筛选 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-dim">分类</span>
          <Link href={q ? `/search?q=${encodeURIComponent(q)}` : "/search"}>
            <span
              className={
                "inline-flex h-7 items-center border px-2.5 text-[12px] " +
                (!cat ? "border-accent text-accent" : "border-line text-muted")
              }
            >
              全部
            </span>
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/search?${q ? `q=${encodeURIComponent(q)}&` : ""}cat=${c.slug}`}
            >
              <span
                className={
                  "inline-flex h-7 items-center border px-2.5 text-[12px] " +
                  (cat === c.slug ? "border-accent text-accent" : "border-line text-muted")
                }
              >
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-5xl">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h1 className="font-sans text-[20px] font-semibold text-ink">
            {q ? `“${q}” 的结果` : "全部资源"}
          </h1>
          <span className="font-mono text-[11px] text-dim">{results.length} 条</span>
        </div>

        {results.length === 0 ? (
          <div className="mt-10 border border-dashed border-line px-6 py-14 text-center">
            <SearchX className="mx-auto size-8 text-dim" strokeWidth={1.5} aria-hidden />
            <p className="mt-4 font-sans text-[18px] font-semibold text-ink">
              {q ? `没找到“${q}”` : "先输入关键词"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
              试试换个说法，或者从分类进去逛。
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Link
                  key={s}
                  href={`/search?q=${encodeURIComponent(s)}`}
                  className="inline-flex h-8 items-center border border-line px-3 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {s}
                </Link>
              ))}
            </div>

            <p className="mt-6 text-[12px] text-dim">
              找不到想要的？<Link href="/about#request" className="text-accent">提交资源需求</Link>
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {results.map((r) => (
              <ResourceCard key={r.code} data={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
