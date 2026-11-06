/**
 * 把 data/import/3dmsoft.json 导入站内「软件工具」分类（服务器端跑）。
 *
 *   node scripts/import-3dmsoft.mjs --dry     # 只看会写什么
 *   node scripts/import-3dmsoft.mjs
 *
 * 数据来源：scripts/fetch-3dmsoft.mjs（抓 3dm 软件站）
 *           scripts/fetch-3dmsoft-covers.mjs（下载封面到 data/import/3dmsoft/covers）
 *
 * 标签：8 个软件分类（系统工具/网络工具/…）作为 kind='soft' 标签，
 *       分类页用 /c/software?soft=xtgj 这样的参数筛选。
 * 链接：provider='direct'（页面上叫「直接下载」，主链接）+ provider='xunlei'（有就挂上）。
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DRY = process.argv.includes("--dry");
const DB = "data/app.db";
const SRC = "data/import/3dmsoft.json";
const COVER_SRC = "data/import/3dmsoft/covers";
const COVER_DST = "data/uploads/covers";

if (!existsSync(SRC)) {
  console.error(`找不到 ${SRC}
请把 3dmsoft.zip 解压到 data/import/，正确结构是：
  data/import/3dmsoft.json
  data/import/3dmsoft/covers/3dm-*.jpg`);
  process.exit(1);
}

const rows = JSON.parse(readFileSync(SRC, "utf8"));
const db = new DatabaseSync(DB);
db.exec("PRAGMA foreign_keys = ON");

const cat = db.prepare("SELECT id FROM categories WHERE slug = 'software'").get();
if (!cat) {
  console.error("找不到 software 分类，先跑迁移");
  process.exit(1);
}
if (!DRY) mkdirSync(COVER_DST, { recursive: true });

/** 分类中文名 → 标签 slug */
const SLUG = {
  系统工具: "xtgj",
  网络工具: "wlgj",
  学习工具: "xxgj",
  安全防护: "aqfh",
  影音播放: "yybf",
  聊天交友: "ltjy",
  主题美化: "ztmh",
  商务办公: "swbg",
  模拟器: "mnq",
};

// 1) 建 soft 标签
const tagIds = new Map();
for (const [name, slug] of Object.entries(SLUG)) {
  const hit = db.prepare("SELECT id FROM tags WHERE slug = ?").get(slug);
  if (hit) {
    tagIds.set(name, hit.id);
    if (!DRY) db.prepare("UPDATE tags SET kind = 'soft', name = ? WHERE id = ?").run(name, hit.id);
  } else if (!DRY) {
    const info = db
      .prepare("INSERT INTO tags (slug, name, kind, use_count) VALUES (?,?, 'soft', 0)")
      .run(slug, name);
    tagIds.set(name, Number(info.lastInsertRowid));
  } else {
    tagIds.set(name, -1);
  }
}
console.log(`标签：${tagIds.size} 个 soft 分类`);

// 2) 生成 code —— 必须取现有最大号 +1，不能用 COUNT（已有编号不连续，COUNT 会撞车）
const year = new Date().getFullYear();
const maxRow = db
  .prepare("SELECT code FROM resources WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
  .get(`XM-${year}-%`);
let seq = maxRow ? Number(String(maxRow.code).split("-")[2]) || 0 : 0;

const insRes = db.prepare(
  `INSERT INTO resources
     (code, slug, title, subtitle, summary, content_md, category_id, cover_url, cover_blur,
      platforms, language, status, is_featured, source_url, published_at, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?, 'published', 0, ?, unixepoch(), unixepoch(), unixepoch())`,
);
const insLink = db.prepare(
  `INSERT INTO resource_links (resource_id, url, url_hash, provider, extract_code, label, is_primary, status, created_at)
   VALUES (?,?,?,?,?,?,?, 'unknown', unixepoch())`,
);
const insTag = db.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)");

let imported = 0;
let skipped = 0;
let covers = 0;
let links = 0;

for (const r of rows) {
  const slug = `3dm-${r.id}`;
  const coverName = `3dm-${r.id}.jpg`;
  const srcFile = join(COVER_SRC, coverName);
  const hasCover = existsSync(srcFile);
  const newCoverUrl = hasCover ? `/files/covers/${coverName}` : null;

  const exists = db.prepare("SELECT id, cover_url AS coverUrl FROM resources WHERE slug = ? LIMIT 1").get(slug);

  /**
   * 已存在也要修两件事（幂等）：
   *   · platforms 早期被写成裸字符串 "windows"，读取端 JSON.parse 会炸 → 统一成 ["windows"]
   *   · cover_url 为空但封面文件现在有了 → 补上
   */
  if (exists) {
    if (!DRY) {
      db.prepare("UPDATE resources SET platforms = ? WHERE id = ?").run(JSON.stringify(["windows"]), exists.id);
      if (!exists.coverUrl && newCoverUrl) {
        copyFileSync(srcFile, join(COVER_DST, coverName));
        db.prepare("UPDATE resources SET cover_url = ? WHERE id = ?").run(newCoverUrl, exists.id);
        covers += 1;
      }
    }
    skipped += 1;
    continue;
  }

  // 封面
  let coverUrl = null;
  if (hasCover) {
    if (!DRY) copyFileSync(srcFile, join(COVER_DST, coverName));
    coverUrl = newCoverUrl;
    covers += 1;
  }

  const intro = (r.intro ?? "").trim();
  const summary = intro.length > 110 ? `${intro.slice(0, 108)}…` : intro || r.name;
  const subtitle = [r.category, r.version ? `v${r.version}` : null, r.size].filter(Boolean).join(" · ");

  if (DRY) {
    imported += 1;
    if (imported <= 3) {
      console.log(JSON.stringify({ slug, title: r.name, subtitle, summary: summary.slice(0, 40), coverUrl, links: r.links }, null, 1));
    }
    continue;
  }

  seq += 1;
  const code = `XM-${year}-${String(seq).padStart(4, "0")}`;

  db.exec("BEGIN");
  try {
    const info = insRes.run(
      code,
      slug,
      r.name,
      subtitle,
      summary,
      intro,
      cat.id,
      coverUrl,
      null,
      JSON.stringify(["windows"]),
      "zh",
      `https://soft.3dmgame.com/down/${r.id}.html`,
    );
    const rid = Number(info.lastInsertRowid);

    // 主链接优先用 direct（页面上「直接下载」），其余顺序挂上
    const ordered = [...r.links].sort((a, b) => (a.provider === "direct" ? -1 : b.provider === "direct" ? 1 : 0));
    ordered.forEach((l, i) => {
      insLink.run(
        rid,
        l.url,
        createHash("sha256").update(l.url).digest("hex"),
        l.provider,
        null,
        l.provider === "direct" ? "直接下载" : null,
        i === 0 ? 1 : 0,
      );
      links += 1;
    });

    const tid = tagIds.get(r.category);
    if (tid && tid > 0) insTag.run(rid, tid);

    db.exec("COMMIT");
    imported += 1;
  } catch (e) {
    db.exec("ROLLBACK");
    console.log(`✗ ${r.name}: ${e.message.slice(0, 80)}`);
  }
}

// 3) 重算标签计数
if (!DRY) {
  db.exec(`UPDATE tags SET use_count = (SELECT COUNT(*) FROM resource_tags WHERE tag_id = tags.id)`);
}

db.close();
console.log(`\n导入 ${imported} · 跳过 ${skipped} · 封面 ${covers} · 链接 ${links}${DRY ? "（dry-run，未写库）" : ""}`);
