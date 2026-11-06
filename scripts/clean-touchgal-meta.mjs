/**
 * 清洗 TouchGal 详情补丁里的占位文本，并统计覆盖率。
 *
 *   node --import tsx scripts/clean-touchgal-meta.mjs --dry
 *   node --import tsx scripts/clean-touchgal-meta.mjs
 *
 * 站点在缺字段时会输出「这个 Galgame 本体暂未添加所属会社信息」这类占位句，
 * 抓下来会变成假会社名，这里统一剔除。同时重写 data/import/touchgal-meta.json。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DB = "./data/app.db";
const PATCH = "./data/import/touchgal-meta.json";
const dry = process.argv.includes("--dry");

const BAD = /暂未|暂无|未添加|未知|待补充|敬请期待|没有找到|undefined|null/i;

const db = new DatabaseSync(DB);
const rows = db
  .prepare(`SELECT id, slug, meta_json FROM resources WHERE meta_json IS NOT NULL AND meta_json <> ''`)
  .all();

const upd = db.prepare(`UPDATE resources SET meta_json = ? WHERE id = ?`);
let cleaned = 0;
const stats = { total: 0, company: 0, release: 0, aliases: 0, aliasSum: 0, platform: 0, lang: 0, official: 0 };

for (const row of rows) {
  stats.total += 1;
  let meta;
  try {
    meta = JSON.parse(row.meta_json);
  } catch {
    continue;
  }

  let touched = false;
  if (meta.company && BAD.test(meta.company)) {
    delete meta.company;
    touched = true;
  }
  if (Array.isArray(meta.aliases)) {
    const good = meta.aliases.filter((a) => typeof a === "string" && a.trim() && !BAD.test(a));
    if (good.length !== meta.aliases.length) touched = true;
    if (good.length) meta.aliases = good;
    else delete meta.aliases;
  }
  for (const key of ["originalTitle", "releaseDate", "officialUrl", "vndb", "bangumi"]) {
    if (typeof meta[key] === "string" && BAD.test(meta[key])) {
      delete meta[key];
      touched = true;
    }
  }

  if (meta.company) stats.company += 1;
  if (meta.releaseDate) stats.release += 1;
  if (meta.aliases?.length) {
    stats.aliases += 1;
    stats.aliasSum += meta.aliases.length;
  }
  if (meta.platforms?.length) stats.platform += 1;
  if (meta.languages?.length) stats.lang += 1;
  if (meta.officialUrl) stats.official += 1;

  if (touched) {
    cleaned += 1;
    if (!dry) upd.run(JSON.stringify(meta), row.id);
  }
}

console.log(`记录 ${stats.total} 条 · 清洗 ${cleaned} 条${dry ? "（dry-run）" : ""}`);
console.log(
  `会社 ${stats.company} · 发售 ${stats.release} · 有别名 ${stats.aliases}（平均 ${(stats.aliasSum / Math.max(stats.aliases, 1)).toFixed(1)} 个） · 平台 ${stats.platform} · 语言 ${stats.lang} · 官网 ${stats.official}`,
);

// 重写补丁文件，保持与库一致
if (!dry && existsSync(PATCH)) {
  const old = JSON.parse(readFileSync(PATCH, "utf8"));
  const bySlug = new Map(old.map((x) => [x.slug, x]));
  const fresh = db
    .prepare(
      `SELECT slug, meta_json, summary, content_md FROM resources
       WHERE meta_json IS NOT NULL AND meta_json <> ''`,
    )
    .all()
    .map((r) => {
      const prev = bySlug.get(r.slug);
      return {
        slug: r.slug,
        meta: JSON.parse(r.meta_json),
        summary: r.summary,
        contentMd: r.content_md ?? prev?.contentMd ?? null,
      };
    });
  writeFileSync(PATCH, JSON.stringify(fresh, null, 2), "utf8");
  console.log(`补丁文件已重写：${fresh.length} 条 → ${PATCH}`);
}
