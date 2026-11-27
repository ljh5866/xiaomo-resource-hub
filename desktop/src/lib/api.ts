/**
 * 后端接口封装。桌面端不内嵌数据库，所有内容都来自站点 API，
 * 这样站上发什么、桌面端就显示什么。
 *
 * API 基址可在设置里改（本地开发指向 localhost:3100）。
 */

const KEY = "xm.apiBase";

export function apiBase(): string {
  return localStorage.getItem(KEY) ?? "https://ttals.com";
}

export function setApiBase(v: string) {
  const clean = v.trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem(KEY, clean);
  else localStorage.removeItem(KEY);
}

export type Card = {
  id: number;
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  cover: string | null;
  category: string;
  categoryName: string;
  provider: string | null;
  providerName: string | null;
  size: string | null;
  version: string | null;
  updatedAt: number;
};

export type Detail = {
  id: number;
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  content: string | null;
  cover: string | null;
  category: string;
  categoryName: string;
  platforms: string[];
  version: string | null;
  size: string | null;
  language: string | null;
  license: string | null;
  sourceUrl: string | null;
  publishedAt: number | null;
  updatedAt: number;
  meta: { label: string; value: string }[];
  tags: { slug: string; name: string; kind: string }[];
  links: {
    id: number;
    provider: string;
    providerName: string;
    url: string;
    code: string | null;
    label: string | null;
    primary: boolean;
  }[];
};

export type Taxonomy = {
  categories: { slug: string; name: string; description: string | null; count: number }[];
  tags: { slug: string; name: string; kind: string; category: string | null; count: number }[];
};

async function j<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

/** 封面转绝对地址（API 返回的是站内路径） */
export function coverUrl(cover: string | null): string | null {
  if (!cover) return null;
  return /^https?:/i.test(cover) ? cover : `${apiBase()}${cover}`;
}

export const api = {
  taxonomy: () => j<Taxonomy>("/api/app/taxonomy"),
  feed: (p: { category?: string; kind?: string; q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (p.category) qs.set("category", p.category);
    if (p.kind) qs.set("kind", p.kind);
    if (p.q) qs.set("q", p.q);
    if (p.page) qs.set("page", String(p.page));
    return j<{ ok: boolean; page: number; total: number; hasMore: boolean; items: Card[] }>(
      `/api/app/feed?${qs}`,
    );
  },
  detail: (slug: string) => j<{ ok: boolean; resource: Detail }>(`/api/app/resource?slug=${encodeURIComponent(slug)}`),
};
