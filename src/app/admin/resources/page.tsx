import Link from "next/link";
import { all } from "@/db/client";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { DeleteButton } from "@/components/admin/delete-button";
import { setStatusForm } from "@/lib/admin/form-actions";
import { formatCount, relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  code: string;
  slug: string;
  title: string;
  status: string;
  isFeatured: number;
  updatedAt: number;
  downloadCount: number;
  categoryName: string;
  linkStatus: string | null;
  linkCount: number;
};

async function load(status?: string) {
  const where = status ? "WHERE r.status = ?" : "";
  const params = status ? [status] : [];
  return all<Row>(
    `SELECT r.id, r.code, r.slug, r.title, r.status, r.is_featured AS isFeatured,
            r.updated_at AS updatedAt, r.download_count AS downloadCount,
            c.name AS categoryName, l.status AS linkStatus,
            (SELECT COUNT(*) FROM resource_links x WHERE x.resource_id = r.id) AS linkCount
     FROM resources r
     JOIN categories c ON c.id = r.category_id
     LEFT JOIN resource_links l ON l.resource_id = r.id AND l.is_primary = 1
     ${where}
     ORDER BY r.updated_at DESC
     LIMIT 200`,
    ...params,
  );
}

const TABS = [
  { key: "", label: "全部" },
  { key: "published", label: "已发布" },
  { key: "draft", label: "草稿" },
  { key: "archived", label: "已归档" },
];

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "" } = await searchParams;
  const rows = await load(status || undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key ? `/admin/resources?status=${t.key}` : "/admin/resources"}
              className={
                "inline-flex min-h-10 items-center border px-3 text-[13px] transition-colors " +
                (status === t.key
                  ? "border-accent text-accent"
                  : "border-line text-muted hover:border-line-strong hover:text-ink")
              }
            >
              {t.label}
            </Link>
          ))}
        </div>
        <Link
          href="/admin/resources/new"
          className="inline-flex min-h-11 items-center bg-accent px-4 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
        >
          新建资源
        </Link>
      </div>

      <p className="font-mono text-[11px] text-dim">
        {rows.length} 条{status ? ` · 筛选：${status}` : ""}
      </p>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2 text-left text-[11px] tracking-wide text-dim">
              <th className="px-3 py-2 font-normal">编号</th>
              <th className="px-3 py-2 font-normal">标题</th>
              <th className="px-3 py-2 font-normal">分类</th>
              <th className="px-3 py-2 font-normal">状态</th>
              <th className="px-3 py-2 font-normal">链接</th>
              <th className="px-3 py-2 font-normal">下载</th>
              <th className="px-3 py-2 font-normal">更新</th>
              <th className="px-3 py-2 font-normal">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted">
                  没有符合条件的资源。
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
                  {r.isFeatured ? (
                    <span className="ml-2 border border-accent/40 px-1 text-[10px] text-accent">
                      精选
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted">{r.categoryName}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "border px-1.5 py-0.5 text-[11px] " +
                      (r.status === "published"
                        ? "border-ok/40 text-ok"
                        : r.status === "draft"
                          ? "border-line text-muted"
                          : "border-line text-dim")
                    }
                  >
                    {r.status === "published" ? "已发布" : r.status === "draft" ? "草稿" : "已归档"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <StatusDot status={(r.linkStatus as LinkStatus) ?? "unknown"} size="sm" />
                    <span className="font-mono text-[11px] text-dim">×{r.linkCount}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted">
                  {formatCount(r.downloadCount)}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-dim">
                  {relativeDate(new Date(r.updatedAt * 1000))}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <form action={setStatusForm}>
                      <input type="hidden" name="id" value={r.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={r.status === "published" ? "draft" : "published"}
                      />
                      <button
                        type="submit"
                        className="min-h-9 cursor-pointer border border-line px-2 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        {r.status === "published" ? "下线" : "发布"}
                      </button>
                    </form>
                    <DeleteButton id={r.id} title={r.title} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
