/**
 * 从 MC百科列表页收集整合包/模组详情页 URL
 *
 *   node scripts/mcmod-list.mjs "https://www.mcmod.cn/modpack.html?mcver=1.20.1" --limit 30 --random
 *   node scripts/mcmod-list.mjs "https://www.mcmod.cn/modlist.html?mcver=1.20.1" --limit 20 > urls.txt
 *
 * 参数：
 *   --limit N    最多输出 N 条（默认 30）
 *   --random     打乱后取（默认按页面顺序）
 *   --pages N    最多翻 N 页列表（默认 3）
 */
import { setTimeout as sleep } from "node:timers/promises";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//.test(a));
const limit = Number(args[args.indexOf("--limit") + 1]) || 30;
const pages = Number(args[args.indexOf("--pages") + 1]) || 3;
const random = args.includes("--random");

if (!url) {
  console.error('用法: node scripts/mcmod-list.mjs "<列表页URL>" [--limit 30] [--random] [--pages 3]');
  process.exit(1);
}

const isPack = url.includes("/modpack");
const detailRe = isPack ? /\/modpack\/(\d+)\.html/g : /\/class\/(\d+)\.html/g;

const found = new Set();

for (let page = 1; page <= pages && found.size < limit * 2; page++) {
  const target = new URL(url);
  // mcmod 列表分页参数是 page
  if (page > 1) target.searchParams.set("page", String(page));

  process.stderr.write(`→ 列表第 ${page} 页\n`);
  const res = await fetch(target, { headers: { "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9" } });
  if (!res.ok) {
    process.stderr.write(`  HTTP ${res.status}，停止翻页\n`);
    break;
  }
  const html = await res.text();

  let added = 0;
  for (const m of html.matchAll(detailRe)) {
    const u = `https://www.mcmod.cn/${isPack ? "modpack" : "class"}/${m[1]}.html`;
    if (!found.has(u)) {
      found.add(u);
      added++;
    }
  }
  process.stderr.write(`  新增 ${added} 条，累计 ${found.size}\n`);
  if (added === 0) break;
  await sleep(1200);
}

let list = [...found];
if (random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}
list = list.slice(0, limit);

console.log(list.join("\n"));
process.stderr.write(`\n共输出 ${list.length} 条 URL\n`);
