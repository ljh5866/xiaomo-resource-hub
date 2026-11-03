import { chromium } from "playwright-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://127.0.0.1:3100";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill("admin@xiaomo.local");
await page.getByPlaceholder("至少 8 位").fill("xiaomo2026");
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2000);

const before = (await ctx.cookies()).map((c) => `${c.name}@${c.domain}`);
console.log("before:", before);

const res = await ctx.request.post(`${BASE}/api/logout`, { maxRedirects: 0 });
console.log("logout status:", res.status(), "set-cookie:", res.headers()["set-cookie"]?.slice(0, 120));

await page.waitForTimeout(500);
const after = (await ctx.cookies()).map((c) => `${c.name}@${c.domain}`);
console.log("after:", after);

const check = await ctx.request.get(`${BASE}/admin`, { maxRedirects: 0 });
console.log("admin status after logout:", check.status(), check.headers()["location"] ?? "");

await browser.close();
