import { all } from "@/db/client";
import {
  categoryForm,
  deleteTagForm,
  mergeTagForm,
  renameTagForm,
} from "@/lib/admin/taxonomy-forms";

export const dynamic = "force-dynamic";

type Cat = {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
  isVisible: number;
  count: number;
};

type Tag = { id: number; name: string; slug: string; useCount: number };

const cellInput =
  "min-h-9 border border-line bg-surface-2 px-2 text-[13px] text-ink outline-none focus:border-accent";

export default async function AdminTaxonomyPage() {
  const categories = all<Cat>(
    `SELECT c.id, c.slug, c.name, c.sort_order AS sortOrder, c.is_visible AS isVisible,
            (SELECT COUNT(*) FROM resources r WHERE r.category_id = c.id AND r.status='published') AS count
     FROM categories c
     ORDER BY c.sort_order, c.id`,
  );

  const tags = all<Tag>(
    `SELECT id, name, slug, use_count AS useCount FROM tags ORDER BY use_count DESC, id LIMIT 200`,
  );

  return (
    <div className="space-y-10">
      {/* ───────── 分类 ───────── */}
      <section>
        <div className="border-b border-line pb-3">
          <h1 className="font-serif text-[22px] font-bold text-ink">分类</h1>
          <p className="mt-1 font-mono text-[11px] text-dim">
            {categories.length} 个 · 排序值小的排前面 · 隐藏后前台分类栏不再出现
          </p>
        </div>

        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] text-dim">
                <th className="px-3 py-2 font-normal">slug</th>
                <th className="px-3 py-2 font-normal">名称</th>
                <th className="px-3 py-2 font-normal">排序</th>
                <th className="px-3 py-2 font-normal">前台可见</th>
                <th className="px-3 py-2 font-normal">已发布</th>
                <th className="px-3 py-2 text-right font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-[11px] text-dim">{c.slug}</td>
                  <td className="px-3 py-2" colSpan={3}>
                    <form action={categoryForm} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        name="name"
                        defaultValue={c.name}
                        className={cellInput + " w-[160px]"}
                        aria-label={`${c.name} 名称`}
                      />
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={c.sortOrder}
                        className={cellInput + " w-16"}
                        aria-label={`${c.name} 排序`}
                      />
                      <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-muted">
                        <input
                          type="checkbox"
                          name="isVisible"
                          value="1"
                          defaultChecked={Boolean(c.isVisible)}
                        />
                        显示
                      </label>
                      <button
                        type="submit"
                        className="min-h-9 shrink-0 cursor-pointer whitespace-nowrap border border-line px-2 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        保存
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-dim">{c.count}</td>
                  <td className="px-3 py-2 text-right">
                    <a href={`/c/${c.slug}`} target="_blank" className="text-[12px] text-accent">
                      前台 ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────── 标签 ───────── */}
      <section>
        <div className="border-b border-line pb-3">
          <h2 className="font-serif text-[22px] font-bold text-ink">标签</h2>
          <p className="mt-1 font-mono text-[11px] text-dim">
            {tags.length} 个 · 可改名、合并、删除（有资源在用时必须先合并）
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {tags.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 border border-line p-2">
              <form action={renameTagForm} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <input
                  name="name"
                  defaultValue={t.name}
                  className={cellInput + " w-[140px]"}
                  aria-label={`标签 ${t.name}`}
                />
                <button
                  type="submit"
                  className="min-h-9 cursor-pointer border border-line px-2 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  改名
                </button>
              </form>

              <span className="font-mono text-[11px] text-dim">×{t.useCount}</span>

              <form action={mergeTagForm} className="flex items-center gap-1">
                <input type="hidden" name="fromId" value={t.id} />
                <select
                  name="toId"
                  defaultValue=""
                  className="min-h-9 max-w-[130px] border border-line bg-surface-2 px-1 text-[12px] text-muted"
                  aria-label={`把 ${t.name} 合并到`}
                >
                  <option value="">合并到…</option>
                  {tags
                    .filter((x) => x.id !== t.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="min-h-9 cursor-pointer border border-line px-2 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  合并
                </button>
              </form>

              {t.useCount === 0 && (
                <form action={deleteTagForm}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="min-h-9 cursor-pointer border border-line px-2 text-[12px] text-dim transition-colors hover:border-danger hover:text-danger"
                  >
                    删除
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
