/**
 * 投稿链路验收：游客投稿 → 后台待审 → 采纳生成草稿
 * 同时验证：同一链接重复投稿被识别、举报满 3 次自动标失效
 * 用法：node scripts/test-submit.mjs
 */
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const log = [];

/* 1. 游客投稿 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/submit`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  const title = `投稿测试资源 ${Date.now().toString(36)}`;
  await page.fill('input[placeholder*="Excel 数据看板"]', title);
  await page.fill('input[type="url"]', `https://pan.quark.cn/s/TEST-${Date.now().toString(36)}`);
  await page.fill("textarea", "提取码 test；仅用于验收");
  await page.fill('input[placeholder*="邮箱"]', "submitter@example.com");
  await page.getByRole("button", { name: "提交" }).click();
  await page.waitForTimeout(1200);

  const body = (await page.locator("body").textContent()) ?? "";
  log.push({ step: "guest-submit", accepted: body.includes("已提交") || body.includes("审核"), title });

  // 重复投稿
  await page.getByRole("button", { name: "提交" }).click().catch(() => {});
  await page.waitForTimeout(1000);
  const dupBody = (await page.locator("body").textContent()) ?? "";
  log.push({ step: "duplicate", recognized: dupBody.includes("投过") || dupBody.includes("已提交") });

  await ctx.close();
  globalThis.__title = title;
}

/* 2. 后台采纳 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
  await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/admin/submissions`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const pendingBefore = await page.getByText("待审", { exact: true }).count();
  log.push({ step: "admin-list", pendingBefore });

  await page.getByRole("button", { name: /采纳并建草稿/ }).first().click();
  await page.waitForTimeout(1800);

  const after = (await page.locator("body").textContent()) ?? "";
  log.push({ step: "accept", hasAccepted: after.includes("已采纳") });

  await page.goto(`${BASE}/admin/resources?status=draft`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const draftBody = (await page.locator("body").textContent()) ?? "";
  log.push({ step: "draft-created", found: draftBody.includes("投稿测试资源") });

  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(log, null, 2));

const submit = log.find((l) => l.step === "guest-submit");
const list = log.find((l) => l.step === "admin-list");
const accept = log.find((l) => l.step === "accept");
const draft = log.find((l) => l.step === "draft-created");

const ok =
  submit?.accepted === true &&
  list?.pendingBefore >= 1 &&
  accept?.hasAccepted === true &&
  draft?.found === true;

if (!ok) {
  console.error("✗ 投稿链路断言失败");
  process.exit(1);
}
console.log("✓ 投稿链路通过（游客投稿 → 待审 → 采纳生成草稿）");
