/** 清理端到端测试产生的数据：pnpm exec tsx src/scripts/cleanup-test.ts */
import { all, run } from "../db/client";
import { reindexAll } from "../lib/search/fts";

const rows = all<{ id: number; slug: string }>(
  "SELECT id, slug FROM resources WHERE slug LIKE 'e2e-test-%' OR slug IN ('figma-kit-demo','fin-model-demo')",
);

for (const r of rows) {
  run("DELETE FROM resource_links WHERE resource_id = ?", r.id);
  run("DELETE FROM resource_tags WHERE resource_id = ?", r.id);
  run("DELETE FROM resources WHERE id = ?", r.id);
  run("DELETE FROM resources_fts WHERE resource_id = ?", r.id);
  console.log("deleted", r.slug);
}

const n = reindexAll();
const left = all<{ n: number }>("SELECT COUNT(*) AS n FROM resources")[0]?.n ?? 0;
console.log(`✓ 清理完成，资源剩余 ${left} 条，索引重建 ${n} 条`);
