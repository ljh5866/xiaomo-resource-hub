/**
 * 为种子资源生成品牌封面（演示「上传 → 存储 → 卡片」全链路，不引外部图）：
 *   pnpm covers:gen
 *
 * 产物：data/uploads/covers/{slug}.webp + DB 的 cover_url / cover_blur
 */
import { all, run } from "../db/client";
import { storeSvg } from "../lib/storage";

const TINTS: Record<string, string> = {
  software: "#6f8bd4",
  template: "#d3a94f",
  material: "#c07a5a",
  course: "#6aa98a",
  font: "#b08ac0",
  icon: "#5fa8b8",
  ebook: "#c9a227",
};

type Row = { id: number; slug: string; code: string; category: string; title: string };

function svgFor(r: Row, tint: string) {
  const seed = [...r.slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const arcX = 120 + (seed % 5) * 120;
  const arcY = 90 + (seed % 4) * 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#121c18"/>
      <stop offset="60%" stop-color="#0b1310"/>
      <stop offset="100%" stop-color="#0a0f0d"/>
    </linearGradient>
    <radialGradient id="glow" cx="${arcX}" cy="${arcY}" r="360" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${tint}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${tint}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="800" height="500" fill="url(#g)"/>
  <rect width="800" height="500" fill="url(#glow)"/>

  <g stroke="#26362e" stroke-width="1" opacity="0.9">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${56 * (i + 1)}" x2="800" y2="${56 * (i + 1)}"/>`).join("")}
  </g>

  <rect x="0" y="0" width="6" height="500" fill="${tint}" opacity="0.75"/>
  <rect x="48" y="404" width="${120 + (seed % 3) * 60}" height="2" fill="${tint}" opacity="0.6"/>

  <circle cx="${arcX}" cy="${arcY}" r="150" fill="none" stroke="${tint}" stroke-opacity="0.28" stroke-width="1.5"/>
  <circle cx="${arcX}" cy="${arcY}" r="96" fill="none" stroke="${tint}" stroke-opacity="0.18" stroke-width="1"/>

  <text x="48" y="196" font-family="Consolas, 'Courier New', monospace" font-size="64" letter-spacing="4" fill="#e8ede6" opacity="0.94">${r.code}</text>
  <text x="48" y="236" font-family="Consolas, 'Courier New', monospace" font-size="17" letter-spacing="7" fill="${tint}" opacity="0.9">${r.category.toUpperCase()}</text>

  <text x="48" y="470" font-family="Consolas, monospace" font-size="13" letter-spacing="3" fill="#6b7a70">XIAOMO INDEX</text>
  <text x="752" y="470" text-anchor="end" font-family="Consolas, monospace" font-size="13" letter-spacing="3" fill="#6b7a70">${String(seed).padStart(4, "0")}</text>
</svg>`;
}

async function main() {
  const rows = all<Row>(
    `SELECT r.id, r.slug, r.code, c.slug AS category, r.title
     FROM resources r JOIN categories c ON c.id = r.category_id`,
  );

  let n = 0;
  for (const r of rows) {
    const tint = TINTS[r.category] ?? "#d3a94f";
    const svg = svgFor(r, tint);
    const stored = await storeSvg(svg, r.slug);
    run(
      "UPDATE resources SET cover_url = ?, cover_blur = ? WHERE id = ?",
      stored.url,
      stored.blur,
      r.id,
    );
    n += 1;
    console.log(`  ✓ ${r.slug} → ${stored.url} (${Math.round(stored.bytes / 1024)} KB)`);
  }

  console.log(`✓ 生成 ${n} 张封面`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
