import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { processCover } from "@/lib/storage";

export const runtime = "nodejs";

/** 封面上传（仅管理员）。表单字段名：file */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "需要管理员登录" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "没有收到文件" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const stored = await processCover(buf, file.type || "image/jpeg");

    return NextResponse.json({ ok: true, ...stored });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message },
      { status: 400 },
    );
  }
}
