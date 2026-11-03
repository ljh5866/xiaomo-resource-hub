"use server";

import { deleteTag, mergeTags, renameTag, updateCategory } from "./taxonomy";

/**
 * 表单包装层：只负责把 FormData 拆成参数。
 * revalidatePath 统一放在 taxonomy.ts 的动作里 —— 这里再调一次会撞上
 * Next 的「revalidatePath can't be called during render」。
 */

export async function categoryForm(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  await updateCategory(id, {
    name: String(formData.get("name") ?? ""),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isVisible: formData.get("isVisible") === "1",
  });
}

export async function renameTagForm(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await renameTag(id, String(formData.get("name") ?? ""));
}

export async function mergeTagForm(formData: FormData) {
  const fromId = Number(formData.get("fromId"));
  const toId = Number(formData.get("toId"));
  if (!Number.isFinite(fromId) || !Number.isFinite(toId) || toId <= 0) return;
  await mergeTags(fromId, toId);
}

export async function deleteTagForm(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await deleteTag(id);
}
