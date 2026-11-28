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
  savePanCookie,
  scanBrowsers,
  type BrowserInfo,
  type PanProvider,
} from "../lib/pan";
import { readPanCookie } from "../lib/quark";

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

  useEffect(() => {
    setBound(getPanCookie(provider));
    setMsg(null);
    setErr(null);
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
            <div className="pan-section">
              <div className="pan-label">扫码登录（推荐）</div>
              <button
                className="btn scan-btn"
                disabled={busy || !inTauri()}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  setMsg(null);
                  try {
                    const cookie = await openPanLogin(provider);
                    if (!cookie) {
                      setErr("没有拿到 Cookie —— 确认已在窗口里扫码并点了「完成登录」");
                      return;
                    }
                    savePanCookie(provider, cookie);
                    setBound(cookie);
                    const ok = looksLikePanCookie(provider, cookie);
                    setMsg(
                      ok
                        ? `已登录 ${PAN_NAMES[provider]}，共 ${cookie.split(";").length} 项 Cookie`
                        : "已保存，但没读到网盘的关键登录字段，可能还需要在该窗口里再点一次「完成登录」",
                    );
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "等待扫码…" : `打开登录窗口 · ${PAN_NAMES[provider]}`}
              </button>

              <button
                className="btn btn-ghost scan-btn"
                style={{ marginTop: 8 }}
                disabled={busy || !inTauri()}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  setMsg(null);
                  try {
                    // 直接从 WebView2 的 cookie 库读（能拿到 httpOnly 的 __pus）
                    const cookie = await readPanCookie(provider);
                    savePanCookie(provider, cookie);
                    setBound(cookie);
                    setMsg(`已从登录窗口读到 ${cookie.split(";").length} 项 Cookie`);
                  } catch (e) {
                    setErr(typeof e === "string" ? e : e instanceof Error ? e.message : "读取失败");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                已在窗口里登录好了 → 读取登录态
              </button>

              <p className="pan-hint">
                点第一个按钮开窗口扫码；登录完**回来点第二个按钮**读取登录态。
                Cookie 直接从浏览内核读，不上传服务器。
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
