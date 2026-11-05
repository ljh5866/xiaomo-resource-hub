/**
 * 给已有的 Galgame 补上网盘下载链接
 *
 *   node --import tsx scripts/sync-touchgal-pan.mjs --limit 450
 *   node --import tsx scripts/sync-touchgal-pan.mjs --limit 20 --dry
 *
 * 之前导入时只存了源站页面；其实真实网盘地址在
 *   /api/patch?uniqueId=<hash>          → 拿到 patchId
 *   /api/patch/resource?patchId=<id>    → 拿到 links[].content 与 code
 * 这两个接口被 Cloudflare 保护，必须在页面上下文里 fetch，所以用浏览器。
 *
 * 结果：
 *   - 资源链接替换为真实网盘地址（夸克/百度/蓝奏/123 等），带提取码
 *   - 源站页面保留为最后一条「源站」链接
 *   - 简介补上出品信息与文件大小
 */
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { providerOf } from "../src/lib/providers.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Number(valueOf("--limit") ?? 450);

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");

const rows = db
  .prepare(
    `SELECT id, code, title, source_url FROM resources
      WHERE source_url LIKE 'https://www.touchgal.ink/%'
      ORDER BY id LIMIT ?`,
  )
  .all(limit);

console.log(`\n待补链 Galgame：${rows.length} 条`);

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
});
const page = await browser.newPage();

// 先打开任意详情页，拿到同源上下文（Cloudflare 放行后再批量取）
await page.goto("https://www.touchgal.ink/galgame", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

let done = 0;
let updated = 0;
let empty = 0;

for (const r of rows) {
  const hash = r.source_url.split("/").pop().split("?")[0];
  done++;

  const data = await page
    .evaluate(
      async ({ hash }) => {
        const j = async (u) => {
          const res = await fetch(u, { headers: { accept: "application/json" } });
          return res.ok ? res.json().catch(() => null) : null;
        };
        const patch = await j(`/api/patch?uniqueId=${hash}`);
        if (!patch?.id) return { error: "no-patch" };
        const list = await j(`/api/patch/resource?patchId=${patch.id}`);
        if (!Array.isArray(list) || !list.length) return { error: "no-resource" };
        return {
          name: patch.name ?? null,
          items: list.slice(0, 6).map((it) => ({
            name: it.name ?? null,
            size: it.size ?? null,
            language: it.language ?? [],
            links: (it.links ?? []).slice(0, 4).map((l) => ({
              url: l.content ?? "",
              code: l.code || l.password || "",
              storage: l.storage ?? "",
            })),
          })),
        };
      },
      { hash },
    )
    .catch(() => null);

  if (!data || data.error) {
    empty++;
    continue;
  }

  // 汇总所有网盘链接（去重）
  const seen = new Set();
  const links = [];
  for (const it of data.items) {
    for (const l of it.links) {
      if (!l.url || seen.has(l.url)) continue;
      const provider = providerOf(l.url);
      if (!provider) continue;
      seen.add(l.url);
      const label = [it.name, it.size].filter(Boolean).join(" · ").slice(0, 40) || provider;
      links.push({ url: l.url, code: l.code || null, provider, label });
    }
  }

  // 一个资源最多留 8 条，避免版本太多把侧栏撑爆
  links.length = Math.min(links.length, 8);

  if (!links.length) {
    empty++;
    continue;
  }

  if (dry) {
    console.log(`· ${r.title} → ${links.length} 个网盘（${links.map((l) => l.provider).join("/")}）`);
    updated++;
    continue;
  }

  db.exec("BEGIN");
  try {
    // 清掉旧的链接，换成真实网盘 + 一条源站
    db.prepare("DELETE FROM resource_links WHERE resource_id = ?").run(r.id);
    const ins = db.prepare(
      `INSERT INTO resource_links (resource_id, url, url_hash, provider, extract_code, label, is_primary, status, created_at)
       VALUES (?,?,?,?,?,?,?,'unknown',unixepoch())`,
    );
    links.forEach((l, i) => {
      ins.run(
        r.id,
        l.url,
        createHash("sha256").update(l.url).digest("hex"),
        l.provider,
        l.code,
        l.label,
        i === 0 ? 1 : 0,
      );
    });
    // 源站留一条，方便查更新
    ins.run(
      r.id,
      r.source_url,
      createHash("sha256").update(r.source_url).digest("hex"),
      "self",
      null,
      "源站",
      0,
    );

    db.exec("COMMIT");
    updated++;
  } catch (e) {
    db.exec("ROLLBACK");
    console.log(`✗ ${r.title}: ${e.message.slice(0, 60)}`);
  }

  if (done % 25 === 0) console.log(`  …${done}/${rows.length}（已更新 ${updated}）`);
}

db.close();
await browser.close();

console.log(`\n${dry ? "（预演）" : ""}更新 ${updated} 条 · 无网盘 ${empty} 条 · 共处理 ${done}`);
