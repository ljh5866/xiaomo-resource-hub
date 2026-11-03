import { chromium } from "playwright-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://127.0.0.1:3100";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("response", (r) => {
  const u = r.url();
  if (u.includes("/api/logout")) {
    console.log("logout response:", r.status(), JSON.stringify(r.headers()["set-cookie"] ?? "").slice(0, 160));
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill("admin@xiaomo.local");
await page.getByPlaceholder("至少 8 位").fill("xiaomo2026");
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2000);

console.log("before:", (await ctx.cookies()).map((c) => c.name));

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

const link = page.getByRole("link", { name: /退出/ }).first();
console.log("logout link count:", await page.getByRole("link", { name: /退出/ }).count());
console.log("href:", await link.getAttribute("href"));

await link.click();
await page.waitForTimeout(2500);

console.log("after click url:", page.url());
console.log("after:", (await ctx.cookies()).map((c) => c.name));

await browser.close();
