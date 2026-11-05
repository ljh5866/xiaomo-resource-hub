import { z } from "zod";

export const LINK_PROVIDERS = [
  "quark",
  "baidu",
  "aliyun",
  "xunlei",
  "123",
  "uc",
  "115",
  "lanzou",
  "self",
] as const;

export const linkSchema = z.object({
  provider: z.enum(LINK_PROVIDERS),
  url: z.string().url("请填完整链接（含 https://）"),
  extractCode: z.string().max(16).optional().nullable(),
  label: z.string().max(24).optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export const resourceSchema = z.object({
  title: z.string().min(2, "标题至少 2 个字").max(80),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "slug 只能用小写字母、数字、连字符"),
  subtitle: z.string().max(80).optional().nullable(),
  summary: z.string().max(200).optional().nullable(),
  contentMd: z.string().max(20000).optional().nullable(),

  categoryId: z.coerce.number().int().positive("请选择分类"),
  kind: z.enum([
    "software",
    "template",
    "material",
    "course",
    "font",
    "icon",
    "ebook",
    "other",
  ]),
  platforms: z.array(z.string()).default([]),
  version: z.string().max(32).optional().nullable(),
  sizeLabel: z.string().max(24).optional().nullable(),
  language: z.string().max(16).optional().nullable(),
  licenseLabel: z.string().max(16).optional().nullable(),

  sourceUrl: z.string().url().optional().nullable().or(z.literal("")),
  sourceNote: z.string().max(200).optional().nullable(),

  coverUrl: z.string().max(300).optional().nullable(),
  coverBlur: z.string().max(6000).optional().nullable(),

  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isFeatured: z.boolean().default(false),

  seoTitle: z.string().max(80).optional().nullable(),
  seoDesc: z.string().max(200).optional().nullable(),

  tags: z.array(z.string().max(24)).default([]),
  links: z.array(linkSchema).min(1, "至少填一条下载链接"),
});

export type ResourceInput = z.infer<typeof resourceSchema>;
export type LinkInput = z.infer<typeof linkSchema>;
