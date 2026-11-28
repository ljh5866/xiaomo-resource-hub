//! 内嵌网盘窗口：登录 + 在页面上下文里执行网盘操作。
//!
//! 为什么操作必须在页面里做：
//! 夸克的 `__pus` 是 httpOnly，`document.cookie` 读不到（实测只拿到 ctoken/__puus）。
//! 用它调 `sharepage/save`（转存）会返回 `require login [guest] (code=31001)`。
//! 而页面内 fetch 同源/跨子域都会自动带 httpOnly cookie —— 实测 `pan.quark.cn` 页面
//! fetch `drive-pc.quark.cn` 返回 200，CORS 是通的。
//!
//! 结果回传：页面执行完 → 导航到 `http://127.0.0.1:<port>/d?u=<直链>&n=<文件名>`
//! （https 页面 fetch http://127.0.0.1 会被混合内容拦掉，导航不会）。

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// 登录回传：`host\u{1}cookie`
static PICKED: Mutex<Option<String>> = Mutex::new(None);
/// 直链回传：(url, file_name, 转存后的 fid —— 用来下载完清理)
static DL: Mutex<Option<(String, String, String)>> = Mutex::new(None);
static PORT: OnceLock<u16> = OnceLock::new();

#[derive(Serialize)]
pub struct PickedCookie {
    pub cookie: String,
    pub host: String,
}

#[derive(Serialize)]
pub struct DirectResult {
    pub url: String,
    pub name: String,
    /// 转存到用户网盘后的文件 id，下载完成后用它清理
    pub fid: String,
}

fn ensure_server() -> u16 {
    *PORT.get_or_init(|| {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind 127.0.0.1");
        let port = listener.local_addr().expect("local_addr").port();

        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let mut s = stream;
                let _ = s.set_read_timeout(Some(std::time::Duration::from_millis(1200)));

                let mut buf = vec![0u8; 32768];
                let mut total = 0usize;
                loop {
                    match s.read(&mut buf[total..]) {
                        Ok(0) => break,
                        Ok(n) => {
                            total += n;
                            if total >= buf.len() || find_sub(&buf[..total], b"\r\n\r\n").is_some() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }

                let head = String::from_utf8_lossy(&buf[..total.min(buf.len())]).to_string();
                if let Some(line) = head.lines().next() {
                    // GET /d?u=...&n=...&f=...  → 直链
                    if line.contains("GET /d?") {
                        let u = query_param(line, "u");
                        let n = query_param(line, "n");
                        let f = query_param(line, "f").unwrap_or_default();
                        if let (Some(u), Some(n)) = (u, n) {
                            if let Ok(mut slot) = DL.lock() {
                                *slot = Some((u, n, f));
                            }
                        }
                    } else if line.contains("GET /c?") {
                        // GET /c?d=<host\ncookie>  → 登录 cookie
                        if let Some(raw) = query_param(line, "d") {
                            if let Some((host, cookie)) = raw.split_once('\n') {
                                if !cookie.trim().is_empty() {
                                    if let Ok(mut slot) = PICKED.lock() {
                                        *slot = Some(format!("{}\u{1}{}", host.trim(), cookie.trim()));
                                    }
                                }
                            }
                        }
                    }
                }

                let _ = s.write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
                      Connection: close\r\nContent-Length: 0\r\n\r\n",
                );
            }
        });

        port
    })
}

fn find_sub(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

/// 从请求行里取 query 参数（percent-decode）
fn query_param(line: &str, key: &str) -> Option<String> {
    let q = line.split('?').nth(1)?.split(' ').next()?;
    for pair in q.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == key {
                return Some(pct_decode(v));
            }
        }
    }
    None
}

