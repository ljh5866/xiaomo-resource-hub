/**
 * 用户页验收：/me 收藏 / 投稿 / 设置 + 头像上传 + /favorites 重定向
 *   node scripts/test-me.mjs
 */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { BASE, launch } from "./lib/browser.mjs";

const email = `me-${Date.now().toString(36)}@test.local`;
const password = "MePass123";
const newName = "改过的昵称";

/* 造一个可登录的用户 */
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

/* 1. 未登录访问 /me 也能看到页面（游客态） */
await page.goto(`${BASE}/me`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
const guestText = (await page.locator("body").textContent()) ?? "";
log.push({ step: "guest", status: 200, hasLoginCta: guestText.includes("登录") });

/* 2. 登录 */
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(2800);

/* 3. /me 三个 tab */
for (const [tab, keyword] of [
  ["favorites", "收藏"],
  ["submissions", "投稿"],
  ["settings", "昵称"],
]) {
  await page.goto(`${BASE}/me?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const text = (await page.locator("body").textContent()) ?? "";
  log.push({ step: `tab-${tab}`, ok: text.includes(keyword) && !text.includes("Application error") });
}

/* 4. 改昵称 */
await page.goto(`${BASE}/me?tab=settings`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const nameInput = page.locator('input[aria-label="昵称"]');
await nameInput.fill(newName);
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.waitForTimeout(1500);
const savedText = (await page.locator("body").textContent()) ?? "";
log.push({ step: "rename", ok: savedText.includes("已保存") });

/* 5. /favorites 应重定向到 /me */
await page.goto(`${BASE}/favorites`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(300);
log.push({ step: "favorites-redirect", url: page.url().replace(BASE, "") });

/* 6. 上传头像 */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const avatarRes = await page.request.post(`${BASE}/api/avatar`, {
  multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } },
});
const avatarJson = await avatarRes.json().catch(() => ({}));
log.push({ step: "avatar", status: avatarRes.status(), ok: Boolean(avatarJson.url) });

await browser.close();

/* 7. 校验库里昵称与头像 */
const db2 = new DatabaseSync("data/app.db");
const row = db2
  .prepare("SELECT name, avatar_url FROM users WHERE id = ?")
  .get(userId);
db2.prepare("DELETE FROM users WHERE id = ?").run(userId);
db2.close();
log.push({ step: "db", name: row?.name, hasAvatar: Boolean(row?.avatar_url) });

console.log(JSON.stringify(log, null, 2));

const ok =
  log.find((l) => l.step === "guest")?.hasLoginCta === true &&
  log.filter((l) => l.step?.startsWith("tab-")).every((l) => l.ok) &&
  log.find((l) => l.step === "rename")?.ok === true &&
  log.find((l) => l.step === "favorites-redirect")?.url?.startsWith("/me") === true &&
  log.find((l) => l.step === "avatar")?.ok === true &&
  log.find((l) => l.step === "db")?.name === newName &&
  log.find((l) => l.step === "db")?.hasAvatar === true;

if (!ok) {
  console.error("✗ 用户页断言失败");
  process.exit(1);
}
console.log("✓ 用户页通过（游客态 / 三个 tab / 改昵称 / 收藏重定向 / 头像上传）");
