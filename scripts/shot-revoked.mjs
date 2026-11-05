import { execSync } from "node:child_process";
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(2500);

execSync(`pnpm user:revoke ${CREDENTIALS.email}`, { stdio: "pipe" });

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await page.screenshot({ path: ".shots/session-revoked.png" });
console.log("saved .shots/session-revoked.png");

await browser.close();
