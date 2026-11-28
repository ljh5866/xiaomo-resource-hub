//! 分片并发下载（参考 云析 YunX-Desktop 的 ChunkDownloader / DownloadSaver 思路）。
//!
//! 为什么需要它：夸克直链**按连接限速**，单连接就是几十 KB/s～2 MB/s；
//! 开 N 个 Range 并发能线性叠加（实测别人 512 线程跑到 11.7 MB/s）。
//!
//! 设计取舍：
//!  · 每个分片写自己的 `.partN` 文件（不用 pwrite 抢同一句柄），全部完成后顺序合并。
//!    好处是断点续传极其简单——part 文件在且大小对，就跳过。
//!  · 每片都校验 `Content-Range` 的区间，服务端偷懒返回整包时能立刻发现。
//!  · 进度用 AtomicU64 聚合，每 1MB 报一次。

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use futures_util::StreamExt;
use serde::Serialize;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                  (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// 单分片最小 1MB，避免切成几千个碎片
const MIN_CHUNK: u64 = 1024 * 1024;

#[derive(Serialize, Clone)]
pub struct DlProgress {
    pub got: u64,
    pub total: u64,
    pub done: u64,
    pub chunks: u64,
}

/// 探测文件总大小（用 Range: bytes=0-0 读 Content-Range）
async fn probe_size(
    cli: &reqwest::Client,
    url: &str,
    cookie: &str,
) -> Result<u64, String> {
    let res = cli
        .get(url)
        .header("cookie", cookie)
        .header("referer", "https://pan.quark.cn/")
        .header("user-agent", UA)
        .header("content-disposition", "attachment")
        .header("x-oss-traffic-limit", "0")
        .header("range", "bytes=0-0")
        .send()
        .await
        .map_err(|e| format!("探测大小失败：{e}"))?;

    if !res.status().is_success() && res.status().as_u16() != 206 {
        return Err(format!("源站返回 {}", res.status()));
    }

    // 优先 Content-Range: bytes 0-0/12345
    if let Some(cr) = res.headers().get("content-range").and_then(|v| v.to_str().ok()) {
        if let Some(total) = cr.rsplit('/').next().and_then(|s| s.trim().parse::<u64>().ok()) {
            if total > 0 {
                return Ok(total);
            }
        }
    }
    // 退化为 Content-Length（服务端忽略 Range 时）
    res.content_length()
        .filter(|n| *n > 0)
        .ok_or_else(|| "拿不到文件大小".to_string())
}

/// 解析 `Content-Range: bytes start-end/total`
fn parse_content_range(v: &str) -> Option<(u64, u64)> {
    let s = v.trim().strip_prefix("bytes ")?;
    let (range, _) = s.split_once('/')?;
    let (a, b) = range.split_once('-')?;
    Some((a.trim().parse().ok()?, b.trim().parse().ok()?))
}

async fn fetch_chunk(
    cli: &reqwest::Client,
    url: &str,
    cookie: &str,
    start: u64,
    end: u64,
    part: &Path,
    counter: &Arc<AtomicU64>,
    app: &tauri::AppHandle,
    total: u64,
    done: &Arc<AtomicU64>,
    chunks: u64,
) -> Result<(), String> {
    use tauri::Emitter;

    let mut last_err = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(800)).await;
        }

        let res = match cli
            .get(url)
            .header("cookie", cookie)
            .header("referer", "https://pan.quark.cn/")
            .header("user-agent", UA)
            .header("content-disposition", "attachment")
            .header("x-oss-traffic-limit", "0")
            .header("range", format!("bytes={start}-{end}"))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_err = format!("请求失败：{e}");
                continue;
            }
        };

        if res.status().as_u16() != 206 {
            last_err = format!("分片 {} 返回 {}（不是 206）", start, res.status());
            continue;
        }

        // 严格校验区间：服务端返回的和请求的不一致就重试
        match res
            .headers()
            .get("content-range")
            .and_then(|v| v.to_str().ok())
            .and_then(parse_content_range)
        {
            Some((a, b)) if a == start && b == end => {}
            Some((a, b)) => {
                last_err = format!("分片区间不符：要 {start}-{end}，给 {a}-{b}");
                continue;
            }
            None => {
                last_err = "缺少 Content-Range".to_string();
                continue;
            }
        }

        let mut f = match std::fs::File::create(part) {
            Ok(f) => f,
            Err(e) => return Err(format!("建分片文件失败：{e}")),
        };

        let mut stream = res.bytes_stream();
        let mut written = 0u64;
        let mut bad = false;
        let mut last_emit = 0u64;

        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    if let Err(e) = f.write_all(&bytes) {
                        return Err(format!("写分片失败：{e}"));
                    }
                    written += bytes.len() as u64;
                    counter.fetch_add(bytes.len() as u64, Ordering::Relaxed);

                    let got = counter.load(Ordering::Relaxed);
                    if got - last_emit >= 1_048_576 {
                        last_emit = got;
                        let _ = app.emit(
                            "pan-download",
                            DlProgress {
                                got,
                                total,
                                done: done.load(Ordering::Relaxed),
                                chunks,
                            },
                        );
                    }
                }
                Err(e) => {
                    last_err = format!("读取分片失败：{e}");
                    bad = true;
                    break;
                }
            }
        }

        if bad {
            counter.fetch_sub(written, Ordering::Relaxed);
            continue;
        }

        let expect = end - start + 1;
        if written != expect {
            counter.fetch_sub(written, Ordering::Relaxed);
            last_err = format!("分片大小不符：要 {expect}，实收 {written}");
            continue;
        }

        drop(f);
        done.fetch_add(1, Ordering::Relaxed);
        let _ = app.emit(
            "pan-download",
            DlProgress {
                got: counter.load(Ordering::Relaxed),
                total,
                done: done.load(Ordering::Relaxed),
                chunks,
            },
        );
        return Ok(());
    }

    Err(last_err)
}

