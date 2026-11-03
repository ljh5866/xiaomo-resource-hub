import type { MetadataRoute } from "next";
import { all } from "@/db/client";

const BASE = process.env.SITE_URL ?? "http://localhost:3100";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/updates`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const cats = all<{ slug: string }>(
    `SELECT slug FROM categories WHERE is_visible = 1`,
  );

  const rows = all<{ slug: string; updatedAt: number }>(
    `SELECT slug, updated_at AS updatedAt FROM resources
     WHERE status = 'published' ORDER BY updated_at DESC LIMIT 5000`,
  );

  return [
    ...staticRoutes,
    ...cats.map((c) => ({
      url: `${BASE}/c/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...rows.map((r) => ({
      url: `${BASE}/r/${r.slug}`,
      lastModified: new Date(r.updatedAt * 1000),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
