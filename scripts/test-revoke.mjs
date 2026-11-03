/**
 * 会话吊销验收：登录 → 后台可达 → revoke → 同一浏览器里后台被踢 → 重新登录恢复
 * 用法：node scripts/test-revoke.mjs
 */
import { execSync } from "node:child_process";
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const log = [];

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
  await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForTimeout(2500);
}

await login();
const r1 = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
log.push({ step: "before-revoke", status: r1?.status(), url: page.url().replace(BASE, "") });

execSync(`pnpm user:revoke ${CREDENTIALS.email}`, { stdio: "pipe" });

const r2 = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
const bodyText = (await page.locator("body").textContent()) ?? "";
const kicked = bodyText.includes("会话已失效") || page.url().includes("/login");
log.push({
  step: "after-revoke",
  status: r2?.status(),
  url: page.url().replace(BASE, ""),
  kicked,
  showsRevoked: bodyText.includes("会话已失效"),
});

await login();
const r3 = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
log.push({ step: "relogin", status: r3?.status(), url: page.url().replace(BASE, "") });

await browser.close();
console.log(JSON.stringify(log, null, 2));

const ok =
  log[0].status === 200 &&
  log[1].kicked === true &&
  log[2].status === 200 &&
  !log[2].url.startsWith("/login");

if (!ok) {
  console.error("✗ 会话吊销断言失败");
  process.exit(1);
}
console.log("✓ 会话吊销通过（revoke 后旧会话立即失效，重新登录可用）");
