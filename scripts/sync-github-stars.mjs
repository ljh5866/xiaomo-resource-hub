/**
 * 同步 GitHub 仓库 star 数（每天跑一次）
 *
 *   node --use-system-ca --import tsx scripts/sync-github-stars.mjs
 *
 * 作用：把当前 star 数写进 repo_stars 快照表，
 * 「本周热门」= 最近 7 天 star 增长最多的项目（实时由数据算出，不是写死的标签）。
 *
 * 部署后挂 systemd timer 或 crontab，每天凌晨跑一次即可。
 */
import { DatabaseSync } from "node:sqlite";

const UA = "xiaomo-resource-hub/1.0";
const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const rows = db
  .prepare(
    `SELECT r.id, r.title, r.source_url
       FROM resources r
       JOIN categories c ON c.id = r.category_id
      WHERE c.slug = 'opensource' AND r.status = 'published'
        AND r.source_url LIKE 'https://github.com/%'`,
  )
  .all();

console.log(`\n需要同步 ${rows.length} 个仓库`);

const day = new Date().toISOString().slice(0, 10);
let ok = 0;
let fail = 0;

for (const [i, r] of rows.entries()) {
  const repo = r.source_url.replace("https://github.com/", "").replace(/\/+$/, "");
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { "user-agent": UA, accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      fail++;
      if (res.status === 403) {
        console.log("  限速了，先停。已同步 " + ok);
        break;
      }
      continue;
    }
    const data = await res.json();
    db.prepare(
      `INSERT INTO repo_stars (resource_id, day, stars, captured_at)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(resource_id, day) DO UPDATE SET stars = excluded.stars, captured_at = unixepoch()`,
    ).run(r.id, day, data.stargazers_count ?? 0);
    ok++;
  } catch {
    fail++;
  }
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${rows.length}`);
  await new Promise((s) => setTimeout(s, 220));
}

db.close();
console.log(`\n✓ 已同步 ${ok} 个仓库（失败 ${fail}），快照日期 ${day}`);
