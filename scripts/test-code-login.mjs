/**
 * 验证码登录验收：老用户（bcrypt）既能密码登录，也能免密登录
 *   node scripts/test-code-login.mjs
 */
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import { BASE, launch } from "./lib/browser.mjs";

const email = `code-${Date.now().toString(36)}@test.local`;
const oldPassword = "OldPass123";

/* 1. 造一个"从 Supabase 迁过来"的用户：bcrypt 哈希、没有本地密码体系 */
const db = new DatabaseSync("data/app.db");
db.prepare(
  `INSERT INTO users (email, name, role, password_hash, token_version, status)
   VALUES (?, '迁移用户', 'user', ?, 0, 'active')`,
).run(email, bcrypt.hashSync(oldPassword, 10));
db.close();

const browser = await launch({});
const log = [];

/* 2. 密码登录（走 bcrypt 兼容 + 自动升级） */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(oldPassword);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForTimeout(2800);
  log.push({ step: "password-login", ok: !page.url().includes("/login"), url: page.url().replace(BASE, "") });
  await ctx.close();
}

/* 3. 验证码登录（免密） */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "验证码登录" }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.getByRole("button", { name: /获取验证码/ }).click();
  await page.waitForTimeout(2000);

  const devLog = fs.existsSync("data/.dev-emails.log")
    ? fs.readFileSync("data/.dev-emails.log", "utf8")
    : "";
  const line = devLog
    .trim()
    .split("\n")
    .filter((l) => l.includes(email) && l.includes("login"))
    .pop();
  const code = line?.split("\t")[2]?.trim() ?? "";
  log.push({ step: "code-issued", found: code.length === 6 });

  await page.locator('input[autocomplete="one-time-code"]').fill(code);
  await page.getByRole("button", { name: "验证码登录", exact: true }).last().click();
  await page.waitForTimeout(2800);

  // 登录页上「验证码登录」既是切换按钮也是提交按钮，等待跳转
  log.push({ step: "code-login", ok: !page.url().includes("/login"), url: page.url().replace(BASE, "") });
  await ctx.close();
}

await browser.close();

/* 4. 密码登录后哈希应升级为 scrypt */
const db2 = new DatabaseSync("data/app.db");
const row = db2.prepare("SELECT substr(password_hash,1,7) AS p FROM users WHERE email = ?").get(email);
db2.prepare("DELETE FROM users WHERE email = ?").run(email);
db2.close();
log.push({ step: "rehash", prefix: row?.p, upgraded: row?.p === "scrypt$" });

console.log(JSON.stringify(log, null, 2));

const pwd = log.find((l) => l.step === "password-login");
const codeLogin = log.find((l) => l.step === "code-login");
const rehash = log.find((l) => l.step === "rehash");

if (!pwd?.ok || !codeLogin?.ok || !rehash?.upgraded) {
  console.error("✗ 双通道登录断言失败");
  process.exit(1);
}
console.log("✓ 双通道登录通过（bcrypt 密码登录 → 自动升级 scrypt；验证码免密登录）");
