/**
 * 鉴权端到端：拦截 → 登录 → 收藏 → 退出 → 再次拦截
 * 用法：node scripts/test-auth.mjs
 * 环境：BASE_URL / BROWSER_PATH / TEST_EMAIL / TEST_PASSWORD
 */
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const log = [];

/* 1. 未登录访问后台 */
const res1 = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
log.push({ step: "guard", url: page.url().replace(BASE, ""), status: res1?.status() });

/* 2. 上传接口未登录 */
const up1 = await page.request.post(`${BASE}/api/upload`, {
  multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } },
});
log.push({ step: "upload-guard", status: up1.status() });

/* 3. 登录 */
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);
log.push({ step: "login", url: page.url().replace(BASE, "") });

/* 4. 后台可达 */
const res2 = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
log.push({ step: "admin-open", status: res2?.status() });

/* 5. 会话接口 */
const session = await page.request.get(`${BASE}/api/auth/session`);
const sessionJson = await session.json();
log.push({
  step: "session",
  user: sessionJson?.user?.email ?? null,
  role: sessionJson?.user?.role ?? null,
});

/* 6. 收藏：走真实 UI（不依赖资源 id） */
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const firstCard = page.locator('a[href^="/r/"]').first();
await firstCard.click();
await page.waitForTimeout(1200);

const title = (await page.locator("h1").first().textContent())?.trim() ?? "";
const favBtn = page.getByRole("button", { name: /收藏/ }).first();

// 幂等：上次跑过可能已经是「已收藏」，先确保处于未收藏再点
let label = (await favBtn.textContent())?.trim() ?? "";
if (label.includes("已收藏")) {
  await favBtn.click();
  await page.waitForTimeout(800);
}
await favBtn.click();
await page.waitForTimeout(800);
const favLabel = (await favBtn.textContent())?.trim() ?? "";
log.push({ step: "favorite", title, label: favLabel });

/* 7. 收藏页能看到它 */
await page.goto(`${BASE}/favorites`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const inList = (await page.locator("body").textContent())?.includes(title) ?? false;
log.push({ step: "favorites-page", containsTitle: inList });

/* 8. 退出 */
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const before = (await ctx.cookies()).map((c) => c.name);
await page.getByRole("link", { name: /退出/ }).first().click();
await page.waitForTimeout(2500);
const after = (await ctx.cookies()).map((c) => c.name);
log.push({
  step: "signout",
  before,
  after,
  sessionGone: !after.includes("authjs.session-token"),
  url: page.url().replace(BASE, ""),
});

const res3 = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
log.push({ step: "after-logout", url: page.url().replace(BASE, ""), status: res3?.status() });

await browser.close();
console.log(JSON.stringify(log, null, 2));

const find = (s) => log.find((l) => l.step === s);
const ok =
  find("guard")?.status === 200 &&
  find("upload-guard")?.status === 401 &&
  find("session")?.role === "admin" &&
  find("favorite")?.label?.includes("已收藏") &&
  find("favorites-page")?.containsTitle === true &&
  find("signout")?.sessionGone === true &&
  find("after-logout")?.url?.startsWith("/login");

if (!ok) {
  console.error("✗ 鉴权链路断言失败");
  process.exit(1);
}
console.log("✓ 鉴权链路通过");
