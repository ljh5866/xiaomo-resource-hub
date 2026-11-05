/**
 * 抓 TouchGal 的 Galgame 列表并导入「热门游戏」分类（类型：Galgame）
 *
 *   node --import tsx scripts/import-touchgal.mjs --limit 450
 *   node --import tsx scripts/import-touchgal.mjs --limit 40 --dry
 *
 * 站点是 Next.js 客户端分页，没有公开 API，所以用真实浏览器翻页取卡片：
 *   卡片 → 标题 / 评分 / 浏览量 / 语言与平台标签 / 封面
 * 详情页不逐条打开（450 次太慢），简介用卡片信息合成，跳转直接去源站。
 *
 * 幂等：同一源站链接已存在就跳过。
 */
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

process.env.NODE_ENV ??= "production";
const { processCover } = await import("../src/lib/storage.ts");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Number(valueOf("--limit") ?? 450);
const BASE = "https://www.touchgal.ink";

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const HASH_RE = /^\/[0-9a-f]{8}$/;

function parseCard(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  const title = flat.split("评分")[0]?.trim() ?? flat;
  const rating = flat.match(/评分\s*([\d.]+)/)?.[1] ?? null;
  const views = flat.match(/浏览量\s*([\d.]+\s*[万亿wW]?)/)?.[1]?.replace(/\s/g, "") ?? null;
  const tail = flat.split(/浏览量\s*[\d.]+\s*[万亿wW]?/)[1] ?? "";
  const tags = [
    ...new Set(
      tail
        .replace(/[，,、]/g, " ")
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => s && s.length <= 6),
    ),
  ];
  return { title, rating, views, tags };
}

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

await page.goto(`${BASE}/galgame`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);

const collected = new Map();
let pageNo = 1;

while (collected.size < limit && pageNo <= 80) {
  const cards = await page.locator("a[href]").evaluateAll((els) =>
    els
      .filter((e) => /^\/[0-9a-f]{8}$/.test(e.getAttribute("href") ?? ""))
      .map((e) => ({
        href: e.getAttribute("href"),
        text: (e.textContent ?? "").replace(/\s+/g, " ").trim(),
        img: e.querySelector("img")?.getAttribute("src") ?? null,
      })),
  );

  let added = 0;
  for (const c of cards) {
    if (collected.size >= limit) break;
    if (collected.has(c.href)) continue;
    collected.set(c.href, c);
    added++;
  }
  console.log(`第 ${pageNo} 页：本页 ${cards.length} 张，新增 ${added}，累计 ${collected.size}`);

  if (collected.size >= limit) break;

  // 点分页器右侧按钮（pager 文本形如 "3 / 175" 的下一个按钮）
  const buttons = await page.locator("button").all();
  let pagerIdx = -1;
  for (const [i, btn] of buttons.entries()) {
    const t = ((await btn.textContent()) ?? "").trim();
    if (/^\d+\s*\/\s*\d+$/.test(t)) {
      pagerIdx = i;
      break;
    }
  }
  if (pagerIdx < 0 || pagerIdx + 1 >= buttons.length) {
    console.log("找不到下一页按钮，停止");
    break;
  }

  const before = cards[0]?.href;
  await buttons[pagerIdx + 1].click();
  // 等首卡变化
  let changed = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    const now = await page
      .locator("a[href]")
      .first()
      .getAttribute("href")
      .catch(() => null);
    if (now && now !== before) {
      changed = true;
      break;
    }
  }
  if (!changed) {
    console.log("翻页没有新内容，停止");
    break;
  }
  pageNo++;
}

await browser.close();

console.log(`\n共收集 ${collected.size} 条`);

/* ───────── 入库 ───────── */

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");
const cat = db.prepare("SELECT id FROM categories WHERE slug = 'games'").get();
const galgameTag = db.prepare("SELECT id FROM tags WHERE slug = 'galgame'").get();

if (!cat || !galgameTag) {
  console.error("缺 games 分类或 galgame 标签，先跑 seed-taxonomy");
  process.exit(1);
}

function nextCode() {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT code FROM resources WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
    .get(`XM-${year}-%`);
  const n = row ? Number(row.code.split("-")[2]) + 1 : 1;
  return `XM-${year}-${String(n).padStart(4, "0")}`;
}

let imported = 0;
let skipped = 0;
let failed = 0;

for (const [href, c] of collected) {
  const url = `${BASE}${href}`;
  const hash = createHash("sha256").update(url).digest("hex");

  if (db.prepare("SELECT resource_id FROM resource_links WHERE url_hash = ? LIMIT 1").get(hash)) {
    skipped++;
    continue;
  }

  const info = parseCard(c.text);
  if (!info.title) {
    failed++;
    continue;
  }

  if (dry) {
    console.log(`· ${info.title} | 评分 ${info.rating ?? "-"} | ${info.tags.join("/")}`);
    imported++;
    continue;
  }

  let coverUrl = null;
  let coverBlur = null;
  if (c.img) {
    try {
      const res = await fetch(c.img, { headers: { "user-agent": "Mozilla/5.0" } });
      if (res.ok) {
        const stored = await processCover(Buffer.from(await res.arrayBuffer()), "image/webp");
        coverUrl = stored.url;
        coverBlur = stored.blur;
      }
    } catch {
      /* 没封面不影响入库 */
    }
  }

  const summary = [
    `${info.title}（Galgame）`,
    info.rating ? `评分 ${info.rating}` : "",
    info.views ? `浏览 ${info.views}` : "",
    info.tags.length ? `标签：${info.tags.join("、")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const slug = `${href.slice(1)}-gal`;
  const code = nextCode();

  db.exec("BEGIN");
  try {
    const r = db
      .prepare(
        `INSERT INTO resources
           (code, slug, title, subtitle, summary, content_md, category_id, cover_url, cover_blur,
            platforms, version, language, status, is_featured, source_url, published_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'published',0,?,unixepoch(),unixepoch(),unixepoch())`,
      )
      .run(
        code,
        slug,
        info.title,
        "Galgame",
        summary.slice(0, 220),
        `${summary}\n\n资源来自 TouchGal，站内只做索引；点击下载会跳转到源站页面。`,
        cat.id,
        coverUrl,
        coverBlur,
        JSON.stringify(info.tags.includes("PE") ? ["Windows", "PE"] : ["Windows"]),
        null,
        "zh",
        url,
      );

    const rid = Number(r.lastInsertRowid);
    db.prepare(
      `INSERT INTO resource_links (resource_id, url, url_hash, provider, label, is_primary, status, created_at)
       VALUES (?,?,?,'self','TouchGal',1,'unknown',unixepoch())`,
    ).run(rid, url, hash);

    db.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)").run(
      rid,
      galgameTag.id,
    );

    db.exec("COMMIT");
    imported++;
  } catch (e) {
    db.exec("ROLLBACK");
    failed++;
    console.log(`✗ ${info.title}: ${e.message.slice(0, 60)}`);
  }

  if (imported % 25 === 0) console.log(`  …已导入 ${imported}`);
}

db.close();
console.log(`\n${dry ? "（预演）" : ""}导入 ${imported} · 跳过 ${skipped} · 失败 ${failed}`);
