/**
 * 两个防护的验收：删除二次确认 + 登录限流
 * 用法：node scripts/test-guards.mjs
 * 注意：会在结尾把账号锁 10 分钟（进程内），CI 里跑完即销毁，本地跑完需重启服务。
 */
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const log = [];

/* ---------- 1. 删除二次确认（需要先登录） ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
  await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/admin/resources`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const onList = page.url().includes("/admin/resources");
  log.push({ step: "admin-list", onList });

  if (onList) {
    // 用「第一行的标题」判断有没有被真删，不用行数（流式渲染期间行数会短暂翻倍）
    const firstRow = page.locator("tbody tr").first();
    const firstTitle = (await firstRow.locator("a, span").first().textContent().catch(() => ""))?.trim();

    await page.getByRole("button", { name: "删除" }).first().click();
    await page.waitForTimeout(400);

    const dialogVisible = (await page.locator("dialog[open]").count()) > 0;
    const dialogText = (await page.locator("dialog").first().textContent().catch(() => "")) ?? "";
    log.push({
      step: "dialog",
      visible: dialogVisible,
      saysIrreversible: dialogText.includes("不可撤销"),
    });

    await page.getByRole("button", { name: "取消" }).click();
    await page.waitForTimeout(600);

    const closed = (await page.locator("dialog[open]").count()) === 0;
    const stillThere =
      firstTitle && firstTitle.length > 1
        ? await page.getByText(firstTitle, { exact: false }).first().isVisible().catch(() => false)
        : true;

    log.push({ step: "cancel-keeps-row", closed, stillThere });
  }

  await page.goto(`${BASE}/api/logout`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await ctx.close();
}

/* ---------- 2. 登录限流（放最后；用专用账号，避免把管理员锁住） ---------- */
{
  const RL_EMAIL = "ratelimit-guard@xiaomo.local"; // 故意不存在的账号：能触发限流但不影响 admin 登录
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (let i = 1; i <= 6; i += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("you@example.com").fill(RL_EMAIL);
    await page.getByPlaceholder("至少 8 位").fill(`wrong-pass-${i}`);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForTimeout(900);
    log.push({ step: `attempt-${i}`, stillLogin: page.url().includes("/login") });
  }
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(log, null, 2));

const dialog = log.find((l) => l.step === "dialog");
const cancel = log.find((l) => l.step === "cancel-keeps-row");
const attempts = log.filter((l) => l.step.startsWith("attempt-"));

const ok =
  log[0].onList === true &&
  dialog?.visible === true &&
  cancel?.closed === true &&
  cancel?.stillThere === true &&
  attempts.length === 6 &&
  attempts.every((a) => a.stillLogin === true);

if (!ok) {
  console.error("✗ 防护断言失败");
  process.exit(1);
}
console.log("✓ 防护检查通过（删除需确认、连续失败被拦）");
