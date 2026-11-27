# 小莫资源库 · 桌面端

用 **Tauri 2 + React 19 + Vite** 做的桌面客户端，内容全部来自网站 `/api/app/*`，
站上发什么它立刻显示什么（不内嵌数据库、不同步、不需要登录）。

## 为什么是 Tauri 而不是 Electron

| | Tauri（本项目） | Electron |
|---|---|---|
| 安装包 | **约 3–6 MB** | 90–150 MB |
| 常驻内存 | **约 60–90 MB** | 150–300 MB |
| 渲染内核 | 系统 WebView2（Win11 自带） | 自带 Chromium |
| 前端产物体积 | **228 KB**（gzip 71 KB） | 同左（但还要背 Chromium） |

代价：Windows 10 需要预装 [WebView2 运行时](https://developer.microsoft.com/microsoft-edge/webview2/)（Win11 自带；Win10 若缺失，安装包会引导安装）。

## 目录

```
desktop/
├─ src/                    前端（React + 手写 CSS，无 UI 库、无路由库）
│   ├─ App.tsx             侧栏分类/标签 + 卡片流 + 详情
│   ├─ lib/api.ts          调站点 API，基址可切
│   └─ styles.css          设计令牌与网站前台保持一致
├─ src-tauri/              Rust 外壳
│   ├─ src/lib.rs          开窗口、居中、注册命令
│   ├─ tauri.conf.json     窗口尺寸 / CSP / 打包配置
│   └─ capabilities/       最小权限：只允许 opener
└─ package.json
```

## 开发

```powershell
cd desktop
pnpm install
pnpm app:dev          # 热更新，自动开窗口
```

默认连线上 `https://ttals.com`。本地联调时把基址改成 `http://localhost:3100`：

```ts
// 控制台
localStorage.setItem("xm.apiBase", "http://localhost:3100");
```

## 打包

```powershell
cd desktop
pnpm app:build        # 产物在 src-tauri/target/release/bundle/nsis/
```

前置：Rust 工具链（`rustup`）+ VS 生成工具 + WebView2。

## 体积控制做了什么

- 前端不引 UI 库、不引 react-router（用状态切换），只依赖 react/react-dom
- Vite 单 chunk、esbuild 压缩、去掉 console
- Rust release：`opt-level="s"`、`lto=true`、`codegen-units=1`、`strip=true`、`panic="abort"`
- 图标只保留用得到的尺寸

## 后续可加

- 收藏 / 下载历史（本地 SQLite，`tauri-plugin-sql`）
- 托盘常驻 + 剪贴板识别网盘链接
- 内置下载器（多连接 Range，参考网站 `/api/pan/download`）
