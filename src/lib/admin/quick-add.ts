"use server";

/**
 * 后台「只贴链接」快速建草稿。
 *
 * 一个人运营时，一条资源要填标题/slug/分类/provider/大小/版本/摘要/正文…20 多个字段，
 * 200 条就是一天。这里把可推断的全部自动化：
 *   · provider ← 按域名识别（夸克/百度/UC/迅雷/3DM/其它）
 *   · slug     ← 网盘分享取分享码，3DM 取文章 id，其余取域名+序号
 *   · 标题     ← 3DM 会自动抓真实标题；其余先用域名占位，后台列表里再补
 *   · 分类     ← 页面下拉框统一指定（默认软件工具）
 *   · 正文     ← 3DM 抓到的简介直接当正文（≥150 字的会自动转 published，否则 draft）
 *
 * 目标是「贴 50 条链接 → 30 秒后列表里多 50 条草稿 → 只补标题和封面」。
 */
import { revalidatePath } from "next/cache";
import { get, run } from "@/db/client";
import { requireAdmin } from "@/lib/auth";
import { hashUrl } from "@/lib/links";

export type QuickRow = {
  url: string;
  title?: string;
};

export type QuickResult = {
  ok: boolean;
  message: string;
  created: { slug: string; title: string; provider: string }[];
  failed: { url: string; reason: string }[];
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36";

/** 按域名判断 provider */
function detectProvider(url: string): string {
  if (/pan\.quark\.cn/i.test(url)) return "quark";
  if (/pan\.baidu\.com/i.test(url)) return "baidu";
  if (/pan\.xunlei\.com/i.test(url)) return "xunlei";
  if (/drive\.uc\.cn|fastshare\.uc/i.test(url)) return "uc";
  if (/aliyundrive|alipan\.com/i.test(url)) return "aliyun";
  if (/lanzou[a-z]?\.com/i.test(url)) return "lanzou";
  if (/123pan|pan\.123/i.test(url)) return "123";
  if (/115\.com/i.test(url)) return "115";
  if (/soft\.3dmgame\.com/i.test(url)) return "direct";
  return "self";
}

/** 从 URL 里挖一个可读的 slug 底子 */
function baseSlug(url: string, provider: string): string {
  const share = url.match(/\/(?:s|share)\/([A-Za-z0-9_-]{4,})/);
  if (share && provider !== "self" && provider !== "direct") {
    return `${provider}-${share[1].toLowerCase().slice(0, 20)}`;
  }
  const id3dm = url.match(/\/down\/(\d+)\.html/);
  if (id3dm) return `3dm-${id3dm[1]}`;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    const tail = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "x";
    return `${host}-${tail.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 24).replace(/-+$/, "")}`.toLowerCase();
  } catch {
    return `link-${Date.now().toString(36)}`;
  }
}

type Grabbed = {
  title: string | null;
  intro: string | null;
  cover: string | null;
  size: string | null;
  version: string | null;
  category: string | null;
};

/** 3DM 详情页：抓标题/简介/封面/版本/大小 */
async function grab3dm(url: string): Promise<Grabbed> {
  const empty: Grabbed = { title: null, intro: null, cover: null, size: null, version: null, category: null };
  const res = await fetch(url, {
    headers: { "user-agent": UA, referer: "https://soft.3dmgame.com/" },
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!res?.ok) return empty;
  const html = await res.text();

  const title =
    html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ??
    html.match(/<title>([^<_]+)/)?.[1]?.trim() ??
    null;
  const intro =
    html.match(/<meta\s+name="Description"\s+content="([^"]+)"/i)?.[1]?.trim() ?? null;
  const cover = html.match(/<img[^>]+data-original="([^"]+)"/)?.[1] ?? null;
  const version = html.match(/版本：\s*([\d.]+)/)?.[1] ?? null;
  const size = html.match(/大小：\s*([\d.]+\s*[MGK]B)/i)?.[1]?.replace(/\s+/g, "") ?? null;

  return { title, intro, cover, size, version, category: null };
}

export async function quickAddLinks(
  rawText: string,
  categorySlug: string,
  publishReady: boolean,
): Promise<QuickResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "需要管理员登录", created: [], failed: [] };

  const cat = get<{ id: number }>("SELECT id FROM categories WHERE slug = ?", categorySlug);
  if (!cat) return { ok: false, message: `分类 ${categorySlug} 不存在`, created: [], failed: [] };

  const urls = [
    ...new Set(
      rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^https?:\/\//i.test(l)),
    ),
  ];
  if (!urls.length) return { ok: false, message: "没找到 http(s) 链接", created: [], failed: [] };

  const created: QuickResult["created"] = [];
  const failed: QuickResult["failed"] = [];
  const year = new Date().getFullYear();
  const ts = Math.floor(Date.now() / 1000);

  for (const url of urls) {
    const provider = detectProvider(url);
    let slug = baseSlug(url, provider);

    // slug 去重：撞了加后缀
    let n = 1;
    let finalSlug = slug;
    while (get<{ id: number }>("SELECT id FROM resources WHERE slug = ?", finalSlug)) {
      n += 1;
      finalSlug = `${slug}-${n}`;
      if (n > 50) break;
    }
    slug = finalSlug;

    let grabbed: Grabbed = { title: null, intro: null, cover: null, size: null, version: null, category: null };
    if (/soft\.3dmgame\.com\/down\//i.test(url)) {
      grabbed = await grab3dm(url);
    }

    const title = grabbed.title || `${provider === "self" ? "待补充" : provider} · ${slug}`;
    const intro = grabbed.intro ?? "";
    // 正文够 150 字且勾了「自动发布」才直接发，否则草稿
    const status = publishReady && intro.length >= 150 ? "published" : "draft";

    // code：接续当年最大号
    const seqRow = get<{ n: number }>(
      "SELECT COALESCE(MAX(CAST(substr(code, 9) AS INTEGER)), 0) + 1 AS n FROM resources WHERE code LIKE ?",
      `XM-${year}-%`,
    );
    const code = `XM-${year}-${String(seqRow?.n ?? 1).padStart(4, "0")}`;

    try {
      const row = get<{ id: number }>(
        `INSERT INTO resources
           (code, slug, title, summary, content_md, category_id, kind, platforms,
            cover_url, version, size_label, language, license_label,
            status, published_at, created_at, updated_at, source_url)
         VALUES (?,?,?,?,?,?, 'other', '[]', ?,?,?, 'zh-CN', 'free', ?, ?, ?, ?, ?) RETURNING id`,
        code,
        slug,
        title,
        intro.slice(0, 110) || null,
        intro || null,
        cat.id,
        grabbed.cover,
        grabbed.version,
        grabbed.size,
        status,
        status === "published" ? ts : null,
        ts,
        ts,
        url,
      );
      if (!row) throw new Error("insert 未返回 id");

      run(
        `INSERT INTO resource_links
           (resource_id, provider, url, url_hash, label, is_primary, sort_order, status, created_at)
         VALUES (?,?,?,?, '主链接', 1, 0, 'unknown', ?)`,
        row.id,
        provider,
        url,
        hashUrl(url),
        ts,
      );

      created.push({ slug, title, provider });
    } catch (e) {
      failed.push({ url, reason: e instanceof Error ? e.message.slice(0, 80) : "写入失败" });
    }
  }

  revalidatePath("/admin/resources");
  revalidatePath("/admin");
  return {
    ok: created.length > 0,
    message: `新建 ${created.length} 条${failed.length ? `，失败 ${failed.length} 条` : ""}`,
    created,
    failed,
  };
}
