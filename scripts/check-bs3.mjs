import Database from "better-sqlite3";

const p = "D:/小莫资源站/data/ci-test.db";
const db = new Database(p, { readonly: true });
const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("better-sqlite3 sees:", names.map((r) => r.name).join(","));
console.log("file:", db.name);
db.close();
