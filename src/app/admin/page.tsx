import Link from "next/link";
import { all } from "@/db/client";
import { getSiteStats, listAdminRows } from "@/lib/queries";
import { ftsCount } from "@/lib/search";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { formatCount, relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [rows, stats] = await Promise.all([listAdminRows(8), getSiteStats()]);
  const indexed = ftsCount();

  const pending = all<{ n: number }>(
    "SELECT (SELECT COUNT(*) FROM submissions WHERE status='pending') + (SELECT COUNT(*) FROM reports WHERE status='open') AS n",
  )[0]?.n ?? 0;
  const users = all<{ n: number }>("SELECT COUNT(*) AS n FROM users")[0]?.n ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink">概览</h1>
          <p className="mt-1 text-[12px] text-dim">数据每次刷新实时读取，不做缓存</p>
        </div>
        <Link
          href="/admin/resources/new"
          className="inline-flex min-h-8 items-center rounded-[6px] bg-ink px-3 text-[12px] text-white hover:opacity-90"
        >
          新建资源
        </Link>
      </div>

      {/* 指标条：密排、无阴影 */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line lg:grid-cols-5">
        <Stat label="已发布" value={String(stats.total)} />
        <Stat label="本周更新" value={String(stats.updatedThisWeek)} />
        <Stat label="死链率" value={`${stats.deadRate}%`} tone={stats.deadRate > 5 ? "danger" : undefined} />
        <Stat label="待处理" value={String(pending)} tone={pending > 0 ? "warn" : undefined} />
        <Stat label="账号 / 索引" value={`${users} / ${indexed}`} tone={indexed === 0 ? "danger" : undefined} />
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Quick href="/admin/resources/new" title="新建资源" desc="结构化字段 + 多链接" />
        <Quick href="/admin/imports" title="批量导入" desc="粘贴 CSV，一次几十条" />
        <Quick href="/admin/links" title="链接巡检" desc="看失效清单，一键复测" />
        <Quick href="/admin/users" title="用户管理" desc="封禁、改角色、重置密码" />
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-[14px] font-medium text-ink">最近更新</h2>
          <Link href="/admin/resources" className="text-[12px] text-muted hover:text-ink">
            全部资源 →
          </Link>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-line bg-surface">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wider text-dim">
                <th className="px-3 py-2 font-medium">编号</th>
                <th className="px-3 py-2 font-medium">标题</th>
                <th className="px-3 py-2 font-medium">分类</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">链接</th>
                <th className="px-3 py-2 font-medium">更新</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-muted">
                    还没有资源。可以先
                    <Link href="/admin/resources/new" className="mx-1 underline">
                      新建一条
                    </Link>
                    或在导入页粘贴 CSV。
                  </td>
                </tr>
              )}

              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-3 py-1.5 font-mono text-[11px] text-dim">{r.code}</td>
                  <td className="px-3 py-1.5">
                    <Link href={`/admin/resources/${r.id}`} className="text-[13px] text-ink hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-muted">{r.categoryName}</td>
                  <td className="px-3 py-1.5 text-[12px]">
                    <span
                      className={
                        r.status === "published"
                          ? "text-ok"
                          : r.status === "draft"
                            ? "text-muted"
                            : "text-dim"
                      }
                    >
                      {r.status === "published" ? "已发布" : r.status === "draft" ? "草稿" : "归档"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusDot status={(r.linkStatus as LinkStatus) ?? "unknown"} size="sm" />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-dim">
                    {relativeDate(r.updatedAt ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  tone?: "danger" | "warn";
}) {
  return (
    <div className="bg-surface px-3 py-3">
      <p className="text-[11px] uppercase tracking-wider text-dim">{label}</p>
      <p
        className={
          "mt-1 font-mono text-[20px] leading-none " +
          (tone === "danger" ? "text-danger" : tone === "warn" ? "text-ink" : "text-ink")
        }
      >
        {value}
      </p>
    </div>
  );
}

function Quick({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="rounded-[4px] border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="mt-0.5 text-[11px] text-dim">{desc}</p>
    </Link>
  );
}
