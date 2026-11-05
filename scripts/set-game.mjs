/**
 * 批量修改资源的「所属游戏」标签
 *
 *   node scripts/set-game.mjs minecraft --all --dry
 *   node scripts/set-game.mjs minecraft --all                 # 全部资源归到我的世界
 *   node scripts/set-game.mjs sekiro --category mods          # 某分类下全部
 *   node scripts/set-game.mjs sekiro --unassigned             # 只处理还没归类的
 *   node scripts/set-game.mjs sekiro --from minecraft         # 从旧游戏迁过来
 *   node scripts/set-game.mjs sekiro --ids 12,13,14
 *
 * 一个资源只保留一个游戏标签：会先删掉它原来的游戏标签再挂新的。
 */
const args = process.argv.slice(2);
const gameSlug = args.find((a) => !a.startsWith("--"));
const dry = args.includes("--dry");

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

if (!gameSlug) {
  console.error("用法: node scripts/set-game.mjs <gameSlug> [--all|--unassigned|--category slug|--from slug|--ids 1,2] [--dry]");
  process.exit(1);
}

const { previewBulkGame, applyBulkGame } = await import("../src/lib/games/bulk.ts");

let scope = { kind: "all" };
if (args.includes("--unassigned")) scope = { kind: "unassigned" };
else if (valueOf("--category")) scope = { kind: "category", slug: valueOf("--category") };
else if (valueOf("--from")) scope = { kind: "game", slug: valueOf("--from") };
else if (valueOf("--ids")) {
  scope = {
    kind: "ids",
    ids: valueOf("--ids")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
  };
}

const preview = previewBulkGame(gameSlug, scope);
if (!preview) {
  console.error(`✗ 找不到游戏标签「${gameSlug}」，或者它的类型不是 game`);
  console.error("  先到后台「游戏分类」里新增，或检查 slug");
  process.exit(1);
}

console.log(`\n目标游戏：${preview.gameName}（${gameSlug}）`);
console.log(`范围内资源：${preview.total} 条，其中需要改：${preview.willChange} 条`);
if (preview.sample.length) {
  console.log("\n样例：");
  for (const r of preview.sample) {
    console.log(`  ${r.code}  ${r.title}   ${r.current ?? "（未归类）"} → ${preview.gameName}`);
  }
}

if (dry) {
  console.log("\n（预演，未写库）");
  process.exit(0);
}

const res = applyBulkGame(gameSlug, scope);
if (!res.ok) {
  console.error(`✗ ${res.message}`);
  process.exit(1);
}
console.log(`\n✓ 已把 ${res.updated} 条资源的游戏标签设为「${res.gameName}」`);
