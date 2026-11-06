/**
 * 标签域：每种标签类型只属于一个分类，不能跨类互挂。
 *
 *   game  → 游戏 MODS（"我的世界 / 只狼"这类所属游戏）
 *   genre → 热门游戏（Galgame / 恐怖 / 竞技 …）
 *   gh    → GitHub 开源项目（安卓端 / iOS 端 / 桌面端 / 工具库）
 *
 * platform / other 是通用标签，不限制。
 *
 * 这层约束的意义：分类页的筛选条读的是这些标签，
 * 一旦 galgame 被挂上「我的世界」，'/?game=minecraft' 就会把整站资源都筛出来。
 */

export const TAG_KIND_HOME: Record<string, string> = {
  game: "mods",
  genre: "games",
  gh: "opensource",
};

/** 该标签类型能否挂在这个分类的资源上 */
export function tagKindAllowedIn(kind: string, categorySlug: string | null | undefined): boolean {
  const home = TAG_KIND_HOME[kind];
  if (!home) return true; // 通用标签
  return home === categorySlug;
}

/** 这个分类的「专属」标签类型（用于筛选条 / 后台统计） */
export function homeTagKind(categorySlug: string): string | null {
  for (const [kind, slug] of Object.entries(TAG_KIND_HOME)) {
    if (slug === categorySlug) return kind;
  }
  return null;
}

/** 分类页要展示的筛选条类型：mods 看 game，games 看 genre，opensource 看 gh */
export const FILTER_KIND_BY_CATEGORY: Record<string, string> = {
  mods: "game",
  games: "genre",
  opensource: "gh",
};
