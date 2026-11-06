/**
 * 下载 3DM 软件封面 → data/import/3dmsoft/covers/3dm-<id>.jpg
 *
 *   node scripts/fetch-3dmsoft-covers.mjs
 *
 * 服务器在香港访问 3dm 图床可能很慢，所以这一步放在本地做，
 * 之后连同 3dmsoft.json 一起打包，传到服务器再跑 import-3dmsoft.mjs。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SRC = "data/import/3dmsoft.json";
const DIR = "data/import/3dmsoft/covers";
const DELAY = Number(process.env.DELAY ?? 150);

const rows = JSON.parse(readFileSync(SRC, "utf8"));
mkdirSync(DIR, { recursive: true });

let ok = 0;
let skip = 0;
let fail = 0;

for (const r of rows) {
  const file = join(DIR, `3dm-${r.id}.jpg`);
  if (existsSync(file)) {
    skip += 1;
    continue;
  }
  if (!r.cover) {
    fail += 1;
    continue;
  }
  try {
    const res = await fetch(r.cover, {
      headers: { "user-agent": UA, referer: "https://soft.3dmgame.com/" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error(`too small ${buf.length}`);
    writeFileSync(file, buf);
    ok += 1;
    if (ok % 40 === 0) console.log(`  已下载 ${ok} 张…`);
  } catch (e) {
    fail += 1;
    console.log(`  ✗ ${r.id} ${String(e.message).slice(0, 60)}`);
  }
  await new Promise((r2) => setTimeout(r2, DELAY));
}

console.log(`\n封面：成功 ${ok} · 已存在 ${skip} · 失败 ${fail} → ${DIR}`);
