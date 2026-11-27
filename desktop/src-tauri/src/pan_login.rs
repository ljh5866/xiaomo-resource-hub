//! 内嵌网盘登录窗口。
//!
//! 做法：开一个独立 WebviewWindow 打开网盘站点，用户在里面扫码登录。
//! 登录完点页面右上角注入的「完成登录」浮层 → 该浮层把 `document.cookie`
//! 通过 Tauri IPC 回传（`submit_pan_cookie`），Rust 侧存到全局槽位，前端取走。
//!
//! 为什么不在 Rust 里直接发 HTTP 做二维码登录：
//! 夸克的扫码确认后登录态是响应自己 Set-Cookie 下发的，裸 HTTP 在服务器 IP 上
//! 实测拿不到 `__pus`（被判定为非浏览器环境）。内嵌浏览器执行完整 JS，行为一致。

use std::sync::Mutex;

use serde::Serialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// 浮层回传的 cookie 暂存（只存一份，取走即清）
static PICKED: Mutex<Option<String>> = Mutex::new(None);

#[derive(Serialize)]
pub struct PickedCookie {
    pub cookie: String,
    pub host: String,
}

/// 页面里的浮层调用这个把 cookie 交回来
#[tauri::command]
pub fn submit_pan_cookie(cookie: String, host: String) -> Result<(), String> {
    let mut slot = PICKED.lock().map_err(|_| "锁失败")?;
    *slot = Some(format!("{host}\u{1}{cookie}"));
    Ok(())
}

/// 前端轮询取结果；没有就返回 None
#[tauri::command]
pub fn take_pan_cookie() -> Option<PickedCookie> {
    let mut slot = PICKED.lock().ok()?;
    let v = slot.take()?;
    let (host, cookie) = v.split_once('\u{1}')?;
    Some(PickedCookie {
        host: host.to_string(),
        cookie: cookie.to_string(),
    })
}

const OVERLAY: &str = r#"
(() => {
  if (document.getElementById('xm-pan-finish')) return;
  const bar = document.createElement('div');
  bar.id = 'xm-pan-finish';
  bar.style.cssText = [
    'position:fixed','top:10px','right:10px','z-index:2147483647',
    'background:#111','color:#fff','border-radius:8px','padding:8px 12px',
    'font:13px/1.4 system-ui,sans-serif','box-shadow:0 4px 18px rgba(0,0,0,.35)',
    'display:flex','gap:8px','align-items:center'
  ].join(';');
  const ok = document.createElement('button');
  ok.textContent = '完成登录';
  ok.style.cssText = 'border:0;border-radius:6px;padding:6px 12px;background:#1a56db;color:#fff;font:inherit;cursor:pointer';
  ok.onclick = async () => {
    const cookie = document.cookie || '';
    try {
      await window.__TAURI_INTERNALS__.invoke('submit_pan_cookie', {
        cookie,
        host: location.host,
      });
      ok.textContent = '已读取 ' + cookie.split(';').filter(Boolean).length + ' 项';
      ok.style.background = '#2f8f5b';
    } catch (e) {
      ok.textContent = '读取失败';
      console.error(e);
    }
  };
  const hint = document.createElement('span');
  hint.textContent = '扫码登录后点这里';
  hint.style.cssText = 'opacity:.75';
  bar.appendChild(hint);
  bar.appendChild(ok);
  document.documentElement.appendChild(bar);
})();
"#;

/// 打开网盘登录窗口
#[tauri::command]
pub async fn open_pan_login(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    let parsed: tauri::Url = url.parse().map_err(|_| format!("地址不对：{url}"))?;

    // 已存在就聚焦，不重复开
    if let Some(w) = app.get_webview_window("pan-login") {
        let _ = w.set_focus();
        return Ok(());
    }

    {
        let mut slot = PICKED.lock().map_err(|_| "锁失败")?;
        *slot = None;
    }

    let win = WebviewWindowBuilder::new(&app, "pan-login", WebviewUrl::External(parsed))
        .title(&title)
        .inner_size(520.0, 780.0)
        .min_inner_size(420.0, 600.0)
        .on_page_load(|webview, _payload| {
            // 每次页面加载后注入浮层（扫码跳转也不丢）
            let _ = webview.eval(OVERLAY);
        })
        .build()
        .map_err(|e| format!("打不开窗口：{e}"))?;

    let _ = win.center();
    Ok(())
}

/// 关掉登录窗口（取到 cookie 后前端调用）
#[tauri::command]
pub fn close_pan_login(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("pan-login") {
        let _ = w.close();
    }
}
