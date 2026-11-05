import Link from "next/link";
import { all } from "@/db/client";
import {
  deleteTagForm,
  newTagForm,
  renameTagForm,
  tagKindForm,
} from "@/lib/admin/taxonomy-forms";

export const dynamic = "force-dynamic";

type GameRow = {
  id: number;
  slug: string;
  name: string;
  count: number;
  platformCount: number;
  updatedAt: number | null;
};

const cellInput =
  "min-h-9 rounded-[6px] border border-line bg-surface-2 px-2 text-[13px] text-ink outline-none focus:border-accent";

/**
 * 游戏分类管理：只关心 kind='game' 的标签。
 *
 * 为什么要单独一页：分类页的游戏筛选条就是读这张表，
 * 平时加一个游戏（只狼 / 赛博朋克）不需要先建资源，直接在这里加。
 */
export default async function AdminGamesPage() {
  const games = all<GameRow>(
    `SELECT t.id, t.slug, t.name,
            COUNT(DISTINCT rt.resource_id) AS count,
            (SELECT COUNT(DISTINCT r.id)
               FROM resource_tags rt2
               JOIN resources r ON r.id = rt2.resource_id AND r.status = 'published'
              WHERE rt2.tag_id = t.id) AS platformCount,
            (SELECT MAX(r.updated_at)
               FROM resource_tags rt3
               JOIN resources r ON r.id = rt3.resource_id
              WHERE rt3.tag_id = t.id) AS updatedAt
       FROM tags t
       LEFT JOIN resource_tags rt ON rt.tag_id = t.id
      WHERE t.kind = 'game'
      GROUP BY t.id
      ORDER BY count DESC, t.id`,
  );

  const candidates = all<{ id: number; slug: string; name: string; count: number }>(
    `SELECT t.id, t.slug, t.name, COUNT(rt.resource_id) AS count
       FROM tags t
       LEFT JOIN resource_tags rt ON rt.tag_id = t.id
      WHERE t.kind <> 'game'
      GROUP BY t.id
      ORDER BY count DESC, t.id
      LIMIT 30`,
  );

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <h1 className="text-[22px] font-bold text-ink">游戏分类</h1>
            <p className="mt-1 font-mono text-[11px] text-dim">
              {games.length} 个游戏 · 分类页顶部筛选条按这里显示
            </p>
          </div>
          <Link
            href="/c/mods"
            target="_blank"
            className="text-[12px] text-accent underline-offset-2 hover:underline"
          >
            前台效果 ↗
          </Link>
        </div>

        {/* 新增 */}
        <form
          action={newTagForm}
          className="mt-4 flex flex-wrap items-end gap-2 rounded-[8px] border border-dashed border-line p-3"
        >
          <div>
            <label className="block text-[11px] text-dim">游戏名称</label>
            <input name="name" placeholder="只狼" className={cellInput + " w-[140px]"} required />
          </div>
          <div>
            <label className="block text-[11px] text-dim">slug（英文，用不了中文）</label>
            <input
              name="slug"
              placeholder="sekiro"
              className={cellInput + " w-[130px] font-mono"}
              required
            />
          </div>
          <input type="hidden" name="kind" value="game" />
          <button
            type="submit"
            className="min-h-9 cursor-pointer rounded-[6px] bg-ink px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            新增游戏
          </button>
          <span className="pb-1 text-[11px] text-dim">
            slug 会出现在 URL 里（/c/mods?game=sekiro）
          </span>
        </form>
      </section>

      {/* 列表 */}
      <section>
        <div className="overflow-x-auto rounded-[8px] border border-line">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] text-dim">
                <th className="px-3 py-2 font-normal">游戏</th>
                <th className="px-3 py-2 font-normal">slug</th>
                <th className="px-3 py-2 font-normal">资源数</th>
                <th className="px-3 py-2 font-normal">最近更新</th>
                <th className="px-3 py-2 text-right font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {games.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[13px] text-muted">
                    还没有游戏分类，用上面的表单加一个。
                  </td>
                </tr>
              )}
              {games.map((g) => (
                <tr key={g.id} className="border-t border-line align-middle">
                  <td className="px-3 py-2">
                    <form action={renameTagForm} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={g.id} />
                      <input
                        name="name"
                        defaultValue={g.name}
                        className={cellInput + " w-[130px]"}
                        aria-label={`${g.name} 名称`}
                      />
                      <button
                        type="submit"
                        className="min-h-9 cursor-pointer rounded-[6px] border border-line px-2 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        改名
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-dim">{g.slug}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-[12px] text-ink">{g.count}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-dim">
                    {g.updatedAt ? new Date(g.updatedAt * 1000).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/c/mods?game=${g.slug}`}
                        target="_blank"
                        className="text-[12px] text-accent"
                      >
                        前台 ↗
                      </Link>

                      <form action={tagKindForm} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="kind" value="platform" />
                        <button
                          type="submit"
                          className="min-h-9 cursor-pointer rounded-[6px] border border-line px-2 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
                          title="改成「平台」后不再出现在游戏筛选条"
                        >
                          转为平台
                        </button>
                      </form>

                      {g.count === 0 && (
                        <form action={deleteTagForm}>
                          <input type="hidden" name="id" value={g.id} />
                          <button
                            type="submit"
                            className="min-h-9 cursor-pointer rounded-[6px] border border-line px-2 text-[12px] text-dim transition-colors hover:border-danger hover:text-danger"
                          >
                            删除
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 待归类 */}
      {candidates.length > 0 && (
        <section>
          <h2 className="border-b border-line pb-2 text-[15px] font-semibold text-ink">
            可能想设成游戏的标签
          </h2>
          <p className="mt-1 text-[11px] text-dim">
            这些标签当前是「平台」或「其它」，点一下就能改成游戏分类。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidates.slice(0, 18).map((t) => (
              <form key={t.id} action={tagKindForm} className="flex items-center gap-1 rounded-[6px] border border-line px-2 py-1">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="kind" value="game" />
                <span className="text-[12px] text-ink">{t.name}</span>
                <span className="font-mono text-[10px] text-dim">×{t.count}</span>
                <button
                  type="submit"
                  className="ml-1 cursor-pointer text-[11px] text-accent hover:underline"
                >
                  设为游戏
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
