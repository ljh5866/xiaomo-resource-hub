import { all } from "@/db/client";
import { RecheckButton } from "@/components/admin/recheck-button";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { providerOf } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  resourceId: number;
  title: string;
  slug: string;
  provider: string;
  url: string;
  status: string;
  failCount: number;
  checkedAt: number | null;
  lastError: string | null;
  clickCount: number;
};

function load() {
  return all<Row>(
    `SELECT l.id, l.resource_id AS resourceId, r.title, r.slug, l.provider, l.url,
            l.status, l.fail_count AS failCount, l.checked_at AS checkedAt,
            l.last_error AS lastError, l.click_count AS clickCount
     FROM resource_links l
     JOIN resources r ON r.id = l.resource_id
     ORDER BY
       CASE l.status WHEN 'invalid' THEN 0 WHEN 'unknown' THEN 1 ELSE 2 END,
       l.checked_at ASC
     LIMIT 300`,
  );
}

function summary(rows: Row[]) {
  const ok = rows.filter((r) => r.status === "ok").length;
  const bad = rows.filter((r) => r.status === "invalid").length;
  const unknown = rows.filter((r) => r.status === "unknown").length;
  return { ok, bad, unknown, total: rows.length };
}

export default async function LinksPage() {
  const rows = load();
  const s = summary(rows);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[20px] font-bold text-ink">链接巡检</h1>
          <p className="mt-1 text-[13px] text-muted">
            失效的排在最前。点「复测」只测待校验/失效的链接；命令行{" "}
            <code className="font-mono text-ink">pnpm links:check</code> 可跑全量（连续失败 3 次才判死）。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2 font-mono text-[11px]">
            <span className="border border-ok/40 px-2 py-1 text-ok">有效 {s.ok}</span>
            <span className="border border-danger/40 px-2 py-1 text-danger">失效 {s.bad}</span>
            <span className="border border-line px-2 py-1 text-dim">待校验 {s.unknown}</span>
          </div>
          <RecheckButton limit={20} />
        </div>
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2 text-left text-[11px] tracking-wide text-dim">
              <th className="px-3 py-2 font-normal">资源</th>
              <th className="px-3 py-2 font-normal">网盘</th>
              <th className="px-3 py-2 font-normal">链接</th>
              <th className="px-3 py-2 font-normal">状态</th>
              <th className="px-3 py-2 font-normal">失败次数</th>
              <th className="px-3 py-2 font-normal">最近检测</th>
              <th className="px-3 py-2 font-normal">错误</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted">
                  还没有链接。
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-surface-2/60">
                <td className="px-3 py-2">
                  <a href={`/admin/resources/${r.resourceId}`} className="text-ink hover:text-accent">
                    {r.title}
                  </a>
                </td>
                <td className="px-3 py-2 text-muted">{providerOf(r.provider).name}</td>
                <td className="max-w-[280px] truncate px-3 py-2 font-mono text-[11px] text-dim">
                  {r.url}
                </td>
                <td className="px-3 py-2">
                  <StatusDot status={r.status as LinkStatus} size="sm" />
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{r.failCount}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-dim">
                  {r.checkedAt ? formatDate(new Date(r.checkedAt * 1000)) : "—"}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-[11px] text-dim">
                  {r.lastError ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
