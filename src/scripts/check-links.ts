/**
 * 链接巡检：pnpm links:check [--limit 200] [--dry]
 * 逻辑在 src/lib/link-check.ts，后台的「一键复测」走同一份实现。
 */
import { checkLinks } from "../lib/link-check";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg
  ? Number(limitArg.includes("=") ? limitArg.split("=")[1] : args[args.indexOf(limitArg) + 1])
  : 200;
const DRY = args.includes("--dry");

const r = await checkLinks({ limit: Number.isFinite(LIMIT) ? LIMIT : 200, dry: DRY });

console.log(
  `→ 待检 ${r.candidates} 条；跳过示例域名 ${r.skipped} 条；实际检测 ${r.checked} 条${DRY ? "（dry run）" : ""}`,
);

for (const d of r.details) {
  console.log(d.ok ? `  ✓ ${d.url.slice(0, 72)}` : `  × ${d.url.slice(0, 60)} — ${d.error}`);
}

console.log(`✓ 完成：有效 ${r.ok} / 失效 ${r.invalid} / 待复检 ${r.unknown} / 跳过 ${r.skipped}`);
