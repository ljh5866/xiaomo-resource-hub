/**
 * 抓 TouchGal 详情页的「游戏信息」，写回本地库并导出可上传的补丁文件。
 *
 *   node --import tsx scripts/fetch-touchgal-detail.mjs --only 39c7052e-gal --dry
 *   node --import tsx scripts/fetch-touchgal-detail.mjs --limit 20
 *   node --import tsx scripts/fetch-touchgal-detail.mjs            # 全量（已抓过的跳过）
 *
 * 站点是 Next.js 客户端渲染 + Cloudflare，必须用真实浏览器（默认本机 Edge）。
 * 产物：data/import/touchgal-meta.json，服务器上用 import-touchgal-meta.mjs 导入。
 */
import { chromium } from "playwright-core";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d = null) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};

const DB_PATH = val("--db", "./data/app.db");
const OUT = val("--out", "./data/import/touchgal-meta.json");
const LIMIT = Number(val("--limit", 0));
const ONLY = val("--only");
const DELAY = Number(val("--delay", 600));
const DRY = has("--dry");
const FORCE = has("--force");
const BASE = "https://www.touchgal.ink";

const PLATFORMS = ["Windows", "Android", "iOS", "Mac", "Linux", "Switch", "PS4", "PS5", "模拟器"];
const LANGUAGES = ["日本語", "简体中文", "繁體中文", "英语", "其它"];
const TYPES = ["游戏本体", "破解补丁", "AI翻译补丁", "汉化补丁", "图片CG", "存档", "视频", "补丁"];

const db = new DatabaseSync(DB_PATH);
const base = `SELECT id, slug, title, summary, source_url AS sourceUrl FROM resources
              WHERE source_url LIKE '%touchgal%'`;
const rows = (FORCE ? db.prepare(base) : db.prepare(`${base} AND (meta_json IS NULL OR meta_json = '')`)).all();
const picked = ONLY
  ? rows.filter((r) => r.slug === ONLY || (r.sourceUrl ?? "").includes(ONLY))
  : LIMIT > 0
    ? rows.slice(0, LIMIT)
    : rows;

if (picked.length === 0) {
  console.log("没有需要抓取的记录（加 --force 可重抓）");
  process.exit(0);
}
console.log(`待抓取 ${picked.length} 条`);

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 从页面 innerText 里抠出结构化字段（在浏览器上下文执行，字典必须作为参数传入） */
function extract(dict) {
  const text = document.body.innerText;
  const pick = (re, i = 1) => text.match(re)?.[i]?.trim() ?? null;
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  const originalTitle = document.querySelector("h1")?.textContent?.trim() ?? null;

  // 游戏介绍正文：到「游戏截图」为止
  const introRaw = pick(/游戏介绍\s*\n([\s\S]*?)\n\s*游戏截图/) ?? "";
  const intro = introRaw
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p && !/^\[https?:/.test(p))
    .join("\n\n");

  const companyRaw = pick(/所属会社\s*\n([^\n]+)/);
  const company = companyRaw ? companyRaw.replace(/^\s*/, "").replace(/\s*\+\d+\s*$/, "").trim() : null;

  const aliasesBlock = pick(/游戏别名\s*\n([\s\S]*?)(?:\n\s*©|\n\s*使用指南|$)/) ?? "";
  const aliases = uniq(
    aliasesBlock
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && s.length <= 80),
  ).slice(0, 6);

  const chipZone = text.split("查看评分分布")[1]?.split(/\n\s*下载\s*\n/)[0] ?? "";
  const chips = chipZone.split("\n").map((s) => s.trim());

  return {
    originalTitle,
    intro,
    company,
    releaseDate: pick(/发售时间:\s*([\d-]+)/),
    vndb: pick(/VNDB ID:\s*([\w-]+)/),
    bangumi: pick(/Bangumi:\s*(\d+)/),
    officialUrl: pick(/外部链接\s*\n[^\n]+\n[^\n]*\n(https?:\/\/[^\s]+)/),
    rating: pick(/\n\s*(\d+(?:\.\d+)?)\s*\n\s*查看评分分布/),
    aliases,
    platforms: uniq(chips.filter((c) => dict.platforms.includes(c))),
    languages: uniq(chips.filter((c) => dict.languages.includes(c))),
    resourceTypes: uniq(chips.filter((c) => dict.types.includes(c))),
    // 浏览数在列表卡片上，详情页头部也会出现（形如 3.3k）
    views: pick(/\n\s*(\d+(?:\.\d+)?[kKwW万])\s*\n/) ?? null,
  };
}

const patch = [];
let ok = 0;
let fail = 0;

for (const [i, row] of picked.entries()) {
  const url = row.sourceUrl ?? `${BASE}/${row.slug.replace(/-gal$/, "")}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(() => document.body.innerText.includes("游戏介绍"), { timeout: 20000 });
    const d = await page.evaluate(extract, {
      platforms: PLATFORMS,
      languages: LANGUAGES,
      types: TYPES,
    });

    const meta = {
      source: "TouchGal",
      originalTitle: d.originalTitle,
      aliases: d.aliases,
      company: d.company,
      releaseDate: d.releaseDate,
      resourceTypes: d.resourceTypes,
      platforms: d.platforms,
      languages: d.languages,
      rating: d.rating,
      views: d.views,
      vndb: d.vndb,
      bangumi: d.bangumi,
      officialUrl: d.officialUrl,
      fetchedAt: Math.floor(Date.now() / 1000),
    };
    // 去掉空字段，meta_json 保持精简
    for (const k of Object.keys(meta)) {
      const v = meta[k];
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) delete meta[k];
    }

    const summary = (d.intro || row.summary || "").replace(/\s+/g, " ").trim().slice(0, 120) || null;
    const content = d.intro || null;

    patch.push({ slug: row.slug, meta, summary, contentMd: content });
    if (!DRY) {
      db.prepare(`UPDATE resources SET meta_json = ?, summary = ?, content_md = ? WHERE id = ?`).run(
        JSON.stringify(meta),
        summary,
        content,
        row.id,
      );
    }
    ok += 1;
    console.log(
      `✓ [${i + 1}/${picked.length}] ${row.slug} 会社=${meta.company ?? "—"} 发售=${meta.releaseDate ?? "—"} 别名=${(meta.aliases ?? []).length} 介绍=${content ? content.length : 0}字`,
    );
  } catch (err) {
    fail += 1;
    console.log(`✗ [${i + 1}/${picked.length}] ${row.slug} ${err.message.split("\n")[0]}`);
  }
  await sleep(DELAY);
}

await browser.close();

if (!DRY && patch.length) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(patch, null, 2), "utf8");
  console.log(`\n导出 ${patch.length} 条 → ${OUT}`);
}
console.log(`\n完成：成功 ${ok} · 失败 ${fail}${DRY ? "（dry-run，未写库）" : ""}`);
