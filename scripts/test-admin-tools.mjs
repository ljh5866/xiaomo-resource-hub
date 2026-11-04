/**
 * 后台三件套验收：资源搜索分页 / 分类标签管理 / 巡检复测
 * 用法：node scripts/test-admin-tools.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const log = [];

/* 登录 */
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);

/* 1. 资源搜索 */
{
  await page.goto(`${BASE}/admin/resources?q=Excel`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const rows = await page.locator("tbody tr").count();
  const body = (await page.locator("body").textContent()) ?? "";
  log.push({
    step: "search",
    rows,
    hitExcel: body.includes("Excel"),
    showsTotal: /共 \d+ 条/.test(body),
  });
}

/* 2. 分页（需要 ≥31 条资源才有多页；空库时跳过） */
{
  await page.goto(`${BASE}/admin/resources?page=2`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const rows = await page.locator("tbody tr").count();
  const body = (await page.locator("body").textContent()) ?? "";
  const total = Number((body.match(/共 (\d+) 条/)?.[1] ?? "0"));

  log.push({
    step: "page-2",
    total,
    rows,
    skipped: total < 31,
    showsPager: total < 31 ? true : /2 \/ \d+/.test(body),
    hasPrev: total < 31 ? true : (await page.getByRole("link", { name: /上一页/ }).count()) > 0,
  });
}

/* 3. 分类：改排序值并确认落库（按 slug 核验，不能假设行顺序） */
{
  await page.goto(`${BASE}/admin/taxonomy`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const catCount = await page.locator("table tbody tr").count();
  const firstRow = page.locator("table tbody tr").first();
  const slug = (await firstRow.locator("td").first().textContent())?.trim() ?? "";

  const sortInput = firstRow.locator('input[name="sortOrder"]');
  const oldVal = await sortInput.inputValue();
  const newVal = String(Number(oldVal) + 7);
  await sortInput.fill(newVal);
  await firstRow.getByRole("button", { name: "保存" }).click();
  await page.waitForTimeout(1500);

  const db = new DatabaseSync("data/app.db");
  const row = db.prepare("SELECT sort_order AS so FROM categories WHERE slug = ?").get(slug);
  db.close();

  log.push({
    step: "category-sort",
    catCount,
    slug,
    oldVal,
    newVal,
    dbValue: String(row?.so ?? ""),
    applied: String(row?.so ?? "") === newVal,
  });
}

/* 4. 标签：合并（把 use_count 最小的标签并到第一个） */
{
  const db = new DatabaseSync("data/app.db");
  const tags = db.prepare("SELECT id, name, use_count AS u FROM tags ORDER BY use_count ASC LIMIT 2").all();
  db.close();

  const [from, to] = tags;
  if (from && to) {
    await page.goto(`${BASE}/admin/taxonomy`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // 按「改名输入框的值」定位行：不能用 hasText —— 每个下拉里都列着所有标签名，会全命中
    const rows = page.locator("div.border.border-line.p-2");
    const rowCount = await rows.count();
    let target = -1;
    for (let i = 0; i < rowCount; i += 1) {
      const v = await rows.nth(i).locator('input[name="name"]').inputValue().catch(() => "");
      if (v === from.name) {
        target = i;
        break;
      }
    }

    log.push({ step: "tag-row", rowCount, target, lookingFor: from.name });

    if (target >= 0) {
      const row = rows.nth(target);
      await row.locator("select").selectOption(String(to.id));
      await row.getByRole("button", { name: "合并" }).click();
      await page.waitForTimeout(1800);
    }

    const db2 = new DatabaseSync("data/app.db");
    const gone = db2.prepare("SELECT id FROM tags WHERE id = ?").get(from.id);
    const merged = db2.prepare("SELECT use_count AS u FROM tags WHERE id = ?").get(to.id);
    db2.close();

    log.push({
      step: "tag-merge",
      from: from.name,
      to: to.name,
      removed: !gone,
      targetCount: merged?.u ?? null,
    });
  } else {
    log.push({ step: "tag-merge", skipped: "标签不足两条" });
  }
}

/* 5. 巡检复测（示例域名会被跳过，只验证接口与提示） */
{
  await page.goto(`${BASE}/admin/links`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const before = (await page.locator("body").textContent()) ?? "";
  await page.getByRole("button", { name: /复测 \d+ 条/ }).click();
  await page.waitForTimeout(4000);
  const after = (await page.locator("body").textContent()) ?? "";

  log.push({
    step: "recheck",
    hadButton: /复测 \d+ 条/.test(before),
    reported: /已复测|没有需要复测/.test(after),
  });
}

await browser.close();
console.log(JSON.stringify(log, null, 2));

const search = log.find((l) => l.step === "search");
const page2 = log.find((l) => l.step === "page-2");
const cat = log.find((l) => l.step === "category-sort");
const tag = log.find((l) => l.step === "tag-merge");
const recheck = log.find((l) => l.step === "recheck");

const ok =
  search?.rows > 0 &&
  search?.showsTotal === true &&
  page2?.showsPager === true &&
  cat?.applied === true &&
  // 标签可能本来就是 0 条资源在挂，合并后目标计数不一定会涨
  (tag?.skipped !== undefined || tag?.removed === true) &&
  recheck?.hadButton === true &&
  recheck?.reported === true;

if (!ok) {
  console.error("✗ 后台三件套断言失败");
  process.exit(1);
}
console.log("✓ 后台三件套通过（搜索分页 / 分类排序 / 标签合并 / 复测）");
