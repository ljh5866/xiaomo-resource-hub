/**
 * 从链接清单生成导入用 CSV。
 *
 *   pnpm import:links links.txt [--cat software] [--out data/import/batch.csv]
 *
 * links.txt 每行一个网盘分享链接（可以带一行标题，用空格或制表符分隔）：
 *   https://pan.quark.cn/s/xxxxxxxx
 *   Excel 模板合集 https://pan.quark.cn/s/yyyyyyyy
 *
 * 会尽量抓取落地页标题；抓不到就用「待补标题 N」，导出后手改即可。
 */
import fs from "node:fs";
import path from "node:path";
import { buildCsv, toSlug, type CsvRow } from "../lib/csv";

const PROVIDER_BY_HOST: [RegExp, string][] = [
  [/pan\.quark\.cn/i, "quark"],
  [/pan\.baidu\.com/i, "baidu"],
  [/aliyundrive\.com|alipan\.com/i, "aliyun"],
  [/pan\.xunlei\.com/i, "xunlei"],
  [/123pan\.com|123684\.com/i, "123"],
];

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? "links.txt";
const catIdx = args.indexOf("--cat");
const category = catIdx >= 0 ? args[catIdx + 1] : "software";
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : "data/import/batch.csv";
/** --dry：只打印预览表格，不写文件（先看一眼标题抓得对不对） */
const DRY = args.includes("--dry");

function providerOf(url: string): string {
  for (const [re, key] of PROVIDER_BY_HOST) if (re.test(url)) return key;
  return "other";
}

async function fetchTitle(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XiaomoImporter/1.0)" },
    });
    if (!res.ok) return null;

    const html = (await res.text()).slice(0, 200_000);
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (og?.[1]) return decode(og[1]).trim();

    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t?.[1]) return decode(t[1]).trim();

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 链接短哈希：保证 slug 与具体链接一一对应（同标题不同链接不撞） */
function shortHash(s: string): string {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1_679_616; // 36^4
  return h.toString(36).padStart(4, "0");
}

function decode(s: string): string {  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** 从链接里猜提取码：?pwd=xxxx / pwd=xxxx / 提取码: xxxx */
function guessCode(line: string): string {
  const m =
    line.match(/[?&]pwd=([a-z0-9]{2,8})/i) ??
    line.match(/(?:^|[\s|｜])pwd=([a-z0-9]{2,8})/i) ??
    line.match(/(?:提取码|code)[:：\s]*([a-z0-9]{4,8})/i);
  return m?.[1] ?? "";
}

async function main() {
  if (!fs.existsSync(file)) {
    console.error(`找不到链接清单：${file}`);
    console.error("用法：pnpm import:links links.txt [--cat software] [--out data/import/batch.csv]");
    process.exit(1);
  }

  const lines = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const urlLines = lines.filter((l) => /https?:\/\//i.test(l));
  console.log(`→ 共 ${urlLines.length} 个链接，开始抓标题（失败的留空待补）`);
  if (DRY) console.log("→ dry run：只预览，不写文件\n");

  const rows: CsvRow[] = [];

  for (const [i, line] of urlLines.entries()) {
    const urlMatch = line.match(/https?:\/\/\S+/i);
    const url = urlMatch?.[0] ?? "";
    const inlineTitle = line
      .replace(url, "")
      .replace(/(?:^|[\s|｜?&])pwd=[a-z0-9]{2,8}/gi, " ")
      .replace(/(?:提取码|密码|code)[:：\s]*[a-z0-9]{2,8}/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const fetched = inlineTitle || (await fetchTitle(url)) || `待补标题 ${i + 1}`;
    const title = fetched.replace(/\s*[-_|｜].*$/, "").slice(0, 80) || `待补标题 ${i + 1}`;

    rows.push({
      title,
      // slug 追加链接短哈希：同标题不同链接不会撞，重复导同一链接会被识别为已存在
      slug: `${toSlug(title, i + 1)}-${shortHash(url)}`,
      categorySlug: category,
      provider: providerOf(url),
      url,
      extractCode: guessCode(line),
      size: "",
      version: "",
      summary: "",
    });

    console.log(`   ${i + 1}. ${title}  ·  ${providerOf(url)}`);
  }

  const pad = (s: string, n: number) =>
    [...s].length > n ? [...s].slice(0, n - 1).join("") + "…" : s + " ".repeat(n - [...s].length);

  if (DRY) {
    console.log(`${pad("标题", 30)} ${pad("分类", 10)} ${pad("网盘", 8)} 提取码`);
    for (const r of rows) {
      console.log(
        `${pad(r.title, 30)} ${pad(r.categorySlug, 10)} ${pad(r.provider, 8)} ${r.extractCode || "-"}`,
      );
    }
    console.log("\n（预览结束，去掉 --dry 就会生成 CSV）");
    return;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  // 加 BOM：Excel 打开不乱码
  fs.writeFileSync(outFile, "\ufeff" + buildCsv(rows), "utf8");

  console.log(`✓ 已生成 ${outFile}（${rows.length} 行）`);
  console.log("   下一步：打开检查标题/分类，再粘到 后台 → 批量导入");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
