"use server";

import { revalidatePath } from "next/cache";
import { get, run } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import { hashUrl, sniffExtractCode } from "@/lib/links";
import { reindexOne } from "@/lib/search/fts";
import { resourceSchema, type ResourceInput } from "./schema";

export type ActionResult =
  | { ok: true; id?: number; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** 所有写操作都先过一遍管理员校验（middleware 只拦页面，不该只靠它） */
async function guard(): Promise<ActionResult | null> {
  const admin = await requireAdmin();
  return admin ? null : { ok: false, message: "需要管理员登录" };
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function slugifyTag(name: string) {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii) return ascii;
  // 中文标签：用稳定短哈希当 slug，展示仍用原名
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 1_000_000;
  return `t-${h.toString(36)}`;
}

function nextCode(): string {
  const year = new Date().getFullYear();
  const row = get<{ n: number }>(
    "SELECT COALESCE(MAX(CAST(substr(code, 9) AS INTEGER)), 0) + 1 AS n FROM resources WHERE code LIKE ?",
    `XM-${year}-%`,
  );
  const seq = row?.n ?? 1;
  return `XM-${year}-${String(seq).padStart(4, "0")}`;
}

function refreshPaths(slug?: string) {
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/updates");
  revalidatePath("/admin");
  revalidatePath("/admin/resources");
  if (slug) revalidatePath(`/r/${slug}`);
}

/* ------------------------------------------------------------------ */

export async function saveResource(
  input: unknown,
  id?: number,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "有字段没填对，按提示改一下", fieldErrors };
  }

  const d = parsed.data;

  const slugTaken = get<{ id: number }>(
    "SELECT id FROM resources WHERE slug = ? AND id != ?",
    d.slug,
    id ?? -1,
  );
  if (slugTaken) return { ok: false, message: `slug「${d.slug}」已被占用`, fieldErrors: { slug: "重复" } };

  const ts = nowSec();
  const platforms = JSON.stringify(d.platforms ?? []);
  let resourceId = id ?? 0;

  if (id) {
    run(
      `UPDATE resources SET
         slug = ?, title = ?, subtitle = ?, summary = ?, content_md = ?,
         category_id = ?, kind = ?, platforms = ?, version = ?, size_label = ?,
         language = ?, license_label = ?, source_url = ?, source_note = ?,
         cover_url = ?, cover_blur = ?,
         status = ?, is_featured = ?, seo_title = ?, seo_desc = ?,
         verified_at = ?, updated_at = ?
       WHERE id = ?`,
      d.slug,
      d.title,
      d.subtitle ?? null,
      d.summary ?? null,
      d.contentMd ?? null,
      d.categoryId,
      d.kind,
      platforms,
      d.version ?? null,
      d.sizeLabel ?? null,
      d.language ?? "zh-CN",
      d.licenseLabel ?? "free",
      d.sourceUrl || null,
      d.sourceNote ?? null,
      d.coverUrl ?? null,
      d.coverBlur ?? null,
      d.status,
      d.isFeatured ? 1 : 0,
      d.seoTitle ?? null,
      d.seoDesc ?? null,
      ts,
      ts,
      id,
    );
  } else {
    const code = nextCode();
    const row = get<{ id: number }>(
      `INSERT INTO resources
        (code, slug, title, subtitle, summary, content_md, category_id, kind,
         platforms, version, size_label, language, license_label, source_url, source_note,
         cover_url, cover_blur,
         status, is_featured, seo_title, seo_desc, verified_at,
         published_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       RETURNING id`,
      code,
      d.slug,
      d.title,
      d.subtitle ?? null,
      d.summary ?? null,
      d.contentMd ?? null,
      d.categoryId,
      d.kind,
      platforms,
      d.version ?? null,
      d.sizeLabel ?? null,
      d.language ?? "zh-CN",
      d.licenseLabel ?? "free",
      d.sourceUrl || null,
      d.sourceNote ?? null,
      d.coverUrl ?? null,
      d.coverBlur ?? null,
      d.status,
      d.isFeatured ? 1 : 0,
      d.seoTitle ?? null,
      d.seoDesc ?? null,
      ts,
      d.status === "published" ? ts : null,
      ts,
      ts,
    );
    resourceId = row?.id ?? 0;
  }

  if (!resourceId) return { ok: false, message: "写入失败（未拿到资源 ID）" };

  /* ---------- 链接 ---------- */
  const keepIds: number[] = [];

  for (const [i, l] of d.links.entries()) {
    const urlHash = hashUrl(l.url);
    const dup = get<{ id: number; resource_id: number }>(
      "SELECT id, resource_id FROM resource_links WHERE url_hash = ? AND resource_id != ?",
      urlHash,
      resourceId,
    );
    if (dup) {
      return {
        ok: false,
        message: `这条链接已挂在另一个资源（id=${dup.resource_id}）下，先改那边`,
        fieldErrors: { [`links.${i}.url`]: "全站重复" },
      };
    }

    const existing = get<{ id: number }>(
      "SELECT id FROM resource_links WHERE resource_id = ? AND url_hash = ?",
      resourceId,
      urlHash,
    );
    const extractCode = l.extractCode ?? sniffExtractCode(l.url) ?? null;

    if (existing) {
      run(
        `UPDATE resource_links SET provider=?, url=?, extract_code=?, label=?, is_primary=?, sort_order=?
         WHERE id=?`,
        l.provider,
        l.url,
        extractCode,
        l.label ?? null,
        l.isPrimary ? 1 : 0,
        i,
        existing.id,
      );
      keepIds.push(existing.id);
    } else {
      const row = get<{ id: number }>(
        `INSERT INTO resource_links
          (resource_id, provider, url, url_hash, extract_code, label, is_primary, sort_order, status, created_at)
         VALUES (?,?,?,?,?,?,?,?, 'unknown', ?) RETURNING id`,
        resourceId,
        l.provider,
        l.url,
        urlHash,
        extractCode,
        l.label ?? null,
        l.isPrimary ? 1 : 0,
        i,
        ts,
      );
      if (row) keepIds.push(row.id);
    }
  }

  // 删除本次没提交的旧链接
  const old = get<{ ids: string | null }>(
    "SELECT group_concat(id) AS ids FROM resource_links WHERE resource_id = ?",
    resourceId,
  );
  const oldIds = (old?.ids ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((n) => !keepIds.includes(n));
  for (const oid of oldIds) run("DELETE FROM resource_links WHERE id = ?", oid);

  /* ---------- 标签 ---------- */
  run("DELETE FROM resource_tags WHERE resource_id = ?", resourceId);
  for (const raw of d.tags ?? []) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugifyTag(name);
    let tag: { id: number } | null | undefined = get<{ id: number }>(
      "SELECT id FROM tags WHERE slug = ?",
      slug,
    );
    if (!tag) {
      const created = get<{ id: number }>(
        "INSERT INTO tags (slug, name, use_count) VALUES (?,?,0) RETURNING id",
        slug,
        name,
      );
      tag = created ?? undefined;
    }
    if (!tag) continue;
    run(
      "INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?,?)",
      resourceId,
      tag.id,
    );
    run(
      "UPDATE tags SET use_count = (SELECT COUNT(*) FROM resource_tags WHERE tag_id = ?) WHERE id = ?",
      tag.id,
      tag.id,
    );
  }

  reindexOne(resourceId);
  refreshPaths(d.slug);

  return {
    ok: true,
    id: resourceId,
    message: id ? "已保存" : `已创建（${d.slug}）`,
  };
}

