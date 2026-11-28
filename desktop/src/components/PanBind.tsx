"use client";

import { useEffect, useState } from "react";
import {
  PAN_NAMES,
  clearPanCookie,
  getPanCookie,
  importBrowserCookies,
  inTauri,
  looksLikePanCookie,
  openPanLogin,
  panWindowAlive,
  savePanCookie,
  scanBrowsers,
  type BrowserInfo,
  type PanProvider,
} from "../lib/pan";

/**
 * 网盘登录：先试「从浏览器一键导入」，读不到（Chrome 127+ 的 v20 加密）再手动粘贴。
 * 拿到的 cookie 只存在本机，不上传服务器。
 */
const PROVIDERS: PanProvider[] = ["quark", "uc", "baidu", "xunlei", "115"];

export function PanBind({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<PanProvider>("quark");
  const [browsers, setBrowsers] = useState<BrowserInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [bound, setBound] = useState<string | null>(null);
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    setBound(getPanCookie(provider));
    setMsg(null);
    setErr(null);
    void panWindowAlive().then(setAlive);
  }, [provider]);

  useEffect(() => {
    if (!inTauri()) {
      setBrowsers([]);
      return;
    }
    scanBrowsers()
      .then(setBrowsers)
      .catch(() => setBrowsers([]));
  }, []);

  const doImport = async (b: BrowserInfo) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await importBrowserCookies(b.id, provider);
      savePanCookie(provider, r.cookie);
      setBound(r.cookie);
      setMsg(
        `已从 ${r.browser} 导入 ${r.count} 个 Cookie` +
          (r.skipped_v20 > 0 ? `，跳过 ${r.skipped_v20} 个 v20 加密项` : ""),
      );
    } catch (e) {
      setErr(typeof e === "string" ? e : e instanceof Error ? e.message : "导入失败");
    } finally {
      setBusy(false);
    }
  };

  const doManual = () => {
    const v = manual.trim();
    if (!v) return;
    if (!looksLikePanCookie(provider, v)) {
      setErr(`这段内容里没看到 ${PAN_NAMES[provider]} 的关键字段，确认一下是不是少了`);
      return;
    }
    savePanCookie(provider, v);
    setBound(v);
    setManual("");
    setErr(null);
    setMsg("已保存");
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>网盘登录</h2>
        <p className="modal-sub">
          Cookie 只存本机，用来在本地直接解析和下载，不经过服务器。
        </p>

        <div className="seg seg-wrap">
          {PROVIDERS.map((p) => (
            <button key={p} className={provider === p ? "on" : ""} onClick={() => setProvider(p)}>
              {PAN_NAMES[p]}
              {getPanCookie(p) ? " ✓" : ""}
            </button>
          ))}
        </div>

        {bound ? (
          <div className="pan-bound">
            <div className="pan-bound-row">
              <span className="ok-dot" />
              <span>已绑定 {PAN_NAMES[provider]}</span>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  clearPanCookie(provider);
                  setBound(null);
                  setMsg(null);
                }}
              >
                解绑
              </button>
            </div>
            <code className="pan-cookie-preview">{bound.slice(0, 90)}…</code>
          </div>
        ) : (
          <>
            {alive && (
              <p className="pan-ok" style={{ marginBottom: 10 }}>
                网盘窗口开着 ✓ 直接去资源页点「下载」即可
              </p>
            )}
            <div className="pan-section">
              <div className="pan-label">打开网盘窗口登录（推荐）</div>
              <button
                className="btn scan-btn"
                disabled={busy || !inTauri()}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  setMsg(null);
                  try {
                    await openPanLogin(provider);
                    setAlive(true);
                    setMsg(
                      "窗口已打开 —— 在里面登录好之后，直接去资源页点「下载」就行，不用回来做别的。",
                    );
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "打开中…" : `打开登录窗口 · ${PAN_NAMES[provider]}`}
              </button>

              <button
                className="btn btn-ghost scan-btn"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  const ok = await panWindowAlive();
                  setAlive(ok);
                  setMsg(
                    ok
                      ? "网盘窗口开着 ✓ 直接去资源页点「下载」即可"
                      : "网盘窗口没开 —— 点上面的按钮打开它并登录一次",
                  );
                }}
              >
                检查窗口是否就绪
              </button>

              <button
                className="btn btn-ghost scan-btn"
                style={{ marginTop: 8, color: "var(--danger)" }}
                onClick={async () => {
                  if (!confirm("会关掉登录窗口并清空其中所有登录状态，然后需要重新扫码。继续？")) return;
                  setBusy(true);
                  setErr(null);
                  setMsg(null);
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("reset_pan_login");
                    setAlive(false);
                    setBound(null);
                    clearPanCookie(provider);
                    setMsg("已清空登录态。点上面的「打开登录窗口」重新扫码即可换号。");
                  } catch (e) {
                    setErr(typeof e === "string" ? e : e instanceof Error ? e.message : "重置失败");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                退出并换号（清空登录态）
              </button>

              <p className="pan-hint">
                登录窗口**不要关**：它是唯一能带上 httpOnly 登录态的容器，转存和取链都在里面完成。
                关掉也能重新打开，登录状态会保留。
              </p>
            </div>

            <div className="pan-section">
              <div className="pan-label">从浏览器导入（本机）</div>
              {browsers === null ? (
                <p className="pan-hint">正在检测浏览器…</p>
              ) : !inTauri() ? (
                <p className="pan-hint">浏览器预览模式下不可用，请在桌面端里操作。</p>
              ) : browsers.length === 0 ? (
                <p className="pan-hint">没找到可读的浏览器 Cookie 库。</p>
              ) : (
                <div className="browser-list">
                  {browsers.map((b) => (
                    <button
                      key={b.id}
                      className="browser-row"
                      disabled={busy}
                      onClick={() => void doImport(b)}
                    >
                      <span>{b.name}</span>
                      <span className="browser-meta">
                        {b.kind === "firefox" ? "Firefox" : "Chromium"} · {b.db_paths.length} 个配置
                      </span>
                      <span className="browser-go">{busy ? "…" : "导入"}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="pan-hint">
                先在对应浏览器里登录 {PAN_NAMES[provider]}，再回来点导入。
                新版 Chrome/Edge（127+）用 v20 加密，读不出来是正常的——用下面的粘贴。
              </p>
            </div>

            <div className="pan-section">
              <div className="pan-label">手动粘贴 Cookie</div>
              <textarea
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder="name=value; name2=value2 …（浏览器 F12 → Application → Cookies 里整段复制）"
                className="pan-textarea"
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn" onClick={doManual} disabled={!manual.trim()}>
                  保存
                </button>
              </div>
            </div>
          </>
        )}

        {msg && <p className="pan-ok">{msg}</p>}
        {err && <p className="form-err">{err}</p>}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
