import { chromium } from "playwright-core";
const pages = ["/admin","/admin/resources","/admin/resources/new","/admin/taxonomy","/admin/submissions","/admin/reports","/admin/users","/admin/import"];
const b = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
const ctx = await b.newContext();
const p = await ctx.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", e => errors.push(`pageerror: ${e.message.slice(0,120)}`));
p.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0,140)}`); });

await p.goto("http://127.0.0.1:3100/admin-login", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1000);
await p.locator('input[type="email"]').fill("admin@xiaomo.local");
await p.locator('input[type="password"]').fill("xiaomo2026");
await p.getByRole("button", { name: /登录/ }).first().click();
await p.waitForTimeout(2500);
console.log("登录后:", p.url());

for (const path of pages) {
  errors.length = 0;
  const res = await p.goto("http://127.0.0.1:3100" + path, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(800);
  const t = await p.locator("body").textContent();
  console.log(`${path} → ${res?.status()} | 错误 ${errors.length} | 含「Application error」${t.includes("Application error")}`);
  for (const e of errors.slice(0,2)) console.log("    " + e);
}
await b.close();
