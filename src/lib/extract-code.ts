/** 纯函数，客户端与服务端都能用（不要在这里 import node 内置模块） */

const EXTRACT_CODE_RE = /(?:提取码|密码|访问码|pwd)\s*[:：]?\s*([A-Za-z0-9]{4})/i;

/** 从分享文案里嗅探提取码，后台录入时自动填充 */
export function sniffExtractCode(text: string): string | null {
  return text.match(EXTRACT_CODE_RE)?.[1] ?? null;
}
