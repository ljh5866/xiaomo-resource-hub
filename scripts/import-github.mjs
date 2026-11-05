/**
 * 从 GitHub 拉开源项目，导入「GitHub 开源项目」分类
 *
 *   node --import tsx scripts/import-github.mjs --limit 60
 *   node --import tsx scripts/import-github.mjs --limit 20 --dry
 *   node --import tsx scripts/import-github.mjs --limit 60 --query "stars:>5000 topic:cli"
 *
 * 说明：
 *   - 走 GitHub 公开搜索 API，不带 token 时限速较严（搜索 10 次/分钟），脚本默认只发几次请求
 *   - 封面用 GitHub 官方的仓库预览图（opengraph.githubassets.com），失败就跳过封面
 *   - 按语言/主题自动打「安卓端 / iOS 端 / 桌面端」标签
 *   - 幂等：仓库地址已存在就跳过
 */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

process.env.NODE_ENV ??= "production";
const { processCover } = await import("../src/lib/storage.ts");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Number(valueOf("--limit") ?? 60);
const query = valueOf("--query") ?? "stars:>3000";

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const UA = "xiaomo-resource-hub/1.0";
const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const cat = db.prepare("SELECT id FROM categories WHERE slug = 'opensource' LIMIT 1").get();
if (!cat) {
  console.error("找不到 opensource 分类，先跑 seed-taxonomy");
  process.exit(1);
}

const tagId = (slug) => db.prepare("SELECT id FROM tags WHERE slug = ?").get(slug)?.id;

/** 按语言与话题猜平台标签 */
function platformTags(repo) {
  const lang = (repo.language ?? "").toLowerCase();
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  const desc = (repo.description ?? "").toLowerCase();
  const has = (words) => words.some((w) => topics.includes(w) || desc.includes(w));

  // 只在描述/话题里明确提到端的时候才打标签，光看语言会把一切都算成桌面端
  const out = [];
  if (has(["android", "android-app", "apk", "termux"])) out.push("android-app");
  if (has(["ios", "iphone", "ipados", "swiftui"])) out.push("ios-app");
  if (
    has(["desktop", "electron", "tauri", "qt", "gtk", "windows-app", "macos-app", "linux-app", "cli", "terminal"])
  ) {
    out.push("desktop-app");
  }
  return [...new Set(out)];
}

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { "user-agent": UA, accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

/* ───────── 拉取 ───────── */

const found = [];
let page = 1;

while (found.length < limit && page <= 3) {
  const q = encodeURIComponent(`${query} archived:false fork:false`);
  const data = await api(`/search/repositories?q=${q}&sort=stars&order=desc&per_page=100&page=${page}`);
  const items = data.items ?? [];
  if (!items.length) break;
  found.push(...items);
  page++;
  // 搜索接口限速：无 token 时 10 次/分钟，这里留足间隔
  if (found.length < limit) await new Promise((r) => setTimeout(r, 6000));
}

const repos = found.slice(0, limit);
console.log(`拿到 ${repos.length} 个仓库，开始入库`);

/* ───────── 写库 ───────── */

function nextCode() {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT code FROM resources WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
    .get(`XM-${year}-%`);
  const n = row ? Number(row.code.split("-")[2]) + 1 : 1;
  return `XM-${year}-${String(n).padStart(4, "0")}`;
}

const report = { imported: 0, skipped: 0, failed: 0, lines: [] };

for (const repo of repos) {
  const url = repo.html_url;
  const dup = db
    .prepare("SELECT resource_id FROM resource_links WHERE url_hash = ? LIMIT 1")
    .get(createHash("sha256").update(url).digest("hex"));

  if (dup) {
    report.skipped++;
    continue;
  }

  const desc = (repo.description ?? "").trim() || `${repo.full_name} · GitHub 开源项目`;
  const platforms = platformTags(repo);

  if (dry) {
    report.imported++;
    report.lines.push(`✓ ${repo.full_name} ★${repo.stargazers_count} · ${platforms.join("/") || "—"}`);
    continue;
  }

  let coverUrl = null;
  let coverBlur = null;
  try {
    const og = `https://opengraph.githubassets.com/xiaomo/${repo.full_name}`;
    const res = await fetch(og, { headers: { "user-agent": UA } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const stored = await processCover(buf, "image/png");
      coverUrl = stored.url;
      coverBlur = stored.blur;
    }
  } catch {
    /* 无封面也能入库 */
  }

  const slugBase = repo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = `${slugBase || "repo"}-${createHash("sha1").update(url).digest("hex").slice(0, 6)}`;
  const code = nextCode();

  db.exec("BEGIN");
  try {
    const info = db
      .prepare(
        `INSERT INTO resources
           (code, slug, title, subtitle, summary, content_md, category_id, cover_url, cover_blur,
            platforms, version, language, license_label, status, is_featured, source_url,
            published_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'published',0,?,unixepoch(),unixepoch(),unixepoch())`,
      )
      .run(
        code,
        slug,
        repo.full_name,
        repo.language ?? "开源项目",
        desc.slice(0, 220),
        [
          desc,
          "",
          `- Stars：${repo.stargazers_count}`,
          `- 语言：${repo.language ?? "—"}`,
          repo.license?.spdx_id ? `- 许可证：${repo.license.spdx_id}` : "",
          (repo.topics ?? []).length ? `- 标签：${repo.topics.slice(0, 8).join("、")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        cat.id,
        coverUrl,
        coverBlur,
        JSON.stringify(platforms.length ? platforms : ["desktop-app"]),
        null,
        "en",
        repo.license?.spdx_id ?? null,
        url,
      );

    const rid = Number(info.lastInsertRowid);

    db.prepare(
      `INSERT INTO resource_links (resource_id, url, url_hash, provider, label, is_primary, status, created_at)
       VALUES (?,?,?,'self','GitHub',1,'unknown',unixepoch())`,
    ).run(rid, url, createHash("sha256").update(url).digest("hex"));

    for (const slugTag of platforms) {
      const id = tagId(slugTag);
      if (id) db.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)").run(rid, id);
    }

    db.exec("COMMIT");
    report.imported++;
    report.lines.push(`✓ ${repo.full_name} ★${repo.stargazers_count}`);
  } catch (e) {
    db.exec("ROLLBACK");
    report.failed++;
    report.lines.push(`✗ ${repo.full_name}：${e.message.slice(0, 60)}`);
  }

  await new Promise((r) => setTimeout(r, 150));
}

db.close();

console.log(`\n${dry ? "（预演）" : ""}导入 ${report.imported} · 跳过 ${report.skipped} · 失败 ${report.failed}`);
for (const line of report.lines.slice(-15)) console.log("  " + line);
