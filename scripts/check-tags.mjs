import { DatabaseSync } from "node:sqlite";
const d = new DatabaseSync("data/app.db");
const tags = d.prepare("SELECT id, name, use_count AS u FROM tags ORDER BY use_count ASC LIMIT 6").all();
console.log("低用量标签:", tags);
const mac = d.prepare("SELECT id FROM tags WHERE name = 'macOS'").get();
if (mac) {
  console.log(
    "macOS 关联资源数:",
    d.prepare("SELECT COUNT(*) AS n FROM resource_tags WHERE tag_id = ?").get(mac.id),
  );
}
console.log("标签总数:", d.prepare("SELECT COUNT(*) AS n FROM tags").get());
