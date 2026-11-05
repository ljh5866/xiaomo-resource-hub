import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { run } from "@/db/client";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const DIR = path.join(process.cwd(), "data", "uploads", "avatars");

/** 上传头像：裁成 256×256 WebP，文件名按用户 id 固定（天然覆盖旧图） */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "没有收到文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "图片不能超过 4MB" }, { status: 413 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    await fs.mkdir(DIR, { recursive: true });
    const name = `${user.id}.webp`;
    await sharp(input)
      .rotate() // 按 EXIF 摆正
      .resize(256, 256, { fit: "cover", position: "attention" })
      .webp({ quality: 86 })
      .toFile(path.join(DIR, name));

    // 版本号让 CDN/浏览器拿到新图
    const url = `/files/avatars/${name}?v=${Date.now()}`;
    run("UPDATE users SET avatar_url = ? WHERE id = ?", url, user.id);

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[avatar] failed", err);
    return NextResponse.json({ ok: false, error: "处理失败，换张图试试" }, { status: 500 });
  }
}
