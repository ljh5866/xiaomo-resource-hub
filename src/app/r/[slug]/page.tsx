import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download, Tag as TagIcon } from "lucide-react";
import { LinkRow } from "@/components/resource/link-row";
import { FavoriteButton } from "@/components/resource/favorite-button";
import { ReportDialog } from "@/components/resource/report-dialog";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, resourceJsonLd } from "@/lib/seo";
import { ResourceCard } from "@/components/resource/resource-card";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { Chip } from "@/components/ui/chip";
import {
  getResourceBySlug,
  listResources,
  listResourcesByTag,
} from "@/lib/queries";
import { KINDS, LANGUAGES, LICENSE, platformOf } from "@/lib/constants";
import { formatDate, formatCount } from "@/lib/utils";

export const revalidate = 3600;

/** 构建期预渲染已有资源，后续靠 ISR 增量更新（详情页不再每次请求都查库） */
export async function generateStaticParams() {
  const { all } = await import("@/db/client");
  return all<{ slug: string }>(
    "SELECT slug FROM resources WHERE status = 'published' ORDER BY updated_at DESC LIMIT 500",
  ).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getResourceBySlug(slug);
  if (!data) return { title: "资源不存在" };

  const { resource } = data;
  const title = resource.seoTitle ?? resource.title;
  const description = resource.seoDesc ?? resource.summary ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: `/r/${resource.slug}` },
    openGraph: { title, description, type: "article" },
  };
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getResourceBySlug(slug);
  if (!data) notFound();

  const { resource, category, links, tags } = data;
  const platforms = JSON.parse(resource.platforms || "[]") as string[];

  const primary = links.find((l) => l.isPrimary) ?? links[0];
  const overallStatus: LinkStatus = links.some((l) => l.status === "ok")
    ? "ok"
    : links.length === 0
      ? "unknown"
      : links.every((l) => l.status === "invalid")
        ? "invalid"
        : "unknown";

  const related = tags.length
    ? await listResourcesByTag(tags[0].slug, 4)
    : await listResources({ categorySlug: category.slug, limit: 4 });
  const relatedFiltered = related.filter((r) => r.slug !== resource.slug).slice(0, 3);

  return (
    <article className="container-page py-8 lg:py-12">
      <JsonLd
        data={[
          resourceJsonLd({
            code: resource.code,
            title: resource.title,
            summary: resource.summary,
            kind: resource.kind,
            platforms,
            slug: resource.slug,
            coverUrl: resource.coverUrl,
            licenseLabel: resource.licenseLabel,
            version: resource.version,
            sizeLabel: resource.sizeLabel,
            publishedAt: resource.publishedAt,
            updatedAt: resource.updatedAt,
            categoryName: category.name,
          }),
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: category.name, path: `/c/${category.slug}` },
            { name: resource.title, path: `/r/${resource.slug}` },
          ]),
        ]}
      />

      {/* 面包屑 */}
      <nav aria-label="面包屑" className="flex flex-wrap items-center gap-1 text-[12px] text-dim">
        <Link href="/" className="min-h-8 py-1 hover:text-accent">
          首页
        </Link>
        <ChevronRight className="size-3" strokeWidth={1.5} aria-hidden />
        <Link href={`/c/${category.slug}`} className="min-h-8 py-1 hover:text-accent">
          {category.name}
        </Link>
        <ChevronRight className="size-3" strokeWidth={1.5} aria-hidden />
        <span className="truncate text-muted">{resource.title}</span>
      </nav>

      {overallStatus === "invalid" && (
        <div className="mt-4 border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          这个资源的链接目前都失效了，小编正在修复。可以先收藏，修好后回来取。
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ───── 主体 ───── */}
        <div className="order-2 min-w-0 lg:order-1">
          <p className="font-mono text-[12px] tracking-[0.12em] text-dim">{resource.code}</p>

          <h1 className="mt-3 font-serif text-[30px] font-bold leading-tight text-ink lg:text-[38px]">
            {resource.title}
          </h1>

          {resource.subtitle && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{resource.subtitle}</p>
          )}

          {resource.coverUrl && (
            <div className="mt-6 overflow-hidden border border-line bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resource.coverUrl}
                alt={resource.title}
                className="max-h-[420px] w-full object-cover"
                style={
                  resource.coverBlur
                    ? {
                        backgroundImage: `url(${resource.coverBlur})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              />
            </div>
          )}

          {/* 结构化字段：借阅卡的横线 */}
          <dl className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            <Field label="类型" value={KINDS[resource.kind] ?? resource.kind} />
            <Field
              label="平台"
              value={platforms.length ? platforms.map(platformOf).join(" / ") : "—"}
            />
            <Field label="版本" value={resource.version ?? "—"} mono />
            <Field label="大小" value={resource.sizeLabel ?? "—"} mono />
            <Field
              label="语言"
              value={resource.language ? (LANGUAGES[resource.language] ?? resource.language) : "—"}
            />
            <Field
              label="授权"
              value={resource.licenseLabel ? (LICENSE[resource.licenseLabel] ?? resource.licenseLabel) : "—"}
            />
            <Field label="更新" value={formatDate(resource.updatedAt)} mono />
            <Field label="下载" value={`${formatCount(resource.downloadCount)} 次`} mono />
          </dl>

          {/* 说明正文 */}
          <section className="mt-10">
            <h2 className="font-serif text-[20px] font-semibold text-ink">说明</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink/90">
              {(resource.contentMd ?? "暂无说明。")
                .split(/\n{2,}/)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>
          </section>

          {/* 标签 */}
          {tags.length > 0 && (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 font-serif text-[16px] font-semibold text-ink">
                <TagIcon className="size-4 text-dim" strokeWidth={1.5} aria-hidden />
                标签
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Link key={t.slug} href={`/t/${t.slug}`} className="group">
                    <Chip className="h-8 px-3 transition-colors group-hover:border-accent group-hover:text-accent">
                      #{t.name}
                    </Chip>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ───── 侧栏：下载区（移动端排在正文之前） ───── */}
        <aside className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">
          <div className="border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[11px] tracking-[0.14em] text-dim">下载</span>
              <StatusDot status={overallStatus} />
            </div>

            <div className="space-y-3 p-4">
              {links.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted">
                  暂无可用链接，小编正在补。
                </p>
              ) : (
                links.map((l) => (
                  <LinkRow
                    key={l.id}
                    link={{
                      id: l.id,
                      provider: l.provider,
                      url: l.url,
                      extractCode: l.extractCode,
                      label: l.label,
                      status: l.status,
                      clickCount: l.clickCount,
                    }}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-dim">
                <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
                {formatCount(resource.downloadCount)} 次下载
              </span>
              <FavoriteButton resourceId={resource.id} />
            </div>
          </div>

          <p className="mt-3 px-1 font-mono text-[10px] tracking-wide text-dim">
            最近校验 {formatDate(resource.verifiedAt ?? resource.updatedAt)}
          </p>

          <p className="mt-2 px-1 text-[11px] leading-relaxed text-dim">
            链接来自公开分享，本站不托管文件。若链接失效请点下方举报，修复后会恢复显示。
          </p>

          <div className="mt-2 px-1">
            <ReportDialog
              resourceId={resource.id}
              links={links.map((l) => ({ id: l.id, provider: l.provider, label: l.label }))}
            />
          </div>

          {primary && (
            <p className="mt-2 px-1 font-mono text-[10px] text-dim/70">
              PRIMARY · {primary.provider.toUpperCase()}
            </p>
          )}
        </aside>
      </div>

      {/* 相关推荐 */}
      {relatedFiltered.length > 0 && (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="mb-6 font-serif text-[20px] font-semibold text-ink">相关推荐</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {relatedFiltered.map((r) => (
              <ResourceCard key={r.code} data={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-[11px] tracking-wide text-dim">{label}</dt>
      <dd className={"mt-1 truncate text-[13px] text-ink " + (mono ? "font-mono" : "")}>
        {value}
      </dd>
    </div>
  );
}
