/**
 * 桌面端接口层。内容接口公开，账号接口走 Bearer token。
 */

const BASE_KEY = "xm.apiBase";
const TOKEN_KEY = "xm.token";

export function apiBase(): string {
  return localStorage.getItem(BASE_KEY) ?? "https://ttals.com";
}

export function setApiBase(v: string) {
  const clean = v.trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem(BASE_KEY, clean);
  else localStorage.removeItem(BASE_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
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

export type Me = {
  user: { id: number; email: string; name: string | null; role: string };
  favorites: {
    id: number;
    slug: string;
    title: string;
    cover: string | null;
    category: string;
    categoryName: string;
    createdAt: number;
  }[];
  stats: { favorites: number; submissions: number };
};

export class ApiError extends Error {
  status: number;
  needLogin: boolean;
  constructor(message: string, status: number, needLogin = false) {
    super(message);
    this.status = status;
    this.needLogin = needLogin;
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const j = json as { error?: string; needLogin?: boolean } | null;
    throw new ApiError(j?.error ?? `请求失败（${res.status}）`, res.status, j?.needLogin === true);
  }
  return json as T;
}

/** 封面转绝对地址 */
export function coverUrl(cover: string | null): string | null {
  if (!cover) return null;
  return /^https?:/i.test(cover) ? cover : `${apiBase()}${cover}`;
}

export const api = {
  taxonomy: () => req<Taxonomy>("/api/app/taxonomy"),
  feed: (p: { category?: string; kind?: string; q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (p.category) qs.set("category", p.category);
    if (p.kind) qs.set("kind", p.kind);
    if (p.q) qs.set("q", p.q);
    if (p.page) qs.set("page", String(p.page));
    return req<{ ok: boolean; page: number; total: number; hasMore: boolean; items: Card[] }>(
      `/api/app/feed?${qs}`,
    );
  },
  detail: (slug: string) =>
    req<{ ok: boolean; resource: Detail }>(`/api/app/resource?slug=${encodeURIComponent(slug)}`),
};

export const authApi = {
  login: (email: string, secret: { password?: string; code?: string }) =>
    req<{ ok: boolean; token: string; user: Me["user"] }>("/api/app/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, ...secret }),
    }),
  me: () => req<Me & { ok: boolean }>("/api/app/me"),
  favorite: (slug: string, on: boolean) =>
    req<{ ok: boolean; favorited: boolean; count: number }>("/api/app/favorites", {
      method: on ? "POST" : "DELETE",
      body: JSON.stringify({ slug }),
    }),
};
