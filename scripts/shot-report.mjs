import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/* 详情页举报弹窗 */
await page.goto(`${BASE}/r/excel-dashboard-pack`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: /举报/ }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: ".shots/report-dialog.png" });

/* 后台举报列表 */
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(2500);
await page.goto(`${BASE}/admin/reports`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.screenshot({ path: ".shots/admin-reports.png" });

console.log("saved report-dialog.png / admin-reports.png");
await browser.close();
