//! 夸克网盘解析（本机直连）。
//!
//! 不经过站点服务器：cookie 留在本机，请求从这台机器发出去。
//!
//! 流程（和网站 src/lib/pan/quark.ts 一致）：
//!   ① pwd_id + passcode → stoken
//!   ② stoken → 列目录（pdir_fid=0 是根）
//!   ③ 转存到自己的网盘 → 任务轮询 → 拿文件 fid
//!   ④ 文件 fid → 下载直链
//!
//! 现在先实现 ①②（能列出文件就说明 cookie 够用），③④ 随后补。

use serde::{Deserialize, Serialize};
use serde_json::Value;

const API: &str = "https://drive-pc.quark.cn";
const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                  (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

#[derive(Debug, Serialize)]
pub struct PanFile {
    pub fid: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub fid_token: String,
    pub updated_at: u64,
}

#[derive(Debug, Serialize)]
pub struct ShareListing {
    pub title: Option<String>,
    pub total: u64,
    pub files: Vec<PanFile>,
    /// 诊断用：这次请求实际带回的 cookie 名（不含值）
    pub cookie_names: Vec<String>,
}

#[derive(Deserialize)]
struct ApiResp {
    status: Option<i64>,
    code: Option<i64>,
    message: Option<String>,
    data: Option<Value>,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败：{e}"))
}

/// 统一请求 + 错误归一
async fn call(
    method: reqwest::Method,
    path: &str,
    query: &[(&str, String)],
    body: Option<Value>,
    cookie: &str,
) -> Result<Value, String> {
    let cli = client()?;
    let mut req = cli
        .request(method, format!("{API}{path}"))
        .header("referer", "https://pan.quark.cn/")
        .header("origin", "https://pan.quark.cn")
        .query(&[("pr", "ucpro"), ("fr", "pc"), ("uc_param_str", "")])
        .query(query);

    if !cookie.trim().is_empty() {
        req = req.header("cookie", cookie);
    }
    if let Some(b) = body {
        req = req.json(&b);
    }

    let res = req.send().await.map_err(|e| format!("连不上夸克：{e}"))?;
    let http_status = res.status();
    let text = res.text().await.map_err(|e| format!("读取响应失败：{e}"))?;

    let parsed: ApiResp = serde_json::from_str(&text).unwrap_or(ApiResp {
        status: None,
        code: None,
        message: Some(text.chars().take(160).collect()),
        data: None,
    });

    let code = parsed.code.unwrap_or(0);
    if !http_status.is_success() || (parsed.status.unwrap_or(0) != 0 && code != 0) {
        let msg = parsed.message.unwrap_or_else(|| format!("HTTP {http_status}"));
        return Err(format!("{msg}（code={code}）"));
    }

    parsed
        .data
        .ok_or_else(|| "响应里没有 data（可能是登录态不对）".to_string())
}

fn cookie_names(cookie: &str) -> Vec<String> {
    cookie
        .split(';')
        .filter_map(|p| p.trim().split_once('=').map(|(k, _)| k.to_string()))
        .collect()
}

/// ① pwd_id + passcode → stoken
#[tauri::command]
pub async fn quark_share_token(
    share_id: String,
    passcode: String,
    cookie: String,
) -> Result<String, String> {
    let data = call(
        reqwest::Method::POST,
        "/1/clouddrive/share/sharepage/token",
        &[],
        Some(serde_json::json!({ "pwd_id": share_id, "passcode": passcode })),
        &cookie,
    )
    .await?;

    data.get("stoken")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "没拿到 stoken（分享可能已失效）".to_string())
}

/// ② 列目录
#[tauri::command]
pub async fn quark_share_list(
    share_id: String,
    stoken: String,
    pdir_fid: String,
    cookie: String,
) -> Result<ShareListing, String> {
    let data = call(
        reqwest::Method::GET,
        "/1/clouddrive/share/sharepage/detail",
        &[
            ("pwd_id", share_id.clone()),
            ("stoken", stoken),
            ("pdir_fid", pdir_fid),
            ("force", "0".into()),
            ("_page", "1".into()),
            ("_size", "100".into()),
            ("_fetch_banner", "0".into()),
            ("_fetch_share", "1".into()),
            ("_fetch_total", "1".into()),
            ("_sort", "file_type:asc,updated_at:desc".into()),
        ],
        None,
        &cookie,
    )
    .await?;

    let list = data
        .get("list")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let files = list
        .iter()
        .map(|f| PanFile {
            fid: f.get("fid").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: f
                .get("file_name")
                .and_then(|v| v.as_str())
                .unwrap_or("(未命名)")
                .to_string(),
            size: f.get("size").and_then(|v| v.as_u64()).unwrap_or(0),
            is_dir: f.get("dir").and_then(|v| v.as_bool()).unwrap_or(false),
            fid_token: f
                .get("share_fid_token")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            updated_at: f.get("updated_at").and_then(|v| v.as_u64()).unwrap_or(0),
        })
        .collect::<Vec<_>>();

    let total = data
        .get("metadata")
        .and_then(|m| m.get("_total"))
        .and_then(|v| v.as_u64())
        .unwrap_or(files.len() as u64);

    let title = data
        .get("share")
        .and_then(|s| s.get("title"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(ShareListing {
        title,
        total,
        files,
        cookie_names: cookie_names(&cookie),
    })
}
