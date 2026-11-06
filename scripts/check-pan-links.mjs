/**
 * 网盘链接巡检：用匿名接口判断分享是否还活着，并回填 provider / 提取码。
 *
 *   node --import tsx scripts/check-pan-links.mjs --dry --limit 20
 *   node --import tsx scripts/check-pan-links.mjs --provider quark --limit 200
 *   node --import tsx scripts/check-pan-links.mjs            # 全量 quark
 *
 * 只做 token + detail 两个匿名接口，不转存、不下载、不占网盘空间。
 * 结果写回 resource_links.status / last_error / checked_at。
 */
import { DatabaseSync } from "node:sqlite";
import { setDefaultResultOrder } from "node:dns";

// 香港机器到夸克 IPv6 不通，Node fetch 会 ETIMEDOUT；强制 IPv4 优先。
setDefaultResultOrder("ipv4first");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d = null) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};

const DB = val("--db", "./data/app.db");
const PROVIDER = val("--provider", "quark");
const LIMIT = Number(val("--limit", 0));
const DRY = has("--dry");
const DELAY = Number(val("--delay", 900));

const API = "https://drive-pc.quark.cn";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "quark-cloud-drive/3.23.2 Chrome/112.0.5615.165 Electron/24.1.3.8 Safari/537.36";

const db = new DatabaseSync(DB);
const rows = db
  .prepare(
    `SELECT l.id, l.provider, l.url, l.extract_code AS code
       FROM resource_links l
       JOIN resources r ON r.id = l.resource_id
      WHERE l.provider = ? AND r.status = 'published'
      ORDER BY l.id`,
  )
  .all(PROVIDER);

const picked = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
console.log(`待巡检 ${picked.length} 条（${PROVIDER}）`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hit(path, init = {}) {
  const qs = new URLSearchParams({ pr: "ucpro", fr: "pc", ...(init.query ?? {}) });
  let lastErr = null;
  const res = await fetch(`${API}${path}?${qs}`, {
    method: init.body ? "POST" : "GET",
    headers: {
      "user-agent": UA,
      referer: "https://pan.quark.cn/",
      accept: "application/json, text/plain, */*",
      ...(init.body ? { "content-type": "application/json;charset=UTF-8" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  }).catch((e) => {
    lastErr = e;
    return null;
  });
  if (!res) {
    const cause = lastErr?.cause?.code ?? lastErr?.cause?.message ?? "";
    return { code: -1, message: `网络失败: ${lastErr?.message ?? "unknown"}${cause ? ` (${cause})` : ""}` };
  }
  const json = await res.json().catch(() => null);
  if (!json) return { code: -2, message: `HTTP ${res.status}` };
  const code = json.code ?? json.status ?? 0;
  return { code, message: json.message ?? "", data: json.data ?? {} };
}

/** 分享 URL → pwd_id + passcode */
function parseShare(url, code) {
  const m = url.match(/pan\.quark\.cn\/s\/([0-9A-Za-z]+)/);
  if (!m) return null;
  let passcode = (code ?? "").trim();
  if (!passcode) {
    try {
      passcode = new URL(url).searchParams.get("pwd") ?? "";
    } catch {
      passcode = "";
    }
  }
  return { shareId: m[1], passcode };
}

const ok = [];
const invalid = [];
const needCode = [];
const errors = [];

for (const [i, row] of picked.entries()) {
  const tail = `[${i + 1}/${picked.length}] #${row.id}`;
  const parsed = parseShare(row.url, row.code);
  if (!parsed) {
    errors.push({ id: row.id, reason: "URL 无法识别" });
    console.log(`${tail} 无法识别 ${row.url.slice(0, 60)}`);
    continue;
  }

  const token = await hit("/1/clouddrive/share/sharepage/token", {
    body: { pwd_id: parsed.shareId, passcode: parsed.passcode },
  });

  if (token.code === 41005 || token.code === 41008) {
    needCode.push(row.id);
    console.log(`${tail} 需要提取码`);
    if (!DRY) mark(row.id, "unknown", "需要提取码");
  } else if (token.code === 41006) {
    needCode.push(row.id);
    console.log(`${tail} 提取码错误`);
    if (!DRY) mark(row.id, "unknown", "提取码错误");
  } else if (token.code !== 0) {
    invalid.push(row.id);
    console.log(`${tail} 失效 code=${token.code} ${token.message}`);
    if (!DRY) mark(row.id, "invalid", `分享失效：${token.message || token.code}`);
  } else {
    const stoken = token.data?.stoken;
    const detail = await hit("/1/clouddrive/share/sharepage/detail", {
      query: { pwd_id: parsed.shareId, stoken, pdir_fid: "0", _page: "1", _size: "1" },
    });
    if (detail.code === 0) {
      ok.push(row.id);
      console.log(`${tail} ✓ 有效`);
      if (!DRY) mark(row.id, "ok", null);
    } else {
      errors.push({ id: row.id, reason: detail.message || String(detail.code) });
      console.log(`${tail} 异常 code=${detail.code} ${detail.message}`);
    }
  }

  await sleep(DELAY);
}

function mark(id, status, err) {
  db.prepare(
    `UPDATE resource_links SET status = ?, last_error = ?, checked_at = unixepoch() WHERE id = ?`,
  ).run(status, err, id);
}

console.log(
  `\n${DRY ? "[dry-run] " : ""}有效 ${ok.length} · 失效 ${invalid.length} · 缺码 ${needCode.length} · 异常 ${errors.length}`,
);
if (errors.length) {
  console.log("异常样本：", JSON.stringify(errors.slice(0, 5)));
}
