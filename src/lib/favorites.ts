import { cookies } from "next/headers";

/**
 * 收藏（M2-c 过渡实现）：
 * 尚未接 Auth.js，先用一个匿名 cookie 存资源 id 列表。
 * 接上账号后，把 readFavIds/writeFavIds 换成 favorites 表即可，调用方不变。
 */

export const FAV_COOKIE = "xm_fav";
const MAX_ITEMS = 200;

export async function readFavIds(): Promise<number[]> {
  const store = await cookies();
  const raw = store.get(FAV_COOKIE)?.value ?? "";
  return raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function serializeFavIds(ids: number[]): string {
  return [...new Set(ids)].slice(0, MAX_ITEMS).join(",");
}
