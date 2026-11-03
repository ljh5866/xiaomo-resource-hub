import { sql } from "drizzle-orm";
import { db } from "../db";

const rows = db.all<{ name: string }>(
  sql`select name from sqlite_master where type='table' order by name`,
);
console.log("DATABASE_URL =", process.env.DATABASE_URL);
console.log("cwd =", process.cwd());
console.log("tables =", rows.map((r) => r.name).join(","));
