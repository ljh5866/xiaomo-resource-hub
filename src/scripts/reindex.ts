/**
 * 重建搜索索引：pnpm db:reindex
 * 何时用：改了 tokenize 规则、手工改过库、怀疑索引与资源不一致。
 */
import { ftsCount, reindexAll } from "../lib/search/fts";

const n = reindexAll();
console.log(`✓ 已重建 ${n} 条索引（当前表内 ${ftsCount()} 条）`);