/* ------------------------------------------------------------------ */

export async function setStatus(id: number, status: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (!["draft", "published", "archived"].includes(status)) {
    return { ok: false, message: "非法状态" };
  }
  const row = get<{ slug: string }>("SELECT slug FROM resources WHERE id = ?", id);
  run(
    "UPDATE resources SET status = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?",
    status,
    status === "published" ? nowSec() : null,
    nowSec(),
    id,
  );
  refreshPaths(row?.slug);
  return { ok: true, message: `状态已改为 ${status}` };
}

export async function deleteResource(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const row = get<{ slug: string }>("SELECT slug FROM resources WHERE id = ?", id);
  run("DELETE FROM resources WHERE id = ?", id);
  run("DELETE FROM resources_fts WHERE resource_id = ?", id);
  refreshPaths(row?.slug);
  return { ok: true, message: "已删除" };
}

/* ------------------------------------------------------------------ */

/**
 * 批量导入。第一行可留表头，空行忽略。
 * 列顺序：标题,slug,分类slug,网盘,链接,提取码,大小,版本,摘要
 */
export async function importCsv(text: string): Promise<ActionResult & { inserted?: number; skipped?: number }> {
  const denied = await guard();
  if (denied) return denied;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return { ok: false, message: "没有内容" };

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const ts = nowSec();

  for (const [i, line] of lines.entries()) {
    if (i === 0 && line.toLowerCase().startsWith("title")) continue;

    const cells = line.split(",").map((c) => c.trim());
    if (cells.length < 5) {
      skipped += 1;
      errors.push(`第 ${i + 1} 行：列数不足`);
      continue;
    }

    const [title, slug, catSlug, provider, url, extractCode, size, version, summary] = cells;

    if (!title || !slug || !catSlug || !provider || !url) {
      skipped += 1;
      errors.push(`第 ${i + 1} 行：必填项缺失`);
      continue;
    }
    if (!/^https?:\/\//.test(url)) {
      skipped += 1;
      errors.push(`第 ${i + 1} 行：链接不是 http(s)`);
      continue;
    }

    const exists = get<{ id: number }>("SELECT id FROM resources WHERE slug = ?", slug);
    if (exists) {
      skipped += 1;
      errors.push(`第 ${i + 1} 行：slug 已存在`);
      continue;
    }

    const cat = get<{ id: number }>("SELECT id FROM categories WHERE slug = ?", catSlug);
    if (!cat) {
      skipped += 1;
      errors.push(`第 ${i + 1} 行：分类 ${catSlug} 不存在`);
      continue;
    }

    const code = nextCode();
    const row = get<{ id: number }>(
      `INSERT INTO resources
        (code, slug, title, subtitle, summary, category_id, kind, platforms,
         version, size_label, language, license_label, status, published_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'published', ?, ?, ?) RETURNING id`,
      code,
      slug,
      title,
      null,
      summary ?? null,
      cat.id,
      "other",
      "[]",
      version ?? null,
      size ?? null,
      "zh-CN",
      "free",
      ts,
      ts,
      ts,
    );
    if (!row) {
      skipped += 1;
      continue;
    }

    const urlHash = hashUrl(url);
    run(
      `INSERT INTO resource_links
        (resource_id, provider, url, url_hash, extract_code, label, is_primary, sort_order, status, created_at)
       VALUES (?,?,?,?,?, '主链接', 1, 0, 'unknown', ?)`,
      row.id,
      provider,
      url,
      urlHash,
      extractCode || sniffExtractCode(url),
      ts,
    );
    reindexOne(row.id);
    inserted += 1;
  }

  refreshPaths();

  const head = `导入完成：新增 ${inserted}，跳过 ${skipped}`;
  return {
    ok: true,
    inserted,
    skipped,
    message: errors.length ? `${head}。\n${errors.slice(0, 8).join("\n")}` : head,
  };
}

