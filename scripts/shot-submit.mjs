import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const browser = await launch({});

/* 投稿页 */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/submit`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: ".shots/submit.png" });

  /* 后台投稿列表 */
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
  await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/admin/submissions`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: ".shots/admin-submissions.png" });
  await page.close();
}

console.log("saved submit.png / admin-submissions.png");
await browser.close();
