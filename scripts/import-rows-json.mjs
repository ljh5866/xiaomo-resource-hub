/**
 * 从导出的 JSON 导入资源（服务器端用，不需要浏览器）
 *
 *   node --import tsx scripts/import-rows-json.mjs data/import/touchgal
 *
 * 目录里应有：
 *   rows.json       导出的行
 *   covers/*.webp   对应封面（可选，缺了就走占位封面）
 *
 * 行为：
 *   - 已存在（同 linkUrl 或同 slug）跳过，幂等
 *   - 分类按 subtitle 判断：Galgame → games，其余 → mods
 *   - 标签按 slug 挂，缺失的标签会被跳过并提示
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, "rows.json"))) {
  console.error("用法: node --import tsx scripts/import-rows-json.mjs <目录>（目录里要有 rows.json）");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(path.join(dir, "rows.json"), "utf8"));
const coversDir = path.join(dir, "covers");
const uploadCovers = path.join(process.cwd(), "data", "uploads", "covers");
fs.mkdirSync(uploadCovers, { recursive: true });

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const gameCat = db.prepare("SELECT id FROM categories WHERE slug = 'games'").get();
const modCat = db.prepare("SELECT id FROM categories WHERE slug = 'mods'").get();

function nextCode() {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT code FROM resources WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
    .get(`XM-${year}-%`);
  const n = row ? Number(row.code.split("-")[2]) + 1 : 1;
  return `XM-${year}-${String(n).padStart(4, "0")}`;
}

let imported = 0;
let skipped = 0;
let covers = 0;

for (const r of rows) {
  const exists =
    db.prepare("SELECT id FROM resources WHERE slug = ? OR source_url = ? LIMIT 1").get(r.slug, r.sourceUrl);
  if (exists) {
    skipped++;
    continue;
  }

  // 封面：复制进 data/uploads/covers，并沿用原 URL
  let coverUrl = null;
  if (r.coverFile) {
    const from = path.join(coversDir, r.coverFile);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(uploadCovers, r.coverFile));
      coverUrl = `/files/covers/${r.coverFile}`;
      covers++;
    }
  }

  const catId = (r.subtitle ?? "").toLowerCase().includes("galgame") ? gameCat?.id : modCat?.id;
  if (!catId) {
    skipped++;
    continue;
  }

  const code = nextCode();

  db.exec("BEGIN");
  try {
    const info = db
      .prepare(
        `INSERT INTO resources
           (code, slug, title, subtitle, summary, content_md, category_id, cover_url, cover_blur,
            platforms, language, status, is_featured, source_url, published_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'published', 0, ?, unixepoch(), unixepoch(), unixepoch())`,
      )
      .run(
        code,
        r.slug,
        r.title,
        r.subtitle,
        r.summary,
        r.contentMd,
        catId,
        coverUrl,
        r.coverBlur,
        r.platforms,
        r.language ?? "zh",
        r.sourceUrl,
      );

    const rid = Number(info.lastInsertRowid);

    const url = r.linkUrl ?? r.sourceUrl;
    const { createHash } = await import("node:crypto");
    db.prepare(
      `INSERT INTO resource_links (resource_id, url, url_hash, provider, label, is_primary, status, created_at)
       VALUES (?,?,?,'self','源站',1,'unknown',unixepoch())`,
    ).run(rid, url, createHash("sha256").update(url).digest("hex"));

    for (const slug of r.tags ?? []) {
      const tag = db.prepare("SELECT id FROM tags WHERE slug = ?").get(slug);
      if (tag) db.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)").run(rid, tag.id);
    }

    db.exec("COMMIT");
    imported++;
  } catch (e) {
    db.exec("ROLLBACK");
    console.log(`✗ ${r.title}: ${e.message.slice(0, 70)}`);
  }
}

db.close();
console.log(`\n导入 ${imported} · 跳过 ${skipped} · 附带封面 ${covers}`);
