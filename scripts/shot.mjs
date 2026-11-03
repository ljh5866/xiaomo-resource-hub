/**
 * 视觉/排版验收：真实视口截图 + 横向溢出检测。
 * 用法：node scripts/shot.mjs
 * 环境：BASE_URL / BROWSER_PATH（CI 里用 playwright 自带 chromium）
 */
import fs from "node:fs";
import { BASE, launch } from "./lib/browser.mjs";

const OUT = ".shots";

const targets = [
  { name: "p-home-375", path: "/", w: 375, h: 812, full: true },
  { name: "p-home-768", path: "/", w: 768, h: 900, full: true },
  { name: "p-home-1440", path: "/", w: 1440, h: 1000, full: true },
  { name: "p-detail-375", path: "/r/excel-dashboard-pack", w: 375, h: 812, full: true },
  { name: "p-detail-1440", path: "/r/excel-dashboard-pack", w: 1440, h: 1000, full: true },
  { name: "p-search-1440", path: "/search?q=Excel", w: 1440, h: 900, full: false },
  { name: "p-cat-1440", path: "/c/template", w: 1440, h: 900, full: false },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await launch({});
const ctx = await browser.newContext({ deviceScaleFactor: 1 });

const report = [];

for (const t of targets) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: t.w, height: t.h });
  await page.goto(BASE + t.path, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) ?? null,
    cards: document.querySelectorAll('a[href^="/r/"]').length,
  }));

  await page.screenshot({ path: `${OUT}/${t.name}.png`, fullPage: t.full });
  report.push({
    name: t.name,
    width: t.w,
    overflow: metrics.scrollWidth > metrics.innerWidth + 1,
    h1: metrics.h1,
    cards: metrics.cards,
  });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));

const broken = report.filter((r) => r.overflow);
if (broken.length) {
  console.error(`✗ ${broken.length} 个视口出现横向溢出：`, broken.map((b) => b.name).join(", "));
  process.exit(1);
}
console.log("✓ 三个断点均无横向溢出");
