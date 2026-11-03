import Link from "next/link";
import { all } from "@/db/client";
import { acceptSubmissionForm, rejectSubmissionForm } from "@/lib/admin/form-actions";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string;
  url: string;
  categorySlug: string | null;
  provider: string | null;
  note: string | null;
  contact: string | null;
  status: string;
  createdAt: number;
};

export default async function AdminSubmissionsPage() {
  const rows = all<Row>(
    `SELECT id, title, url, category_slug AS categorySlug, provider, note, contact, status,
            created_at AS createdAt
     FROM submissions
     ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 100`,
  );

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-serif text-[24px] font-bold text-ink">投稿</h1>
          <p className="mt-1 font-mono text-[11px] text-dim">
            待审 {pending} 条 · 最近 100 条 · 采纳后生成草稿资源
          </p>
        </div>
        <Link href="/submit" className="text-[12px] text-accent" target="_blank">
          打开投稿页 ↗
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 border border-dashed border-line p-10 text-center text-[13px] text-muted">
          还没有人投稿。<Link href="/submit" className="text-accent">投稿页</Link> 的提交会落到这里。
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif text-[15px] font-semibold text-ink">{r.title}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-dim">{r.url}</p>
                </div>
                <span
                  className={
                    "shrink-0 border px-2 py-0.5 text-[11px] " +
                    (r.status === "pending"
                      ? "border-accent/40 text-accent"
                      : r.status === "accepted"
                        ? "border-ok/40 text-ok"
                        : "border-line text-dim")
                  }
                >
                  {r.status === "pending" ? "待审" : r.status === "accepted" ? "已采纳" : "已拒绝"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                <span>分类 {r.categorySlug ?? "未指定"}</span>
                <span>网盘 {r.provider ?? "—"}</span>
                <span>联系 {r.contact ?? "—"}</span>
                <span className="font-mono text-[11px] text-dim">
                  {relativeDate(new Date(r.createdAt * 1000))}
                </span>
              </div>

              {r.note && <p className="mt-2 text-[12px] leading-relaxed text-muted">{r.note}</p>}

              {r.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <form action={acceptSubmissionForm}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="min-h-9 cursor-pointer border border-accent bg-accent px-3 text-[12px] text-on-accent transition-colors hover:bg-accent-strong"
                    >
                      采纳并建草稿
                    </button>
                  </form>
                  <form action={rejectSubmissionForm}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="min-h-9 cursor-pointer border border-line px-3 text-[12px] text-dim transition-colors hover:border-danger hover:text-danger"
                    >
                      拒绝
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
