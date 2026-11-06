/**
 * 已取到的直链缓存（内存，5 分钟）。
 *
 * 目的：把「取链」和「下载」拆成两个请求。
 *   ① 前端先 POST /api/pan/direct → 拿 ticket（这时可以显示「正在取链…」）
 *   ② 再 GET /api/pan/download?ticket=… → 服务器直接用缓存的直链开拉，零等待
 *
 * 直链本身只有 1 小时有效期，这里 5 分钟足够，过期就重新取。
 */
export type Prepared = {
  url: string;
  cookie: string;
  fileName: string;
  size: number;
  at: number;
};

const store = new Map<string, Prepared>();
const TTL = 5 * 60 * 1000;

export function putPrepared(p: Omit<Prepared, "at">): string {
  const ticket = crypto.randomUUID();
  // 顺手清理过期项，避免无限增长
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.at > TTL) store.delete(k);
  }
  store.set(ticket, { ...p, at: now });
  return ticket;
}

export function takePrepared(ticket: string): Prepared | null {
  const hit = store.get(ticket);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL) {
    store.delete(ticket);
    return null;
  }
  return hit;
}
