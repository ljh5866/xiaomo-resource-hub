import test from "node:test";
import assert from "node:assert/strict";
import { CSV_HEADER, buildCsv, csvEscape, parseCsvLine, rowToCsv, toSlug } from "../src/lib/csv.ts";

test("表头列顺序与后台导入一致", () => {
  assert.equal(CSV_HEADER, "标题,slug,分类slug,网盘,链接,提取码,大小,版本,摘要");
});

test("含逗号的字段会被引号包起来", () => {
  assert.equal(csvEscape("a,b"), '"a,b"');
  assert.equal(csvEscape("普通值"), "普通值");
});

test("字段里的双引号写两遍", () => {
  assert.equal(csvEscape('说 "你好"'), '"说 ""你好"""');
});

test("换行会被压成空格（避免破坏单行 CSV）", () => {
  assert.equal(csvEscape("第一行\n第二行"), "第一行 第二行");
});

test("整行按固定顺序拼接", () => {
  const line = rowToCsv({
    title: "标题",
    slug: "demo",
    categorySlug: "template",
    provider: "quark",
    url: "https://pan.quark.cn/s/x",
    extractCode: "m801",
    size: "1.2 GB",
    version: "v1",
    summary: "摘要",
  });
  assert.equal(line, "标题,demo,template,quark,https://pan.quark.cn/s/x,m801,1.2 GB,v1,摘要");
});

test("buildCsv 第一行是表头", () => {
  const csv = buildCsv([
    {
      title: "T",
      slug: "s",
      categorySlug: "template",
      provider: "quark",
      url: "https://x.y/z",
    },
  ]);
  const [head, row] = csv.split("\n");
  assert.equal(head, CSV_HEADER);
  assert.match(row, /^T,s,template,quark,https:\/\/x\.y\/z,,,,$/);
});

test("解析支持引号包裹与转义引号", () => {
  assert.deepEqual(parseCsvLine('a,"b,c",d'), ["a", "b,c", "d"]);
  assert.deepEqual(parseCsvLine('a,"说 ""你好""",c'), ["a", '说 "你好"', "c"]);
});

test("解析后能被 rowToCsv 还原（往返一致）", () => {
  const original = {
    title: "带逗号, 的标题",
    slug: "demo",
    categorySlug: "template",
    provider: "quark",
    url: "https://pan.quark.cn/s/x",
    extractCode: "m801",
    size: "",
    version: "",
    summary: '含 "引号"',
  };
  const round = parseCsvLine(rowToCsv(original));
  assert.deepEqual(round, [
    original.title,
    original.slug,
    original.categorySlug,
    original.provider,
    original.url,
    original.extractCode,
    original.size,
    original.version,
    original.summary,
  ]);
});

test("slug：英文标题转 kebab-case", () => {
  assert.equal(toSlug("Excel Dashboard Pack"), "excel-dashboard-pack");
});

test("slug：中文标题给稳定短哈希（同样输入同样输出）", () => {
  const a = toSlug("数据看板", 1);
  const b = toSlug("数据看板", 1);
  assert.equal(a, b);
  assert.match(a, /^r-[a-z0-9]+-1$/);
});
