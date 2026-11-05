"use server";

import { get, run } from "@/db/client";
import { requireAdmin } from "@/lib/auth";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function guard(): Promise<ActionResult | null> {
  const admin = await requireAdmin();
  return admin ? null : { ok: false, message: "需要管理员登录" };
}

/**
 * 不做 revalidatePath：后台页是 force-dynamic，本来就不缓存；
 * 前台（首页/分类页）走 ISR 自然过期。
 * 在这里调 revalidatePath 会撞上 Next 的「can't be called during render」。
 */

/* ---------------- 分类 ---------------- */

export async function updateCategory(
  id: number,
  patch: { name?: string; sortOrder?: number; isVisible?: boolean },
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const row = get<{ id: number }>("SELECT id FROM categories WHERE id = ?", id);
  if (!row) return { ok: false, message: "分类不存在" };

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 1 || name.length > 40) return { ok: false, message: "名称长度不合法" };
    run("UPDATE categories SET name = ? WHERE id = ?", name, id);
  }
  if (patch.sortOrder !== undefined) {
    run("UPDATE categories SET sort_order = ? WHERE id = ?", Math.trunc(patch.sortOrder), id);
  }
  if (patch.isVisible !== undefined) {
    run("UPDATE categories SET is_visible = ? WHERE id = ?", patch.isVisible ? 1 : 0, id);
  }
  return { ok: true, message: "已保存" };
}

/* ---------------- 标签 ---------------- */

/** 设置标签类型：game（游戏）/ platform（平台）/ other（其它）。游戏类型会出现在分类页筛选条。 */
export async function setTagKind(id: number, kind: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!["game", "platform", "other"].includes(kind)) return { ok: false, message: "类型不合法" };
  const row = get<{ id: number }>("SELECT id FROM tags WHERE id = ?", id);
  if (!row) return { ok: false, message: "标签不存在" };
  run("UPDATE tags SET kind = ? WHERE id = ?", kind, id);
  return { ok: true, message: "已更新" };
}

/** 新建标签（后台加游戏时用） */
export async function createTag(slug: string, name: string, kind = "game"): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const n = name.trim();
  if (!s || !n) return { ok: false, message: "slug 与名称都要填" };
  if (get("SELECT id FROM tags WHERE slug = ?", s)) return { ok: false, message: "slug 已存在" };
  run("INSERT INTO tags (slug, name, use_count, kind) VALUES (?,?,0,?)", s, n, kind);
  return { ok: true, message: `已新增「${n}」` };
}

export async function renameTag(id: number, name: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const clean = name.trim();
  if (clean.length < 1 || clean.length > 40) return { ok: false, message: "名称长度不合法" };

  const dup = get<{ id: number }>(
    "SELECT id FROM tags WHERE name = ? AND id <> ? LIMIT 1",
    clean,
    id,
  );
  if (dup) return { ok: false, message: "已存在同名标签，请用「合并」" };

  run("UPDATE tags SET name = ? WHERE id = ?", clean, id);
  return { ok: true, message: "已重命名" };
}

/** 合并：把 from 上的资源全部挂到 to，然后删掉 from */
export async function mergeTags(fromId: number, toId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (fromId === toId) return { ok: false, message: "不能合并到自己" };

  const from = get<{ id: number; name: string }>("SELECT id, name FROM tags WHERE id = ?", fromId);
  const to = get<{ id: number; name: string }>("SELECT id, name FROM tags WHERE id = ?", toId);
  if (!from || !to) return { ok: false, message: "标签不存在" };

  // 先搬关系（IGNORE 掉已经同时拥有两个标签的资源）
  run(
    "INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) SELECT resource_id, ? FROM resource_tags WHERE tag_id = ?",
    toId,
    fromId,
  );
  run("DELETE FROM resource_tags WHERE tag_id = ?", fromId);
  run("DELETE FROM tags WHERE id = ?", fromId);

  recomputeTagCounts();
  return { ok: true, message: `已把「${from.name}」合并进「${to.name}」` };
}

export async function deleteTag(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const used = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM resource_tags WHERE tag_id = ?",
    id,
  )?.n ?? 0;
  if (used > 0) return { ok: false, message: `还有 ${used} 条资源在用，先合并再删` };

  run("DELETE FROM tags WHERE id = ?", id);
  return { ok: true, message: "已删除" };
}

export async function recomputeTagCounts(): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  run(`UPDATE tags SET use_count = (
        SELECT COUNT(*) FROM resource_tags rt WHERE rt.tag_id = tags.id
      )`);
  return { ok: true, message: "计数已重算" };
}
