import Link from "next/link";
import { all, get } from "@/db/client";
import { StatusDot, type LinkStatus } from "@/components/ui/status-dot";
import { DeleteButton } from "@/components/admin/delete-button";
import { setStatusForm } from "@/lib/admin/form-actions";
import { formatCount, relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

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

/** 搜索范围：标题 / 编号 / 副标题 / slug —— 后台最常见的是"我记得编号" */
function buildWhere(q: string, status: string) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (status) {
    where.push("r.status = ?");
    params.push(status);
  }
  if (q) {
    const like = `%${q}%`;
    where.push("(r.title LIKE ? OR r.code LIKE ? OR r.slug LIKE ? OR r.subtitle LIKE ?)");
    params.push(like, like, like, like);
  }

  return { clause: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

function load(q: string, status: string, page: number) {
  const { clause, params } = buildWhere(q, status);
  const offset = (page - 1) * PAGE_SIZE;

  const rows = all<Row>(
    `SELECT r.id, r.code, r.slug, r.title, r.status, r.is_featured AS isFeatured,
            r.updated_at AS updatedAt, r.download_count AS downloadCount,
            c.name AS categoryName, l.status AS linkStatus,
            (SELECT COUNT(*) FROM resource_links x WHERE x.resource_id = r.id) AS linkCount
     FROM resources r
     JOIN categories c ON c.id = r.category_id
     LEFT JOIN resource_links l ON l.resource_id = r.id AND l.is_primary = 1
     ${clause}
     ORDER BY r.updated_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
    PAGE_SIZE,
    offset,
  );

  const total =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM resources r ${clause}`,
      ...params,
    )?.n ?? 0;

  return { rows, total };
}

const TABS = [
  { key: "", label: "全部" },
  { key: "published", label: "已发布" },
  { key: "draft", label: "草稿" },
  { key: "archived", label: "已归档" },
];

function href(params: { q?: string; status?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return s ? `/admin/resources?${s}` : "/admin/resources";
}

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const { rows, total } = load(q, status, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ q, status: t.key })}
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

      <form method="get" className="flex flex-wrap items-center gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="搜标题 / 编号 / slug"
          className="min-h-10 w-[260px] border border-line bg-surface-2 px-3 text-[13px] text-ink outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          className="min-h-10 cursor-pointer border border-line px-3 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent"
        >
          搜索
        </button>
        {q && (
          <Link href={href({ status })} className="text-[12px] text-dim hover:text-accent">
            清空
          </Link>
        )}
        <span className="ml-auto font-mono text-[11px] text-dim">
          共 {total} 条{q ? ` · 关键词「${q}」` : ""}
          {totalPages > 1 ? ` · 第 ${page}/${totalPages} 页` : ""}
        </span>
      </form>

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
                  {q ? `没有匹配「${q}」的资源。` : "没有符合条件的资源。"}
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

      {totalPages > 1 && (
        <nav aria-label="分页" className="flex items-center justify-between border-t border-line pt-3">
          {page > 1 ? (
            <Link
              href={href({ q, status, page: page - 1 })}
              className="inline-flex min-h-10 items-center border border-line px-3 text-[13px] text-muted hover:border-accent hover:text-accent"
            >
              ← 上一页
            </Link>
          ) : (
            <span className="inline-flex min-h-10 items-center px-3 text-[13px] text-dim/50">
              ← 上一页
            </span>
          )}

          <span className="font-mono text-[11px] text-dim">
            {page} / {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={href({ q, status, page: page + 1 })}
              className="inline-flex min-h-10 items-center border border-line px-3 text-[13px] text-muted hover:border-accent hover:text-accent"
            >
              下一页 →
            </Link>
          ) : (
            <span className="inline-flex min-h-10 items-center px-3 text-[13px] text-dim/50">
              下一页 →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
