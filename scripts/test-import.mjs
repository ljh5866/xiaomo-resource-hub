/**
 * 内容流水线验收：链接清单 → CSV → 后台导入 → 前台可见
 * 用法：node scripts/test-import.mjs
 */
import fs from "node:fs";
import { execSync } from "node:child_process";
import { BASE, CREDENTIALS, launch } from "./lib/browser.mjs";

const stamp = Date.now().toString(36);
const linksFile = `data/import/links-${stamp}.txt`;
const csvFile = `data/import/batch-${stamp}.csv`;
const log = [];

fs.mkdirSync("data/import", { recursive: true });
fs.writeFileSync(
  linksFile,
  [
    "# 每行一个链接，可在链接前写标题",
    `流水线测试 A ${stamp} https://pan.quark.cn/s/E2E-${stamp}-a`,
    `https://pan.baidu.com/s/E2E-${stamp}-b`,
  ].join("\n"),
  "utf8",
);

/* 1. 生成 CSV */
try {
  execSync(
    `node node_modules/tsx/dist/cli.mjs src/scripts/make-csv.ts ${linksFile} --cat template --out ${csvFile}`,
    { stdio: "pipe", encoding: "utf8" },
  );
} catch (e) {
  log.push({ step: "generate", error: String(e.message).slice(0, 200) });
}

if (fs.existsSync(csvFile)) {
  const csv = fs.readFileSync(csvFile, "utf8").replace(/^\ufeff/, "");
  const rows = csv.split(/\r?\n/).filter(Boolean);
  log.push({
    step: "generate",
    rows: rows.length,
    header: rows[0],
    hasQuark: csv.includes(",quark,"),
    hasBaidu: csv.includes(",baidu,"),
    inlineTitleKept: csv.includes(`流水线测试 A ${stamp}`),
    fallbackTitle: /待补标题 \d/.test(csv),
  });
} else {
  log.push({ step: "generate", rows: 0, missing: true });
}

/* 2. 后台导入 */
const csvText = fs.existsSync(csvFile)
  ? fs.readFileSync(csvFile, "utf8").replace(/^\ufeff/, "")
  : "";

const browser = await launch({});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByPlaceholder("you@example.com").fill(CREDENTIALS.email);
await page.getByPlaceholder("至少 8 位").fill(CREDENTIALS.password);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(2500);

await page.goto(`${BASE}/admin/imports`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);

const hasTemplateLink = (await page.getByRole("link", { name: /下载 CSV 模板/ }).count()) > 0;

await page.locator("textarea").fill(csvText);
await page.getByRole("button", { name: "开始导入" }).click();
await page.waitForTimeout(2500);

const body = (await page.locator("body").textContent()) ?? "";
const m = body.match(/新增\s*(\d+)[，,]\s*跳过\s*(\d+)/);

log.push({
  step: "import",
  hasTemplateLink,
  inserted: m ? Number(m[1]) : null,
  skipped: m ? Number(m[2]) : null,
});

/* 3. 前台可见 */
await page.goto(`${BASE}/admin/resources?q=${encodeURIComponent(stamp)}`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(600);
const listBody = (await page.locator("body").textContent()) ?? "";
const found = (listBody.match(new RegExp(stamp, "g")) ?? []).length;

log.push({ step: "front", foundInAdmin: found > 0 });

await browser.close();

/* 清理临时文件 */
for (const f of [linksFile, csvFile]) {
  try {
    fs.unlinkSync(f);
  } catch {
    /* ignore */
  }
}

console.log(JSON.stringify(log, null, 2));

const gen = log.find((l) => l.step === "generate");
const imp = log.find((l) => l.step === "import");
const front = log.find((l) => l.step === "front");

const ok =
  gen?.rows === 3 &&
  gen?.hasQuark === true &&
  gen?.hasBaidu === true &&
  gen?.inlineTitleKept === true &&
  imp?.hasTemplateLink === true &&
  imp?.inserted === 2 &&
  front?.foundInAdmin === true;

if (!ok) {
  console.error("✗ 导入流水线断言失败");
  process.exit(1);
}
console.log("✓ 导入流水线通过（链接清单 → CSV → 后台导入 2 条 → 后台可搜到）");
