import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 桌面端构建配置。体积优先：
 *  · 单 chunk（不切包，减少请求与体积开销）
 *  · esbuild 压缩 + 去掉 console
 */
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    target: "chrome110", // 只跑在 WebView2 上，不必兼容老浏览器
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  esbuild: {
    drop: ["console", "debugger"],
  },
});
