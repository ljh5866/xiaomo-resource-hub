/**
 * CSV 工具（纯函数，便于单测）。
 * 后台批量导入的列顺序固定为：
 *   标题,slug,分类slug,网盘,链接,提取码,大小,版本,摘要
 */

export const CSV_HEADER =
  "标题,slug,分类slug,网盘,链接,提取码,大小,版本,摘要";

export type CsvRow = {
  title: string;
  slug: string;
  categorySlug: string;
  provider: string;
  url: string;
  extractCode?: string;
  size?: string;
  version?: string;
  summary?: string;
};

/** 含逗号 / 引号 / 换行的字段要用双引号包起来，内部引号写两遍 */
export function csvEscape(value: string | undefined | null): string {
  const v = (value ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function rowToCsv(row: CsvRow): string {
  return [
    row.title,
    row.slug,
    row.categorySlug,
    row.provider,
    row.url,
    row.extractCode,
    row.size,
    row.version,
    row.summary,
  ]
    .map(csvEscape)
    .join(",");
}

export function buildCsv(rows: CsvRow[]): string {
  return [CSV_HEADER, ...rows.map(rowToCsv)].join("\n");
}

/** 解析一行（支持双引号包裹与 "" 转义），与后台导入的宽松解析对齐 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur.trim());
  return out;
}

/** slug：中文标题给稳定短哈希，英文标题转 kebab-case */
export function toSlug(title: string, fallbackIndex = 0): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  if (ascii) return ascii;

  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 1_000_000;
  return `r-${h.toString(36)}-${fallbackIndex}`;
}
