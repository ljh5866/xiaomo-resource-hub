import { execSync } from "node:child_process";
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);

let r = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
console.log("before:", r?.status(), page.url().replace(BASE, ""));

execSync(`pnpm user:revoke ${CREDENTIALS.email}`, { stdio: "pipe" });

r = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
const body = (await page.locator("body").textContent())?.slice(0, 80).replace(/\s+/g, " ");
console.log("after:", r?.status(), page.url().replace(BASE, ""), "| body:", body);

await browser.close();
