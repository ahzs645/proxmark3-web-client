mod bluetooth;
mod native_pm3;
mod serial;
mod tcp;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize serial port state
            app.manage(serial::SerialState::new());
            // Initialize Bluetooth state
            app.manage(bluetooth::BluetoothState::new());
            // Initialize TCP (Proxmark5 BWM Wi-Fi / bridges) state
            app.manage(tcp::TcpState::new());

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_platform,
            // Optional installed-client runtime (no bundled executable)
            native_pm3::native_pm3_probe,
            native_pm3::native_pm3_run,
            // Serial commands
            serial::serial_list_ports,
            serial::serial_connect,
            serial::serial_disconnect,
            serial::serial_read,
            serial::serial_write,
            serial::serial_is_connected,
            // Bluetooth commands
            bluetooth::bt_list_devices,
            bluetooth::bt_scan_devices,
            bluetooth::bt_connect,
            bluetooth::bt_disconnect,
            bluetooth::bt_is_connected,
            bluetooth::bt_read,
            bluetooth::bt_write,
            // TCP commands
            tcp::tcp_connect,
            tcp::tcp_disconnect,
            tcp::tcp_is_connected,
            tcp::tcp_read,
            tcp::tcp_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Get the current platform
#[tauri::command]
fn get_platform() -> String {
    #[cfg(target_os = "macos")]
    return "darwin".to_string();

    #[cfg(target_os = "linux")]
    return "linux".to_string();

    #[cfg(target_os = "windows")]
    return "win32".to_string();

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    return "unknown".to_string();
}
