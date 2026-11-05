/**
 * 把本地已导入的 TouchGal 数据打包成可上传的 zip
 *
 *   node --import tsx scripts/export-touchgal.mjs
 *
 * 产物：data/import/touchgal.zip
 *    rows.json       每条的字段（标题/简介/平台/源站/封面路径）
 *    covers/*.webp   对应封面文件
 *
 * 服务器上没有浏览器也能导入，见 scripts/import-rows-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join(process.cwd(), "data", "import", "touchgal");
const COVER_SRC = path.join(process.cwd(), "data", "uploads", "covers");

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT_DIR, "covers"), { recursive: true });

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const rows = db
  .prepare(
    `SELECT r.code, r.slug, r.title, r.subtitle, r.summary, r.content_md,
            r.platforms, r.language, r.source_url, r.cover_url, r.cover_blur,
            l.url,
            (SELECT GROUP_CONCAT(t.slug) FROM resource_tags rt JOIN tags t ON t.id = rt.tag_id
              WHERE rt.resource_id = r.id) AS tags
       FROM resources r
       JOIN resource_links l ON l.resource_id = r.id
      WHERE r.source_url LIKE 'https://www.touchgal.ink/%'
      ORDER BY r.id`,
  )
  .all();

db.close();

console.log(`导出 ${rows.length} 条`);

let copied = 0;
const out = [];

for (const r of rows) {
  let coverFile = null;
  if (r.cover_url?.startsWith("/files/covers/")) {
    const name = r.cover_url.split("/").pop().split("?")[0];
    const from = path.join(COVER_SRC, name);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(OUT_DIR, "covers", name));
      coverFile = name;
      copied++;
    }
  }
  out.push({
    code: r.code,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    summary: r.summary,
    contentMd: r.content_md,
    platforms: r.platforms,
    language: r.language,
    sourceUrl: r.source_url,
    linkUrl: r.url,
    coverFile,
    coverBlur: r.cover_blur,
    tags: (r.tags ?? "").split(",").filter(Boolean),
  });
}

fs.writeFileSync(path.join(OUT_DIR, "rows.json"), JSON.stringify(out, null, 1), "utf8");
console.log(`封面复制 ${copied} 张`);

// 打包（Windows 用 tar 的自带实现，Linux/mac 用 zip）
const zipPath = path.join(process.cwd(), "data", "import", "touchgal.zip");
fs.rmSync(zipPath, { force: true });
try {
  execFileSync("tar", ["-a", "-c", "-f", zipPath, "-C", OUT_DIR, "."], { stdio: "inherit" });
  console.log(`已打包：${zipPath}`);
} catch {
  console.log(`打包失败，可直接上传目录：${OUT_DIR}`);
}