/* ------------------------------------------------------------------ */
/* 举报处理                                                            */
/* ------------------------------------------------------------------ */

export async function handleReport(id: number, status: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  if (!["handled", "ignored", "open"].includes(status)) {
    return { ok: false, message: "非法状态" };
  }

  run(
    "UPDATE reports SET status = ?, handled_at = CASE WHEN ? = 'open' THEN NULL ELSE unixepoch() END WHERE id = ?",
    status,
    status,
    id,
  );

  revalidatePath("/admin/reports");
  return { ok: true, message: status === "open" ? "已重新打开" : "已处理" };
}

/* ------------------------------------------------------------------ */
/* 投稿审核                                                            */
/* ------------------------------------------------------------------ */

export async function acceptSubmission(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const sub = get<{
    id: number;
    title: string;
    url: string;
    category_slug: string | null;
    provider: string | null;
    note: string | null;
    status: string;
  }>("SELECT id, title, url, category_slug, provider, note, status FROM submissions WHERE id = ?", id);

  if (!sub) return { ok: false, message: "投稿不存在" };
  if (sub.status === "accepted") return { ok: false, message: "这条已经采纳过了" };

  const cat =
    (sub.category_slug
      ? get<{ id: number; slug: string }>("SELECT id, slug FROM categories WHERE slug = ?", sub.category_slug)
      : null) ??
    get<{ id: number; slug: string }>("SELECT id, slug FROM categories ORDER BY sort_order LIMIT 1");

  if (!cat) return { ok: false, message: "没有可用分类" };

  const code = nextCode();
  const slug = `sub-${Date.now().toString(36)}`;
  const ts = nowSec();

  const created = get<{ id: number }>(
    `INSERT INTO resources
      (code, slug, title, summary, category_id, kind, platforms, status, source_url, source_note, created_at, updated_at)
     VALUES (?,?,?,?,?, 'other', '[]', 'draft', ?, ?, ?, ?) RETURNING id`,
    code,
    slug,
    sub.title,
    sub.note,
    cat.id,
    sub.url,
    `读者投稿 #${sub.id}`,
    ts,
    ts,
  );

  if (created) {
    run(
      `INSERT INTO resource_links
        (resource_id, provider, url, url_hash, label, is_primary, sort_order, status, created_at)
       VALUES (?,?,?,?,?,1,0,'unknown',?)`,
      created.id,
      sub.provider ?? "other",
      sub.url,
      hashUrl(sub.url),
      "投稿链接",
      ts,
    );

    run("UPDATE submissions SET status = 'accepted', handled_at = unixepoch() WHERE id = ?", id);
    refreshPaths(slug);
    return { ok: true, id: created.id, message: `已采纳，草稿 ${code} 已生成` };
  }

  return { ok: false, message: "创建失败" };
}

export async function rejectSubmission(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  run("UPDATE submissions SET status = 'rejected', handled_at = unixepoch() WHERE id = ?", id);
  revalidatePath("/admin/submissions");
  return { ok: true, message: "已拒绝" };
}
