import { all } from "@/db/client";

const BASE = process.env.SITE_URL ?? "http://localhost:3100";

export const revalidate = 1800;

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET() {
  const items = all<{
    slug: string;
    title: string;
    summary: string | null;
    publishedAt: number | null;
  }>(
    `SELECT slug, title, summary, published_at AS publishedAt
     FROM resources WHERE status = 'published'
     ORDER BY published_at DESC LIMIT 50`,
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>小莫资源网 · 每日更新</title>
    <link>${BASE}</link>
    <description>认真归档的好用资源</description>
    <language>zh-CN</language>
${items
  .map(
    (i) => `    <item>
      <title>${escapeXml(i.title)}</title>
      <link>${BASE}/r/${i.slug}</link>
      <guid>${BASE}/r/${i.slug}</guid>
      <description>${escapeXml(i.summary ?? "")}</description>
      <pubDate>${new Date((i.publishedAt ?? Math.floor(Date.now() / 1000)) * 1000).toUTCString()}</pubDate>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}
