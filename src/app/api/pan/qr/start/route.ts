import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth";
import { startQrLogin } from "@/lib/pan/qr";

/**
 * POST /api/pan/qr/start
 * 生成夸克扫码登录的二维码（内容由夸克 CAS 的 token 拼成，本站只负责渲染）。
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  const started = await startQrLogin();
  if (!started) {
    return Response.json({ error: "夸克没有返回二维码，稍后再试" }, { status: 502 });
  }

  let dataUrl = "";
  try {
    dataUrl = await QRCode.toDataURL(started.qrContent, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0b0c", light: "#ffffff" },
    });
  } catch {
    return Response.json({ error: "二维码渲染失败" }, { status: 500 });
  }

  return Response.json({ ok: true, sessionId: started.sessionId, dataUrl });
}
