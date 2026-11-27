//! 小莫资源库桌面端外壳。
//!
//! 只做三件事：开窗口、把外链交给系统浏览器、暴露一个最小的 API 基址设置命令。
//! 内容全部来自站点 /api/app/* —— 桌面端不内嵌数据库，站上更新它立刻可见。

use tauri::Manager;

/// 返回当前版本，设置页里显示用
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![app_version])
        .setup(|app| {
            // 首次启动把窗口居中（Tauri 默认位置依赖系统，这里显式居中）
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.center();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
