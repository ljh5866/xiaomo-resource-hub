/**
 * 清空内容数据（保留分类、标签、账号）。
 *
 *   pnpm db:clean:content --dry     # 只看会删什么
 *   pnpm db:clean:content           # 真删
 *
 * 会清：resources / resource_links / resource_tags / favorites /
 *       reports / submissions / download_events / 搜索索引
 * 保留：categories / tags / users
 */
import { all, exec, get, run } from "../db/client";
import { reindexAll } from "../lib/search/fts";

const DRY = process.argv.includes("--dry");

const counts = {
  resources: get<{ n: number }>("SELECT COUNT(*) AS n FROM resources")?.n ?? 0,
  links: get<{ n: number }>("SELECT COUNT(*) AS n FROM resource_links")?.n ?? 0,
  favorites: get<{ n: number }>("SELECT COUNT(*) AS n FROM favorites")?.n ?? 0,
  reports: get<{ n: number }>("SELECT COUNT(*) AS n FROM reports")?.n ?? 0,
  submissions: get<{ n: number }>("SELECT COUNT(*) AS n FROM submissions")?.n ?? 0,
  events: get<{ n: number }>("SELECT COUNT(*) AS n FROM download_events")?.n ?? 0,
};

console.log("将要清理：");
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);

const keep = {
  categories: get<{ n: number }>("SELECT COUNT(*) AS n FROM categories")?.n ?? 0,
  tags: get<{ n: number }>("SELECT COUNT(*) AS n FROM tags")?.n ?? 0,
  users: get<{ n: number }>("SELECT COUNT(*) AS n FROM users")?.n ?? 0,
};
console.log("保留：", keep);

if (DRY) {
  console.log("\n（dry run，加 --dry 之外的调用才真删）");
  process.exit(0);
}

// 顺序：先删子表，再删主表
run("DELETE FROM favorites");
run("DELETE FROM reports");
run("DELETE FROM download_events");
run("DELETE FROM resource_tags");
run("DELETE FROM resource_links");
run("DELETE FROM submissions");
run("DELETE FROM resources");

// 自增 id 归零，让新导入的数据从 1 开始编号更整齐
exec("DELETE FROM sqlite_sequence WHERE name IN ('resources','resource_links','reports','submissions')");

// 标签使用次数全部归零
run("UPDATE tags SET use_count = 0");

const indexed = reindexAll();

const after = get<{ n: number }>("SELECT COUNT(*) AS n FROM resources")?.n ?? 0;
console.log(`\n✓ 已清空：resources=${after}，索引重建 ${indexed} 条`);
console.log("  分类 / 标签 / 账号已保留，可以直接开始导入自己的数据。");
