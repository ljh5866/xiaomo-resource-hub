import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* 分类                                                                */
/* ------------------------------------------------------------------ */
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("folder"),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
});

/* ------------------------------------------------------------------ */
/* 资源（核心表）                                                       */
/* ------------------------------------------------------------------ */
export const resources = sqliteTable(
  "resources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** 目录编号，如 XM-2026-0417，独立于自增 id，可被外部引用 */
    code: text("code").notNull().unique(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    summary: text("summary"),
    contentMd: text("content_md"),

    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    kind: text("kind").notNull().default("other"),
    /** JSON 数组字符串：["windows","mac","web"] */
    platforms: text("platforms").notNull().default("[]"),
    version: text("version"),
    sizeLabel: text("size_label"),
    language: text("language").default("zh-CN"),
    licenseLabel: text("license_label"),

    coverUrl: text("cover_url"),
    coverBlur: text("cover_blur"),

    sourceUrl: text("source_url"),
    sourceNote: text("source_note"),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),

    status: text("status").notNull().default("draft"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),

    viewCount: integer("view_count").notNull().default(0),
    downloadCount: integer("download_count").notNull().default(0),
    favoriteCount: integer("favorite_count").notNull().default(0),

    seoTitle: text("seo_title"),
    seoDesc: text("seo_desc"),

    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_resources_cat_status").on(t.categoryId, t.status, t.publishedAt),
    index("idx_resources_updated").on(t.updatedAt),
    index("idx_resources_featured").on(t.isFeatured),
  ],
);

/* ------------------------------------------------------------------ */
/* 下载链接（资源站的生命线）                                            */
/* ------------------------------------------------------------------ */
export const resourceLinks = sqliteTable(
  "resource_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    /** baidu | quark | aliyun | xunlei | 123 | uc | 115 | self */
    provider: text("provider").notNull(),
    url: text("url").notNull(),
    /** sha256(url)，全站去重 */
    urlHash: text("url_hash").notNull(),
    extractCode: text("extract_code"),
    label: text("label"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    /** ok | invalid | unknown | checking */
    status: text("status").notNull().default("unknown"),
    checkedAt: integer("checked_at", { mode: "timestamp" }),
    failCount: integer("fail_count").notNull().default(0),
    lastError: text("last_error"),

    clickCount: integer("click_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("uq_link_resource_hash").on(t.resourceId, t.urlHash),
    index("idx_links_status").on(t.status, t.checkedAt),
  ],
);

/* ------------------------------------------------------------------ */
/* 标签                                                                */
/* ------------------------------------------------------------------ */
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  useCount: integer("use_count").notNull().default(0),
});

export const resourceTags = sqliteTable(
  "resource_tags",
  {
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.tagId] })],
);

/* ------------------------------------------------------------------ */
/* 用户与行为                                                           */
/* ------------------------------------------------------------------ */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),
  /** scrypt$N$salt$hash；见 src/lib/password.ts */
  passwordHash: text("password_hash"),
  /** 会话版本：+1 即可让该用户所有旧 JWT 失效 */
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const favorites = sqliteTable(
  "favorites",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.resourceId] })],
);

export const downloadEvents = sqliteTable(
  "download_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    linkId: integer("link_id").references(() => resourceLinks.id, {
      onDelete: "set null",
    }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** 只存哈希，不存明文 IP */
    ipHash: text("ip_hash"),
    uaFamily: text("ua_family"),
    refererHost: text("referer_host"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("idx_downloads_resource").on(t.resourceId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* 失效举报                                                             */
/* ------------------------------------------------------------------ */
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resourceId: integer("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  linkId: integer("link_id").references(() => resourceLinks.id, {
    onDelete: "set null",
  }),
  reason: text("reason").notNull().default("link-dead"),
  contact: text("contact"),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  handledAt: integer("handled_at", { mode: "timestamp" }),
});

/* ------------------------------------------------------------------ */
/* 关系                                                                 */
/* ------------------------------------------------------------------ */
export const categoriesRelations = relations(categories, ({ many }) => ({
  resources: many(resources),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  category: one(categories, {
    fields: [resources.categoryId],
    references: [categories.id],
  }),
  links: many(resourceLinks),
  resourceTags: many(resourceTags),
}));

export const resourceLinksRelations = relations(resourceLinks, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceLinks.resourceId],
    references: [resources.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  resourceTags: many(resourceTags),
}));

export const resourceTagsRelations = relations(resourceTags, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceTags.resourceId],
    references: [resources.id],
  }),
  tag: one(tags, { fields: [resourceTags.tagId], references: [tags.id] }),
}));

export type Resource = typeof resources.$inferSelect;
export type ResourceLink = typeof resourceLinks.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
