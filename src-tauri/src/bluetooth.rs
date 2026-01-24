//! Bluetooth SPP communication module for macOS
//!
//! Provides Tauri commands for Bluetooth device discovery and SPP communication.
//! Uses IOBluetooth framework via objc2 bindings.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Mutex;
use tauri::State;

/// Information about a Bluetooth device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothDeviceInfo {
    pub address: String,
    pub name: String,
    pub paired: bool,
    pub connected: bool,
}

/// Managed state for Bluetooth connection
pub struct BluetoothState {
    /// Currently connected device address
    connected_device: Mutex<Option<String>>,
    /// Receive buffer for incoming data
    rx_buffer: Mutex<VecDeque<u8>>,
    /// Connection status
    is_connected: Mutex<bool>,
}

impl BluetoothState {
    pub fn new() -> Self {
        Self {
            connected_device: Mutex::new(None),
            rx_buffer: Mutex::new(VecDeque::new()),
            is_connected: Mutex::new(false),
        }
    }
}

impl Default for BluetoothState {
    fn default() -> Self {
        Self::new()
    }
}

// macOS-specific implementation using IOBluetooth
#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use std::process::Command;

    /// Get list of paired Bluetooth devices on macOS
    /// Uses system_profiler to list Bluetooth devices
    pub fn get_paired_devices() -> Result<Vec<BluetoothDeviceInfo>, String> {
        // Use system_profiler to get Bluetooth device info
        let output = Command::new("system_profiler")
            .arg("SPBluetoothDataType")
            .arg("-json")
            .output()
            .map_err(|e| format!("Failed to run system_profiler: {}", e))?;

        if !output.status.success() {
            return Err("system_profiler failed".to_string());
        }

        let json_str = String::from_utf8_lossy(&output.stdout);

        // Parse the JSON output to find paired devices
        // Note: This is a simplified parser - production code should use serde_json properly
        let mut devices = Vec::new();

        // Look for Proxmark3 X device in the output
        if json_str.contains("Proxmark3") || json_str.contains("PM3") {
            // For now, return a placeholder - real implementation would parse the JSON
            log::info!("Found potential Proxmark3 device in Bluetooth list");
        }

        // Also check for any paired devices using blueutil if available
        if let Ok(bt_output) = Command::new("blueutil").arg("--paired").output() {
            if bt_output.status.success() {
                let bt_str = String::from_utf8_lossy(&bt_output.stdout);
                for line in bt_str.lines() {
                    // Parse blueutil output format: address, name, ...
                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() >= 2 {
                        let address = parts[0].trim().to_string();
                        let name = parts[1].trim().trim_matches('"').to_string();

                        devices.push(BluetoothDeviceInfo {
                            address,
                            name,
                            paired: true,
                            connected: false,
                        });
                    }
                }
            }
        }

        // If no blueutil, try to parse system_profiler output
        if devices.is_empty() {
            // Look for device entries in the JSON
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
                if let Some(bt_data) = json.get("SPBluetoothDataType") {
                    if let Some(arr) = bt_data.as_array() {
                        for item in arr {
                            // Look for device_connected or device_not_connected sections
                            for section_key in &[
                                "device_connected",
                                "device_not_connected",
                                "devices_list",
                            ] {
                                if let Some(devices_section) = item.get(section_key) {
                                    if let Some(obj) = devices_section.as_object() {
                                        for (name, info) in obj {
                                            let address = info
                                                .get("device_address")
                                                .and_then(|a| a.as_str())
                                                .unwrap_or("")
                                                .to_string();

                                            if !address.is_empty() {
                                                devices.push(BluetoothDeviceInfo {
                                                    address,
                                                    name: name.clone(),
                                                    paired: true,
                                                    connected: *section_key == "device_connected",
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(devices)
    }

    /// Connect to a Bluetooth device using RFCOMM
    /// Note: This requires the device to already be paired via macOS System Preferences
    pub fn connect_rfcomm(address: &str) -> Result<bool, String> {
        log::info!("Attempting RFCOMM connection to {}", address);

        // For SPP, we need to connect via RFCOMM channel
        // The typical approach on macOS is:
        // 1. Device must be paired via System Preferences > Bluetooth
        // 2. Use IOBluetoothRFCOMMChannel to open SPP channel
        //
        // Since objc2 IOBluetooth bindings are complex, we'll use a workaround:
        // Create a virtual serial port using the macOS Bluetooth Serial utility

        // Try to create a serial port binding using blueutil if available
        if let Ok(output) = Command::new("blueutil")
            .args(["--connect", address])
            .output()
        {
            if output.status.success() {
                log::info!("Connected to device via blueutil");
                return Ok(true);
            } else {
                let err = String::from_utf8_lossy(&output.stderr);
                log::warn!("blueutil connect failed: {}", err);
            }
        }

        // Note: Full IOBluetooth RFCOMM implementation would go here
        // This would involve:
        // 1. IOBluetoothDevice.getDeviceRef() to get device reference
        // 2. IOBluetoothDevice.openRFCOMMChannelSync() to open RFCOMM channel
        // 3. Setting up delegates for data callbacks
        //
        // For now, we return a placeholder

        Err("RFCOMM connection not fully implemented - please use blueutil or pair device first"
            .to_string())
    }

    /// Disconnect from Bluetooth device
    pub fn disconnect_rfcomm(address: &str) -> Result<(), String> {
        log::info!("Disconnecting from {}", address);

        // Try blueutil first
        if let Ok(output) = Command::new("blueutil")
            .args(["--disconnect", address])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
        }

        Ok(())
    }
}

#[cfg(not(target_os = "macos"))]
mod macos {
    use super::*;

    pub fn get_paired_devices() -> Result<Vec<BluetoothDeviceInfo>, String> {
        Err("Bluetooth not supported on this platform yet".to_string())
    }

    pub fn connect_rfcomm(_address: &str) -> Result<bool, String> {
        Err("Bluetooth not supported on this platform yet".to_string())
    }

    pub fn disconnect_rfcomm(_address: &str) -> Result<(), String> {
        Err("Bluetooth not supported on this platform yet".to_string())
    }
}

/// List paired Bluetooth devices
#[tauri::command]
pub fn bt_list_devices() -> Result<Vec<BluetoothDeviceInfo>, String> {
    macos::get_paired_devices()
}

/// Scan for nearby Bluetooth devices (requires device discovery)
#[tauri::command]
pub fn bt_scan_devices() -> Result<Vec<BluetoothDeviceInfo>, String> {
    // For now, just return paired devices
    // Full implementation would use IOBluetoothDeviceInquiry for discovery
    log::info!("Scanning for Bluetooth devices...");
    macos::get_paired_devices()
}

/// Connect to a Bluetooth device via SPP
#[tauri::command]
pub fn bt_connect(
    state: State<'_, BluetoothState>,
    address: String,
    _pin: String, // PIN is handled by macOS pairing dialog
) -> Result<bool, String> {
    // Try to establish RFCOMM connection
    let result = macos::connect_rfcomm(&address)?;

    if result {
        let mut connected = state.is_connected.lock().map_err(|e| e.to_string())?;
        *connected = true;

        let mut device = state.connected_device.lock().map_err(|e| e.to_string())?;
        *device = Some(address);
    }

    Ok(result)
}

/// Disconnect from Bluetooth device
#[tauri::command]
pub fn bt_disconnect(state: State<'_, BluetoothState>) -> Result<(), String> {
    let device = state.connected_device.lock().map_err(|e| e.to_string())?;
    if let Some(addr) = device.as_ref() {
        macos::disconnect_rfcomm(addr)?;
    }

    let mut connected = state.is_connected.lock().map_err(|e| e.to_string())?;
    *connected = false;

    let mut device = state.connected_device.lock().map_err(|e| e.to_string())?;
    *device = None;

    Ok(())
}

/// Check if Bluetooth is connected
#[tauri::command]
pub fn bt_is_connected(state: State<'_, BluetoothState>) -> Result<bool, String> {
    let connected = state.is_connected.lock().map_err(|e| e.to_string())?;
    Ok(*connected)
}

/// Read data from Bluetooth SPP connection
#[tauri::command]
pub fn bt_read(state: State<'_, BluetoothState>, max_bytes: usize) -> Result<Vec<u8>, String> {
    let connected = state.is_connected.lock().map_err(|e| e.to_string())?;
    if !*connected {
        return Err("Bluetooth not connected".to_string());
    }

    let mut buffer = state.rx_buffer.lock().map_err(|e| e.to_string())?;
    let count = std::cmp::min(max_bytes, buffer.len());
    let data: Vec<u8> = buffer.drain(..count).collect();

    Ok(data)
}

/// Write data to Bluetooth SPP connection
#[tauri::command]
pub fn bt_write(state: State<'_, BluetoothState>, data: Vec<u8>) -> Result<usize, String> {
    let connected = state.is_connected.lock().map_err(|e| e.to_string())?;
    if !*connected {
        return Err("Bluetooth not connected".to_string());
    }

    // Note: Actual write implementation would send via RFCOMM channel
    // For now, this is a placeholder
    log::debug!("BT write {} bytes", data.len());

    Ok(data.len())
}
