/**
 * 进程内滑动窗口限流。单机够用；多实例部署时换成 Redis（接口保持不变）。
 *
 * 用法：
 *   const rl = hit(`login:${ip}`, { limit: 5, windowMs: 10 * 60_000 })
 *   if (!rl.ok) return 429
 */

type Bucket = { hits: number[]; blockedUntil?: number };

const store = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  /** 触发后的锁定时长，默认等于 windowMs */
  blockMs?: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function hit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const { limit, windowMs } = opts;
  const blockMs = opts.blockMs ?? windowMs;

  // 简单的容量保护：超过上限就清掉过期最久的键
  if (store.size > MAX_KEYS) {
    for (const [k, b] of store) {
      if (!b.hits.length || now - b.hits[b.hits.length - 1] > windowMs) store.delete(k);
      if (store.size <= MAX_KEYS * 0.8) break;
    }
  }

  const bucket = store.get(key) ?? { hits: [] };

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    bucket.blockedUntil = now + blockMs;
    store.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil(blockMs / 1000) };
  }

  bucket.hits.push(now);
  store.set(key, bucket);

  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterSec: 0,
  };
}

/** 登录成功后清掉计数，避免"错两次成功一次"仍被计入 */
export function reset(key: string) {
  store.delete(key);
}

export function clientKey(req: Request, scope: string) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}
