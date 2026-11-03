import { chromium } from "playwright-core";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://127.0.0.1:3100";

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 780 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill("admin@xiaomo.local");
await page.getByPlaceholder("至少 8 位").fill("xiaomo2026");
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.screenshot({ path: ".shots/admin-authed.png" });

console.log("saved .shots/admin-authed.png", page.url());
await browser.close();
