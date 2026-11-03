/** 网盘 / 平台 / 类型的展示元数据。品牌色一律取低饱和版（DESIGN.md §5.5） */

export type ProviderKey =
  | "quark"
  | "baidu"
  | "aliyun"
  | "xunlei"
  | "123"
  | "uc"
  | "115"
  | "self";

export const PROVIDERS: Record<
  ProviderKey,
  { name: string; short: string; tint: string; note?: string }
> = {
  quark: { name: "夸克网盘", short: "夸克", tint: "#6f8bd4" },
  baidu: { name: "百度网盘", short: "百度", tint: "#5878c4" },
  aliyun: { name: "阿里云盘", short: "阿里", tint: "#6aa9d0" },
  xunlei: { name: "迅雷云盘", short: "迅雷", tint: "#6fa6c9" },
  "123": { name: "123 云盘", short: "123", tint: "#7ba05b" },
  uc: { name: "UC 网盘", short: "UC", tint: "#c08a5a" },
  "115": { name: "115 网盘", short: "115", tint: "#8d7fb8" },
  self: { name: "本站直链", short: "直链", tint: "#c8a44e" },
};

export const PLATFORMS: Record<string, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  web: "Web",
  android: "Android",
  ios: "iOS",
  wps: "WPS",
  office: "Office",
};

export const KINDS: Record<string, string> = {
  software: "软件",
  template: "模板",
  material: "素材",
  course: "教程",
  font: "字体",
  icon: "图标",
  ebook: "电子书",
  other: "其他",
};

export const LICENSE: Record<string, string> = {
  free: "免费",
  oss: "开源",
  trial: "试用",
  paid: "需授权",
};

export const LANGUAGES: Record<string, string> = {
  "zh-CN": "中文",
  zh: "中文",
  en: "英文",
  multi: "多语言",
};

export function providerOf(key: string) {
  return PROVIDERS[key as ProviderKey] ?? { name: key, short: key, tint: "#7a8a80" };
}

export function platformOf(key: string) {
  return PLATFORMS[key] ?? key;
}
