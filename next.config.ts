import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 运行时数据库走 Node 内建 node:sqlite，无需 external 原生包
  images: {
    // 骨架阶段：封面走纯色占位 + LQIP，接入对象存储后再放开 remotePatterns
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        /**
         * 桌面端（Tauri WebView）的 origin 是 tauri://localhost，
         * 调这些只读接口必然跨域，所以单独放开。
         * 只开了 GET + 只读接口，写接口不加。
         */
        source: "/api/app/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
