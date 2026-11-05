/**
 * 头像 URL 归一化。
 *
 * 早期版本把 URL 写成了 /files/uploads/avatars/xx.webp，
 * 而 /files 路由的根目录本身就是 data/uploads，多一层 uploads 会 404。
 * 这里在读取时兜底，历史数据不用手工改。
 */
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/files/uploads/", "/files/");
}
