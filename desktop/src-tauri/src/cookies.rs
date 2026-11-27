//! 从本机浏览器导入网盘 Cookie。
//!
//! 方案照 tidain/YunX-Desktop 的 BrowserCookieImporter：
//!  · Chromium 系：`<UserData>/Network/Cookies`（SQLite），`encrypted_value` 是
//!    `v10` 前缀 + Windows DPAPI 载荷，用 CryptUnprotectData 解（同一 Windows 用户下可解）。
//!  · `v20` 前缀是 Chrome 127+ 的 App-Bound 加密，DPAPI 解不开 —— 直接跳过并告知。
//!  · Firefox：`cookies.sqlite` 的 `moz_cookies.value` 是明文。
//!
//! 只读 cookie，不写、不改浏览器任何数据；读之前先复制一份（浏览器对原库有独占锁）。

use std::fs;
use std::path::PathBuf;

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct BrowserInfo {
    /// 内部 id，例如 "chromium-edge"
    pub id: String,
    pub name: String,
    /// "chromium" | "firefox"
    pub kind: String,
    /// 该浏览器下找到的 cookie 库文件路径（可能有多个 profile）
    pub db_paths: Vec<String>,
}

#[derive(Serialize)]
pub struct ImportResult {
    pub browser: String,
    pub cookie: String,
    pub count: usize,
    /// 跳过的 v20 条目数（App-Bound 加密）
    pub skipped_v20: usize,
}

fn local() -> Option<PathBuf> {
    std::env::var("LOCALAPPDATA").ok().map(PathBuf::from)
}
fn roaming() -> Option<PathBuf> {
    std::env::var("APPDATA").ok().map(PathBuf::from)
}

/// 常见 Chromium 系浏览器的 User Data 根目录
fn chromium_roots() -> Vec<(String, String, PathBuf)> {
    let mut out = Vec::new();
    if let Some(l) = local() {
        out.push(("chromium-chrome".into(), "Chrome".into(), l.join("Google\\Chrome\\User Data")));
        out.push(("chromium-edge".into(), "Edge".into(), l.join("Microsoft\\Edge\\User Data")));
        out.push(("chromium-360".into(), "360极速浏览器".into(), l.join("360Chrome\\Chrome\\User Data")));
        out.push(("chromium-qq".into(), "QQ浏览器".into(), l.join("Tencent\\QQBrowser\\User Data")));
        out.push(("chromium-brave".into(), "Brave".into(), l.join("BraveSoftware\\Brave-Browser\\User Data")));
        out.push(("chromium-vivaldi".into(), "Vivaldi".into(), l.join("Vivaldi\\User Data")));
    }
    if let Some(r) = roaming() {
        out.push(("chromium-opera".into(), "Opera".into(), r.join("Opera Software\\Opera Stable")));
        out.push(("chromium-sogou".into(), "搜狗浏览器".into(), r.join("SogouExplorer\\User Data")));
        out.push(("chromium-360se".into(), "360安全浏览器".into(), r.join("360se6\\User Data")));
    }
    out
}

/// 在 User Data 下找所有 `Network/Cookies`
fn find_chromium_dbs(root: &PathBuf) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let direct = root.join("Network\\Cookies");
    if direct.is_file() {
        out.push(direct);
    }
    // 多 profile：Default / Profile 1 / Profile 2 …
    if let Ok(entries) = fs::read_dir(root) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                let c = p.join("Network\\Cookies");
                if c.is_file() {
                    out.push(c);
                }
            }
        }
    }
    out
}

fn find_firefox_dbs() -> Vec<PathBuf> {
    let mut out = Vec::new();
    let Some(r) = roaming() else { return out };
    let profiles = r.join("Mozilla\\Firefox\\Profiles");
    if let Ok(entries) = fs::read_dir(&profiles) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                let c = p.join("cookies.sqlite");
                if c.is_file() {
                    out.push(c);
                }
            }
        }
    }
    out
}

/// 列出本机能找到的浏览器
#[tauri::command]
pub fn scan_browsers() -> Vec<BrowserInfo> {
    let mut out = Vec::new();

    for (id, name, root) in chromium_roots() {
        let dbs = find_chromium_dbs(&root);
        if !dbs.is_empty() {
            out.push(BrowserInfo {
                id,
                name,
                kind: "chromium".into(),
                db_paths: dbs.iter().map(|p| p.display().to_string()).collect(),
            });
        }
    }

    let ff = find_firefox_dbs();
    if !ff.is_empty() {
        out.push(BrowserInfo {
            id: "firefox".into(),
            name: "Firefox".into(),
            kind: "firefox".into(),
            db_paths: ff.iter().map(|p| p.display().to_string()).collect(),
        });
    }

    out
}

