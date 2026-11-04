import { all } from "@/db/client";
import { UserRowActions } from "@/components/admin/user-row-actions";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: number;
  favorites: number;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const q = (sp.q ?? "").trim();

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status) {
    where.push("u.status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(u.email LIKE ? OR u.name LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const rows = all<Row>(
    `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at AS createdAt,
            (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorites
     FROM users u
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY u.created_at DESC
     LIMIT 200`,
    ...params,
  );

  const counts = all<{ status: string; n: number }>(
    "SELECT status, COUNT(*) AS n FROM users GROUP BY status",
  );
  const total = counts.reduce((s, c) => s + c.n, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink">用户</h1>
          <p className="mt-1 text-[12px] text-dim">
            共 {total} 个账号 · 封禁会立刻踢掉该用户所有会话
          </p>
        </div>

        <form className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="搜邮箱 / 昵称"
            className="min-h-8 w-[200px] rounded-[6px] border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-line-strong"
          />
          <button
            type="submit"
            className="min-h-8 cursor-pointer rounded-[6px] border border-line px-2.5 text-[12px] text-muted hover:border-line-strong hover:text-ink"
          >
            搜索
          </button>
        </form>
      </div>

      <div className="flex flex-wrap gap-1">
        {[
          ["", "全部"],
          ["active", "正常"],
          ["pending", "待审核"],
          ["banned", "已封禁"],
        ].map(([key, label]) => (
          <a
            key={key}
            href={key ? `/admin/users?status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}` : "/admin/users"}
            className={
              "inline-flex min-h-8 items-center rounded-[6px] border px-2.5 text-[12px] " +
              (status === key
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink")
            }
          >
            {label}
            {key ? ` ${counts.find((c) => c.status === key)?.n ?? 0}` : ""}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[4px] border border-line bg-surface">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wider text-dim">
              <th className="px-3 py-2 font-medium">邮箱</th>
              <th className="px-3 py-2 font-medium">昵称</th>
              <th className="px-3 py-2 font-medium">角色</th>
              <th className="px-3 py-2 font-medium">状态</th>
              <th className="px-3 py-2 font-medium">收藏</th>
              <th className="px-3 py-2 font-medium">注册时间</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[13px] text-muted">
                  没有匹配的账号。
                </td>
              </tr>
            )}

            {rows.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-[12px] text-ink">{u.email}</td>
                <td className="px-3 py-2 text-[12px] text-muted">{u.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "inline-flex rounded-[4px] border px-1.5 py-0.5 text-[11px] " +
                      (u.role === "admin"
                        ? "border-ink/30 bg-ink/5 text-ink"
                        : "border-line text-muted")
                    }
                  >
                    {u.role === "admin" ? "管理员" : "用户"}
                  </span>
                </td>
                <td className="px-3 py-2 text-[12px]">
                  <span
                    className={
                      u.status === "active"
                        ? "text-ok"
                        : u.status === "banned"
                          ? "text-danger"
                          : "text-muted"
                    }
                  >
                    {u.status === "active" ? "正常" : u.status === "banned" ? "已封禁" : "待审核"}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[12px] text-muted">{u.favorites}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-dim">
                  {new Date(u.createdAt * 1000).toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <UserRowActions id={u.id} role={u.role} status={u.status} email={u.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
