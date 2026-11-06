/**
 * 资源扩展信息（resources.meta_json）
 *
 * 不同来源站点的字段结构不一样，这里做一层归一：写入端（抓取脚本）只负责塞 JSON，
 * 展示端（详情页 / 后台）统一走 parseResourceMeta + metaRows，缺字段自动跳过。
 */

export type ResourceMeta = {
  /** 数据来源站，如 "TouchGal" */
  source?: string;
  /** 原名（日文/英文），与站内中文标题不同时才展示 */
  originalTitle?: string;
  /** 别名 / 罗马音 / 简称 */
  aliases?: string[];
  /** 制作会社 / 开发商 */
  company?: string;
  /** 发售日期 YYYY-MM-DD */
  releaseDate?: string;
  /** 资源形态：游戏本体 / 汉化补丁 / 存档 / CG … */
  resourceTypes?: string[];
  platforms?: string[];
  languages?: string[];
  /** 评分（10 分制或来源站分值，原样展示） */
  rating?: number | string;
  views?: string;
  favorites?: number;
  /** 外部 ID，便于回源核对 */
  vndb?: string;
  bangumi?: string;
  /** 官方网站 / 购买页 */
  officialUrl?: string;
  tags?: string[];
  /** 抓取时间戳（秒） */
  fetchedAt?: number;
};

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];

const asText = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim();
  return s ? s : undefined;
};

/** 解析 meta_json；空值/坏 JSON 一律返回 null，不抛错 */
export function parseResourceMeta(raw: string | null | undefined): ResourceMeta | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object") return null;
    const meta: ResourceMeta = {
      source: asText(obj.source),
      originalTitle: asText(obj.originalTitle),
      aliases: asArray(obj.aliases),
      company: asText(obj.company),
      releaseDate: asText(obj.releaseDate),
      resourceTypes: asArray(obj.resourceTypes),
      platforms: asArray(obj.platforms),
      languages: asArray(obj.languages),
      rating: (obj.rating as number | string) ?? undefined,
      views: asText(obj.views),
      favorites: typeof obj.favorites === "number" ? obj.favorites : undefined,
      vndb: asText(obj.vndb),
      bangumi: asText(obj.bangumi),
      officialUrl: asText(obj.officialUrl),
      tags: asArray(obj.tags),
      fetchedAt: typeof obj.fetchedAt === "number" ? obj.fetchedAt : undefined,
    };
    // 全空视为没有
    const hasAny = Object.entries(meta).some(([k, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "",
    );
    return hasAny ? meta : null;
  } catch {
    return null;
  }
}

export type MetaRow = { label: string; value: string; href?: string };

/**
 * 生成「作品信息」表的行。
 * @param meta 解析后的扩展信息
 * @param title 站内标题（原名与之相同则不重复展示）
 */
export function metaRows(meta: ResourceMeta | null, title?: string): MetaRow[] {
  if (!meta) return [];
  const rows: MetaRow[] = [];
  const push = (label: string, value?: string | null, href?: string) => {
    if (value && value.trim()) rows.push({ label, value: value.trim(), href });
  };

  if (meta.originalTitle && meta.originalTitle !== title) push("原名", meta.originalTitle);
  if (meta.aliases?.length) push("别名", meta.aliases.slice(0, 4).join(" / "));
  if (meta.company) push("会社", meta.company);
  if (meta.releaseDate) push("发售", meta.releaseDate);
  if (meta.resourceTypes?.length) push("形态", meta.resourceTypes.join(" / "));
  if (meta.languages?.length) push("语言", meta.languages.join(" / "));
  if (meta.rating !== undefined && meta.rating !== "") push("评分", String(meta.rating));
  if (meta.views) push("浏览", meta.views);
  if (meta.favorites) push("收藏", String(meta.favorites));
  if (meta.vndb) push("VNDB", meta.vndb, `https://vndb.org/${meta.vndb}`);
  if (meta.bangumi) push("Bangumi", meta.bangumi, `https://bgm.tv/subject/${meta.bangumi}`);
  if (meta.officialUrl) push("官网", new URL(meta.officialUrl).host, meta.officialUrl);
  if (meta.tags?.length) push("标签", meta.tags.slice(0, 8).join(" / "));

  return rows;
}