/// Chromium 的 encrypted_value：去掉 v10/v20 前缀后走 DPAPI
fn decrypt_chromium(bytes: &[u8], skipped_v20: &mut usize) -> Option<String> {
    if bytes.len() < 3 {
        return None;
    }
    let mut offset = 0usize;
    if bytes[0] == b'v' && bytes[1].is_ascii_digit() && bytes[2].is_ascii_digit() {
        let version = (bytes[1] - b'0') as u32 * 10 + (bytes[2] - b'0') as u32;
        if version >= 20 {
            *skipped_v20 += 1;
            return None;
        }
        offset = 3;
    }
    let payload = &bytes[offset..];
    let plain = dpapi_unprotect(payload)?;
    String::from_utf8(plain).ok()
}

/// Windows DPAPI 解密（当前用户作用域，和浏览器登录时是同一个用户即可解）
#[cfg(windows)]
fn dpapi_unprotect(payload: &[u8]) -> Option<Vec<u8>> {
    use std::ptr;
    use winapi::shared::minwindef::DWORD;
    use winapi::um::dpapi::CryptUnprotectData;
    use winapi::um::winbase::LocalFree;
    use winapi::um::wincrypt::DATA_BLOB;

    unsafe {
        let mut input = DATA_BLOB {
            cbData: payload.len() as DWORD,
            pbData: payload.as_ptr() as *mut u8,
        };
        let mut output = DATA_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        let ok = CryptUnprotectData(
            &mut input,
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            0,
            &mut output,
        );
        if ok == 0 {
            return None;
        }

        let plain = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as *mut _);
        Some(plain)
    }
}

#[cfg(not(windows))]
fn dpapi_unprotect(_payload: &[u8]) -> Option<Vec<u8>> {
    None
}

/// 从指定浏览器导入匹配域名的 Cookie
#[tauri::command]
pub fn import_browser_cookies(browser_id: String, domains: Vec<String>) -> Result<ImportResult, String> {
    let browsers = scan_browsers();
    let target = browsers
        .into_iter()
        .find(|b| b.id == browser_id)
        .ok_or_else(|| format!("没找到浏览器 {browser_id}"))?;

    let mut pairs: Vec<String> = Vec::new();
    let mut skipped_v20 = 0usize;

    for db in &target.db_paths {
        // 复制一份再读：浏览器对原库持有锁
        let tmp = std::env::temp_dir().join(format!(
            "xm-cookies-{}.db",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        if fs::copy(db, &tmp).is_err() {
            continue;
        }

        if target.kind == "firefox" {
            if let Ok(conn) = rusqlite::Connection::open(&tmp) {
                let sql = "SELECT name, value FROM moz_cookies WHERE host LIKE ?";
                let mut stmt = match conn.prepare(sql) {
                    Ok(s) => s,
                    Err(_) => {
                        let _ = fs::remove_file(&tmp);
                        continue;
                    }
                };
                for d in &domains {
                    let like = format!("%{d}%");
                    if let Ok(rows) = stmt.query_map([&like], |r| {
                        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
                    }) {
                        for row in rows.flatten() {
                            if !row.0.is_empty() && !row.1.is_empty() {
                                pairs.push(format!("{}={}", row.0, row.1));
                            }
                        }
                    }
                }
            }
        } else if let Ok(conn) = rusqlite::Connection::open(&tmp) {
            let sql = "SELECT name, encrypted_value FROM cookies WHERE host_key LIKE ?";
            let mut stmt = match conn.prepare(sql) {
                Ok(s) => s,
                Err(_) => {
                    let _ = fs::remove_file(&tmp);
                    continue;
                }
            };
            for d in &domains {
                let like = format!("%{d}%");
                if let Ok(rows) = stmt.query_map([&like], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?))
                }) {
                    for row in rows.flatten() {
                        if row.0.is_empty() {
                            continue;
                        }
                        if let Some(v) = decrypt_chromium(&row.1, &mut skipped_v20) {
                            if !v.is_empty() {
                                pairs.push(format!("{}={}", row.0, v));
                            }
                        }
                    }
                }
            }
        }

        let _ = fs::remove_file(&tmp);
    }

    // 去重（同名 cookie 取最后一个）
    let mut seen = std::collections::HashMap::<String, String>::new();
    for p in pairs {
        if let Some((k, v)) = p.split_once('=') {
            seen.insert(k.to_string(), v.to_string());
        }
    }

    if seen.is_empty() {
        let hint = if skipped_v20 > 0 {
            format!(
                "{} 的 Cookie 是 v20 加密（Chrome/Edge 127+ 的应用绑定加密），本工具解不开。请改用手动粘贴。",
                target.name
            )
        } else {
            format!("{} 里没有找到匹配的登录 Cookie，先在浏览器登录网盘再试。", target.name)
        };
        return Err(hint);
    }

    let cookie = seen
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("; ");

    Ok(ImportResult {
        browser: target.name,
        count: seen.len(),
        cookie,
        skipped_v20,
    })
}
