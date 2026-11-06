"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { bulkGameAction, type BulkState } from "@/lib/games/actions";

const field =
  "min-h-9 rounded-[6px] border border-line bg-surface-2 px-2 text-[13px] text-ink outline-none focus:border-accent";

export function BulkGameForm({
  games,
  categories,
  coverage,
}: {
  games: { slug: string; name: string; count: number }[];
  categories: { slug: string; name: string; count: number }[];
  coverage?: { total: number; assigned: number; unassigned: number };
}) {
  const [state, action, pending] = useActionState<BulkState, FormData>(bulkGameAction, {
    ok: true,
    message: "",
  });

  return (
    <div className="rounded-[8px] border border-line">
      <form action={action} className="space-y-4 p-4">
        <p className="rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] text-muted">
          只改「游戏 MODS」分类的资源，热门游戏 / 开源项目不会被波及。
          {coverage ? `（该分类 ${coverage.total} 条，已归类 ${coverage.assigned}，未归类 ${coverage.unassigned}）` : ""}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="block text-[11px] text-dim">目标游戏</span>
            <select name="gameSlug" defaultValue={games[0]?.slug ?? ""} className={field + " mt-1 w-full"}>
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}（该分类 {g.count} 条）
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] text-dim">范围</span>
            <select name="scope" defaultValue="unassigned" className={field + " mt-1 w-full"}>
              <option value="unassigned">
                还没归类的{coverage ? `（${coverage.unassigned} 条）` : ""}
              </option>
              <option value="all">该分类下全部{coverage ? `（${coverage.total} 条）` : ""}</option>
              <option value="category">指定分类下的全部</option>
              <option value="game">从某个游戏迁移过来</option>
              <option value="ids">指定资源 ID</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="block text-[11px] text-dim">分类 slug（范围选“指定分类”时用）</span>
            <select name="categorySlug" defaultValue="mods" className={field + " mt-1 w-full"}>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}（{c.count}）
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] text-dim">旧游戏 slug（范围选“迁移”时用）</span>
            <select name="fromSlug" defaultValue="" className={field + " mt-1 w-full"}>
              <option value="">—</option>
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] text-dim">资源 ID（逗号分隔，范围选“指定 ID”时用）</span>
            <input name="ids" placeholder="12,13,14" className={field + " mt-1 w-full font-mono"} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="mode"
            value="preview"
            disabled={pending}
            className="min-h-9 cursor-pointer rounded-[6px] border border-line px-3 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            先预览
          </button>
          <button
            type="submit"
            name="mode"
            value="apply"
            disabled={pending}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] bg-ink px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-3 animate-spin" strokeWidth={2} aria-hidden />}
            执行修改
          </button>
          <span className="text-[11px] text-dim">一个资源只保留一个游戏标签，旧的会自动移除</span>
        </div>
      </form>

      {state.message && (
        <div
          className={
            "border-t border-line px-4 py-3 text-[12px] " +
            (state.ok ? "bg-surface-2 text-ink" : "text-danger")
          }
        >
          <p>{state.message}</p>
          {state.preview && state.preview.sample.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted">
              {state.preview.sample.map((r) => (
                <li key={r.code}>
                  {r.code} {r.title} · {r.current ?? "未归类"} → {state.preview!.gameName}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
