"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

/**
 * 手动刷新前台缓存。
 *
 * 首页是 ISR（60s），分类页是动态的；批量导入/改游戏之后，
 * 首页那张分类卡片的数字可能要等一分钟才变。管理员点一下这里就立即刷新。
 */
export async function refreshFrontCache(): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "需要管理员登录" };

  revalidatePath("/", "page");
  revalidatePath("/updates", "page");
  revalidatePath("/c/[category]", "page");

  return { ok: true, message: "前台缓存已刷新" };
}
