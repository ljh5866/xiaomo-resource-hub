import { DatabaseSync } from "node:sqlite";
const d = new DatabaseSync("data/app.db");
const one = (sql) => d.prepare(sql).get().n;
console.log({
  真实资源: one("SELECT COUNT(*) n FROM resources WHERE slug NOT LIKE 'bulk-%' AND status='published'"),
  压测资源: one("SELECT COUNT(*) n FROM resources WHERE slug LIKE 'bulk-%'"),
  草稿: one("SELECT COUNT(*) n FROM resources WHERE status='draft'"),
  链接: one("SELECT COUNT(*) n FROM resource_links"),
  死链: one("SELECT COUNT(*) n FROM resource_links WHERE status='invalid'"),
  举报: one("SELECT COUNT(*) n FROM reports"),
  投稿: one("SELECT COUNT(*) n FROM submissions"),
  用户: one("SELECT COUNT(*) n FROM users"),
});
