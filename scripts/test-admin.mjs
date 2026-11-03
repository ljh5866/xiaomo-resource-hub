/**
 * 后台端到端验证：新建资源 + 批量导入
 * 用法：node scripts/test-admin.mjs
 */
import { chromium } from "playwright-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://127.0.0.1:3100";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const log = [];
const stamp = Date.now().toString().slice(-6);

/* ---------- 1. 新建资源 ---------- */
await page.goto(`${BASE}/admin/resources/new`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);

const title = `E2E 测试资源 ${stamp}`;
const slug = `e2e-test-${stamp}`;

await page.getByPlaceholder("Excel 数据看板模板合集").fill(title);
await page.getByPlaceholder("excel-dashboard-pack").fill(slug);
await page.locator("select").first().selectOption({ index: 1 });
await page
  .getByPlaceholder("https://pan.quark.cn/s/xxxx")
  .fill(`https://pan.quark.cn/s/E2E-${stamp}`);

await page.getByRole("button", { name: "创建资源" }).click();
await page.waitForURL("**/admin/resources", { timeout: 20000 });
await page.waitForTimeout(800);

const listHasIt = await page.locator(`text=${title}`).count();
log.push({ step: "create", foundInList: listHasIt > 0, url: page.url() });

/* ---------- 1b. 列表里点"发布" ---------- */
const row = page.locator("tr", { hasText: title }).first();
await row.getByRole("button", { name: "发布" }).click();
await page.waitForTimeout(1200);
const rowText = await row.textContent();
log.push({ step: "publish", rowHasPublished: rowText?.includes("已发布") ?? false });

/* ---------- 2. 前台能打开 ---------- */
await page.goto(`${BASE}/r/${slug}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
const h1 = await page.locator("h1").first().textContent();
const cards = await page.locator('a[href^="/go/"]').count();
log.push({ step: "front-detail", h1: h1?.trim(), downloadButtons: cards });

/* ---------- 3. 批量导入 ---------- */
await page.goto(`${BASE}/admin/imports`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "填入示例" }).click();
await page.getByRole("button", { name: "开始导入" }).click();
await page.waitForTimeout(2500);
const result = await page.locator("pre").first().textContent().catch(() => "");
log.push({ step: "import", result: result?.trim().slice(0, 120) });

/* ---------- 4. 后台页面可达 ---------- */
for (const path of ["/admin", "/admin/resources", "/admin/links"]) {
  const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  log.push({ step: "page", path, status: res?.status() });
}

await browser.close();
console.log(JSON.stringify(log, null, 2));
