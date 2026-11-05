/**
 * 结构化数据验收：抓页面 HTML，解析所有 application/ld+json，校验必填字段。
 * 用法：node scripts/test-seo.mjs
 */
import { BASE } from "./lib/browser.mjs";

const BODY_TYPES = ["SoftwareApplication", "CreativeWork", "Course", "Book"];

const PAGES = [
  { name: "home", path: "/", expect: ["WebSite"] },
  { name: "category", path: "/c/games", expect: ["CollectionPage", "BreadcrumbList"] },
  {
    name: "detail",
    path: "/r/excel-dashboard-pack",
    expect: ["BreadcrumbList"],
    requireBody: true, // 具体类型取决于 kind（software / template / course…）
  },
  { name: "tag", path: "/t/excel", expect: ["CollectionPage", "BreadcrumbList"] },
];

const log = [];

for (const p of PAGES) {
  const res = await fetch(BASE + p.path);
  const html = await res.text();

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );

  const parsed = [];
  let parseError = null;
  for (const raw of blocks) {
    try {
      parsed.push(JSON.parse(raw));
    } catch (err) {
      parseError = String(err.message);
    }
  }

  const types = parsed.map((d) => d["@type"]);
  const missing = p.expect.filter((t) => !types.includes(t));
  if (p.requireBody && !types.some((t) => BODY_TYPES.includes(t))) {
    missing.push(`正文类型之一（${BODY_TYPES.join(" / ")}）`);
  }

  // 关键字段检查
  const problems = [];
  for (const d of parsed) {
    if (d["@type"] === "WebSite" && !d.potentialAction?.target?.urlTemplate) {
      problems.push("WebSite 缺 SearchAction");
    }
    if (d["@type"] === "BreadcrumbList") {
      const els = d.itemListElement ?? [];
      if (els.length < 2) problems.push("面包屑少于 2 级");
      els.forEach((e, i) => {
        if (e.position !== i + 1) problems.push(`面包屑 position 错位 at ${i}`);
        if (!/^https?:\/\//.test(e.item ?? "")) problems.push("面包屑 item 不是绝对地址");
      });
    }
    if (["SoftwareApplication", "CreativeWork", "Course", "Book"].includes(d["@type"])) {
      if (!d.name) problems.push("详情页缺 name");
      if (!d.identifier) problems.push("详情页缺 identifier");
      if (!/^https?:\/\//.test(d.url ?? "")) problems.push("详情页 url 不是绝对地址");
      if (d.aggregateRating) problems.push("出现了不该有的 aggregateRating");
    }
    if (d["@type"] === "CollectionPage") {
      const n = d.mainEntity?.numberOfItems;
      if (typeof n !== "number") problems.push("CollectionPage 缺 numberOfItems");
    }
  }

  log.push({
    page: p.name,
    blocks: blocks.length,
    types,
    missing,
    problems,
    parseError,
  });
}

console.log(JSON.stringify(log, null, 2));

const bad = log.filter(
  (l) => l.missing.length || l.problems.length || l.parseError || l.blocks === 0,
);
if (bad.length) {
  console.error("✗ 结构化数据校验失败");
  process.exit(1);
}
console.log("✓ 结构化数据通过（WebSite/CollectionPage/详情页 + 面包屑，字段齐全）");
