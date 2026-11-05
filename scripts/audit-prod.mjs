/**
 * 线上功能自检（只读，不写数据）
 *   node scripts/audit-prod.mjs
 *
 * 覆盖：前台页面 / 机器可读端点 / 静态资源 / 404 行为 /
 *       后台登录与各页面渲染 / 主域跳子域 / 注册页
 */
import { chromium } from "playwright-core";

const FRONT = (process.env.FRONT ?? "https://ttals.com").replace(/\/$/, "");
const ADMIN = (process.env.ADMIN ?? "https://admin.ttals.com").replace(/\/$/, "");
const EMAIL = process.env.AUDIT_EMAIL ?? "";
const PASSWORD = process.env.AUDIT_PASS ?? "";

const rows = [];
const add = (area, name, ok, detail = "") => rows.push({ area, name, ok, detail });

if (!EMAIL || !PASSWORD) {
  console.error(
    "需要后台账号：AUDIT_EMAIL=... AUDIT_PASS=... node scripts/audit-prod.mjs（凭据不写进仓库）",
  );
  process.exit(2);
}

async function status(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return { status: res.status, location: res.headers.get("location"), res };
  } catch (e) {
    return { status: 0, error: String(e.message).slice(0, 60) };
  }
}

/* ───────── 前台页面 ───────── */
const frontPages = [
  ["首页", "/", 200],
  ["分类-软件", "/c/software", 200],
  ["分类-游戏", "/c/games", 200],
  ["分类-MOD", "/c/mods", 200],
  ["分类-开源", "/c/opensource", 200],
  ["标签页", "/t/windows", 200],
  ["每日更新", "/updates", 200],
  ["搜索", "/search?q=test", 200],
  ["登录", "/login", 200],
  ["注册", "/register", 200],
  ["投稿", "/submit", 200],
  ["关于", "/about", 200],
  ["收藏（未登录）", "/favorites", 200],
];

for (const [name, path, expect] of frontPages) {
  const r = await status(FRONT + path);
  add("前台", name, r.status === expect, `${r.status}`);
}

/* ───────── 机器可读 ───────── */
for (const [name, path] of [
  ["sitemap.xml", "/sitemap.xml"],
  ["robots.txt", "/robots.txt"],
  ["rss.xml", "/rss.xml"],
  ["health", "/api/health"],
  ["OG 图", "/api/og?title=自检&sub=audit"],
]) {
  const r = await status(FRONT + path);
  const type = r.res?.headers.get("content-type") ?? "";
  add("端点", name, r.status === 200, `${r.status} ${type.split(";")[0]}`);
}

/* ───────── 404 行为 ───────── */
for (const [name, path] of [
  ["不存在的资源", "/r/definitely-not-a-slug"],
  ["不存在的标签", "/t/no-such-tag"],
  ["不存在的分类", "/c/no-such-category"],
]) {
  const r = await status(FRONT + path);
  add("404", name, r.status === 404, `${r.status}`);
}

/* ───────── 静态资源 ───────── */
{
  const home = await status(FRONT + "/");
  const html = await home.res?.text();
  const css = html?.match(/\/_next\/static\/[^"]+\.css/)?.[0];
  const js = html?.match(/\/_next\/static\/[^"]+\.js/)?.[0];
  if (css) {
    const r = await status(FRONT + css);
    add("资源", "CSS chunk", r.status === 200, `${r.status}`);
  }
  if (js) {
    const r = await status(FRONT + js);
    add("资源", "JS chunk", r.status === 200, `${r.status}`);
  }
  add("资源", "浅色主题生效", Boolean(html?.includes("编号归档")), "含「编号归档」");
  add("资源", "旧版文案已清", !html?.includes("目录编号制"), "无「目录编号制」");
}

/* ───────── 主域 → 子域（只有真分了子域才检） ───────── */
if (ADMIN !== FRONT) {
  const r = await status(FRONT + "/admin");
  const loc = r.location ?? "";
  add("路由", "主域 /admin 跳子域", loc.startsWith(ADMIN), `${r.status} → ${loc}`);
} else {
  add("路由", "主域 /admin 跳子域", true, "本地未分子域，跳过");
}

/* ───────── 后台（登录后逐页） ───────── */
// 线上：后台在子域根路径；本地：没有子域，后台在 /admin 下
const LOCAL_MODE = ADMIN === FRONT;
const adminUrl = (path) => (LOCAL_MODE ? `${FRONT}/admin${path === "/" ? "" : path}` : `${ADMIN}${path}`);
const loginUrl = LOCAL_MODE ? `${FRONT}/login` : `${ADMIN}/login`;

const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_PATH ??
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1500); // 等 React 水合，否则可能触发表单原生提交
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(3000);

const loggedIn = !page.url().includes("/login");
add("后台", "登录", loggedIn, page.url().replace(FRONT, "") || "/");

if (loggedIn) {
  const adminPages = [
    ["概览", "/", "概览"],
    ["资源列表", "/resources", "资源"],
    ["分类与标签", "/taxonomy", "分类"],
    ["投稿", "/submissions", "投稿"],
    ["举报", "/reports", "举报"],
    ["链接巡检", "/links", "巡检"],
    ["批量导入", "/imports", "导入"],
    ["用户", "/users", "用户"],
  ];

  for (const [name, path, keyword] of adminPages) {
    const res = await page.goto(adminUrl(path), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const text = (await page.locator("body").textContent()) ?? "";
    const errored = /Application error|Internal Server Error|500/.test(text);
    const matched = text.includes(keyword);
    add("后台", name, res?.status() === 200 && !errored && matched, `${res?.status()} ${errored ? "有错误页" : ""}`);
  }

  // 前台收藏页（已登录）
  const fav = await page.goto(`${FRONT}/favorites`, { waitUntil: "domcontentloaded" });
  const favText = (await page.locator("body").textContent()) ?? "";
  add("前台", "收藏页（已登录）", fav?.status() === 200 && !/Application error/.test(favText), `${fav?.status()}`);
}

await browser.close();

/* ───────── 输出 ───────── */
const pass = rows.filter((r) => r.ok).length;
const fail = rows.filter((r) => !r.ok);

console.log(`\n线上自检 ${FRONT} / ${ADMIN}\n`);
for (const r of rows) {
  const mark = r.ok ? "✓" : "✗";
  console.log(`${mark} [${r.area}] ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
}

console.log(`\n合计 ${rows.length} 项：通过 ${pass}，失败 ${fail.length}`);
if (fail.length) {
  console.error("失败项：" + fail.map((f) => `${f.area}/${f.name}`).join("、"));
  process.exit(1);
}
console.log("✓ 线上自检全部通过");
