/**
 * 从用户粘贴的内容里抽出 Cookie。
 *
 * 支持四种粘法（都是浏览器 DevTools 里能直接拿到的）：
 *   ① 纯 Cookie 行：__pus=…; __puus=…
 *   ② 带前缀：Cookie: __pus=…
 *   ③ Copy as cURL：-H 'cookie: __pus=…'
 *   ④ Copy as cURL：-b '…'
 *
 * 第 ③ 种对新手最友好 —— 右键请求整段复制，不用在一堆头里找。
 * 注意：本文件**不能**加 "use server"（Server Action 文件只能导出 async 函数）。
 */
export function extractCookie(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  const header = text.match(/(?:-H|--header)\s+['"]cookie:\s*([^'"]+)['"]/i);
  if (header?.[1]) return header[1].replace(/\s+/g, " ").trim();

  const cookieFlag = text.match(/(?:-b|--cookie)\s+['"]([^'"]+)['"]/i);
  if (cookieFlag?.[1]) return cookieFlag[1].replace(/\s+/g, " ").trim();

  return text
    .replace(/^cookie:\s*/i, "")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}
