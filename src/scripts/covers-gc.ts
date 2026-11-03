/**
 * 孤儿封面回收：删掉磁盘上没有任何资源引用的封面文件。
 *   pnpm covers:gc           # 只列出（dry run）
 *   pnpm covers:gc --force   # 真的删
 */
import fs from "node:fs/promises";
import path from "node:path";
import { all } from "../db/client";

const DIR = path.join(process.cwd(), "data", "uploads", "covers");
const FORCE = process.argv.includes("--force");

async function main() {
  let files: string[] = [];
  try {
    files = await fs.readdir(DIR);
  } catch {
    console.log("· 还没有封面目录，跳过");
    return;
  }

  const used = new Set(
    all<{ coverUrl: string | null }>(
      "SELECT cover_url AS coverUrl FROM resources WHERE cover_url IS NOT NULL",
    )
      .map((r) => r.coverUrl ?? "")
      .filter(Boolean)
      .map((u) => decodeURIComponent(u.split("/").pop() ?? "")),
  );

  const orphans = files.filter((f) => f.endsWith(".webp") && !used.has(f));
  let bytes = 0;

  for (const f of orphans) {
    const stat = await fs.stat(path.join(DIR, f)).catch(() => null);
    bytes += stat?.size ?? 0;
  }

  console.log(
    `→ 共 ${files.length} 个文件，被引用 ${used.size} 个，孤儿 ${orphans.length} 个（${Math.round(bytes / 1024)} KB）`,
  );

  if (!orphans.length) return;

  if (!FORCE) {
    for (const f of orphans.slice(0, 20)) console.log(`  · ${f}`);
    console.log("（dry run，加 --force 才会删除）");
    return;
  }

  for (const f of orphans) {
    await fs.unlink(path.join(DIR, f)).catch(() => {});
  }
  console.log(`✓ 已删除 ${orphans.length} 个孤儿封面`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
