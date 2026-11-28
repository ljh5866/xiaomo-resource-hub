//! 从 WebView2 的 cookie 库直读全部 cookie（含 httpOnly）。
//!
//! 云析 YunX-Desktop 用 JCEF 的 `CookieManager.getCookie()` 拿全量 cookie；
//! 我们这边的 WebView2 把 cookie 落在 **Chromium 格式的 SQLite** 里
//! （`EBWebView/Default/Network/Cookies`），加密方式和 Chrome 一致（`v10` + DPAPI），
//! 所以可以直接复用 `cookies.rs` 里那套解密，不用碰 COM 接口。
//!
//! 同一个 Windows 用户下 DPAPI 可解 —— 这是整条链路能成立的前提。

use std::path::{Path, PathBuf};

use crate::cookies::decrypt_chromium;

/// Tauri 的 WebView2 用户数据目录可能在 exe 旁边，也可能在 LOCALAPPDATA 下按产品名建。
fn candidate_dbs() -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();

    // ① exe 同级
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join("EBWebView").join("Default").join("Network").join("Cookies"));
        }
    }

    // ② LOCALAPPDATA 下所有一级目录的 EBWebView（覆盖 Tauri 按 productName 建目录的情况）
    if let Ok(la) = std::env::var("LOCALAPPDATA") {
        if let Ok(entries) = std::fs::read_dir(&la) {
            for e in entries.flatten() {
                let p = e
                    .path()
                    .join("EBWebView")
                    .join("Default")
                    .join("Network")
                    .join("Cookies");
                if p.is_file() {
                    out.push(p);
                }
            }
        }
    }

    out.into_iter().filter(|p| p.is_file()).collect()
}

/// 读一个 Chromium cookie 库里匹配域名的条目
fn read_db(db: &Path, domains: &[String]) -> Vec<(String, String)> {
    let mut out = Vec::new();

    // 复制再读：WebView2 对原库有锁
    let tmp = std::env::temp_dir().join(format!(
        "xm-wv-cookies-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    if std::fs::copy(db, &tmp).is_err() {
        return out;
    }

    if let Ok(conn) = rusqlite::Connection::open(&tmp) {
        let sql = "SELECT name, encrypted_value FROM cookies WHERE host_key LIKE ?";
        if let Ok(mut stmt) = conn.prepare(sql) {
            let mut skipped = 0usize;
            for d in domains {
                let like = format!("%{d}%");
                if let Ok(rows) = stmt.query_map([&like], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?))
                }) {
                    for row in rows.flatten() {
                        if row.0.is_empty() {
                            continue;
                        }
                        if let Some(v) = decrypt_chromium(&row.1, &mut skipped) {
                            if !v.is_empty() {
                                out.push((row.0, v));
                            }
                        }
                    }
                }
            }
        }
    }

    let _ = std::fs::remove_file(&tmp);
    out
}

/// 读 WebView2 里某网盘域的全部 cookie
pub fn read_webview_cookies(provider: &str) -> Result<Vec<(String, String)>, String> {
    let domains: Vec<String> = match provider {
        "quark" => vec![".quark.cn".into(), "quark.cn".into()],
        "uc" => vec![".uc.cn".into()],
        "baidu" => vec![".baidu.com".into()],
        "xunlei" => vec![".xunlei.com".into()],
        "115" => vec![".115.com".into(), ".115cdn.com".into()],
        other => return Err(format!("不支持的网盘：{other}")),
    };

    let dbs = candidate_dbs();
    if dbs.is_empty() {
        return Err("没找到 WebView2 的 cookie 库 —— 先把登录窗口打开并登录一次".to_string());
    }

    let mut all: Vec<(String, String)> = Vec::new();
    for db in &dbs {
        all.extend(read_db(db, &domains));
    }

    if all.is_empty() {
        return Err(
            "WebView2 里没读到这个网盘的 cookie —— 确认已在登录窗口里登录成功".to_string(),
        );
    }
    Ok(all)
}

/// 只保留登录相关的字段
pub fn important(cookies: &[(String, String)], provider: &str) -> Vec<(String, String)> {
    let keep: &[&str] = match provider {
        "quark" | "uc" => &[
            "__pus", "__puus", "__kp", "__kps", "__ktd", "ctoken", "b-user-id", "_uid", "_UP_",
            "tfstk", "isg", "xlly_s", "__uid",
        ],
        "baidu" => &["BDUSS", "BDUSS_BFESS", "STOKEN", "PANWEB", "BAIDUID", "BDCLND"],
        "xunlei" => &["sub", "pan.xunlei", "uid", "sessionid", "drive"],
        "115" => &["UID", "CID", "SEID", "KID"],
        _ => &[],
    };

    if keep.is_empty() {
        return cookies.to_vec();
    }

    cookies
        .iter()
        .filter(|(k, _)| keep.iter().any(|p| k == *p || k.starts_with(p)))
        .cloned()
        .collect()
}
