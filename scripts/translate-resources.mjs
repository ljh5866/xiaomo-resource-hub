/**
 * 把资源详情页的介绍翻成中文（只处理非中文内容）
 *
 *   node scripts/translate-resources.mjs --dry
 *   node scripts/translate-resources.mjs --limit 30
 *   node scripts/translate-resources.mjs --provider google
 *   node scripts/translate-resources.mjs --ids 12,13
 *
 * 翻译走免费的公开接口，按顺序尝试：
 *   1) Google gtx 接口（国内机器常被挡，海外服务器一般可用）
 *   2) MyMemory（有每日字符配额，脚本会自动停在配额点）
 *
 * 特性：
 *   - 只翻译「中文占比低」的文本，已经是中文的直接跳过
 *   - 逐条写库，中断后重跑会从没翻的继续
 *   - 原文保留在 summary 的上一行，避免信息丢失
 */
import { DatabaseSync } from "node:sqlite";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Number(valueOf("--limit") ?? 50);
const onlyProvider = valueOf("--provider");
const ids = valueOf("--ids")
  ?.split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const db = new DatabaseSync(process.env.DATABASE_URL?.replace(/^\.\//, "") ?? "data/app.db");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 中文占比：>=25% 就当已经是中文 */
function isChinese(text) {
  const s = text.replace(/\s/g, "");
  if (!s) return true;
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return cjk / s.length >= 0.25;
}

async function google(text) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = await res.json();
  return (data[0] ?? []).map((seg) => seg[0]).join("").trim();
}

async function mymemory(text) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 480)) +
    "&langpair=en|zh-CN";
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`mymemory ${res.status}`);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (!out || /QUOTA|MYMEMORY WARNING/i.test(out)) throw new Error("mymemory 配额用尽");
  return String(out).trim();
}

const providers = onlyProvider
  ? [{ name: onlyProvider, fn: onlyProvider === "google" ? google : mymemory }]
  : [
      { name: "google", fn: google },
      { name: "mymemory", fn: mymemory },
    ];

async function translate(text) {
  for (const p of providers) {
    try {
      const out = await p.fn(text);
      if (out && out !== text) return { text: out, provider: p.name };
    } catch {
      /* 换下一个 */
    }
  }
  return null;
}

/* ───────── 主流程 ───────── */

const rows = db
  .prepare(
    `SELECT id, code, title, summary, content_md
       FROM resources
      WHERE status = 'published'
      ORDER BY id`,
  )
  .all()
  .filter((r) => (ids ? ids.includes(r.id) : true))
  .filter((r) => {
    const text = `${r.summary ?? ""} ${r.content_md ?? ""}`.trim();
    return text.length > 20 && !isChinese(text);
  })
  .slice(0, limit);

console.log(`\n待翻译 ${rows.length} 条（已跳过中文内容的资源）`);

let done = 0;
let failed = 0;

for (const [i, r] of rows.entries()) {
  const source = (r.summary || r.content_md || "").trim().slice(0, 1600);
  if (!source) continue;

  if (dry) {
    console.log(`· ${r.code} ${r.title} — ${source.slice(0, 60)}…`);
    continue;
  }

  const res = await translate(source);
  if (!res) {
    failed++;
    // 配额/网络都失败时早点停，别把时间耗在重试上
    if (failed >= 3) {
      console.log("  连续失败 3 次，先停。换台能访问 Google 的机器，或明天再跑。");
      break;
    }
    await sleep(800);
    continue;
  }

  const cjk = res.text;
  db.prepare(
    `UPDATE resources
        SET summary = ?, content_md = ?
      WHERE id = ?`,
  ).run(
    cjk.slice(0, 220),
    `${cjk}\n\n---\n原文（${res.provider} 未覆盖的细节以原文为准）：\n${source.slice(0, 1200)}`,
    r.id,
  );

  done++;
  console.log(`✓ ${r.code} ${r.title}（${res.provider}）`);
  await sleep(700);
  if ((i + 1) % 10 === 0) console.log(`  …${i + 1}/${rows.length}`);
}

db.close();

if (dry) {
  console.log("\n（预演，未写库）");
} else {
  console.log(`\n完成：翻译 ${done} 条 · 失败 ${failed} 条`);
}
