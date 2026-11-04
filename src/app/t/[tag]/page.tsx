import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceCard } from "@/components/resource/resource-card";
import { JsonLd } from "@/components/seo/json-ld";
import { getTagBySlug, listResourcesByTag } from "@/lib/queries";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { all } = await import("@/db/client");
  return all<{ slug: string }>("SELECT slug FROM tags WHERE use_count > 0 LIMIT 200").map(
    (t) => ({ tag: t.slug }),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const row = await getTagBySlug(tag);
  if (!row) return { title: "标签不存在", robots: { index: false } };

  const name = row.name;
  return {
    title: `#${name}`,
    description: `标签「${name}」下的全部资源。`,
    alternates: { canonical: `/t/${tag}` },
    openGraph: {
      title: `#${name} · 小莫资源网`,
      description: `标签「${name}」下的全部资源。`,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(`#${name}`)}&tag=${encodeURIComponent("标签聚合")}`,
          width: 1200,
          height: 630,
          alt: name,
        },
      ],
    },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;

  // 标签不存在就 404，而不是给搜索引擎一个 200 的空页（软 404）
  const row = await getTagBySlug(tag);
  if (!row) notFound();

  const name = row.name;
  const items = await listResourcesByTag(tag);

  return (
    <div className="container-page py-10">
      <JsonLd
        data={[
          collectionJsonLd({
            name: `#${name}`,
            description: `标签「${name}」下的全部资源。`,
            path: `/t/${tag}`,
            items: items.map((i) => ({ title: i.title, path: `/r/${i.slug}` })),
          }),
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: `#${name}`, path: `/t/${tag}` },
          ]),
        ]}
      />

      <nav aria-label="面包屑" className="text-[12px] text-dim">
        <Link href="/" className="hover:text-accent">首页</Link>
        <span className="mx-2">/</span>
        <span className="text-muted">标签</span>
      </nav>

      <header className="mt-4 border-b border-line pb-6">
        <h1 className="font-sans text-[30px] font-bold text-ink">#{name}</h1>
        <p className="mt-2 font-mono text-[11px] text-dim">共 {items.length} 项</p>
      </header>

      {items.length === 0 ? (
        <p className="mt-10 border border-dashed border-line p-10 text-center text-[13px] text-muted">
          这个标签下还没有资源。
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <ResourceCard key={r.code} data={r} />
          ))}
        </div>
      )}
    </div>
  );
}
