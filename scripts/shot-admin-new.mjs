import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

// 注册页
await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.screenshot({ path: ".shots/admin-register.png" });

// 后台（登录后）
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').fill(CREDENTIALS.email);
await page.locator('input[type="password"]').fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.screenshot({ path: ".shots/admin-dashboard-new.png" });

await page.goto(`${BASE}/admin/users`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.screenshot({ path: ".shots/admin-users.png" });

console.log("saved admin-register / admin-dashboard-new / admin-users");
await browser.close();
