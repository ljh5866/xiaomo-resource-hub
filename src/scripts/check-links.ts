/**
 * 链接巡检：pnpm links:check [--limit 200] [--dry]
 *
 * 状态机（docs/02 §6）：
 *   ok      ← 探测成功
 *   unknown ← 探测失败但 fail_count < 3
 *   invalid ← 连续失败 ≥ 3
 *
 * 示例域名（*.example.com）默认跳过：种子数据全是假链接，
 * 不跳过的话一跑就把演示数据全标成失效了。
 */
import { all, run } from "../db/client";

const SKIP_HOSTS = ["example.com", "localhost", "127.0.0.1"];
const CONCURRENCY = 5;
const TIMEOUT_MS = 8000;
const DEAD_HINTS = ["链接不存在", "已失效", "分享已取消", "文件已删除", "404 Not Found"];

type Row = {
  id: number;
  url: string;
  status: string;
  failCount: number;
  checkedAt: number | null;
};

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? Number(limitArg.split("=")[1] ?? args[args.indexOf(limitArg) + 1]) : 200;
const DRY = args.includes("--dry");

function now() {
  return Math.floor(Date.now() / 1000);
}

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

async function main() {
  const since = now() - 7 * 86_400;
  const rows = all<Row>(
    `SELECT id, url, status, fail_count AS failCount, checked_at AS checkedAt
     FROM resource_links
     WHERE status != 'ok' OR checked_at IS NULL OR checked_at < ?
     ORDER BY checked_at ASC NULLS FIRST
     LIMIT ?`,
    since,
    Number.isFinite(LIMIT) ? LIMIT : 200,
  );

  const skipped = rows.filter((r) => SKIP_HOSTS.some((h) => r.url.includes(h)));
  const targets = rows.filter((r) => !SKIP_HOSTS.some((h) => r.url.includes(h)));

  console.log(
    `→ 待检测 ${rows.length} 条；跳过示例域名 ${skipped.length} 条；实际检测 ${targets.length} 条${DRY ? "（dry run，不写库）" : ""}`,
  );

  let ok = 0;
  let dead = 0;
  let unknown = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        const res = await probe(row.url);

        if (res.ok) {
          ok += 1;
          console.log(`  ✓ ${row.url.slice(0, 72)}`);
          if (!DRY) {
            run(
              "UPDATE resource_links SET status='ok', fail_count=0, checked_at=?, last_error=NULL WHERE id=?",
              now(),
              row.id,
            );
          }
          return;
        }

        const fails = row.failCount + 1;
        const nextStatus = fails >= 3 ? "invalid" : "unknown";
        if (nextStatus === "invalid") dead += 1;
        else unknown += 1;
        console.log(`  × ${row.url.slice(0, 60)} — ${res.error}（第 ${fails} 次）`);

        if (!DRY) {
          run(
            "UPDATE resource_links SET status=?, fail_count=?, checked_at=?, last_error=? WHERE id=?",
            nextStatus,
            fails,
            now(),
            res.error ?? null,
            row.id,
          );
        }
      }),
    );
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(
    `✓ 完成：有效 ${ok} / 失效 ${dead} / 待复核 ${unknown} / 跳过 ${skipped.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
