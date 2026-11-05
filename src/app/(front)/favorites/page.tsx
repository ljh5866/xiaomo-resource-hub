import { redirect } from "next/navigation";

/** 收藏页已合并进用户页：/favorites → /me?tab=favorites */
export default function FavoritesRedirect() {
  redirect("/me?tab=favorites");
}
