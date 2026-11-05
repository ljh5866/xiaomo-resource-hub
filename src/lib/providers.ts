/**
 * 网盘链接识别：把 URL 归类到本站的 provider 枚举
 *
 * 只认网盘域名；官方站、B站、论坛这些一律返回 null（导入时会被丢弃）。
 */

export type ProviderKey =
  | "quark"
  | "baidu"
  | "aliyun"
  | "xunlei"
  | "123"
  | "uc"
  | "115"
  | "lanzou"
  | "self";

/** 域名 → provider。顺序有讲究：先匹配更具体的域名 */
const RULES: [RegExp, ProviderKey][] = [
  [/pan\.quark\.cn/i, "quark"],
  [/pan\.baidu\.com|yun\.baidu\.com|eyun\.baidu\.com/i, "baidu"],
  [/aliyundrive\.com|alipan\.com/i, "aliyun"],
  [/pan\.xunlei\.com/i, "xunlei"],
  [/123pan\.com|123684\.com|123865\.com/i, "123"],
  [/drive\.uc\.cn/i, "uc"],
  [/115\.com|115cdn\.com/i, "115"],
  [/lanzou[a-z]?\.com|lanzn\.com|lanzouw\.com|lanzoup\.com|lanzoux\.com/i, "lanzou"],
];

export function providerOf(url: string): ProviderKey | null {
  for (const [re, key] of RULES) {
    if (re.test(url)) return key;
  }
  return null;
}

/** 提取码：从 URL 的 pwd=/password=/code= 或文案里的「提取码: xxxx」拿 */
export function extractCode(url: string, text = ""): string | null {
  const fromUrl = url.match(/[?&](?:pwd|password|passcode|code)=([A-Za-z0-9]{4,8})/);
  if (fromUrl) return fromUrl[1];
  const fromText = text.match(/提取码[::]?\s*([A-Za-z0-9]{4,8})/);
  return fromText ? fromText[1] : null;
}
