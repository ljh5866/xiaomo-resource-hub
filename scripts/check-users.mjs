import { DatabaseSync } from "node:sqlite";
const d = new DatabaseSync("D:/小莫资源站/data/app.db");
console.log(d.prepare("SELECT id,email,role,token_version FROM users").all());
