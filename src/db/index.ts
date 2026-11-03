import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH =
  process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __xiaomoDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

/** 开发态 HMR 下复用同一个连接，避免 better-sqlite3 句柄泄漏 */
export const db = global.__xiaomoDb ?? createDb();
if (process.env.NODE_ENV !== "production") global.__xiaomoDb = db;

export { schema };
