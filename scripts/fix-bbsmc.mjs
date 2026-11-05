/**
 * 修补 BBSMC 导入留下的空字段
 *
 *   node --import tsx scripts/fix-bbsmc.mjs --dry
 *   node --import tsx scripts/fix-bbsmc.mjs
 *
 * 处理两类：
 *   1. 简介为空（有些项目的 body 是空的，得用 description 或搜索接口的 summary）
 *   2. 没有封面（当时图标下载失败，重试一次）
 */
import { DatabaseSync } from "node:sqlite";

process.env.NODE_ENV ??= "production";
const { processCover } = await import("../src/lib/storage.ts");

const API = "https://api.bbsmc.net/v2";
const UA = "xiaomo-resource-hub/1.0 (fix script)";
const dry = process.argv.includes("--dry");

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

function stripMarkdown(md) {
  return (md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const rows = db
  .prepare(
    `SELECT id, code, title, summary, cover_url, source_url, version, platforms, category_id
       FROM resources
      WHERE (summary IS NULL OR summary = '' OR cover_url IS NULL)`,
  )
  .all();

console.log(`\n需要修补：${rows.length} 条`);

let fixedSummary = 0;
let fixedCover = 0;
let failed = 0;

for (const [i, r] of rows.entries()) {
  const slug = (r.source_url ?? "").includes("bbsmc.net/modpack/")
    ? r.source_url.split("/modpack/")[1]?.split(/[/?#]/)[0]
    : null;

  let p = {};
  if (slug) {
    const res = await fetch(`${API}/project/${slug}`, { headers: { "user-agent": UA } });
    if (res.ok) p = await res.json();
  }

  // 2) API 也没有简介时，用元数据合成一句话，别让详情页空着
  if ((!r.summary || r.summary === "") && !dry) {
    const fromApi = stripMarkdown(p.body || p.description || "");
    if (fromApi) {
      db.prepare("UPDATE resources SET summary = ? WHERE id = ?").run(fromApi.slice(0, 220), r.id);
      fixedSummary++;
    } else {
      const platforms = (() => {
        try {
          return (JSON.parse(r.platforms ?? "[]") || []).join("/");
        } catch {
          return "";
        }
      })();
      const bits = [
        `${r.title} 是一款 Minecraft 整合包`,
        r.version ? `，适用于 ${r.version}` : "",
        platforms ? `，运行平台 ${platforms}` : "",
        "，站内提供网盘下载与版本信息。",
      ];
      db.prepare("UPDATE resources SET summary = ? WHERE id = ?").run(bits.join(""), r.id);
      fixedSummary++;
    }
  }

  if ((!r.summary || r.summary === "") && !dry) {
    const text = stripMarkdown(p.body || p.description || "");
    if (text) {
      db.prepare("UPDATE resources SET summary = ? WHERE id = ?").run(text.slice(0, 220), r.id);
      fixedSummary++;
    }
  }

  if (!r.cover_url && p.icon_url && !dry) {
    try {
      const img = await fetch(p.icon_url, { headers: { "user-agent": UA } });
      if (img.ok) {
        const buf = Buffer.from(await img.arrayBuffer());
        const stored = await processCover(buf, "image/png");
        db.prepare("UPDATE resources SET cover_url = ?, cover_blur = ? WHERE id = ?").run(
          stored.url,
          stored.blur,
          r.id,
        );
        fixedCover++;
      }
    } catch {
      /* 还是拿不到就留着占位 */
    }
  }

  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${rows.length} …`);
  await new Promise((s) => setTimeout(s, 120));
}

db.close();
console.log(
  `\n${dry ? "（预演）" : ""}补简介 ${fixedSummary} 条 · 补封面 ${fixedCover} 条 · 失败 ${failed} 条`,
);
