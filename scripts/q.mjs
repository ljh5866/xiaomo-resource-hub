import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("./data/app.db");
const rows = db.prepare("SELECT id, code, slug, title FROM resources ORDER BY id LIMIT 3").all();
console.log(JSON.stringify(rows, null, 2));
const stats = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM resources) AS res,
            (SELECT COUNT(*) FROM resource_links) AS links,
            (SELECT COUNT(*) FROM tags) AS tags,
            (SELECT COUNT(*) FROM resources_fts) AS idx`,
  )
  .get();
console.log(stats);
