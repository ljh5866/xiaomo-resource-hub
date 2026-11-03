import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);

await page.goto(`${BASE}/admin/resources?q=Excel`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.screenshot({ path: ".shots/admin-search.png" });

await page.goto(`${BASE}/admin/taxonomy`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.screenshot({ path: ".shots/admin-taxonomy.png" });

await page.goto(`${BASE}/admin/links`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.screenshot({ path: ".shots/admin-links.png" });

console.log("saved admin-search / admin-taxonomy / admin-links");
await browser.close();
