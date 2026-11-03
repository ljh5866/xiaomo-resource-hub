import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const t0 = Date.now();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录" }).click();
await page.waitForTimeout(2500);

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

console.log(
  JSON.stringify(
    {
      账号: CREDENTIALS.email,
      最终地址: page.url().replace(BASE, ""),
      登录耗时ms: Date.now() - t0,
      是否进了后台: page.url().includes("/admin"),
    },
    null,
    2,
  ),
);

await page.screenshot({ path: ".shots/login-ok-admin.png" });
await browser.close();
