import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0B1310"/>
  <text x="80" y="300" font-family="Microsoft YaHei, SimSun, sans-serif" font-size="72" fill="#EDE7DA">小莫资源网 · 测试</text>
  <text x="80" y="400" font-family="Arial, sans-serif" font-size="36" fill="#D3A94F">XIAOMO INDEX · OG TEST</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(".shots/og-cjk-test.png");
console.log("saved .shots/og-cjk-test.png");
