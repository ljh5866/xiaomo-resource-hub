import type { ResourceCardData } from "@/components/resource/resource-card";
import { searchResources } from "@/lib/queries";
import { ensureFts, ftsCount, searchFts } from "./fts";

/**
 * 搜索适配层：调用方只认 search(q, opts)。
 * 换实现 = 只改这一个目录。
 *
 * "fts"  ：FTS5 + 2-gram 中文切词（./tokenize），bm25 排序
 * "like" ：SQL LIKE 兜底；FTS 无命中或索引为空时自动回落
 *
 * 想换成 Meilisearch：在下面 switch 里加一个分支即可，页面零改动。
 */

export type SearchMode = "fts" | "like";

export const SEARCH_MODE: SearchMode = "fts";

export type SearchOptions = {
  categorySlug?: string;
  limit?: number;
};

export async function search(
  q: string,
  opts: SearchOptions = {},
): Promise<ResourceCardData[]> {
  const term = q.trim();
  if (!term) return searchResources("", opts);

  if (SEARCH_MODE === "fts") {
    ensureFts();

    if (ftsCount() > 0) {
      const hits = searchFts(term, opts);
      // 2-gram 召回不到时（错别字、极长尾），退回子串匹配
      if (hits.length > 0) return hits;
    }
  }

  return searchResources(term, opts);
}

export { ensureFts, ftsCount, reindexAll, reindexOne } from "./fts";
export { tokenize } from "./tokenize";
