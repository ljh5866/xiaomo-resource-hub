/**
 * 性能门禁：用真实 Chromium 量 LCP / CLS / TTFB，超预算就 exit 1。
 * 比 Lighthouse 轻得多，指标口径一致（都是 Chrome 的 PerformanceObserver）。
 *
 * 用法：node scripts/perf.mjs
 * 环境：BASE_URL / BROWSER_PATH
 */
import { BASE, launch } from "./lib/browser.mjs";

const BUDGET = {
  lcpMs: 2500,
  cls: 0.1,
  ttfbMs: 800,
};

const PAGES = [
  { name: "home", path: "/" },
  { name: "category", path: "/c/template" },
  { name: "detail", path: "/r/excel-dashboard-pack" },
];

const browser = await launch({});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const results = [];

for (const p of PAGES) {
  const page = await ctx.newPage();

  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.lcp = e.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__perf.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(BASE + p.path, { waitUntil: "domcontentloaded", timeout: 45000 });
  // 等 LCP 稳定：再观察 1.2s
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      lcp: window.__perf?.lcp ?? 0,
      cls: Number((window.__perf?.cls ?? 0).toFixed(4)),
      resourceBytes: performance
        .getEntriesByType("resource")
        .reduce((sum, r) => sum + (r.transferSize || 0), 0),
    };
  });

  results.push({ page: p.name, path: p.path, ...m });
  await page.close();
}

await browser.close();

console.log(JSON.stringify(results, null, 2));

const failures = [];
for (const r of results) {
  if (r.lcp > BUDGET.lcpMs) failures.push(`${r.page}: LCP ${Math.round(r.lcp)}ms > ${BUDGET.lcpMs}ms`);
  if (r.cls > BUDGET.cls) failures.push(`${r.page}: CLS ${r.cls} > ${BUDGET.cls}`);
  if (r.ttfb > BUDGET.ttfbMs) failures.push(`${r.page}: TTFB ${Math.round(r.ttfb)}ms > ${BUDGET.ttfbMs}ms`);
}

if (failures.length) {
  console.error("✗ 性能预算超标：\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}

console.log(
  `✓ 性能预算通过（LCP ≤ ${BUDGET.lcpMs}ms / CLS ≤ ${BUDGET.cls} / TTFB ≤ ${BUDGET.ttfbMs}ms）`,
);
