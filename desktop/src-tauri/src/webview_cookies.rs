//! 从 WebView2 的 cookie 库读 cookie（Chromium 格式 + DPAPI）。
//!
//! ⚠️ 局限：新版 WebView2 也用 **v20（App-Bound 加密）**，DPAPI 解不开 —— 实测确认。
//! 所以这里只作为兜底（老版本 WebView2 / v10 加密时可用）。
//!
//! 主力方案不依赖导 cookie：转存/取链都在登录窗口的**页面里**发请求
//! （同源自动带 httpOnly 的 `__pus`），见 `pan_login::build_task_js`。

use std::path::{Path, PathBuf};

use crate::cookies::decrypt_chromium;

/// Tauri 的 WebView2 用户数据目录可能在 exe 旁边，也可能在 LOCALAPPDATA 下按产品名建。
pub fn candidate_dbs() -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(
                dir.join("EBWebView")
                    .join("Default")
                    .join("Network")
                    .join("Cookies"),
            );
        }
    }

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

/// 读 WebView2 里某网盘域的 cookie（v20 加密时会返回空）
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
            "WebView2 的 cookie 是 v20 加密，读不出来。改用「下载」按钮（在登录窗口里执行）"
                .to_string(),
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
