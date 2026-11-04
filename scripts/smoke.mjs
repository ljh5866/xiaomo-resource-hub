/**
 * 部署后冒烟检查：首页 / 静态资源 / 健康检查 / 后台拦截
 *   node scripts/smoke.mjs            # 默认打本地 3100
 *   BASE_URL=https://ttals.com node scripts/smoke.mjs
 *
 * 为什么需要它：光看首页 200 不够——曾经出现过 HTML 正常但 CSS chunk 500，
 * 浏览器拿不到新样式，表现就是「改了却没生效」。
 */
const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");

const results = [];

async function check(name, url, expect) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = expect.includes(res.status);
    results.push({ name, status: res.status, ok });
    return res;
  } catch (e) {
    results.push({ name, status: 0, ok: false, error: String(e.message).slice(0, 80) });
    return null;
  }
}

const home = await check("首页", `${BASE}/`, [200]);

// 静态资源：CSS / JS 必须能取到，否则页面等于没换样式
if (home?.ok) {
  const html = await home.text();

  const css = html.match(/\/_next\/static\/[^"]+\.css/)?.[0];
  if (css) await check("CSS", BASE + css, [200]);

  const js = html.match(/\/_next\/static\/[^"]+\.js/)?.[0];
  if (js) await check("JS", BASE + js, [200]);

  // 新版浅色主题的标记（换主题时记得同步这里）
  const hasLightTheme = /编号归档/.test(html);
  results.push({ name: "新版文案", status: hasLightTheme ? 1 : 0, ok: hasLightTheme });

  const stillOld = /目录编号制/.test(html);
  results.push({ name: "旧版残留", status: stillOld ? 1 : 0, ok: !stillOld });
}

await check("健康检查", `${BASE}/api/health`, [200]);
await check("后台拦截", `${BASE}/admin`, [307, 302]);

for (const r of results) {
  const mark = r.ok ? "✓" : "✗";
  console.log(`${mark} ${r.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n✗ 冒烟检查失败 ${failed.length} 项`);
  process.exit(1);
}
console.log("\n✓ 冒烟检查通过（页面 / 静态资源 / 健康检查 / 鉴权拦截）");
