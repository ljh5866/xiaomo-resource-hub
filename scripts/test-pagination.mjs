/**
 * 分页与「加载更多」验收
 * 用法：node scripts/test-pagination.mjs
 */
import { BASE, launch } from "./lib/browser.mjs";

const log = [];

/* 1. 接口 */
{
  const res = await fetch(`${BASE}/api/resources?offset=12&limit=12`);
  const json = await res.json();
  log.push({
    step: "api",
    status: res.status,
    returned: json.items?.length ?? 0,
    total: json.total,
    nextOffset: json.nextOffset,
    firstCode: json.items?.[0]?.code ?? null,
    distinct: new Set((json.items ?? []).map((i) => i.code)).size,
  });
}

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

/* 2. 更新页加载更多 */
{
  await page.goto(`${BASE}/updates`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const before = await page.locator('a[href^="/r/"]').count();
  const btn = page.getByRole("button", { name: /加载更多/ });
  const hasBtn = (await btn.count()) > 0;

  if (hasBtn) {
    await btn.click();
    await page.waitForTimeout(1500);
  }

  const after = await page.locator('a[href^="/r/"]').count();
  log.push({ step: "updates-load-more", before, after, hasBtn, grew: after > before });
}

/* 3. 分类页加载更多 */
{
  await page.goto(`${BASE}/c/template`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const before = await page.locator('a[href^="/r/"]').count();
  const btn = page.getByRole("button", { name: /加载更多/ });
  const hasBtn = (await btn.count()) > 0;

  if (hasBtn) {
    await btn.click();
    await page.waitForTimeout(1500);
  }

  const after = await page.locator('a[href^="/r/"]').count();
  log.push({ step: "category-load-more", before, after, hasBtn, grew: after > before });
}

/* 4. 平台筛选 + 已加载数提示 */
{
  await page.goto(`${BASE}/c/template?platform=windows`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const cards = await page.locator('a[href^="/r/"]').count();
  const note = (await page.locator("text=/已显示/").first().textContent().catch(() => "")) ?? "";
  log.push({ step: "platform-filter", cards, note: note.trim().slice(0, 20) });
}

await page.screenshot({ path: ".shots/pagination.png" });
await browser.close();

console.log(JSON.stringify(log, null, 2));

const api = log.find((l) => l.step === "api");
const updates = log.find((l) => l.step === "updates-load-more");
const category = log.find((l) => l.step === "category-load-more");

const ok =
  api?.status === 200 &&
  api?.returned === 12 &&
  api?.distinct === 12 &&
  api?.nextOffset === 24 &&
  updates?.grew === true &&
  category?.grew === true;

if (!ok) {
  console.error("✗ 分页断言失败");
  process.exit(1);
}
console.log("✓ 分页通过（接口切片正确，两个列表页加载更多都增长）");