fn pct_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(if b[i] == b'+' { b' ' } else { b[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

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

#[tauri::command]
pub fn take_pan_direct() -> Option<DirectResult> {
    let mut slot = DL.lock().ok()?;
    let (url, name, fid) = slot.take()?;
    Some(DirectResult { url, name, fid })
}

/// 下载完成后清理转存文件（在页面里删，需要登录态）
#[tauri::command]
pub async fn pan_web_delete(app: tauri::AppHandle, fids: Vec<String>) -> Result<(), String> {
    if fids.is_empty() {
        return Ok(());
    }
    let win = app
        .get_webview_window("pan-login")
        .ok_or_else(|| "网盘窗口已关闭，无法清理转存文件".to_string())?;

    let list = fids
        .iter()
        .map(|f| serde_json::to_string(f).unwrap_or_else(|_| "\"\"".into()))
        .collect::<Vec<_>>()
        .join(",");

    let js = format!(
        r#"(async () => {{
  try {{
    const r = await fetch('https://drive-pc.quark.cn/1/clouddrive/file/delete?pr=ucpro&fr=pc&uc_param_str=', {{
      method: 'POST',
      headers: {{ 'content-type': 'application/json' }},
      credentials: 'include',
      body: JSON.stringify({{ action_type: 2, filelist: [{list}], exclude_fids: [] }}),
    }});
    const j = await r.json();
    console.log('[xm] 清理转存:', j && j.status, j && j.message);
  }} catch (e) {{
    console.warn('[xm] 清理失败', e);
  }}
}})();"#,
        list = list
    );

    win.eval(&js).map_err(|e| format!("注入失败：{e}"))?;
    Ok(())
}

/// 登录窗口是否还活着（活着的窗口才有登录态）
#[tauri::command]
pub fn pan_window_alive(app: tauri::AppHandle) -> bool {
    app.get_webview_window("pan-login").is_some()
}

