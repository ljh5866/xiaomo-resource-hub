/**
 * 中文友好的切词：纯 JS，无原生依赖。
 *
 * 为什么不用 jieba：better-sqlite3 那次教训（见 docs/04）说明原生扩展在
 * Node 24 + Next 16 的进程模型下会带来生命周期风险。napi 库同样可能踩到。
 * 2-gram 的召回率对"资源标题/摘要"这种短文本足够，且零依赖、零构建。
 *
 * 规则：
 *  - 英文/数字：整词保留（excel、v3、2026）
 *  - 中文：连续汉字切 2-gram（"数据看板" → 数据 / 据看 / 看板），单字保留 1-gram
 *  - 去重、去空
 *  - 索引与查询用同一个函数，保证对称
 */

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const ALNUM = /[a-z0-9]/;

function bigrams(s: string): string[] {
  if (s.length === 1) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

export function tokenize(input: string): string[] {
  const text = (input ?? "").toLowerCase();
  const out: string[] = [];

  let cjkBuf = "";
  let wordBuf = "";

  const flushCjk = () => {
    if (!cjkBuf) return;
    out.push(...bigrams(cjkBuf));
    cjkBuf = "";
  };
  const flushWord = () => {
    if (!wordBuf) return;
    out.push(wordBuf);
    wordBuf = "";
  };

  for (const ch of text) {
    if (CJK.test(ch)) {
      flushWord();
      cjkBuf += ch;
    } else if (ALNUM.test(ch)) {
      flushCjk();
      wordBuf += ch;
    } else {
      flushCjk();
      flushWord();
    }
  }
  flushCjk();
  flushWord();

  return [...new Set(out.filter((t) => t.length > 0))];
}

/** 索引侧：空格拼接，直接喂给 FTS5 */
export function tokenizeToIndex(input: string): string {
  return tokenize(input).join(" ");
}

/** 查询侧：OR 连接，任一 2-gram 命中即可召回，再靠 bm25 排序 */
export function toMatchExpr(query: string): string {
  const tokens = tokenize(query);
  if (!tokens.length) return "";
  return tokens.map((t) => `"${t.replaceAll('"', '""')}"`).join(" OR ");
}
