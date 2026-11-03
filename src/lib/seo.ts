import { site } from "../content/site";

/**
 * 结构化数据（JSON-LD）。
 * 纯函数，便于单测：输入业务对象 → 输出可直接 JSON.stringify 的对象。
 */

type Breadcrumb = { name: string; path: string };

export function abs(path: string) {
  return new URL(path, site.baseUrl).toString();
}

/** 站点级：WebSite + 站内搜索能力（Google 的 sitelinks searchbox） */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    alternateName: site.latin,
    url: abs("/"),
    description: site.seo.description,
    inLanguage: "zh-CN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${abs("/search")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: Breadcrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

/** 列表页：CollectionPage + ItemList */
export function collectionJsonLd(opts: {
  name: string;
  description?: string | null;
  path: string;
  items: { title: string; path: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description ?? undefined,
    url: abs(opts.path),
    inLanguage: "zh-CN",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.title,
        url: abs(it.path),
      })),
    },
  };
}

/**
 * 详情页：按资源类型选 schema 类型。
 * 都是"免费获取的资源"，所以统一带 offers（price 0），
 * 但不上 aggregateRating —— 我们没有评分体系，编造评分属于典型的结构化数据作弊。
 */
const SCHEMA_TYPE: Record<string, string> = {
  software: "SoftwareApplication",
  template: "CreativeWork",
  material: "CreativeWork",
  font: "CreativeWork",
  icon: "CreativeWork",
  course: "Course",
  ebook: "Book",
  other: "CreativeWork",
};

export function resourceJsonLd(opts: {
  code: string;
  title: string;
  summary?: string | null;
  kind: string;
  platforms: string[];
  slug: string;
  coverUrl?: string | null;
  licenseLabel?: string | null;
  version?: string | null;
  sizeLabel?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  categoryName: string;
}) {
  const type = SCHEMA_TYPE[opts.kind] ?? "CreativeWork";
  const url = abs(`/r/${opts.slug}`);

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: opts.title,
    description: opts.summary ?? undefined,
    url,
    identifier: opts.code,
    inLanguage: "zh-CN",
    isAccessibleForFree: true,
    datePublished: opts.publishedAt ? opts.publishedAt.toISOString() : undefined,
    dateModified: opts.updatedAt ? opts.updatedAt.toISOString() : undefined,
    genre: opts.categoryName,
  };

  if (opts.coverUrl) base.image = abs(opts.coverUrl);
  if (opts.version) base.version = opts.version;
  if (opts.sizeLabel) base.fileSize = opts.sizeLabel;

  if (type === "SoftwareApplication") {
    base.applicationCategory = opts.categoryName;
    base.operatingSystem = opts.platforms.length ? opts.platforms.join(", ") : "Any";
    base.offers = { "@type": "Offer", price: "0", priceCurrency: "CNY" };
  } else if (type === "Course") {
    base.provider = { "@type": "Organization", name: site.name, sameAs: abs("/") };
  } else {
    base.offers = { "@type": "Offer", price: "0", priceCurrency: "CNY" };
  }

  return base;
}
