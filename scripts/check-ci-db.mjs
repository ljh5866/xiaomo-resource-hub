import { DatabaseSync } from "node:sqlite";
const d = new DatabaseSync("D:/小莫资源站/data/ci-test.db");
const names = d.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
console.log(names.join(","));
console.log(d.prepare("SELECT (SELECT COUNT(*) FROM resources) r, (SELECT COUNT(*) FROM resource_links) l").get());
