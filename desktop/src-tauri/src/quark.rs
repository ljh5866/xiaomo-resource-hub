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

/// ③ 转存到自己的网盘 → 返回转存后的文件 fid
#[tauri::command]
pub async fn quark_share_save(
    share_id: String,
    stoken: String,
    fid: String,
    fid_token: String,
    cookie: String,
) -> Result<String, String> {
    let task = call(
        reqwest::Method::POST,
        "/1/clouddrive/share/sharepage/save",
        &[],
        Some(serde_json::json!({
            "fid_list": [fid],
            "fid_token_list": [fid_token],
            "to_pdir_fid": "0",
            "pwd_id": share_id,
            "stoken": stoken,
            "pdir_fid": "0",
            "scene": "link",
        })),
        &cookie,
    )
    .await?;

    let task_id = task
        .get("task_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "转存任务没拿到 task_id".to_string())?
        .to_string();

    // 转存排队 1–3 秒；400ms 一探，最多等 6 秒
    for i in 0..15 {
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;

        let t = call(
            reqwest::Method::GET,
            "/1/clouddrive/task",
            &[
                ("task_id", task_id.clone()),
                ("retry_index", i.to_string()),
            ],
            None,
            &cookie,
        )
        .await?;

        if t.get("status").and_then(|v| v.as_i64()).unwrap_or(0) == 2 {
            let fid = t
                .get("save_as")
                .and_then(|s| s.get("save_as_top_fids"))
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            return fid.ok_or_else(|| "转存完成但没返回文件 id".to_string());
        }
    }

    Err("转存超时（夸克侧排队中，稍后重试）".to_string())
}

#[derive(Debug, Serialize)]
pub struct DirectLink {
    pub url: String,
    pub file_name: String,
    pub size: u64,
}

/// ④ 转存 + 取下载直链
#[tauri::command]
pub async fn quark_share_direct(
    share_id: String,
    stoken: String,
    fid: String,
    fid_token: String,
    file_name: String,
    size: u64,
    cookie: String,
) -> Result<DirectLink, String> {
    let saved_fid = quark_share_save(
        share_id,
        stoken,
        fid,
        fid_token,
        cookie.clone(),
    )
    .await?;

    let data = call(
        reqwest::Method::POST,
        "/1/clouddrive/file/download",
        &[("sys", "win32".into()), ("ve", "3.23.2".into())],
        Some(serde_json::json!({ "fids": [saved_fid] })),
        &cookie,
    )
    .await?;

    // 响应可能是数组，也可能包在 list 里
    let row = data
        .as_array()
        .and_then(|a| a.first())
        .or_else(|| data.get("list").and_then(|l| l.as_array()).and_then(|a| a.first()))
        .ok_or_else(|| "夸克没返回下载信息".to_string())?;

    let url = row
        .get("download_url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "夸克没返回下载地址（多半是账号被限速或风控）".to_string())?
        .to_string();

    Ok(DirectLink {
        url,
        file_name: row
            .get("file_name")
            .and_then(|v| v.as_str())
            .unwrap_or(&file_name)
            .to_string(),
        size: row.get("size").and_then(|v| v.as_u64()).unwrap_or(size),
    })
}

/// ⑤ 下载到本地（流式写文件）
///
/// 直链是 OSS 签名 URL，签名绑定了 `content-disposition` 和 `x-oss-traffic-limit`
/// 这两个请求头（网站那边踩过：不带就 SignatureDoesNotMatch）。所以这里必须带上，
/// 而且没法把 URL 直接丢给浏览器/IDM —— 它们不会带这两个头。
#[tauri::command]
pub async fn quark_download_file(
    app: tauri::AppHandle,
    url: String,
    file_name: String,
    cookie: String,
) -> Result<String, String> {
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

    let dir = downloads_dir()?;
    let path = unique_path(&dir, &file_name);
    let path_str = path.to_string_lossy().to_string();

    let cli = client()?;
    let res = cli
        .get(&url)
        .header("cookie", &cookie)
        .header("referer", "https://pan.quark.cn/")
        .header("user-agent", UA)
        .header("content-disposition", "attachment")
        .header("x-oss-traffic-limit", "0")
        .send()
        .await
        .map_err(|e| format!("下载请求失败：{e}"))?;

    if !res.status().is_success() {
        return Err(format!(
            "源站返回 {}（签名可能过期，重新解析一次）",
            res.status()
        ));
    }

    let total = res.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| format!("建文件失败：{e}"))?;

    let mut stream = res.bytes_stream();
    let mut got: u64 = 0;
    let mut last_emit: u64 = 0;

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取数据失败：{e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写文件失败：{e}"))?;
        got += chunk.len() as u64;

        // 每 1MB 报一次进度，别刷爆事件通道
        if got - last_emit >= 1_048_576 {
            last_emit = got;
            let _ = app.emit("pan-download", (got, total));
        }
    }

    file.flush().await.map_err(|e| format!("收尾失败：{e}"))?;
    let _ = app.emit("pan-download", (got, total));

    Ok(path_str)
}

fn downloads_dir() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("USERPROFILE").map_err(|_| "找不到用户目录".to_string())?;
    let dir = std::path::PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&dir).map_err(|e| format!("建下载目录失败：{e}"))?;
    Ok(dir)
}

/// 同名文件自动加 (1) (2)
fn unique_path(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
    let safe = name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let p = dir.join(&safe);
    if !p.exists() {
        return p;
    }
    let (stem, ext) = match safe.rsplit_once('.') {
        Some((s, e)) => (s.to_string(), format!(".{e}")),
        None => (safe.clone(), String::new()),
    };
    for i in 1..1000 {
        let cand = dir.join(format!("{stem} ({i}){ext}"));
        if !cand.exists() {
            return cand;
        }
    }
    p
}
