//! 小莫资源库桌面端外壳。
//!
//! 目标：让它像桌面软件，而不是"打开了一个网页"。
//!  · 无系统标题栏，前端自绘（`decorations: false`）
//!  · 关闭窗口 = 收进托盘，托盘菜单可显示/退出
//!  · 右键菜单、F5、F12、文字选中、拖拽、缩放全部在前端拦掉（见 src/lib/shell.ts）
//!
//! 内容全部来自站点 /api/app/*，桌面端不内嵌数据库。

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

mod cookies;
mod pan_login;
mod quark;

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 前端标题栏用
#[tauri::command]
fn show_main(window: tauri::Window) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            show_main,
            cookies::scan_browsers,
            cookies::import_browser_cookies,
            pan_login::open_pan_login,
            pan_login::take_pan_cookie,
            pan_login::close_pan_login,
            quark::quark_share_token,
            quark::quark_share_list
        ])
        .setup(|app| {
            // ── 托盘 ──
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "收进托盘", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("缺少默认窗口图标")?;

            TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("小莫资源库")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键单击托盘 = 切换显示（桌面软件的习惯）
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let visible = w.is_visible().unwrap_or(false);
                            if visible {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // 居中
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.center();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 点关闭按钮 → 收进托盘，不退出（托盘菜单里才有「退出」）
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
