/**
 * 注册系统验收：注册 → 登录 → 收藏 → 后台可见 → 封禁后登录失败
 * 用法：node scripts/test-register.mjs
 */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const stamp = Date.now().toString(36);
const email = `reg-${stamp}@test.local`;
const password = "Test12345";

const browser = await launch({});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const log = [];

/* 1. 注册（需要邮箱验证码：开发模式把码写到 data/.dev-emails.log） */
await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
await page.locator("#email").fill(email);

await page.getByRole("button", { name: /获取验证码/ }).click();
await page.waitForTimeout(2000);

const devLog = fs.existsSync("data/.dev-emails.log")
  ? fs.readFileSync("data/.dev-emails.log", "utf8")
  : "";
const codeLine = devLog
  .trim()
  .split("\n")
  .filter((l) => l.includes(email))
  .pop();
const code = codeLine?.split("\t")[2]?.trim() ?? "";
log.push({ step: "code", found: code.length === 6 });

await page.locator("#code").fill(code);
await page.locator("#name").fill("注册测试");
await page.locator("#password").fill(password);
await page.locator("#password2").fill(password);
await page.getByRole("button", { name: "注册" }).click();
await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
log.push({ step: "register", url: page.url().replace(BASE, ""), onLogin: page.url().includes("/login") });

/* 2. 登录 */
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);
const signedIn = !page.url().includes("/login");
log.push({ step: "login", url: page.url().replace(BASE, ""), signedIn });

/* 3. 普通用户访问后台应被拦（服务端 requireAdmin 兜底） */
const adminRes = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
log.push({ step: "admin-blocked", status: adminRes?.status() ?? 0, url: page.url().replace(BASE, "") });

/* 4. 数据库里的状态 */
const db = new DatabaseSync("data/app.db");
const row = db.prepare("SELECT id, role, status FROM users WHERE email = ?").get(email);
db.close();
log.push({ step: "db", found: Boolean(row), role: row?.role, status: row?.status });

/* 5. 封禁后无法登录（用后台接口验证更接近真实；这里直接改库 + 尝试登录） */
if (row) {
  const db2 = new DatabaseSync("data/app.db");
  db2.prepare("UPDATE users SET status = 'banned', token_version = token_version + 1 WHERE id = ?").run(row.id);
  db2.close();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p2.locator('input[type="email"]').fill(email);
  await p2.locator('input[type="password"]').fill(password);
  await p2.getByRole("button", { name: "登录" }).click();
  await p2.waitForTimeout(2500);
  log.push({ step: "banned-login", stillOnLogin: p2.url().includes("/login") });
  await ctx2.close();
}

await browser.close();
console.log(JSON.stringify(log, null, 2));

const reg = log.find((l) => l.step === "register");
const login = log.find((l) => l.step === "login");
const blocked = log.find((l) => l.step === "admin-blocked");
const dbRow = log.find((l) => l.step === "db");
const banned = log.find((l) => l.step === "banned-login");

const ok =
  reg?.onLogin === true &&
  login?.signedIn === true &&
  dbRow?.found === true &&
  dbRow?.role === "user" &&
  dbRow?.status === "active" &&
  // 普通用户打开 /admin 会被踢回首页（middleware 判角色）
  (blocked?.status === 307 || blocked?.status === 403 || !blocked?.url?.startsWith("/admin")) &&
  banned?.stillOnLogin === true;

if (!ok) {
  console.error("✗ 注册链路断言失败");
  process.exit(1);
}
console.log("✓ 注册链路通过（注册 → 登录 → 后台拦截 → 封禁后无法登录）");
