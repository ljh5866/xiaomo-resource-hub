import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceFeed } from "@/components/resource/resource-feed";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { countResources, listResources } from "@/lib/queries";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "每日更新",
  description: "小莫资源网最近上架与更新的资源，按时间倒序。",
  alternates: { canonical: "/updates" },
};

const PAGE_SIZE = 12;

export default async function UpdatesPage() {
  const [items, total] = await Promise.all([
    listResources({ limit: PAGE_SIZE }),
    countResources(),
  ]);

  return (
    <div className="container-page py-10">
      <header className="border-b border-line pb-6">
        <h1 className="font-sans text-[30px] font-bold text-ink">每日更新</h1>
        <p className="mt-2 text-[14px] text-muted">
          最近上架与变更的资源，共 {total} 项。订阅{" "}
          <a className="text-accent" href="/rss.xml">RSS</a> 可第一时间收到。
        </p>
      </header>

      <Suspense fallback={<div className="mt-8"><CardGridSkeleton count={3} /></div>}>
        <ResourceFeed initialItems={items} initialTotal={total} pageSize={PAGE_SIZE} />
      </Suspense>
    </div>
  );
}
