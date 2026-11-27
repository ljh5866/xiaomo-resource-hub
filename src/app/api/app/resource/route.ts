import { all, get } from "@/db/client";
import { providerOf } from "@/lib/constants";
import { parseResourceMeta, metaRows } from "@/lib/resource-meta";
import { corsOptions } from "@/lib/app-cors";

/**
 * GET /api/app/resource?slug=xxx
 *
 * 桌面端详情：正文 + 全部链接 + 标签 + meta。
 * 链接里含真实 URL（网盘分享页），桌面端负责调起系统浏览器或内置下载。
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!slug) return Response.json({ ok: false, error: "缺少 slug" }, { status: 400 });

  const r = get<{
    id: number;
    code: string;
    slug: string;
    title: string;
    subtitle: string | null;
    summary: string | null;
    contentMd: string | null;
    coverUrl: string | null;
    categorySlug: string;
    categoryName: string;
    platforms: string | null;
    version: string | null;
    sizeLabel: string | null;
    language: string | null;
    licenseLabel: string | null;
    metaJson: string | null;
    sourceUrl: string | null;
    publishedAt: number | null;
    updatedAt: number;
  }>(
    `SELECT r.id, r.code, r.slug, r.title, r.subtitle, r.summary, r.content_md AS contentMd,
            r.cover_url AS coverUrl, c.slug AS categorySlug, c.name AS categoryName,
            r.platforms, r.version, r.size_label AS sizeLabel, r.language,
            r.license_label AS licenseLabel, r.meta_json AS metaJson, r.source_url AS sourceUrl,
            r.published_at AS publishedAt, r.updated_at AS updatedAt
       FROM resources r JOIN categories c ON c.id = r.category_id
      WHERE r.slug = ? AND r.status = 'published'`,
    slug,
  );
  if (!r) return Response.json({ ok: false, error: "资源不存在" }, { status: 404 });

  const links = all<{
    id: number;
    provider: string;
    url: string;
    extractCode: string | null;
    label: string | null;
    isPrimary: number;
  }>(
    `SELECT id, provider, url, extract_code AS extractCode, label, is_primary AS isPrimary
       FROM resource_links WHERE resource_id = ? ORDER BY is_primary DESC, sort_order`,
    r.id,
  );

  const tags = all<{ slug: string; name: string; kind: string }>(
    `SELECT t.slug, t.name, t.kind FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id
      WHERE rt.resource_id = ? ORDER BY t.use_count DESC`,
    r.id,
  );

  let platforms: string[] = [];
  try {
    platforms = JSON.parse(r.platforms ?? "[]") as string[];
  } catch {
    platforms = [];
  }

  const meta = parseResourceMeta(r.metaJson);

  return Response.json({
    ok: true,
    resource: {
      id: r.id,
      code: r.code,
      slug: r.slug,
      title: r.title,
      subtitle: r.subtitle,
      summary: r.summary,
      content: r.contentMd,
      cover: r.coverUrl,
      category: r.categorySlug,
      categoryName: r.categoryName,
      platforms,
      version: r.version,
      size: r.sizeLabel,
      language: r.language,
      license: r.licenseLabel,
      sourceUrl: r.sourceUrl,
      publishedAt: r.publishedAt,
      updatedAt: r.updatedAt,
      meta: metaRows(meta),
      tags,
      links: links.map((l) => ({
        id: l.id,
        provider: l.provider,
        providerName: providerOf(l.provider).name,
        url: l.url,
        code: l.extractCode,
        label: l.label,
        primary: l.isPrimary === 1,
      })),
    },
  });
}

export const OPTIONS = corsOptions;
