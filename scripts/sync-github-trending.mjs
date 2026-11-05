/**
 * 抓 GitHub Trending 周榜（本周 star 增长最多的项目）
 *
 *   node scripts/sync-github-trending.mjs
 *
 * 数据来源：https://github.com/trending?since=weekly
 * 不用 API，没有限速；每天跑一次即可。
 *
 * 结果写入 trending_repos，前台 /c/opensource?hot=1 直接读这张表，
 * 保持「本周热门」独立视图，不受站内标签筛选影响。
 */
import { DatabaseSync } from "node:sqlite";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");
const day = new Date().toISOString().slice(0, 10);

const res = await fetch("https://github.com/trending?since=weekly", {
  headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
});

if (!res.ok) {
  console.error(`✗ GitHub Trending 返回 ${res.status}`);
  process.exit(1);
}

const html = await res.text();

/* 每个仓库在 <article class="Box-row"> 里，逐段抓需要的字段 */
const articles = html.split('<article class="Box-row">').slice(1);
console.log(`\n抓到 ${articles.length} 个仓库`);

function text(fragment) {
  return fragment
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const rows = [];

for (const [i, chunk] of articles.entries()) {
  // 仓库名：<h2 class="h3 lh-condensed"><a href="/owner/repo">
  const nameMatch = chunk.match(/<h2[^>]*>[\s\S]*?href="\/([^"/]+\/[^"/]+)"/);
  if (!nameMatch) continue;
  const fullName = nameMatch[1];

  const descMatch = chunk.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/);
  const langMatch = chunk.match(/itemprop="programmingLanguage">([^<]+)</);

  // 「1,234 stars this week」
  const weekMatch = chunk.match(/([\d,]+)\s+stars?\s+this\s+week/i);
  const totalMatch = chunk.match(/href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/);

  rows.push({
    rank: i + 1,
    fullName,
    url: `https://github.com/${fullName}`,
    starsWeek: weekMatch ? Number(weekMatch[1].replaceAll(",", "")) : null,
    starsTotal: totalMatch ? Number(text(totalMatch[1]).replaceAll(",", "")) || null : null,
    language: langMatch ? text(langMatch[1]) : null,
    description: descMatch ? text(descMatch[1]).slice(0, 300) : null,
  });
}

if (!rows.length) {
  console.error("✗ 一个仓库都没解析到，GitHub 页面结构可能变了");
  process.exit(1);
}

db.exec("BEGIN");
try {
  db.prepare("DELETE FROM trending_repos WHERE day = ?").run(day);
  const ins = db.prepare(
    `INSERT OR REPLACE INTO trending_repos
       (day, rank, full_name, url, stars_week, stars_total, language, description)
     VALUES (?,?,?,?,?,?,?,?)`,
  );
  for (const r of rows) {
    ins.run(day, r.rank, r.fullName, r.url, r.starsWeek, r.starsTotal, r.language, r.description);
  }
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  console.error("✗ 写库失败：", e.message);
  process.exit(1);
}

db.close();

console.log(`✓ 已保存 ${rows.length} 条周榜（${day}）`);
for (const r of rows.slice(0, 5)) {
  console.log(`  #${r.rank} ${r.fullName} +${r.starsWeek ?? "?"} ★/周`);
}
