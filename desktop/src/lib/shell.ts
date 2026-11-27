"use client";

/**
 * 桌面端外壳行为：把「网页感」全部关掉。
 *
 *  · 右键菜单、F5/Ctrl+R、F12/Ctrl+Shift+I、Ctrl+P、Ctrl+U 一律拦掉
 *  · 文字不可选中、图片不可拖拽、页面不可缩放
 *  · 只在 Tauri 里生效（浏览器预览时保持原样，方便调试）
 */

const IN_TAURI =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export function installDesktopShell() {
  if (typeof window === "undefined") return;

  // 禁止整页选中/拖拽（输入框和文本区域除外）
  const style = document.createElement("style");
  style.textContent = `
    html, body { user-select: none; -webkit-user-select: none; overscroll-behavior: none; }
    img { -webkit-user-drag: none; user-drag: none; pointer-events: none; }
    input, textarea { user-select: text; -webkit-user-select: text; }
  `;
  document.head.appendChild(style);

  if (!IN_TAURI) return;

  // 右键菜单
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  // 浏览器快捷键
  window.addEventListener(
    "keydown",
    (e) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (k === "f5" || (mod && ["r", "p", "u", "s", "f", "j"].includes(k))) {
        e.preventDefault();
      }
      if (k === "f12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
      }
      if (mod && (k === "+" || k === "-" || k === "=" || k === "0")) {
        e.preventDefault();
      }
    },
    { capture: true },
  );

  // 阻止拖拽文件/链接进窗口（默认会导航）
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  // 阻止中键滚动（桌面应用里很怪）
  window.addEventListener("mousedown", (e) => {
    if (e.button === 1) e.preventDefault();
  });
}
