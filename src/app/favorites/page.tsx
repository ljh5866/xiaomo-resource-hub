import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { ResourceCard } from "@/components/resource/resource-card";
import { ButtonLink } from "@/components/ui/button";
import { all } from "@/db/client";
import { getSessionUser } from "@/lib/auth";
import { readFavIds } from "@/lib/favorites";

export const metadata: Metadata = {
  title: "我的收藏",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type Row = {
  code: string;
  slug: string;
  title: string;
  subtitle: string | null;
  platforms: string | null;
  sizeLabel: string | null;
  isFeatured: number;
  updatedAt: number;
  categoryName: string;
  provider: string | null;
  linkStatus: string | null;
  coverUrl: string | null;
  coverBlur: string | null;
};

const CARD_SQL = `
  SELECT r.code, r.slug, r.title, r.subtitle, r.platforms,
         r.size_label AS sizeLabel, r.is_featured AS isFeatured,
         r.updated_at AS updatedAt, r.cover_url AS coverUrl, r.cover_blur AS coverBlur,
         c.name AS categoryName, l.provider, l.status AS linkStatus
  FROM resources r
  JOIN categories c ON c.id = r.category_id
  LEFT JOIN resource_links l ON l.resource_id = r.id AND l.is_primary = 1
`;

export default async function FavoritesPage() {
  const user = await getSessionUser();

  let rows: Row[] = [];
  let mode: "account" | "guest" = "guest";

  if (user) {
    mode = "account";
    rows = all<Row>(
      `${CARD_SQL}
       JOIN favorites f ON f.resource_id = r.id AND f.user_id = ?
       WHERE r.status = 'published'
       ORDER BY f.created_at DESC`,
      user.id,
    );
  } else {
    const ids = await readFavIds();
    if (ids.length) {
      rows = all<Row>(
        `${CARD_SQL}
         WHERE r.id IN (${ids.map(() => "?").join(",")}) AND r.status = 'published'
         ORDER BY r.updated_at DESC`,
        ...ids,
      );
    }
  }

  return (
    <div className="container-page py-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <h1 className="font-serif text-[28px] font-bold text-ink">我的收藏</h1>
          <p className="mt-1 font-mono text-[11px] text-dim">
            {rows.length} 条 ·{" "}
            {mode === "account" ? `已同步到账号 ${user?.email}` : "存在本机 cookie（登录后可跨设备）"}
          </p>
        </div>
        <ButtonLink href="/" variant="secondary" size="sm">
          继续逛
        </ButtonLink>
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 border border-dashed border-line px-6 py-14 text-center">
          <Bookmark className="mx-auto size-8 text-dim" strokeWidth={1.5} aria-hidden />
          <p className="mt-4 font-serif text-[18px] font-semibold text-ink">还没有收藏</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
            在资源详情页点「收藏」，下次就能在这里找到
            {mode === "guest" ? "。收藏不需要登录。" : "。"}
          </p>
          <p className="mt-5 text-[12px] text-dim">
            不知道从哪开始？<Link href="/updates" className="text-accent">看看每日更新</Link>
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <ResourceCard
              key={r.code}
              data={{
                code: r.code,
                slug: r.slug,
                title: r.title,
                subtitle: r.subtitle,
                categoryName: r.categoryName,
                platforms: JSON.parse(r.platforms || "[]") as string[],
                sizeLabel: r.sizeLabel,
                provider: r.provider,
                status: (r.linkStatus as "ok" | "invalid" | "unknown") ?? "unknown",
                updatedAt: new Date(r.updatedAt * 1000),
                isFeatured: Boolean(r.isFeatured),
                coverUrl: r.coverUrl,
                coverBlur: r.coverBlur,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
