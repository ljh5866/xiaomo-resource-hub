/**
 * 用户页 + 设置页验收（两页独立）
 *   node scripts/test-me.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { BASE, launch } from "./lib/browser.mjs";

const email = `me-${Date.now().toString(36)}@test.local`;
const password = "MePass123";
const newName = "改过的昵称";

const db = new DatabaseSync("data/app.db");
const { hashPassword } = await import("../src/lib/password.ts");
db.prepare(
  `INSERT INTO users (email, name, role, password_hash, token_version, status)
   VALUES (?, '测试用户', 'user', ?, 0, 'active')`,
).run(email, hashPassword(password));
const userId = db.prepare("SELECT id FROM users WHERE email = ?").get(email).id;
db.close();

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const log = [];

/* 1. 未登录的 /me（游客态） */
await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const guest = (await page.locator("body").textContent()) ?? "";
log.push({ step: "guest", ok: guest.includes("登录") && guest.includes("本机收藏") });

/* 2. 未登录访问设置页 → 跳登录 */
await page.goto(`${BASE}/me/settings`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
log.push({ step: "settings-guard", url: page.url().replace(BASE, "") });

/* 3. 登录 */
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(2800);

/* 4. 用户页两个 tab */
for (const [tab, keyword] of [
  ["favorites", "收藏"],
  ["submissions", "投稿"],
]) {
  await page.goto(`${BASE}/me?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const text = (await page.locator("body").textContent()) ?? "";
  log.push({ step: `tab-${tab}`, ok: text.includes(keyword) && !text.includes("Application error") });
}

/* 5. 用户页不应该有设置表单 */
await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const meText = (await page.locator("body").textContent()) ?? "";
log.push({ step: "no-settings-on-me", ok: !meText.includes("修改密码") && meText.includes("账号设置") });

/* 6. 设置页独立可访问 */
await page.goto(`${BASE}/me/settings`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
const setText = (await page.locator("body").textContent()) ?? "";
log.push({ step: "settings-page", ok: setText.includes("账号设置") && setText.includes("修改密码") });

/* 7. 设置页改昵称 */
await page.locator('input[aria-label="昵称"]').fill(newName);
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.waitForTimeout(1500);
const afterSave = (await page.locator("body").textContent()) ?? "";
log.push({ step: "rename", ok: afterSave.includes("已保存") });

/* 8. /favorites 重定向 */
await page.goto(`${BASE}/favorites`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(300);
log.push({ step: "favorites-redirect", url: page.url().replace(BASE, "") });

/* 9. 头像上传 */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const res = await page.request.post(`${BASE}/api/avatar`, {
  multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } },
});
const json = await res.json().catch(() => ({}));
log.push({ step: "avatar", ok: Boolean(json.url) });

await browser.close();

const db2 = new DatabaseSync("data/app.db");
const row = db2.prepare("SELECT name, avatar_url FROM users WHERE id = ?").get(userId);
db2.prepare("DELETE FROM users WHERE id = ?").run(userId);
db2.close();
log.push({ step: "db", name: row?.name, hasAvatar: Boolean(row?.avatar_url) });

console.log(JSON.stringify(log, null, 2));

const ok =
  log.find((l) => l.step === "guest")?.ok === true &&
  log.find((l) => l.step === "settings-guard")?.url?.includes("/login") === true &&
  log.filter((l) => l.step?.startsWith("tab-")).every((l) => l.ok) &&
  log.find((l) => l.step === "no-settings-on-me")?.ok === true &&
  log.find((l) => l.step === "settings-page")?.ok === true &&
  log.find((l) => l.step === "rename")?.ok === true &&
  log.find((l) => l.step === "favorites-redirect")?.url?.startsWith("/me") === true &&
  log.find((l) => l.step === "avatar")?.ok === true &&
  log.find((l) => l.step === "db")?.name === newName;

if (!ok) {
  console.error("✗ 用户页/设置页断言失败");
  process.exit(1);
}
console.log("✓ 通过（游客态 / 三个 tab 分流 / 设置独立页 / 改昵称 / 重定向 / 头像）");
