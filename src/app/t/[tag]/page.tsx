import type { Metadata } from "next";
import Link from "next/link";
import { ResourceCard } from "@/components/resource/resource-card";
import { JsonLd } from "@/components/seo/json-ld";
import { listResourcesByTag } from "@/lib/queries";
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
  return {
    title: `#${tag}`,
    description: `标签「${tag}」下的全部资源。`,
    alternates: { canonical: `/t/${tag}` },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const items = await listResourcesByTag(tag);

  return (
    <div className="container-page py-10">
      <JsonLd
        data={[
          collectionJsonLd({
            name: `#${tag}`,
            description: `标签「${tag}」下的全部资源。`,
            path: `/t/${tag}`,
            items: items.map((i) => ({ title: i.title, path: `/r/${i.slug}` })),
          }),
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: `#${tag}`, path: `/t/${tag}` },
          ]),
        ]}
      />

      <nav aria-label="面包屑" className="text-[12px] text-dim">
        <Link href="/" className="hover:text-accent">首页</Link>
        <span className="mx-2">/</span>
        <span className="text-muted">标签</span>
      </nav>

      <header className="mt-4 border-b border-line pb-6">
        <h1 className="font-serif text-[30px] font-bold text-ink">#{tag}</h1>
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
