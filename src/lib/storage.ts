import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * 封面存储层（M2-b）。
 *
 * 当前实现：本地磁盘驱动（data/uploads）→ 由 /files/[...path] 路由对外提供。
 * 换对象存储（R2 / OSS）：只改本文件的 put/get/url 三个函数，调用方零改动。
 *
 * 上传产物：
 *   - 800×500 WebP（q=82）——列表与详情用
 *   - 32×20 的 base64 blur——LQIP 占位，防布局抖动
 */

const ROOT = path.join(process.cwd(), "data", "uploads");
const COVER_DIR = path.join(ROOT, "covers");
const MAX_BYTES = 8 * 1024 * 1024;

export type StoredImage = {
  url: string;
  blur: string;
  width: number;
  height: number;
  bytes: number;
};

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export async function ensureDirs() {
  await fs.mkdir(COVER_DIR, { recursive: true });
}

export async function processCover(input: Buffer, mime: string): Promise<StoredImage> {
  if (!ALLOWED.has(mime)) throw new Error(`不支持的图片格式：${mime}`);
  if (input.byteLength > MAX_BYTES) throw new Error("图片太大（上限 8MB）");

  await ensureDirs();

  const hash = createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, 16);
  const file = `${hash}.webp`;
  const abs = path.join(COVER_DIR, file);

  const pipeline = sharp(input).rotate();

  const meta = await pipeline.metadata();
  const width = Math.min(meta.width ?? 800, 1600);

  const out = await pipeline
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  await fs.writeFile(abs, out.data);

  const blurBuf = await sharp(input)
    .resize(32, 20, { fit: "cover" })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    url: `/files/covers/${file}`,
    blur: `data:image/webp;base64,${blurBuf.toString("base64")}`,
    width: out.info.width,
    height: out.info.height,
    bytes: out.info.size,
  };
}

/** 按相对路径读取本地文件（供 /files 路由使用） */
export async function readFile(relPath: string): Promise<Buffer | null> {
  const safe = path
    .normalize(relPath)
    .replace(/^([/\\])+/, "")
    .replace(/\.\./g, "");

  const abs = path.join(ROOT, safe);
  if (!abs.startsWith(ROOT)) return null;

  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export function contentTypeOf(p: string) {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case ".webp":
      return "image/webp";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

/** 生成封面（脚本用）：SVG → WebP，写盘并返回同一套结构 */
export async function storeSvg(svg: string, key: string): Promise<StoredImage> {
  await ensureDirs();
  const buf = Buffer.from(svg);
  const file = `${key}.webp`;
  const abs = path.join(COVER_DIR, file);

  const out = await sharp(buf, { density: 144 })
    .resize(800, 500)
    .webp({ quality: 84, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  await fs.writeFile(abs, out.data);

  const blurBuf = await sharp(buf, { density: 72 })
    .resize(32, 20, { fit: "cover" })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    url: `/files/covers/${file}`,
    blur: `data:image/webp;base64,${blurBuf.toString("base64")}`,
    width: out.info.width,
    height: out.info.height,
    bytes: out.info.size,
  };
}
