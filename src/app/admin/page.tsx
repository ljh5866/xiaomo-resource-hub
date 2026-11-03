import Link from "next/link";
import { listAdminRows, getSiteStats } from "@/lib/queries";
import { ftsCount } from "@/lib/search";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { formatCount, relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [rows, stats] = await Promise.all([listAdminRows(8), getSiteStats()]);
  const dead = rows.filter((r) => r.linkStatus === "invalid").length;
  const indexed = ftsCount();

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
        <Stat label="已发布资源" value={String(stats.total)} />
        <Stat label="本周更新" value={String(stats.updatedThisWeek)} />
        <Stat label="死链率" value={`${stats.deadRate}%`} tone={stats.deadRate > 5 ? "danger" : "ok"} />
        <Stat label="搜索索引" value={String(indexed)} tone={indexed === 0 ? "danger" : "ok"} />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Action href="/admin/resources/new" title="新建资源" desc="填结构化字段 + 多链接" />
        <Action href="/admin/imports" title="批量导入" desc="粘贴 CSV，一次几十条" />
        <Action href="/admin/links" title="链接巡检" desc="看失效清单，决定谁要修" />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-[18px] font-semibold text-ink">最近更新</h2>
          <Link href="/admin/resources" className="text-[13px] text-accent">
            全部资源
          </Link>
        </div>

        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] tracking-wide text-dim">
                <th className="px-3 py-2 font-normal">编号</th>
                <th className="px-3 py-2 font-normal">标题</th>
                <th className="px-3 py-2 font-normal">分类</th>
                <th className="px-3 py-2 font-normal">链接</th>
                <th className="px-3 py-2 font-normal">下载</th>
                <th className="px-3 py-2 font-normal">更新</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted">
                    还没有数据，先跑 <code className="font-mono">pnpm db:seed</code> 或新建一条。
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-surface-2/60">
                  <td className="px-3 py-2 font-mono text-[11px] text-dim">{r.code}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/resources/${r.id}`} className="text-ink hover:text-accent">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{r.categoryName}</td>
                  <td className="px-3 py-2">
                    <StatusDot status={(r.linkStatus as LinkStatus) ?? "unknown"} size="sm" />
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">
                    {formatCount(r.downloadCount)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-dim">
                    {relativeDate(r.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dead > 0 && (
          <p className="mt-2 text-[12px] text-danger">
            最近 8 条里有 {dead} 条链接失效，去「链接巡检」看看。
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-dim">{label}</p>
      <p
        className={
          "mt-2 font-mono text-[26px] leading-none " +
          (tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : "text-ink")
        }
      >
        {value}
      </p>
    </div>
  );
}

function Action({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group border border-line bg-surface p-4 transition-colors hover:border-accent"
    >
      <p className="font-serif text-[15px] font-semibold text-ink group-hover:text-accent">
        {title}
      </p>
      <p className="mt-1 text-[12px] text-muted">{desc}</p>
    </Link>
  );
}