/// 主入口：分片并发下载到 `dest`，返回保存路径
pub async fn download(
    app: tauri::AppHandle,
    url: String,
    file_name: String,
    cookie: String,
    conns: u32,
) -> Result<String, String> {
    use tauri::Emitter;

    let dir = downloads_dir()?;
    let dest = unique_path(&dir, &file_name);

    let cli = reqwest::Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| format!("HTTP 客户端失败：{e}"))?;

    let total = probe_size(&cli, &url, &cookie).await?;
    if total == 0 {
        return Err("文件大小为 0".to_string());
    }

    // 分片数：连接数不超过 1MB 一片的上限，避免碎片过多
    let max_by_size = (total / MIN_CHUNK).max(1);
    let n = (conns.max(1) as u64).min(max_by_size).min(64);
    let chunk_size = total / n + if total % n > 0 { 1 } else { 0 };

    let stem = dest.with_extension("");

    // 断点续传：part 文件已存在且大小正确则跳过
    let counter = Arc::new(AtomicU64::new(0));
    let done = Arc::new(AtomicU64::new(0));
    let mut tasks = Vec::new();

    for i in 0..n {
        let start = i * chunk_size;
        if start >= total {
            break;
        }
        let end = ((i + 1) * chunk_size - 1).min(total - 1);
        let part = PathBuf::from(format!("{}.part{}", stem.display(), i));
        let expect = end - start + 1;

        if let Ok(md) = std::fs::metadata(&part) {
            if md.len() == expect {
                counter.fetch_add(expect, Ordering::Relaxed);
                done.fetch_add(1, Ordering::Relaxed);
                continue;
            }
        }

        let cli2 = cli.clone();
        let url2 = url.clone();
        let cookie2 = cookie.clone();
        let c2 = counter.clone();
        let d2 = done.clone();
        let app2 = app.clone();

        tasks.push(tokio::spawn(async move {
            fetch_chunk(&cli2, &url2, &cookie2, start, end, &part, &c2, &app2, total, &d2, n).await
        }));
    }

    let _ = app.emit(
        "pan-download",
        DlProgress {
            got: counter.load(Ordering::Relaxed),
            total,
            done: done.load(Ordering::Relaxed),
            chunks: n,
        },
    );

    // 等所有分片
    for t in tasks {
        match t.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(format!("{e}（已下载的分片保留，重试可续传）")),
            Err(e) => return Err(format!("任务异常：{e}")),
        }
    }

    // 合并
    let mut out = std::fs::File::create(&dest).map_err(|e| format!("建目标文件失败：{e}"))?;
    for i in 0..n {
        let start = i * chunk_size;
        if start >= total {
            break;
        }
        let part = PathBuf::from(format!("{}.part{}", stem.display(), i));
        let bytes = std::fs::read(&part).map_err(|e| format!("读分片失败：{e}"))?;
        out.write_all(&bytes).map_err(|e| format!("合并失败：{e}"))?;
        let _ = std::fs::remove_file(&part);
    }
    out.flush().ok();

    let final_size = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    if final_size != total {
        return Err(format!("合并后大小不符：要 {total}，实得 {final_size}"));
    }

    let _ = app.emit(
        "pan-download",
        DlProgress {
            got: total,
            total,
            done: n,
            chunks: n,
        },
    );

    Ok(dest.to_string_lossy().to_string())
}

fn downloads_dir() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE").map_err(|_| "找不到用户目录".to_string())?;
    let dir = PathBuf::from(home).join("Downloads");
    std::fs::create_dir_all(&dir).map_err(|e| format!("建下载目录失败：{e}"))?;
    Ok(dir)
}

fn unique_path(dir: &Path, name: &str) -> PathBuf {
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
