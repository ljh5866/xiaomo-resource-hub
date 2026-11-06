/**
 * 抓取 3DM 软件站（soft.3dmgame.com）→ data/import/3dmsoft.json
 *
 *   node scripts/fetch-3dmsoft.mjs --limit 200
 *   node scripts/fetch-3dmsoft.mjs --limit 30 --dry     # 只打印不落盘
 *
 * 9 个分类页天然对应 9 个标签：系统工具 / 网络工具 / 学习工具 / 安全防护 /
 * 影音播放 / 聊天交友 / 主题美化 / 商务办公 / 模拟器
 *
 * 详情页里的下载地址分两类：
 *   down.wsyhn.com/*   → provider=direct（页面上叫「直接下载」）
 *   pan.xunlei.com/*   → provider=xunlei
 * 本站那句 gotsoftdown() 是下载器引导，跳过。
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36";

const CATS = [
  { slug: "xtgj", name: "系统工具" },
  { slug: "wlgj", name: "网络工具" },
  { slug: "xxgj", name: "学习工具" },
  { slug: "aqfh", name: "安全防护" },
  { slug: "yybf", name: "影音播放" },
  { slug: "ltjy", name: "聊天交友" },
  { slug: "ztmh", name: "主题美化" },
  { slug: "swbg", name: "商务办公" },
  { slug: "mnq", name: "模拟器" },
];

const args = process.argv.slice(2);
const val = (f, d = null) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};
const LIMIT = Number(val("--limit", 200));
const DRY = args.includes("--dry");
const DELAY = Number(val("--delay", 400));
const OUT = val("--out", "data/import/3dmsoft.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, referer: "https://soft.3dmgame.com/" },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.text();
}

/** 列表页：抓条目 + 该分类的最后一页页码 */
function parseList(html) {
  const items = [];
  const re =
    /<a\s+href="https:\/\/soft\.3dmgame\.com\/down\/(\d+)\.html"[^>]*class="name"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    items.push({ id: Number(m[1]), name: m[2].trim() });
  }
  // 封面：同一 li 里的 img data-original
  const coverRe =
    /\/down\/(\d+)\.html[^>]*class="img"[^>]*>\s*<img[^>]*data-original="([^"]+)"/g;
  const covers = new Map();
  while ((m = coverRe.exec(html))) covers.set(Number(m[1]), m[2]);

  const pages = [...html.matchAll(/_all_new_(\d+)\//g)].map((x) => Number(x[1]));
  const lastPage = pages.length ? Math.max(...pages) : 1;

  return { items, covers, lastPage };
}

/** 详情页：名称 / 版本 / 大小 / 简介 / 下载链接 */
function parseDetail(html) {
  const name = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ?? "";
  const version = html.match(/版本：\s*([\d.]+)/)?.[1] ?? null;
  const size = html.match(/大小：\s*([\d.]+\s*[MGK]B)/i)?.[1]?.replace(/\s+/g, "") ?? null;
  const lang = html.match(/语言：\s*([^\s<]{1,8})/)?.[1] ?? null;
  const updated = html.match(/更新：\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

  // 简介：优先取 meta description，退而取正文第一段
  const metaDesc = html.match(/<meta\s+name="Description"\s+content="([^"]+)"/i)?.[1] ?? "";
  const bodyIntro =
    html.match(/<div class="[^"]*intro[^"]*"[^>]*>([\s\S]{40,1200}?)<\/div>/i)?.[1] ?? "";
  const intro = (bodyIntro || metaDesc)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  const links = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="(https:\/\/[^"]+)"/g)) {
    const url = m[1].replace(/&amp;/g, "&");
    if (seen.has(url)) continue;
    if (/down\.wsyhn\.com\//.test(url)) {
      seen.add(url);
      links.push({ provider: "direct", url });
    } else if (/pan\.xunlei\.com\//.test(url)) {
      seen.add(url);
      links.push({ provider: "xunlei", url });
    } else if (/pan\.quark\.cn\//.test(url)) {
      seen.add(url);
      links.push({ provider: "quark", url });
    } else if (/pan\.baidu\.com\//.test(url)) {
      seen.add(url);
      links.push({ provider: "baidu", url });
    }
  }

  return { name, version, size, lang, intro, links };
}

const results = [];
const seenIds = new Set();

for (const cat of CATS) {
  if (results.length >= LIMIT) break;

  // 先抓第 1 页拿到总页数
  const first = await get(`https://soft.3dmgame.com/${cat.slug}_all_new_1/`);
  if (!first) {
    console.log(`[${cat.name}] 列表页抓取失败`);
    continue;
  }
  const { items, covers, lastPage } = parseList(first);
  console.log(`[${cat.name}] 第1页 ${items.length} 条，共 ${lastPage} 页`);

  const perCat = Math.max(5, Math.ceil(LIMIT / CATS.length) + 4);
  let taken = 0;
  const pages = [first];

  for (let p = 2; p <= Math.min(lastPage, 4) && taken < perCat; p += 1) {
    const html = await get(`https://soft.3dmgame.com/${cat.slug}_all_new_${p}/`);
    if (html) pages.push(html);
    await sleep(DELAY);
  }

  for (const html of pages) {
    const { items: list, covers: cov } = parseList(html);
    for (const it of list) {
      if (taken >= perCat || results.length >= LIMIT) break;
      if (seenIds.has(it.id)) continue;
      seenIds.add(it.id);

      const detailHtml = await get(`https://soft.3dmgame.com/down/${it.id}.html`);
      await sleep(DELAY);
      if (!detailHtml) continue;

      const d = parseDetail(detailHtml);
      if (!d.links.length) continue;

      results.push({
        id: it.id,
        name: d.name || it.name,
        category: cat.name,
        categorySlug: cat.slug,
        cover: cov.get(it.id) ?? covers.get(it.id) ?? null,
        version: d.version,
        size: d.size,
        lang: d.lang,
        updated: d.updated,
        intro: d.intro,
        links: d.links,
      });
      taken += 1;
      if (results.length % 20 === 0) console.log(`  已抓 ${results.length} 条…`);
    }
  }
}

console.log(`\n共抓到 ${results.length} 条（含有效下载链接）`);
const byCat = {};
for (const r of results) byCat[r.category] = (byCat[r.category] ?? 0) + 1;
console.log("分类分布:", JSON.stringify(byCat, null, 0));
const byProvider = {};
for (const r of results) for (const l of r.links) byProvider[l.provider] = (byProvider[l.provider] ?? 0) + 1;
console.log("链接类型:", JSON.stringify(byProvider, null, 0));
console.log("样本:", JSON.stringify(results[0], null, 2).slice(0, 700));

if (!DRY) {
  if (!existsSync("data/import")) mkdirSync("data/import", { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 1), "utf8");
  console.log(`\n已写入 ${OUT}`);
}