#[tauri::command]
pub async fn open_pan_login(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    let port = ensure_server();
    let parsed: tauri::Url = url.parse().map_err(|_| format!("地址不对：{url}"))?;

    if let Some(w) = app.get_webview_window("pan-login") {
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.eval(&build_overlay(port));
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

/// 只隐藏，不销毁 —— 销毁就丢登录态
#[tauri::command]
pub fn hide_pan_login(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("pan-login") {
        let _ = w.hide();
    }
}

#[tauri::command]
pub fn close_pan_login(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("pan-login") {
        let _ = w.close();
    }
}

/// 在网盘窗口的页面里执行「转存 → 轮询任务 → 取直链」，结果导航回本地
#[tauri::command]
pub async fn pan_web_direct(
    app: tauri::AppHandle,
    share_id: String,
    stoken: String,
    fid: String,
    fid_token: String,
    file_name: String,
) -> Result<(), String> {
    let port = ensure_server();
    let win = app
        .get_webview_window("pan-login")
        .ok_or_else(|| "网盘窗口已关闭 —— 请先在侧栏「网盘登录」重新打开并登录".to_string())?;

    if let Ok(mut slot) = DL.lock() {
        *slot = None;
    }
    let _ = win.show();

    let js = build_download_js(port, &share_id, &stoken, &fid, &fid_token, &file_name);
    win.eval(&js).map_err(|e| format!("注入失败：{e}"))?;
    Ok(())
}

/// 页面里执行的脚本：转存 → 轮询 → 取直链 → 导航回本地端口
fn build_download_js(
    port: u16,
    share_id: &str,
    stoken: &str,
    fid: &str,
    fid_token: &str,
    file_name: &str,
) -> String {
    // 用 serde_json 做字符串转义，避免文件名里的引号把 JS 弄坏
    let j = |s: &str| serde_json::to_string(s).unwrap_or_else(|_| "\"\"".into());

    format!(
        r#"(async () => {{
  const API = 'https://drive-pc.quark.cn';
  const Q = 'pr=ucpro&fr=pc&uc_param_str=';
  const done = (u, n, f) => {{
    location.href = 'http://127.0.0.1:{port}/d?u=' + encodeURIComponent(u) +
      '&n=' + encodeURIComponent(n) + '&f=' + encodeURIComponent(f || '');
  }};
  const fail = (m) => {{
    const d = document.createElement('div');
    d.textContent = '下载失败：' + m;
    d.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;background:#c0392b;color:#fff;padding:8px 12px;border-radius:8px;font:12px system-ui';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 8000);
  }};
  try {{
    const jpost = async (path, extra, body) => {{
      const r = await fetch(API + path + '?' + Q + (extra || ''), {{
        method: 'POST',
        headers: {{ 'content-type': 'application/json' }},
        credentials: 'include',
        body: JSON.stringify(body),
      }});
      return r.json();
    }};
    const jget = async (path, extra) => {{
      const r = await fetch(API + path + '?' + Q + (extra || ''), {{ credentials: 'include' }});
      return r.json();
    }};

    // ① 转存
    const sv = await jpost('/1/clouddrive/share/sharepage/save', '', {{
      fid_list: [{fid_j}],
      fid_token_list: [{tok_j}],
      to_pdir_fid: '0',
      pwd_id: {sid_j},
      stoken: {stk_j},
      pdir_fid: '0',
      scene: 'link',
    }});
    if (!sv || sv.status !== 200 || !sv.data) throw new Error('转存：' + (sv && sv.message) + ' [' + (sv && sv.code) + ']');
    const taskId = sv.data.task_id;

    // ② 轮询任务
    let savedFid = null;
    for (let i = 0; i < 20; i++) {{
      await new Promise((r) => setTimeout(r, 500));
      const t = await jget('/1/clouddrive/task', '&task_id=' + encodeURIComponent(taskId) + '&retry_index=' + i);
      if (t && t.status === 200 && t.data && Number(t.data.status) === 2) {{
        const ids = (t.data.save_as && t.data.save_as.save_as_top_fids) || [];
        savedFid = ids[0];
        break;
      }}
    }}
    if (!savedFid) throw new Error('转存超时（夸克排队中）');

    // ③ 取直链
    const dl = await jpost('/1/clouddrive/file/download', '&sys=win32&ve=3.23.2', {{ fids: [savedFid] }});
    if (!dl || dl.status !== 200) throw new Error('取链：' + (dl && dl.message) + ' [' + (dl && dl.code) + ']');
    const rows = Array.isArray(dl.data) ? dl.data : (dl.data && dl.data.list) || [];
    const row = rows[0];
    if (!row || !row.download_url) throw new Error('夸克没返回下载地址（可能被限速/风控）');

    done(row.download_url, row.file_name || {name_j}, savedFid);
  }} catch (e) {{
    fail(String(e && e.message ? e.message : e));
  }}
}})();"#,
        port = port,
        fid_j = j(fid),
        tok_j = j(fid_token),
        sid_j = j(share_id),
        stk_j = j(stoken),
        name_j = j(file_name),
    )
}

/// 注入到页面里的浮层：点按钮 → 把 cookie 导航回本地端口
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
  hint.textContent = '登录后点这里';
  hint.style.cssText = 'opacity:.75';
  const ok = document.createElement('button');
  ok.textContent = '完成登录';
  ok.style.cssText = 'border:0;border-radius:6px;padding:6px 12px;background:#1a56db;color:#fff;font:inherit;cursor:pointer';
  ok.onclick = () => {{
    const cookie = document.cookie || '';
    const n = cookie.split(';').filter(Boolean).length;
    ok.textContent = '读取中…';
    location.href = 'http://127.0.0.1:{port}/c?d=' + encodeURIComponent(location.host + '\n' + cookie);
    setTimeout(() => {{
      ok.textContent = '已提交 ' + n + ' 项';
      ok.style.background = '#2f8f5b';
    }}, 300);
  }};
  bar.appendChild(hint);
  bar.appendChild(ok);
  document.documentElement.appendChild(bar);
}})();
"#
    )
}
