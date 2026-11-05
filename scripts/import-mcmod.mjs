/**
 * 把 MC百科 的整合包/模组导入本站资源库
 *
 *   node scripts/import-mcmod.mjs https://www.mcmod.cn/modpack/837.html --dry
 *   node scripts/import-mcmod.mjs https://www.mcmod.cn/modpack/837.html
 *   node scripts/import-mcmod.mjs urls.txt            # 一行一个 URL
 *
 * 做的事：
 *   1. 调 fetch-mcmod.mjs 抓取并解析
 *   2. 封面下载 → sharp 处理成 800×500 WebP + LQIP（与后台手动上传一致）
 *   3. 写入 resources / resource_links / resource_tags
 *
 * 幂等：同一个 URL 已存在（按 resource_links.url_hash）就跳过。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

process.env.NODE_ENV ??= "production";

const { processCover } = await import("../src/lib/storage.ts");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const targets = args.filter((a) => !a.startsWith("--"));

if (!targets.length) {
  console.error("用法: node scripts/import-mcmod.mjs <url|file.txt> [--dry]");
  process.exit(1);
}

/* 收集 URL 列表 */
const urls = [];
for (const t of targets) {
  if (/^https?:\/\//.test(t)) urls.push(t);
  else if (fs.existsSync(t)) {
    urls.push(
      ...fs
        .readFileSync(t, "utf8")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//.test(s)),
    );
  } else {
    console.warn(`跳过（既不是 URL 也不是文件）：${t}`);
  }
}
if (!urls.length) {
  console.error("没有可导入的 URL");
  process.exit(1);
}

/* 抓取 */
const scraped = JSON.parse(
  execFileSync(process.execPath, ["scripts/fetch-mcmod.mjs", ...urls, "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }),
);

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

/** 分类：整合包 → mods；模组页 → mods 也归到「游戏 MODS」 */
function categoryId() {
  const row =
    db.prepare("SELECT id FROM categories WHERE slug IN ('mods','games') ORDER BY (slug='mods') DESC LIMIT 1").get() ??
    db.prepare("SELECT id FROM categories ORDER BY id LIMIT 1").get();
  return row?.id ?? null;
}

const catId = categoryId();

/** 标签：把 mcmod 的中文标签尽量映射到本站已有标签，映射不到就不加 */
const TAG_MAP = {
  养老: "mod",
  休闲: "mod",
  种田: "mod",
  烹饪: "mod",
  生存: "mod",
  冒险: "mod",
  建筑: "mod",
  任务: "mod",
  国创: "chinese",
  汉化: "chinese",
};

function tagIds(tags) {
  const ids = new Set();
  for (const t of tags) {
    const slug = TAG_MAP[t] ?? null;
    if (!slug) continue;
    const row = db.prepare("SELECT id FROM tags WHERE slug = ?").get(slug);
    if (row) ids.add(row.id);
  }
  return [...ids];
}

function toSlug(s) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "resource"
  );
}

function shortHash(s) {
  return createHash("sha1").update(s).digest("hex").slice(0, 6);
}

function nextCode() {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT code FROM resources WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
    .get(`XM-${year}-%`);
  const n = row ? Number(row.code.split("-")[2]) + 1 : 1;
  return `XM-${year}-${String(n).padStart(4, "0")}`;
}

async function download(url) {
  const abs = url.startsWith("//") ? `https:${url}` : url.startsWith("http") ? url : `https://${url}`;
  const res = await fetch(abs, {
    headers: { "user-agent": "Mozilla/5.0 xiaomo-importer" },
  });
  if (!res.ok) throw new Error(`封面下载失败 ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const report = [];

for (const item of scraped) {
  if (item.error) {
    report.push({ url: item.source, status: "抓取失败", detail: item.error });
    continue;
  }

  const primary = item.links.find((l) => /官方|官网/.test(l.label)) ?? item.links[0];
  if (!primary) {
    report.push({ url: item.source, status: "跳过", detail: "没有可用下载链接" });
    continue;
  }

  const existed = db
    .prepare("SELECT resource_id FROM resource_links WHERE url_hash = ? LIMIT 1")
    .get(createHash("sha256").update(primary.url).digest("hex"));

  if (existed) {
    report.push({ url: item.source, status: "已存在", detail: `resource #${existed.resource_id}` });
    continue;
  }

  if (!catId) {
    report.push({ url: item.source, status: "失败", detail: "数据库里没有分类" });
    continue;
  }

  const title = item.nameCn || item.title;
  const slug = `${toSlug(item.nameEn || title)}-${shortHash(primary.url)}`;
  const code = nextCode();

  let coverUrl = null;
  let coverBlur = null;
  if (item.cover && !dry) {
    try {
      const buf = await download(item.cover);
      const stored = await processCover(buf, "image/jpeg");
      coverUrl = stored.url;
      coverBlur = stored.blur;
    } catch (e) {
      console.warn(`  封面处理失败：${e.message}`);
    }
  }

  const summary = item.description || item.intro.join(" ");
  const platforms = item.loaders.length ? item.loaders : ["Forge"];

  if (!dry) {
    db.exec("BEGIN");
    try {
      const info = db
        .prepare(
          `INSERT INTO resources
             (code, slug, title, subtitle, summary, content_md, category_id, cover_url, cover_blur,
              platforms, version, language, status, is_featured, source_url, published_at, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'published', 0, ?, unixepoch(), unixepoch(), unixepoch())`,
        )
        .run(
          code,
          slug,
          title,
          item.packType ?? "整合包",
          summary.slice(0, 300),
          [item.description, ...item.intro.slice(1)].filter(Boolean).join("\n\n"),
          catId,
          coverUrl,
          coverBlur,
          JSON.stringify(platforms),
          item.versions[0] ?? null,
          "zh",
          item.source,
        );

      const rid = Number(info.lastInsertRowid);

      for (const [i, l] of item.links.entries()) {
        db.prepare(
          `INSERT INTO resource_links (resource_id, url, url_hash, provider, label, is_primary, status, created_at)
           VALUES (?,?,?,?,?,?,'unknown',unixepoch())`,
        ).run(
          rid,
          l.url,
          createHash("sha256").update(l.url).digest("hex"),
          l.label,
          l.label,
          i === 0 ? 1 : 0,
        );
      }

      for (const tid of tagIds(item.tags)) {
        db.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)").run(rid, tid);
      }

      db.exec("COMMIT");
      report.push({ url: item.source, status: "已导入", detail: `${code} ${title}` });
    } catch (e) {
      db.exec("ROLLBACK");
      report.push({ url: item.source, status: "失败", detail: e.message.slice(0, 80) });
    }
  } else {
    report.push({
      url: item.source,
      status: "预演",
      detail: `${code} ${title} · 标签 ${item.tags.join("/")} · 链接 ${item.links.length}`,
    });
  }
}

db.close();

console.log(`\n${dry ? "（预演，未写库）" : ""}共 ${scraped.length} 个页面`);
for (const r of report) {
  const mark = r.status === "已导入" || r.status === "预演" ? "✓" : r.status === "已存在" ? "·" : "✗";
  console.log(`${mark} [${r.status}] ${r.url}\n    ${r.detail}`);
}
