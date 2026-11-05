/**
 * 从 BBSMC（bbsmc.net，Modrinth 中文站）批量导入整合包
 *
 *   node --import tsx scripts/import-bbsmc.mjs --limit 300
 *   node --import tsx scripts/import-bbsmc.mjs --limit 20 --dry
 *   node --import tsx scripts/import-bbsmc.mjs --limit 300 --offset 0 --index downloads
 *
 * 数据来源是它的公开 API（api.bbsmc.net/v2），不是解析 HTML：
 *   /search        分页拿项目列表
 *   /project/{slug}  拿到标题、简介、图标、版本、分类
 *   /project/{slug}/version  拿到各版本文件地址（基本都是夸克等网盘）
 *
 * 规则：
 *   - 只收网盘链接（夸克/百度/蓝奏/123/迅雷/UC/115），官方 CDN 一律丢掉
 *   - 封面下载后裁成 800×500 WebP + LQIP，与后台上传一致
 *   - 固定打「我的世界」游戏标签
 *   - 幂等：同一个网盘地址已存在就跳过
 */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

process.env.NODE_ENV ??= "production";

const { processCover } = await import("../src/lib/storage.ts");
const { providerOf } = await import("../src/lib/providers.ts");

const API = "https://api.bbsmc.net/v2";
const UA = "xiaomo-resource-hub/1.0 (import script)";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Number(valueOf("--limit") ?? 300);
const offset = Number(valueOf("--offset") ?? 0);
const index = valueOf("--index") ?? "downloads";
const concurrency = Math.max(1, Math.min(6, Number(valueOf("--concurrency") ?? 4)));

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

/* ───────── 工具 ───────── */

async function api(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}${path}`, {
        headers: { "user-agent": UA, accept: "application/json" },
      });
      if (res.status === 429) {
        await sleep(2000);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(800);
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function toSlug(s) {
  return (
    (s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "resource"
  );
}

async function download(url) {
  const abs = url.startsWith("//") ? `https:${url}` : url;
  const res = await fetch(abs, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`封面 ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ───────── 数据库 ───────── */

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const cat =
  db.prepare("SELECT id FROM categories WHERE slug = 'mods' LIMIT 1").get() ??
  db.prepare("SELECT id FROM categories ORDER BY id LIMIT 1").get();
if (!cat) {
  console.error("数据库里没有分类，先跑 seed-taxonomy");
  process.exit(1);
}

const mcTag = db.prepare("SELECT id FROM tags WHERE slug = 'minecraft'").get();
const modTag = db.prepare("SELECT id FROM tags WHERE slug = 'mod'").get();

function nextCode() {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT code FROM resources WHERE code LIKE ? ORDER BY code DESC LIMIT 1")
    .get(`XM-${year}-%`);
  const n = row ? Number(row.code.split("-")[2]) + 1 : 1;
  return `XM-${year}-${String(n).padStart(4, "0")}`;
}

function existsByUrl(url) {
  return db
    .prepare("SELECT resource_id FROM resource_links WHERE url_hash = ? LIMIT 1")
    .get(createHash("sha256").update(url).digest("hex"));
}

/* ───────── 拉取项目 ───────── */

async function collectProjects() {
  const facets = encodeURIComponent('[["project_type:modpack"]]');
  const hits = [];
  let cursor = offset;
  const pageSize = 100;

  while (hits.length < limit) {
    const data = await api(
      `/search?facets=${facets}&limit=${Math.min(pageSize, limit - hits.length)}&offset=${cursor}&index=${index}`,
    );
    if (!data?.hits?.length) break;
    hits.push(...data.hits);
    cursor += data.hits.length;
    if (cursor >= (data.total_hits ?? 0)) break;
    await sleep(250);
  }

  return hits.slice(0, limit);
}

