import { searchFts } from "../lib/search/fts";
import { tokenize } from "../lib/search/tokenize";

const queries = [
  "字体",
  "看板",
  "视频 剪辑",
  "excel",
  "笔记",
  "简历",
  "PPT 模板",
  "图标",
  "不存在的东西",
];

console.log("tokenize('数据看板') =", tokenize("数据看板"));
console.log("tokenize('Excel模板v3.2') =", tokenize("Excel模板v3.2"));
console.log("---");

for (const q of queries) {
  const rows = searchFts(q, { limit: 5 });
  console.log(
    `「${q}」→ ${rows.length} 条`,
    rows.map((r) => r.title.slice(0, 18)).join(" | "),
  );
}
