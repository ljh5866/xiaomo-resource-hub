import { notFound } from "next/navigation";
import { all, get } from "@/db/client";
import { ResourceForm, type ResourceFormValues } from "@/components/admin/resource-form";

export const dynamic = "force-dynamic";

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resourceId = Number(id);
  if (!Number.isFinite(resourceId)) notFound();

  const categories = all<{ id: number; slug: string; name: string }>(
    "SELECT id, slug, name FROM categories ORDER BY sort_order",
  );

  const r = get<{
    id: number;
    code: string;
    slug: string;
    title: string;
    subtitle: string | null;
    summary: string | null;
    contentMd: string | null;
    categoryId: number;
    kind: string;
    platforms: string | null;
    version: string | null;
    sizeLabel: string | null;
    language: string | null;
    licenseLabel: string | null;
    sourceUrl: string | null;
    sourceNote: string | null;
    coverUrl: string | null;
    coverBlur: string | null;
    status: string;
    isFeatured: number;
    seoTitle: string | null;
    seoDesc: string | null;
  }>(
    `SELECT id, code, slug, title, subtitle, summary, content_md AS contentMd,
            category_id AS categoryId, kind, platforms, version, size_label AS sizeLabel,
            language, license_label AS licenseLabel, source_url AS sourceUrl,
            source_note AS sourceNote, cover_url AS coverUrl, cover_blur AS coverBlur,
            status, is_featured AS isFeatured,
            seo_title AS seoTitle, seo_desc AS seoDesc
     FROM resources WHERE id = ?`,
    resourceId,
  );

  if (!r) notFound();

  const links = all<{
    provider: string;
    url: string;
    extractCode: string | null;
    label: string | null;
    isPrimary: number;
  }>(
    `SELECT provider, url, extract_code AS extractCode, label, is_primary AS isPrimary
     FROM resource_links WHERE resource_id = ? ORDER BY is_primary DESC, sort_order`,
    resourceId,
  );

  const tags = all<{ name: string }>(
    `SELECT t.name FROM tags t JOIN resource_tags rt ON rt.tag_id = t.id
     WHERE rt.resource_id = ?`,
    resourceId,
  );

  let platforms: string[] = [];
  try {
    platforms = JSON.parse(r.platforms ?? "[]") as string[];
  } catch {
    platforms = [];
  }

  const initial: ResourceFormValues = {
    id: r.id,
    title: r.title,
    slug: r.slug,
    subtitle: r.subtitle ?? "",
    summary: r.summary ?? "",
    contentMd: r.contentMd ?? "",
    categoryId: r.categoryId,
    kind: r.kind,
    platforms,
    version: r.version ?? "",
    sizeLabel: r.sizeLabel ?? "",
    language: r.language ?? "zh-CN",
    licenseLabel: r.licenseLabel ?? "free",
    sourceUrl: r.sourceUrl ?? "",
    sourceNote: r.sourceNote ?? "",
    coverUrl: r.coverUrl ?? "",
    coverBlur: r.coverBlur ?? "",
    status: r.status,
    isFeatured: Boolean(r.isFeatured),
    seoTitle: r.seoTitle ?? "",
    seoDesc: r.seoDesc ?? "",
    tags: tags.map((t) => t.name).join(", "),
    links: links.length
      ? links.map((l) => ({
          provider: l.provider,
          url: l.url,
          extractCode: l.extractCode ?? "",
          label: l.label ?? "",
          isPrimary: Boolean(l.isPrimary),
        }))
      : [{ provider: "quark", url: "", extractCode: "", label: "主链接", isPrimary: true }],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-[20px] font-bold text-ink">编辑资源</h1>
        <span className="font-mono text-[11px] text-dim">{r.code}</span>
        <a
          href={`/r/${r.slug}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[12px] text-accent"
        >
          看前台 →
        </a>
      </div>
      <ResourceForm categories={categories} initial={initial} />
    </div>
  );
}
