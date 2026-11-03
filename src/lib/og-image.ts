import sharp from "sharp";

/**
 * 分享图（1200×630）用 SVG + sharp 生成，不引 next/og。
 * 原因：next/og 需要打包字体文件才能显示中文；sharp 直接吃系统字体，
 * 部署时确保装了中文字体即可（见 docs/09，Debian: fonts-noto-cjk）。
 */

const W = 1200;
const H = 630;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 按粗略宽度截断（中文按 1em，英文按 0.55em） */
export function fitText(text: string, maxUnits: number): string {
  let units = 0;
  let out = "";

  for (const ch of text) {
    const w = /[\u4e00-\u9fa5]/.test(ch) ? 1 : 0.55;
    if (units + w > maxUnits) return out.trimEnd() + "…";
    out += ch;
    units += w;
  }
  return out;
}

export type OgInput = {
  title: string;
  /** 第二行：分类 / 编号 / 站点副标题 */
  sub?: string;
  /** 左上角小字，如「模板文档 · XM-2026-0001」 */
  tag?: string;
  /** 右下角站点名 */
  brand?: string;
};

export function ogSvg({ title, sub, tag, brand = "小莫资源网 · XIAOMO INDEX" }: OgInput): string {
  const safeTitle = esc(fitText(title, 17));
  const safeSub = sub ? esc(fitText(sub, 30)) : "";
  const safeTag = tag ? esc(fitText(tag, 40)) : "";
  const safeBrand = esc(brand);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0B1310"/>

  <!-- 目录柜纹理：细网格 -->
  <g stroke="#17241F" stroke-width="1">
    ${Array.from({ length: 13 }, (_, i) => `<line x1="${(i + 1) * 90}" y1="0" x2="${(i + 1) * 90}" y2="${H}"/>`).join("")}
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${(i + 1) * 90}" x2="${W}" y2="${(i + 1) * 90}"/>`).join("")}
  </g>

  <!-- 左下黄铜块 -->
  <rect x="0" y="${H - 14}" width="${W}" height="14" fill="#D3A94F"/>

  <!-- 左上标记 -->
  <rect x="72" y="64" width="56" height="56" fill="none" stroke="#D3A94F" stroke-width="3"/>
  <text x="100" y="104" font-family="Microsoft YaHei, Noto Sans CJK SC, SimSun, sans-serif"
        font-size="30" font-weight="700" fill="#D3A94F" text-anchor="middle">莫</text>
  <text x="146" y="104" font-family="Microsoft YaHei, Noto Sans CJK SC, SimSun, sans-serif"
        font-size="22" fill="#8A9A90" letter-spacing="2">${safeTag}</text>

  <!-- 主标题 -->
  <text x="72" y="320" font-family="Microsoft YaHei, Noto Sans CJK SC, SimSun, serif"
        font-size="${safeTitle.length > 12 ? 68 : 82}" font-weight="700" fill="#EDE7DA">${safeTitle}</text>

  ${safeSub ? `<text x="72" y="398" font-family="Microsoft YaHei, Noto Sans CJK SC, SimSun, sans-serif" font-size="30" fill="#9AA8A0">${safeSub}</text>` : ""}

  <!-- 底部品牌 -->
  <text x="72" y="${H - 58}" font-family="Microsoft YaHei, Noto Sans CJK SC, SimSun, sans-serif"
        font-size="24" fill="#6F7D76" letter-spacing="1">${safeBrand}</text>
</svg>`;
}

export async function renderOg(input: OgInput): Promise<Buffer> {
  return sharp(Buffer.from(ogSvg(input)), { density: 144 })
    .resize(W, H)
    .png({ compressionLevel: 9 })
    .toBuffer();
}
