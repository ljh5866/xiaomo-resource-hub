import Link from "next/link";
import { all } from "@/db/client";
import { BulkGameForm } from "@/components/admin/bulk-game-form";
import { GAME_CATEGORY, gameCoverage } from "@/lib/games/bulk";
import { countOutOfScope } from "@/lib/games/fix-scope";
import { fixTagScopeAction } from "@/lib/games/actions";
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
  updatedAt: number | null;
};

const cellInput =
  "min-h-9 rounded-[6px] border border-line bg-surface-2 px-2 text-[13px] text-ink outline-none focus:border-accent";

/**
 * 游戏分类管理：只关心 kind='game' 的标签，且只作用于「游戏 MODS」分类。
 *
 * 计数一律按 mods 分类统计 —— 曾经因为算了全站，显示成 821 条，
 * 再配合不做分类限定的批量操作，把 galgame 和开源项目全打上了「我的世界」。
 */
export default async function AdminGamesPage() {
  const games = all<GameRow>(
    `SELECT t.id, t.slug, t.name,
            (SELECT COUNT(*)
               FROM resource_tags rt
               JOIN resources r ON r.id = rt.resource_id
               JOIN categories c ON c.id = r.category_id
              WHERE rt.tag_id = t.id AND c.slug = ? AND r.status = 'published') AS count,
            (SELECT MAX(r.updated_at)
               FROM resource_tags rt3
               JOIN resources r ON r.id = rt3.resource_id
              WHERE rt3.tag_id = t.id) AS updatedAt
       FROM tags t
      WHERE t.kind = 'game'
      ORDER BY count DESC, t.id`,
    GAME_CATEGORY,
  );

  const coverage = gameCoverage();
  const outOfScope = countOutOfScope();

  const categories = all<{ slug: string; name: string; count: number }>(
    `SELECT c.slug, c.name,
            (SELECT COUNT(*) FROM resources r WHERE r.category_id = c.id AND r.status = 'published') AS count
       FROM categories c ORDER BY c.sort_order, c.id`,
  );

  const genres = all<{ id: number; slug: string; name: string; count: number }>(
    `SELECT t.id, t.slug, t.name, COUNT(rt.resource_id) AS count
       FROM tags t
       LEFT JOIN resource_tags rt ON rt.tag_id = t.id
      WHERE t.kind = 'genre'
      GROUP BY t.id
      ORDER BY t.id`,
  );

  const candidates = all<{ id: number; slug: string; name: string; count: number }>(
    `SELECT t.id, t.slug, t.name, COUNT(rt.resource_id) AS count
       FROM tags t
       LEFT JOIN resource_tags rt ON rt.tag_id = t.id
      WHERE t.kind NOT IN ('game', 'genre', 'gh')
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
            <p className="mt-1 text-[12px] text-muted">
              「游戏 MODS」{coverage.total} 条 · 已归类 {coverage.assigned} · 未归类{" "}
              <span className={coverage.unassigned > 0 ? "text-danger" : "text-ink"}>
                {coverage.unassigned}
              </span>
            </p>
          </div>
          <Link
            href={`/c/${GAME_CATEGORY}`}
            target="_blank"
            className="text-[12px] text-accent underline-offset-2 hover:underline"
          >
            看前台筛选条 ↗
          </Link>
        </div>

        {outOfScope > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-danger/40 bg-danger/5 px-3 py-2">
            <p className="text-[12px] text-danger">
              发现 {outOfScope} 条跨分类标签（例如 galgame 挂着「我的世界」），会让筛选条串内容。
            </p>
            <form action={fixTagScopeAction}>
              <button
                type="submit"
                className="min-h-8 cursor-pointer rounded-[6px] bg-danger px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
              >
                清理越界标签
              </button>
            </form>
          </div>
        )}

        <form
          action={newTagForm}
          className="mt-4 flex flex-wrap items-end gap-2 rounded-[8px] border border-dashed border-line p-3"
        >
          <div>
            <label className="block text-[11px] text-dim">游戏名称</label>
            <input name="name" placeholder="只狼" className={cellInput + " w-[140px]"} required />
          </div>
          <div>
            <label className="block text-[11px] text-dim">slug（英文）</label>
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
          <span className="pb-1 text-[11px] text-dim">URL：/c/mods?game=sekiro</span>
        </form>
      </section>

      {/* 列表 */}
      <section>
        <div className="overflow-x-auto rounded-[8px] border border-line">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] text-dim">
                <th className="px-3 py-2 font-normal">游戏</th>
                <th className="px-3 py-2 font-normal">slug</th>
                <th className="px-3 py-2 font-normal">MODS 数</th>
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
                        href={`/c/${GAME_CATEGORY}?game=${g.slug}`}
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

      {/* 批量归类 */}
      <section>
        <h2 className="border-b border-line pb-2 text-[15px] font-semibold text-ink">
          批量修改所属游戏
        </h2>
        <p className="mt-1 mb-3 text-[11px] text-dim">
          只作用于「游戏 MODS」分类，其它分类的资源不会被改动。先预览再执行。
        </p>
        <BulkGameForm
          games={games.map((g) => ({ slug: g.slug, name: g.name, count: g.count }))}
          categories={categories}
          coverage={coverage}
        />
      </section>

      {/* 游戏类型（热门游戏分类的筛选条） */}
      <section>
        <div className="border-b border-line pb-3">
          <h2 className="text-[16px] font-semibold text-ink">游戏类型</h2>
          <p className="mt-1 text-[11px] text-dim">
            只出现在「热门游戏」分类的筛选条：Galgame / 恐怖 / 竞技 / 生存 / 故事 / 经营 / 其他
          </p>
        </div>

        <form action={newTagForm} className="mt-3 flex flex-wrap items-end gap-2 rounded-[8px] border border-dashed border-line p-3">
          <div>
            <label className="block text-[11px] text-dim">类型名称</label>
            <input name="name" placeholder="解谜" className={cellInput + " w-[120px]"} required />
          </div>
          <div>
            <label className="block text-[11px] text-dim">slug</label>
            <input name="slug" placeholder="puzzle" className={cellInput + " w-[110px] font-mono"} required />
          </div>
          <input type="hidden" name="kind" value="genre" />
          <button
            type="submit"
            className="min-h-9 cursor-pointer rounded-[6px] bg-ink px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            新增类型
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {genres.map((g) => (
            <div key={g.id} className="flex items-center gap-1 rounded-[6px] border border-line px-2 py-1">
              <form action={renameTagForm} className="flex items-center gap-1">
                <input type="hidden" name="id" value={g.id} />
                <input
                  name="name"
                  defaultValue={g.name}
                  className={cellInput + " w-[96px]"}
                  aria-label={`${g.name} 名称`}
                />
                <button type="submit" className="cursor-pointer text-[11px] text-accent hover:underline">
                  改名
                </button>
              </form>
              <span className="font-mono text-[10px] text-dim">×{g.count}</span>
              {g.count === 0 && (
                <form action={deleteTagForm}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" className="cursor-pointer text-[11px] text-dim hover:text-danger">
                    删除
                  </button>
                </form>
              )}
            </div>
          ))}
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
