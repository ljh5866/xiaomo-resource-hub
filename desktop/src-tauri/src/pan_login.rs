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
/// 页面里执行失败的原因
static DL_ERR: Mutex<Option<String>> = Mutex::new(None);
/// 待执行的下载任务：先存这里，导航过去，等 on_page_load 再执行
static PENDING: Mutex<Option<Task>> = Mutex::new(None);

#[derive(Clone, serde::Serialize)]
pub struct Task {
    pub s: String,
    pub t: String,
    pub f: String,
    pub k: String,
    pub n: String,
}
static PORT: OnceLock<u16> = OnceLock::new();

#[derive(Serialize)]
pub struct PickedCookie {
    pub cookie: String,
    pub host: String,
}

#[derive(Serialize)]
pub struct DirectResult {
    /// 成功时给直链
    pub url: String,
    pub name: String,
    /// 转存到用户网盘后的文件 id，下载完成后用它清理
    pub fid: String,
    /// 失败时给原因（页面里抛的错）
    pub err: String,
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
                    // GET /e?m=<错误>  → 页面里执行失败
                    if line.contains("GET /e?") {
                        if let Some(m) = query_param(line, "m") {
                            if let Ok(mut slot) = DL_ERR.lock() {
                                *slot = Some(m);
                            }
                        }
                    } else if line.contains("GET /d?") {
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
    if let Ok(mut e) = DL_ERR.lock() {
        if let Some(msg) = e.take() {
            return Some(DirectResult {
                url: String::new(),
                name: String::new(),
                fid: String::new(),
                err: msg,
            });
        }
    }
    let mut slot = DL.lock().ok()?;
    let (url, name, fid) = slot.take()?;
    Some(DirectResult {
        url,
        name,
        fid,
        err: String::new(),
    })
}

/// 从网盘窗口的 WebView2 cookie store 直读登录态（含 httpOnly 的 `__pus`）。
///
/// 这是整套方案的基石：以前靠页面里 `document.cookie` + 注入脚本，读不到 httpOnly，
/// 转存就一直是 `require login [guest]`。改成直读 cookie store 后，后续所有请求都能在
/// Rust 里发，不再依赖页面内执行。
#[tauri::command]
pub fn read_pan_cookie(app: tauri::AppHandle, provider: String) -> Result<String, String> {
    // 窗口活着才有最新登录态；没开也允许读（可能上次登录的还在）
    let _ = app.get_webview_window("pan-login");

    let all = crate::webview_cookies::read_webview_cookies(&provider)?;
    let picked = crate::webview_cookies::important(&all, &provider);
    let use_list = if picked.is_empty() { all } else { picked };

    // 去重（同名取最后一个）
    let mut map = std::collections::HashMap::<String, String>::new();
    for (k, v) in use_list {
        map.insert(k, v);
    }
    if map.is_empty() {
        return Err("读到了 cookie 但没有网盘登录字段".to_string());
    }

    // __pus 是转存的硬门槛，缺了直接说清楚
    let has_pus = map.contains_key("__pus") || map.contains_key("__puus");
    let cookie = map
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("; ");

    if !has_pus && (provider == "quark" || provider == "uc") {
        return Err(format!(
            "读到了 {} 个 cookie，但没有 __pus（httpOnly 那个）。{}",
            map.len(),
            "可能是 WebView2 用了新版加密；改用侧栏里的「手动粘贴」"
        ));
    }

    Ok(cookie)
}
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

