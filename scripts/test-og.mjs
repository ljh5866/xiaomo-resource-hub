/**
 * 分享图验收：接口产出 1200×630 PNG + 页面里有 og:image
 * 用法：node scripts/test-og.mjs
 */
import sharp from "sharp";
import { BASE } from "./lib/browser.mjs";

const log = [];

/* 1. 接口直接出图 */
{
  const url = `${BASE}/api/og?title=${encodeURIComponent(
    "Excel 数据看板模板合集",
  )}&sub=${encodeURIComponent("12 套经营分析看板")}&tag=${encodeURIComponent("模板文档 · XM-2026-0001")}`;

  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();

  log.push({
    step: "api",
    status: res.status,
    type: res.headers.get("content-type"),
    cache: (res.headers.get("cache-control") ?? "").slice(0, 40),
    width: meta.width,
    height: meta.height,
    bytes: buf.byteLength,
  });
}

/* 2. 页面 meta 里有 og:image */
for (const path of ["/", "/c/template", "/t/excel"]) {
  const html = await (await fetch(BASE + path)).text();
  const m = html.match(/<meta property="og:image" content="([^"]+)"/);
  const tw = html.match(/<meta name="twitter:card" content="([^"]+)"/);
  log.push({
    step: `meta:${path}`,
    hasOgImage: Boolean(m),
    hasTwitter: tw?.[1] ?? null,
    pointsToApi: m ? m[1].includes("/api/og") : false,
  });
}

console.log(JSON.stringify(log, null, 2));

const api = log.find((l) => l.step === "api");
const metas = log.filter((l) => l.step.startsWith("meta:"));

const ok =
  api?.status === 200 &&
  api?.type === "image/png" &&
  api?.width === 1200 &&
  api?.height === 630 &&
  api?.bytes > 5000 &&
  metas.every((m) => m.hasOgImage === true && m.hasTwitter === "summary_large_image");

if (!ok) {
  console.error("✗ 分享图断言失败");
  process.exit(1);
}
console.log("✓ 分享图通过（1200×630 PNG + 三个页面都有 og:image / twitter:card）");
