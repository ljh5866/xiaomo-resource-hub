import { all, run } from "@/db/client";

/**
 * 链接巡检（状态机见 docs/02 §6）：
 *   ok       ← 探测成功
 *   unknown  ← 探测失败但 fail_count < 3
 *   invalid  ← 连续失败 ≥ 3
 *
 * 示例域名（*.example.com）默认跳过：种子数据全是假链接，
 * 不跳过的话跑一次就把演示数据全标成失效了。
 */

export const SKIP_HOSTS = ["example.com", "localhost", "127.0.0.1"];
const CONCURRENCY = 5;
const TIMEOUT_MS = 8000;
const DEAD_HINTS = ["链接不存在", "已失效", "分享已取消", "文件已删除", "404 Not Found"];

export type CheckSummary = {
  candidates: number;
  skipped: number;
  checked: number;
  ok: number;
  invalid: number;
  unknown: number;
  dry: boolean;
  details: { url: string; ok: boolean; error?: string }[];
};

type Row = {
  id: number;
  url: string;
  status: string;
  failCount: number;
  checkedAt: number | null;
};

const nowSec = () => Math.floor(Date.now() / 1000);

async function probe(url: string): Promise<{ ok: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "XiaomoLinkChecker/1.0 (+local)" },
    });

    if (res.status >= 400) return { ok: false, error: `HTTP ${res.status}` };

    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/html")) {
      const text = (await res.text()).slice(0, 4000);
      const hit = DEAD_HINTS.find((h) => text.includes(h));
      if (hit) return { ok: false, error: `页面提示：${hit}` };
    }
    return { ok: true };
  } catch (err) {
    const e = err as Error;
    return { ok: false, error: e.name === "AbortError" ? "超时" : e.message.slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkLinks(
  opts: { limit?: number; dry?: boolean; statuses?: string[] } = {},
): Promise<CheckSummary> {
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 300);
  const dry = Boolean(opts.dry);
  const statuses = opts.statuses ?? [];

  const since = nowSec() - 7 * 86_400;
  const where: string[] = ["(status != 'ok' OR checked_at IS NULL OR checked_at < ?)"];
  const params: (string | number)[] = [since];

  if (statuses.length) {
    where.push(`status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  params.push(limit);

  const rows = all<Row>(
    `SELECT id, url, status, fail_count AS failCount, checked_at AS checkedAt
     FROM resource_links
     WHERE ${where.join(" AND ")}
     ORDER BY checked_at ASC NULLS FIRST
     LIMIT ?`,
    ...params,
  );

  const skippedRows = rows.filter((r) => SKIP_HOSTS.some((h) => r.url.includes(h)));
  const targets = rows.filter((r) => !SKIP_HOSTS.some((h) => r.url.includes(h)));

  const details: CheckSummary["details"] = [];
  let ok = 0;
  let invalid = 0;
  let unknown = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (row) => {
        const res = await probe(row.url);
        details.push({ url: row.url, ok: res.ok, error: res.error });

        if (res.ok) {
          ok += 1;
          if (!dry) {
            run(
              "UPDATE resource_links SET status='ok', fail_count=0, checked_at=?, last_error=NULL WHERE id=?",
              nowSec(),
              row.id,
            );
          }
          return;
        }

        const fails = row.failCount + 1;
        const nextStatus = fails >= 3 ? "invalid" : "unknown";
        if (nextStatus === "invalid") invalid += 1;
        else unknown += 1;

        if (!dry) {
          run(
            "UPDATE resource_links SET status=?, fail_count=?, checked_at=?, last_error=? WHERE id=?",
            nextStatus,
            fails,
            nowSec(),
            res.error ?? null,
            row.id,
          );
        }
      }),
    );

    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    candidates: rows.length,
    skipped: skippedRows.length,
    checked: targets.length,
    ok,
    invalid,
    unknown,
    dry,
    details,
  };
}
