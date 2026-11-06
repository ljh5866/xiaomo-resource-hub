"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { applyBulkGame, previewBulkGame, type GameScope } from "@/lib/games/bulk";
import { fixTagScope } from "@/lib/games/fix-scope";

export type BulkState = {
  ok: boolean;
  message: string;
  preview?: {
    gameName: string;
    total: number;
    willChange: number;
    sample: { code: string; title: string; current: string | null }[];
  };
};

function parseScope(formData: FormData): GameScope {
  const mode = String(formData.get("scope") ?? "unassigned");
  switch (mode) {
    case "all":
      return { kind: "all" };
    case "category":
      return { kind: "category", slug: String(formData.get("categorySlug") ?? "mods") };
    case "game":
      return { kind: "game", slug: String(formData.get("fromSlug") ?? "") };
    case "ids":
      return {
        kind: "ids",
        ids: String(formData.get("ids") ?? "")
          .split(/[\s,，]+/)
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0),
      };
    default:
      return { kind: "unassigned" };
  }
}

export async function bulkGameAction(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "需要管理员登录" };

  const gameSlug = String(formData.get("gameSlug") ?? "");
  const apply = String(formData.get("mode") ?? "preview") === "apply";
  const scope = parseScope(formData);

  const preview = previewBulkGame(gameSlug, scope);
  if (!preview) return { ok: false, message: `找不到游戏「${gameSlug}」（或它不是游戏类型）` };

  const brief = {
    gameName: preview.gameName,
    total: preview.total,
    willChange: preview.willChange,
    sample: preview.sample.map((r) => ({ code: r.code, title: r.title, current: r.current })),
  };

  if (!apply) {
    return {
      ok: true,
      message: `预览：${preview.total} 条命中，${preview.willChange} 条需要改`,
      preview: brief,
    };
  }

  const res = applyBulkGame(gameSlug, scope);
  if (!res.ok) return { ok: false, message: res.message, preview: brief };

  revalidatePath("/admin/games");
  revalidatePath("/");
  revalidatePath("/c/mods");

  return {
    ok: true,
    message: `已把 ${res.updated} 条资源的游戏标签设为「${res.gameName}」`,
    preview: brief,
  };
}

/** 一键清理跨分类标签（game 挂在 mods 之外、genre 挂在 games 之外…） */
export async function fixTagScopeAction(): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  fixTagScope();

  revalidatePath("/admin/games");
  revalidatePath("/admin/taxonomy");
  revalidatePath("/");
  for (const slug of ["mods", "games", "opensource"]) revalidatePath(`/c/${slug}`);
}
