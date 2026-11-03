/**
 * 批量造测试数据（只用于验证分页/列表性能；标题带「分页压测」字样，一眼能认出）
 *   pnpm seed:bulk --count 60
 *   pnpm seed:bulk --clean
 */
import { get, run } from "../db/client";
import { hashUrl } from "../lib/links";
import { reindexAll } from "../lib/search/fts";

const args = process.argv.slice(2);
const CLEAN = args.includes("--clean");
const countIdx = args.indexOf("--count");
const COUNT = countIdx >= 0 ? Number(args[countIdx + 1]) || 60 : 60;

const CATEGORIES = ["software", "template", "material", "course", "font", "icon", "ebook"];
const KINDS = ["software", "template", "material", "course", "font", "icon", "ebook"];
const PLATFORMS = ["windows", "mac", "web", "android", "ios", "office"];
const PROVIDERS = ["quark", "baidu", "aliyun", "xunlei", "123"];

const now = () => Math.floor(Date.now() / 1000);

function nextCode(): string {
  const year = new Date().getFullYear();
  const row = get<{ n: number }>(
    "SELECT COALESCE(MAX(CAST(substr(code, 9) AS INTEGER)), 0) + 1 AS n FROM resources WHERE code LIKE ?",
    `XM-${year}-%`,
  );
  return `XM-${year}-${String(row?.n ?? 1).padStart(4, "0")}`;
}

if (CLEAN) {
  const row = get<{ ids: string | null }>(
    "SELECT group_concat(id) AS ids FROM resources WHERE slug LIKE 'bulk-%'",
  );
  const ids = (row?.ids ?? "").split(",").filter(Boolean).map(Number);

  for (const id of ids) {
    run("DELETE FROM resource_links WHERE resource_id = ?", id);
    run("DELETE FROM resource_tags WHERE resource_id = ?", id);
    run("DELETE FROM resources WHERE id = ?", id);
  }

  const n = reindexAll();
  console.log(`✓ 已清理 ${ids.length} 条压测数据，索引重建 ${n} 条`);
  process.exit(0);
}

const cats = new Map<string, number>();
for (const slug of CATEGORIES) {
  const row = get<{ id: number }>("SELECT id FROM categories WHERE slug = ?", slug);
  if (row) cats.set(slug, row.id);
}

if (cats.size === 0) {
  console.error("没有分类数据，先跑 pnpm db:seed");
  process.exit(1);
}

const catKeys = [...cats.keys()];
const ts = now();
let inserted = 0;

// 续号：已有压测数据时从上一个编号继续，避免标题重复
const existing = get<{ n: number }>(
  "SELECT COUNT(*) AS n FROM resources WHERE slug LIKE 'bulk-%'",
)?.n ?? 0;
const startAt = existing + 1;

for (let n = startAt; n < startAt + COUNT; n += 1) {
  const i = n;
  const catSlug = catKeys[i % catKeys.length];
  const code = nextCode();
  const slug = `bulk-${Date.now().toString(36)}-${i}`;

  const row = get<{ id: number }>(
    `INSERT INTO resources
      (code, slug, title, subtitle, summary, category_id, kind, platforms,
       version, size_label, language, license_label, status, published_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'published', ?, ?, ?) RETURNING id`,
    code,
    slug,
    `分页压测资源 ${String(i).padStart(3, "0")}`,
    `用于验证列表分页与加载更多的占位条目 #${i}`,
    `这不是真实资源，仅用于压测列表分页、搜索索引与渲染性能。条目编号 ${i}。`,
    cats.get(catSlug)!,
    KINDS[i % KINDS.length],
    JSON.stringify([PLATFORMS[i % PLATFORMS.length], PLATFORMS[(i + 2) % PLATFORMS.length]]),
    `v1.${i % 10}`,
    `${(i % 9) + 1} MB`,
    "zh-CN",
    "free",
    ts - i * 3600,
    ts,
    ts - i * 3600,
  );

  if (!row) continue;

  for (let k = 0; k < 2; k += 1) {
    const provider = PROVIDERS[(i + k) % PROVIDERS.length];
    const url = `https://pan.${provider}.example.com/s/BULK-${code}-${k}`;
    run(
      `INSERT INTO resource_links
        (resource_id, provider, url, url_hash, extract_code, label, is_primary, sort_order, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,'unknown',?)`,
      row.id,
      provider,
      url,
      hashUrl(url),
      k === 0 ? "bk2x" : null,
      k === 0 ? "主链接" : "备用",
      k === 0 ? 1 : 0,
      k,
      ts,
    );
  }

  inserted += 1;
}

const n = reindexAll();
console.log(`✓ 新增 ${inserted} 条压测资源，索引重建 ${n} 条`);
console.log("  清理：pnpm seed:bulk --clean");
