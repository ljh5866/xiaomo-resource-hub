"use client";

import { useEffect, useState } from "react";

/**
 * 自绘标题栏（窗口设了 decorations:false）。
 *
 * ⚠️ 拖拽区不能盖住按钮：
 * `data-tauri-drag-region` 的元素会吃掉 mousedown（触发窗口拖动），
 * 所以只在「品牌区」和「中间空白」上加，按钮所在的 .titlebar-actions 绝不加。
 */
const IN_TAURI =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export function TitleBar() {
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    if (!IN_TAURI) return;
    let un: (() => void) | undefined;
    import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const w = getCurrentWindow();
        const sync = async () => {
          try {
            setMaxed(await w.isMaximized());
          } catch {
            /* 权限没给时忽略 */
          }
        };
        await sync();
        un = await w.onResized(() => void sync());
      })
      .catch(() => {});
    return () => un?.();
  }, []);

  const call = async (fn: "min" | "max" | "close") => {
    if (!IN_TAURI) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      if (fn === "min") await w.minimize();
      else if (fn === "max") await w.toggleMaximize();
      else await w.close();
    } catch (e) {
      // 出错时把原因打到控制台，方便排查权限问题
      console.warn("[titlebar]", fn, e);
    }
  };

  if (!IN_TAURI) return null;

  return (
    <div className="titlebar">
      <span className="titlebar-brand" data-tauri-drag-region>
        <span className="brand-mark" aria-hidden>
          莫
        </span>
        小莫资源库
      </span>

      {/* 中间可拖拽的空白：双击这里也能最大化（Tauri 内置行为） */}
      <div className="titlebar-drag" data-tauri-drag-region />

      <div className="titlebar-actions">
        <button className="tb-btn" onClick={() => void call("min")} aria-label="最小化">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <rect x="1" y="4.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="tb-btn"
          onClick={() => void call("max")}
          aria-label={maxed ? "还原" : "最大化"}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            {maxed ? (
              <>
                <rect x="1.5" y="3" width="5.5" height="5.5" fill="none" stroke="currentColor" />
                <path d="M3 3V1.5h5.5V7H7" fill="none" stroke="currentColor" />
              </>
            ) : (
              <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" />
            )}
          </svg>
        </button>
        <button
          className="tb-btn tb-close"
          onClick={() => void call("close")}
          aria-label="关闭到托盘"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  );
}