async function buildProject(hit) {
  const [project, versions] = await Promise.all([
    api(`/project/${hit.slug}`),
    api(`/project/${hit.slug}/version`),
  ]);
  if (!project) return null;

  // 下载地址：所有版本里的网盘链接，去重后保留前 6 个
  const links = [];
  for (const v of versions ?? []) {
    for (const f of v.files ?? []) {
      const provider = providerOf(f.url ?? "");
      if (!provider) continue;
      if (links.some((l) => l.url === f.url)) continue;
      links.push({ url: f.url, provider, version: v.version_number ?? null });
      if (links.length >= 6) break;
    }
    if (links.length >= 6) break;
  }

  const desc = stripMarkdown(project.body ?? project.description ?? "");
  return {
    slug: project.slug,
    title: project.title,
    icon: project.icon_url ?? null,
    summary: desc.slice(0, 220),
    body: desc,
    versions: project.game_versions ?? [],
    loaders: (project.loaders ?? []).map((l) => l[0].toUpperCase() + l.slice(1)),
    categories: project.categories ?? [],
    downloads: project.downloads ?? 0,
    source: `https://bbsmc.net/modpack/${project.slug}`,
    links,
  };
}

/* ───────── 主流程 ───────── */

const hits = await collectProjects();
console.log(`\n列表拿到 ${hits.length} 个项目，开始抓详情（并发 ${concurrency}）`);

const report = { imported: 0, skipped: 0, failed: 0, details: [] };

let cursor = 0;
async function worker(id) {
  while (cursor < hits.length) {
    const hit = hits[cursor++];
    const label = `[${cursor}/${hits.length}] ${hit.slug}`;
    try {
      const p = await buildProject(hit);
      if (!p) {
        report.failed++;
        report.details.push(`✗ ${label} 详情接口失败`);
        continue;
      }
      if (!p.links.length) {
        report.skipped++;
        report.details.push(`· ${label} 没有网盘链接`);
        continue;
      }
      if (existsByUrl(p.links[0].url)) {
        report.skipped++;
        report.details.push(`· ${label} 已存在`);
        continue;
      }

      if (dry) {
        report.imported++;
        report.details.push(`✓ ${label} ${p.title}（${p.links.length} 个网盘）`);
        continue;
      }

      let coverUrl = null;
      let coverBlur = null;
      if (p.icon) {
        try {
          const buf = await download(p.icon);
          const stored = await processCover(buf, "image/png");
          coverUrl = stored.url;
          coverBlur = stored.blur;
        } catch {
          /* 没封面也能入库 */
        }
      }

      const code = nextCode();
      const slug = `${toSlug(p.slug)}-${createHash("sha1").update(p.links[0].url).digest("hex").slice(0, 6)}`;

      db.exec("BEGIN");
      try {
        const info = db
          .prepare(
            `INSERT INTO resources
               (code, slug, title, subtitle, summary, content_md, category_id, cover_url, cover_blur,
                platforms, version, language, status, is_featured, source_url, published_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'published',0,?,unixepoch(),unixepoch(),unixepoch())`,
          )
          .run(
            code,
            slug,
            p.title,
            "整合包",
            p.summary,
            p.body.slice(0, 4000),
            cat.id,
            coverUrl,
            coverBlur,
            JSON.stringify(p.loaders.length ? p.loaders : ["Forge"]),
            p.versions[0] ?? null,
            "zh",
            p.source,
          );

        const rid = Number(info.lastInsertRowid);

        p.links.forEach((l, i) => {
          db.prepare(
            `INSERT INTO resource_links (resource_id, url, url_hash, provider, label, is_primary, status, created_at)
             VALUES (?,?,?,?,?,?,'unknown',unixepoch())`,
          ).run(
            rid,
            l.url,
            createHash("sha256").update(l.url).digest("hex"),
            l.provider,
            l.version ?? "网盘",
            i === 0 ? 1 : 0,
          );
        });

        for (const tid of [mcTag?.id, modTag?.id].filter(Boolean)) {
          db.prepare("INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)").run(rid, tid);
        }

        db.exec("COMMIT");
        report.imported++;
        report.details.push(`✓ ${label} ${code} ${p.title}`);
      } catch (e) {
        db.exec("ROLLBACK");
        report.failed++;
        report.details.push(`✗ ${label} 写库失败：${e.message.slice(0, 60)}`);
      }
    } catch (e) {
      report.failed++;
      report.details.push(`✗ ${label} 异常：${String(e.message).slice(0, 60)}`);
    }
    await sleep(120);
  }
}

await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));

db.close();

console.log(`\n${dry ? "（预演）" : ""}导入 ${report.imported} · 跳过 ${report.skipped} · 失败 ${report.failed}`);
const show = report.details.slice(-25);
for (const line of show) console.log("  " + line);
if (report.details.length > show.length) {
  console.log(`  … 前 ${report.details.length - show.length} 条略`);
}
