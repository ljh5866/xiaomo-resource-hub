import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * 运行时数据访问：Node 24 内建的 node:sqlite（无原生扩展、无需编译）。
 *
 * 为什么不用 better-sqlite3：在 Node 24 + Next 16 的进程模型下，原生 Statement
 * 的析构会在 env teardown 之后触发断言（RemoveEnvironmentCleanupHook: env != nullptr），
 * 进程直接 abort（exit 134）。内建 sqlite 没有这个生命周期问题。
 *
 * 迁移与种子仍走 drizzle-kit + better-sqlite3 工具链（脚本进程，不常驻）。
 */

const DB_PATH =
  process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.db");

type Param = string | number | null | bigint | Uint8Array;

let cached: DatabaseSync | null = null;
let disabled = false;

function conn(): DatabaseSync | null {
  if (cached) return cached;
  if (disabled) return null;

  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    // 构建期多个 worker 同时开库时不至于互相拖死
    for (const pragma of [
      "PRAGMA journal_mode = WAL;",
      "PRAGMA foreign_keys = ON;",
      "PRAGMA busy_timeout = 4000;",
    ]) {
      try {
        db.exec(pragma);
      } catch {
        /* pragma 失败不影响查询 */
      }
    }
    cached = db;
    return db;
  } catch (err) {
    disabled = true;
    console.warn("[sqlite] open failed:", (err as Error).message);
    return null;
  }
}

function normalize(params: Param[]): Param[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

/** node:sqlite 返回的是 null-prototype 对象，必须转成普通对象才能传给 Client Component */
function plain<T>(row: T): T {
  return { ...(row as object) } as T;
}

export function all<T = Record<string, unknown>>(sql: string, ...params: Param[]): T[] {
  const db = conn();
  if (!db) return [];
  try {
    const rows = db.prepare(sql).all(...normalize(params)) as T[];
    return rows.map((r) => plain(r));
  } catch (err) {
    console.warn("[sql:all]", (err as Error).message, "|", sql.slice(0, 80));
    return [];
  }
}

export function get<T = Record<string, unknown>>(sql: string, ...params: Param[]): T | null {
  const db = conn();
  if (!db) return null;
  try {
    const row = db.prepare(sql).get(...normalize(params)) as T | undefined;
    return row ? plain(row) : null;
  } catch (err) {
    console.warn("[sql:get]", (err as Error).message, "|", sql.slice(0, 80));
    return null;
  }
}

export function run(sql: string, ...params: Param[]): void {
  const db = conn();
  if (!db) return;
  try {
    db.prepare(sql).run(...normalize(params));
  } catch (err) {
    console.warn("[sql:run]", (err as Error).message, "|", sql.slice(0, 80));
  }
}

/** 多语句执行（建表、virtual table、pragma） */
export function exec(sql: string): boolean {
  const db = conn();
  if (!db) return false;
  try {
    db.exec(sql);
    return true;
  } catch (err) {
    console.warn("[sql:exec]", (err as Error).message, "|", sql.slice(0, 80));
    return false;
  }
}

/** 库里时间统一存 unix 秒 */
export function ts(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? new Date(n * 1000) : null;
}
