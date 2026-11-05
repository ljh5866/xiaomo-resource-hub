/**
 * 抓取 MC百科（mcmod.cn）整合包 / 模组页面信息
 *
 *   node scripts/fetch-mcmod.mjs https://www.mcmod.cn/modpack/837.html
 *   node scripts/fetch-mcmod.mjs URL1 URL2 --json > out.json
 *
 * 输出：中英文名、类型、支持版本、分类、标签、简介、相关链接（解码真实地址）、封面
 *
 * 说明：
 *   - 只抓公开页面，默认每次间隔 1.2 秒；
 *   - 相关链接是 link.mcmod.cn/target/<base64> 跳板，这里解出真实 URL；
 *   - 简介取「整合包介绍」文本框里的段落，剔掉图片占位与小标题。
 */
import { setTimeout as sleep } from "node:timers/promises";
import { providerOf } from "../src/lib/providers.ts";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const urls = args.filter((a) => /^https?:\/\//.test(a));

if (!urls.length) {
  console.error("用法: node scripts/fetch-mcmod.mjs <url> [url...] [--json]");
  process.exit(1);
}

function decodeEntities(s) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<svg[\s\S]*?<\/svg>/g, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function infoValue(html, label) {
  const re = new RegExp(`${label}\\s*[:：]\\s*([^<\\n]+)`, "i");
  const m = html.match(re);
  return m ? stripTags(m[1]) : null;
}

/* ───────── 解析 ───────── */

function parsePage(url, html) {
  const kind = url.includes("/modpack/") ? "modpack" : "mod";

  const titleRaw = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
  const title = decodeEntities(titleRaw.replace(/\s*-\s*MC百科.*$/, "").trim());
  const nameMatch = title.match(/^(?:\[[^\]]+\]\s*)?(.+?)\s*\(([^)]+)\)\s*$/);
  const nameCn = (nameMatch?.[1] ?? title).trim();
  const nameEn = (nameMatch?.[2] ?? "").trim();

  /* 封面 */
  const cover =
    html.match(/i\.mcmod\.cn\/modpack\/cover\/[^"'\s]+?\.(?:jpg|png|webp)/i)?.[0] ??
    html.match(/i\.mcmod\.cn\/class\/cover\/[^"'\s]+?\.(?:jpg|png|webp)/i)?.[0] ??
    null;

  /* 分类与标签 */
  const categories = [
    ...html.matchAll(new RegExp(`/modpack/category/\\d+-\\d+\\.html"[^>]*>([^<]+)</a>`, "g")),
  ].map((m) => stripTags(m[1]));
  const tags = [
    ...new Set([...html.matchAll(/\/s\?key=([^&"]+)&mold=1/g)].map((m) => decodeURIComponent(m[1]))),
  ];

  /* 支持版本：只看 platform-block 区块，别把导航栏的版本链接算进来 */
  const platformBlocks = [...html.matchAll(/<div class="platform-block">([\s\S]*?)<\/div><\/li>/g)].map(
    (m) => m[1],
  );
  const versions = [];
  const loaders = [];
  for (const block of platformBlocks) {
    const loader = stripTags(block.split("<span")[0]).replace(/\(.*?\)|:/g, "").trim();
    if (loader && !loaders.includes(loader)) loaders.push(loader);
    for (const m of block.matchAll(/mcver=([0-9.]+)/g)) {
      if (!versions.includes(m[1])) versions.push(m[1]);
    }
  }

  /* 相关链接：锚点里是跳板，名字在同 li 的 span.name */
  const links = [];
  for (const m of html.matchAll(
    /<a[^>]+href="\/\/link\.mcmod\.cn\/target\/([A-Za-z0-9+/=]+)"[\s\S]{0,400}?class="name">([^<]+)<\/span>/g,
  )) {
    let real = null;
    try {
      real = Buffer.from(m[1], "base64").toString("utf8");
    } catch {
      /* 忽略坏链接 */
    }
    const label = stripTags(m[2]);
    if (!real || links.some((l) => l.url === real)) continue;
    // 只保留网盘链接：官方站 / B站 / 论坛 一律丢掉
    const provider = providerOf(real);
    if (!provider) continue;
    links.push({ label, url: real, provider });
  }

  /* 简介：取 text-area 文本框，按 <p> 切段 */
  const textArea =
    html.match(/class="text-area common-text[^"]*"[^>]*>([\s\S]*?)<\/li>/)?.[1] ?? "";
  const paragraphs = textArea
    .split(/<\/p>/)
    .map((chunk) => stripTags(chunk))
    .map((t) => t.replace(/^(前言|内容简介|整合包介绍|配置要求|条款声明|图片展示)\s*/, "").trim())
    .filter((t) => t.length >= 25 && !t.includes("loading-colourful"));

  const description = paragraphs[0] ?? "";
  const intro = paragraphs.slice(0, 4);

  return {
    source: url,
    kind,
    title,
    nameCn,
    nameEn,
    cover,
    categories: [...new Set(categories)],
    tags,
    versions,
    loaders,
    packType: infoValue(html, "整合包类型"),
    packageBy: infoValue(html, "打包方式"),
    lastEdit: infoValue(html, "最后编辑"),
    description,
    intro,
    links,
  };
}

/* ───────── 主流程 ───────── */

const results = [];
for (const url of urls) {
  process.stderr.write(`→ ${url}\n`);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "zh-CN,zh;q=0.9" },
    });
    if (!res.ok) {
      results.push({ source: url, error: `HTTP ${res.status}` });
      continue;
    }
    results.push(parsePage(url, await res.text()));
  } catch (e) {
    results.push({ source: url, error: String(e.message).slice(0, 80) });
  }
  await sleep(1200);
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    if (r.error) {
      console.log(`✗ ${r.source} — ${r.error}`);
      continue;
    }
    console.log(`\n${r.title}`);
    console.log(`  中文名: ${r.nameCn}  |  英文名: ${r.nameEn || "—"}`);
    console.log(`  类型: ${[r.packType, r.loaders.join("/"), r.packageBy].filter(Boolean).join(" · ") || "—"}`);
    console.log(`  版本: ${r.versions.join(", ") || "—"}`);
    console.log(`  分类: ${r.categories.join(", ") || "—"}`);
    console.log(`  标签: ${r.tags.join(", ") || "—"}`);
    console.log(`  封面: ${r.cover ?? "—"}`);
    console.log(`  简介: ${r.description ? r.description.slice(0, 140) + (r.description.length > 140 ? "…" : "") : "—"}`);
    if (r.links.length) {
      console.log(`  链接:`);
      for (const l of r.links) console.log(`    [${l.label}] ${l.url}`);
    }
  }
}