    // 窗口已存在：**必须重新导航回网盘页**。
    // 上次「完成登录」会把页面导航到 127.0.0.1（本地回调），只 show() 的话就是一张白纸。
    if let Some(w) = app.get_webview_window("pan-login") {
        let _ = w.navigate(parsed);
        let _ = w.show();
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
            let _ = webview.eval(&build_injector(port));
            // 若有挂起的下载任务，此刻页面已就绪，执行它
            let pending = PENDING.lock().ok().and_then(|mut p| p.take());
            if let Some(task) = pending {
                let _ = webview.eval(&build_task_js(port, &task));
            }
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

/// 在网盘窗口里执行「转存 → 轮询 → 取直链」。
///
/// 时序要点（踩过两次坑）：
///  · 不能用 hash 传参 —— 夸克是 SPA，未知 hash 会被路由当成坏路径，直接出错误页；
///  · 不能在 navigate 后 sleep 再 eval —— 页面没加载完，脚本打在旧文档上，导航完成就没了。
/// 正确做法：任务存进 `PENDING`，导航到**纯** `https://pan.quark.cn/`，
/// 等 `on_page_load`（页面真正就绪的回调）再把脚本打进去。
#[tauri::command]
pub async fn pan_web_direct(
    app: tauri::AppHandle,
    share_id: String,
    stoken: String,
    fid: String,
    fid_token: String,
    file_name: String,
) -> Result<(), String> {
    let win = app
        .get_webview_window("pan-login")
        .ok_or_else(|| "网盘窗口已关闭 —— 请先在侧栏「网盘登录」重新打开并登录".to_string())?;

    if let Ok(mut slot) = DL.lock() {
        *slot = None;
    }
    if let Ok(mut e) = DL_ERR.lock() {
        *e = None;
    }

    let task = Task {
        s: share_id,
        t: stoken,
        f: fid,
        k: fid_token,
        n: file_name,
    };

    let cur = win.url().map(|u| u.to_string()).unwrap_or_default();
    let on_quark = cur.contains("quark.cn") && !cur.contains("127.0.0.1");

    if on_quark {
        // 页面已经在夸克域：直接执行（此刻文档已就绪）
        let port = ensure_server();
        let _ = win.show();
        win.eval(&build_task_js(port, &task))
            .map_err(|e| format!("注入失败：{e}"))?;
    } else {
        // 需要先导航：把任务挂起，交给 on_page_load
        if let Ok(mut p) = PENDING.lock() {
            *p = Some(task);
        }
        let target: tauri::Url = "https://pan.quark.cn/"
            .parse()
            .map_err(|_| "地址解析失败".to_string())?;
        let _ = win.show();
        win.navigate(target)
            .map_err(|e| format!("导航失败：{e}"))?;
    }
    Ok(())
}

/// 页面里执行的脚本：转存 → 轮询 → 取直链 → 导航回本地端口

/// 注入到页面里的脚本，两个职责：
///  ① 右上角浮层「完成登录」→ 把 cookie 导航回本地
///  ② 页面 hash 带 `#xm-dl=<base64>` 时，执行「转存 → 轮询 → 取直链」→ 导航回本地
fn build_injector(port: u16) -> String {
    format!(
        r#"
(() => {{
  const PORT = {port};

  // ── ① 登录浮层 ──
  if (!document.getElementById('xm-pan-finish')) {{
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
      ok.textContent = '提交中…';
      location.href = 'http://127.0.0.1:' + PORT + '/c?d=' + encodeURIComponent(location.host + '\n' + cookie);
      setTimeout(() => {{ ok.textContent = '已提交 ' + n + ' 项'; ok.style.background = '#2f8f5b'; }}, 300);
    }};
    bar.appendChild(hint);
    bar.appendChild(ok);
    document.documentElement.appendChild(bar);
  }}

  // ── ② 下载任务执行器（由 build_task_js 写入 window.__xmTask 后调用）──
  window.__xmRun = async () => {{
    const cfg = window.__xmTask;
    if (!cfg) return;

    const fail = (msg) => {{
      location.href = 'http://127.0.0.1:' + PORT + '/e?m=' + encodeURIComponent(String(msg).slice(0, 300));
    }};

    try {{
      const API = 'https://drive-pc.quark.cn';
    const Q = 'pr=ucpro&fr=pc&uc_param_str=';
    const jpost = async (path, extra, body) => {{
      const r = await fetch(API + path + '?' + Q + (extra || ''), {{
        method: 'POST',
        headers: {{ 'content-type': 'application/json' }},
        credentials: 'include',
        body: JSON.stringify(body),
      }});
      const t = await r.text();
      try {{ return JSON.parse(t); }} catch (e) {{ throw new Error('接口返回非 JSON: ' + t.slice(0, 80)); }}
    }};
    const jget = async (path, extra) => {{
      const r = await fetch(API + path + '?' + Q + (extra || ''), {{ credentials: 'include' }});
      return r.json();
    }};

    // ① 转存
    try {{
      const sv = await jpost('/1/clouddrive/share/sharepage/save', '', {{
        fid_list: [cfg.f],
        fid_token_list: [cfg.k],
        to_pdir_fid: '0',
        pwd_id: cfg.s,
        stoken: cfg.t,
        pdir_fid: '0',
        scene: 'link',
      }});
      if (!sv || sv.status !== 200 || !sv.data) {{
        throw new Error('转存失败：' + (sv && sv.message) + ' [' + (sv && sv.code) + ']');
      }}
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
      if (!dl || dl.status !== 200) {{
        throw new Error('取链失败：' + (dl && dl.message) + ' [' + (dl && dl.code) + ']');
      }}
      const rows = Array.isArray(dl.data) ? dl.data : (dl.data && dl.data.list) || [];
      const row = rows[0];
      if (!row || !row.download_url) throw new Error('夸克没返回下载地址（可能被限速/风控）');

      location.href = 'http://127.0.0.1:' + PORT + '/d'
        + '?u=' + encodeURIComponent(row.download_url)
        + '&n=' + encodeURIComponent(row.file_name || cfg.n)
        + '&f=' + encodeURIComponent(savedFid);
    }} catch (e) {{
      fail(e && e.message ? e.message : e);
    }}
  }};
}})();
"#,
        port = port
    )
}

/// 写入任务参数并触发执行（在 build_injector 之后调用）
fn build_task_js(port: u16, task: &Task) -> String {
    format!(
        r#"
(() => {{
  const PORT = {port};
  window.__xmTask = {cfg};
  if (typeof window.__xmRun === 'function') {{
    window.__xmRun();
  }} else {{
    location.href = 'http://127.0.0.1:' + PORT + '/e?m=' + encodeURIComponent('页面脚本未就绪');
  }}
}})();
"#,
        port = port,
        cfg = serde_json::to_string(task).unwrap_or_else(|_| "null".into())
    )
}
