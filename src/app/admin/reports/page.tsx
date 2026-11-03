import Link from "next/link";
import { all } from "@/db/client";
import { handleReportForm } from "@/lib/admin/form-actions";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  "link-dead": "链接失效",
  "wrong-content": "内容不符",
  virus: "疑似病毒",
  other: "其他",
};

type Row = {
  id: number;
  reason: string;
  contact: string | null;
  status: string;
  createdAt: number;
  resourceId: number;
  slug: string;
  title: string;
  code: string;
  provider: string | null;
};

export default async function AdminReportsPage() {
  const rows = all<Row>(
    `SELECT rp.id, rp.reason, rp.contact, rp.status, rp.created_at AS createdAt,
            r.id AS resourceId, r.slug, r.title, r.code, l.provider
     FROM reports rp
     JOIN resources r ON r.id = rp.resource_id
     LEFT JOIN resource_links l ON l.id = rp.link_id
     ORDER BY CASE rp.status WHEN 'open' THEN 0 ELSE 1 END, rp.created_at DESC
     LIMIT 100`,
  );

  const open = rows.filter((r) => r.status === "open").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-serif text-[24px] font-bold text-ink">举报</h1>
          <p className="mt-1 font-mono text-[11px] text-dim">
            待处理 {open} 条 · 最近 100 条记录
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 border border-dashed border-line p-10 text-center text-[13px] text-muted">
          暂无举报。详情页的「链接失效？举报」会落到这里。
        </p>
      ) : (
        <table className="mt-5 w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-dim">
              <th className="py-2 font-normal">状态</th>
              <th className="py-2 font-normal">资源</th>
              <th className="py-2 font-normal">类型</th>
              <th className="py-2 font-normal">链接</th>
              <th className="py-2 font-normal">联系方式</th>
              <th className="py-2 font-normal">时间</th>
              <th className="py-2 text-right font-normal">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60">
                <td className="py-2.5">
                  <span
                    className={
                      "inline-flex items-center gap-1.5 text-[11px] " +
                      (r.status === "open" ? "text-danger" : "text-dim")
                    }
                  >
                    <span
                      className={
                        "block size-1.5 " + (r.status === "open" ? "bg-danger" : "bg-dim")
                      }
                      aria-hidden
                    />
                    {r.status === "open" ? "待处理" : r.status === "handled" ? "已处理" : "已忽略"}
                  </span>
                </td>
                <td className="max-w-[280px] py-2.5">
                  <Link href={`/r/${r.slug}`} className="text-ink hover:text-accent">
                    <span className="truncate">{r.title}</span>
                  </Link>
                  <span className="ml-1.5 font-mono text-[10px] text-dim">{r.code}</span>
                </td>
                <td className="py-2.5 text-muted">{REASON_LABEL[r.reason] ?? r.reason}</td>
                <td className="py-2.5 text-muted">{r.provider ?? "整个资源"}</td>
                <td className="py-2.5 text-dim">{r.contact ?? "—"}</td>
                <td className="py-2.5 font-mono text-[11px] text-dim">
                  {relativeDate(new Date(r.createdAt * 1000))}
                </td>
                <td className="py-2.5 text-right">
                  <div className="inline-flex gap-1.5">
                    <form action={handleReportForm}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="handled" />
                      <button
                        type="submit"
                        className="min-h-8 cursor-pointer border border-line px-2 text-[12px] text-muted transition-colors hover:border-ok hover:text-ok"
                      >
                        标记已处理
                      </button>
                    </form>
                    <form action={handleReportForm}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="ignored" />
                      <button
                        type="submit"
                        className="min-h-8 cursor-pointer border border-line px-2 text-[12px] text-dim transition-colors hover:border-line-strong hover:text-ink"
                      >
                        忽略
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
