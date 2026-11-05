import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(2500);

await page.goto(`${BASE}/admin/imports`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "填入示例" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: ".shots/admin-imports.png" });

console.log("saved admin-imports.png");
await browser.close();
