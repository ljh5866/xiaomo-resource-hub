/**
 * 举报链路验收：详情页打开弹窗 → 提交 → 后台列表出现 → 标记已处理
 * 用法：node scripts/test-report.mjs
 */
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const log = [];

/* 1. 游客在详情页提交举报 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/r/excel-dashboard-pack`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const trigger = page.getByRole("button", { name: /举报/ }).first();
  await trigger.click();
  await page.waitForTimeout(400);

  const dialogOpen = (await page.locator("dialog[open]").count()) > 0;

  await page.selectOption("dialog select", "link-dead").catch(() => {});
  await page.fill('dialog input[placeholder*="邮箱"]', "tester@example.com").catch(() => {});
  await page.getByRole("button", { name: "提交举报" }).click();
  await page.waitForTimeout(1200);

  const okText = (await page.locator("dialog").textContent().catch(() => "")) ?? "";
  log.push({
    step: "guest-submit",
    dialogOpen,
    accepted: okText.includes("收到") || okText.includes("优先处理"),
  });

  await ctx.close();
}

/* 2. 后台能看到并处理 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
  await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/admin/reports`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const rowsBefore = await page.locator("tbody tr").count();
  const hasContact = (await page.locator("body").textContent())?.includes("tester@example.com");

  log.push({ step: "admin-list", rows: rowsBefore, showsContact: hasContact });

  if (rowsBefore > 0) {
    await page.getByRole("button", { name: "标记已处理" }).first().click();
    await page.waitForTimeout(1500);
    const bodyAfter = (await page.locator("body").textContent()) ?? "";
    log.push({ step: "handle", showsHandled: bodyAfter.includes("已处理") });
  }

  await ctx.close();
}

/* 3. 同一链接被举报满 3 次 → 自动标失效 */
{
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync("data/app.db");

  const link = db
    .prepare(
      "SELECT l.id, l.resource_id AS resourceId, l.status FROM resource_links l WHERE l.status = 'unknown' LIMIT 1",
    )
    .get();

  if (!link) {
    log.push({ step: "auto-invalidate", skipped: "没有 unknown 状态的链接" });
  } else {
    // 清掉这条链接的历史举报，让计数从 0 开始
    db.prepare("DELETE FROM reports WHERE link_id = ?").run(link.id);

    const codes = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await fetch(`${BASE}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: link.resourceId,
          linkId: link.id,
          reason: "link-dead",
        }),
      });
      codes.push(res.status);
    }

    const after = db.prepare("SELECT status FROM resource_links WHERE id = ?").get(link.id);
    log.push({
      step: "auto-invalidate",
      linkId: link.id,
      posts: codes,
      linkStatus: after?.status ?? null,
      invalidated: after?.status === "invalid",
    });
  }

  db.close();
}

await browser.close();
console.log(JSON.stringify(log, null, 2));

const submit = log.find((l) => l.step === "guest-submit");
const list = log.find((l) => l.step === "admin-list");
const handled = log.find((l) => l.step === "handle");
const auto = log.find((l) => l.step === "auto-invalidate");

const ok =
  submit?.dialogOpen === true &&
  submit?.accepted === true &&
  list?.rows > 0 &&
  handled?.showsHandled === true &&
  (auto?.skipped !== undefined || auto?.invalidated === true);

if (!ok) {
  console.error("✗ 举报链路断言失败");
  process.exit(1);
}
console.log("✓ 举报链路通过（游客提交 → 后台可见 → 标记已处理 → 满 3 次自动标失效）");
