//! 内嵌网盘登录窗口。
//!
//! 做法：开一个独立 WebviewWindow 打开网盘站点，用户在里面扫码登录。
//! 登录完点页面右上角注入的「完成登录」浮层，浮层把 `document.cookie`
//! **POST 到本机一个临时 HTTP 端口**（127.0.0.1），Rust 侧收到后存槽位，前端取走。
//!
//! 为什么不用 Tauri IPC：远程页面（pan.quark.cn）里 `window.__TAURI_INTERNALS__`
//! 拿不到，即使配了 capabilities 的 remote 也不注入（实测 2026-11-27：浮层点了报「读取失败」）。
//! 本机回环 HTTP 不受这个限制，且不需要给远程页面开放任何 Tauri 权限。

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// 浮层回传的 cookie 暂存：`host\u{1}cookie`
static PICKED: Mutex<Option<String>> = Mutex::new(None);
static PORT: OnceLock<u16> = OnceLock::new();

#[derive(Serialize)]
pub struct PickedCookie {
    pub cookie: String,
    pub host: String,
}

fn store(host: &str, cookie: &str) {
    if let Ok(mut slot) = PICKED.lock() {
        *slot = Some(format!("{host}\u{1}{cookie}"));
    }
}

/// 启动回环回调服务（只监听 127.0.0.1，随机端口，进程退出即失效）
fn ensure_server() -> u16 {
    *PORT.get_or_init(|| {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind 127.0.0.1");
        let port = listener.local_addr().expect("local_addr").port();

        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let mut s = stream;
                let _ = s.set_read_timeout(Some(std::time::Duration::from_millis(1200)));

                let mut buf = vec![0u8; 16384];
                let mut total = 0usize;
                // 一次 read 可能读不满 body，循环到读不出为止
                loop {
                    match s.read(&mut buf[total..]) {
                        Ok(0) => break,
                        Ok(n) => {
                            total += n;
                            if total >= buf.len() {
                                break;
                            }
                            if let Some(idx) = find_sub(&buf[..total], b"\r\n\r\n") {
                                let head = String::from_utf8_lossy(&buf[..idx]).to_string();
                                let body_len = content_length(&head).unwrap_or(0);
                                if total >= idx + 4 + body_len {
                                    break;
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }

                if let Some(idx) = find_sub(&buf[..total], b"\r\n\r\n") {
                    let body = String::from_utf8_lossy(&buf[idx + 4..total]).to_string();
                    if let Some((host, cookie)) = body.split_once('\n') {
                        if !cookie.trim().is_empty() {
                            store(host.trim(), cookie.trim());
                        }
                    }
                }

                let _ = s.write_all(
                    b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\n\
                      Access-Control-Allow-Headers: *\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                );
            }
        });

        port
    })
}

fn find_sub(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

fn content_length(head: &str) -> Option<usize> {
    for line in head.lines() {
        let l = line.to_ascii_lowercase();
        if let Some(rest) = l.strip_prefix("content-length:") {
            return rest.trim().parse().ok();
        }
    }
    None
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

/// 打开网盘登录窗口
#[tauri::command]
pub async fn open_pan_login(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    let port = ensure_server();
    let parsed: tauri::Url = url.parse().map_err(|_| format!("地址不对：{url}"))?;

    if let Some(w) = app.get_webview_window("pan-login") {
        let _ = w.set_focus();
        return Ok(());
    }

    if let Ok(mut slot) = PICKED.lock() {
        *slot = None;
    }

    let win = WebviewWindowBuilder::new(&app, "pan-login", WebviewUrl::External(parsed))
        .title(&title)
        .inner_size(520.0, 780.0)
        .min_inner_size(420.0, 600.0)
        .on_page_load(move |webview, _payload| {
            let _ = webview.eval(&build_overlay(port));
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

/// 注入到页面里的浮层：点按钮 → 把 cookie POST 到本机端口
fn build_overlay(port: u16) -> String {
    format!(
        r#"
(() => {{
  if (document.getElementById('xm-pan-finish')) return;
  const bar = document.createElement('div');
  bar.id = 'xm-pan-finish';
  bar.style.cssText = [
    'position:fixed','top:10px','right:10px','z-index:2147483647',
    'background:#111','color:#fff','border-radius:8px','padding:8px 12px',
    'font:13px/1.4 system-ui,sans-serif','box-shadow:0 4px 18px rgba(0,0,0,.35)',
    'display:flex','gap:8px','align-items:center'
  ].join(';');
  const hint = document.createElement('span');
  hint.textContent = '扫码登录后点这里';
  hint.style.cssText = 'opacity:.75';
  const ok = document.createElement('button');
  ok.textContent = '完成登录';
  ok.style.cssText = 'border:0;border-radius:6px;padding:6px 12px;background:#1a56db;color:#fff;font:inherit;cursor:pointer';
  ok.onclick = async () => {{
    const cookie = document.cookie || '';
    const n = cookie.split(';').filter(Boolean).length;
    try {{
      await fetch('http://127.0.0.1:{port}/c', {{
        method: 'POST',
        mode: 'no-cors',
        headers: {{ 'content-type': 'text/plain' }},
        body: location.host + '\n' + cookie,
      }});
      ok.textContent = '已读取 ' + n + ' 项';
      ok.style.background = '#2f8f5b';
    }} catch (e) {{
      ok.textContent = '失败：' + (e && e.message ? e.message : '网络');
      ok.style.background = '#c0392b';
      console.error(e);
    }}
  }};
  bar.appendChild(hint);
  bar.appendChild(ok);
  document.documentElement.appendChild(bar);
}})();
"#
    )
}
