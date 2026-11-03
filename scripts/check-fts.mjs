import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
const opt = db
  .prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS v, sqlite_version() AS ver")
  .get();
console.log("sqlite:", opt.ver, "fts5:", opt.v);

try {
  db.exec("CREATE VIRTUAL TABLE t USING fts5(body)");
  db.prepare("INSERT INTO t(body) VALUES (?)").run("excel dashboard 模板 看板");
  const rows = db.prepare("SELECT body FROM t WHERE t MATCH ?").all("看板");
  console.log("match ok:", rows);
} catch (e) {
  console.log("FTS5 FAIL:", e.message);
}
