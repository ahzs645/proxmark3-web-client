//! Serial port communication module for Tauri
//!
//! Provides Tauri commands for serial port enumeration, connection, and data transfer.

use serde::{Deserialize, Serialize};
use serialport::{SerialPort, SerialPortType};
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

/// Information about a serial port
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub serial_number: Option<String>,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
}

/// Managed state for serial port connection
pub struct SerialState {
    port: Mutex<Option<Box<dyn SerialPort>>>,
    port_name: Mutex<Option<String>>,
}

impl SerialState {
    pub fn new() -> Self {
        Self {
            port: Mutex::new(None),
            port_name: Mutex::new(None),
        }
    }
}

impl Default for SerialState {
    fn default() -> Self {
        Self::new()
    }
}

/// List all available serial ports
#[tauri::command]
pub fn serial_list_ports() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;

    let port_infos: Vec<PortInfo> = ports
        .into_iter()
        .map(|p| {
            let (port_type, vid, pid, serial_number, manufacturer, product) = match &p.port_type {
                SerialPortType::UsbPort(info) => (
                    "USB".to_string(),
                    Some(info.vid),
                    Some(info.pid),
                    info.serial_number.clone(),
                    info.manufacturer.clone(),
                    info.product.clone(),
                ),
                SerialPortType::PciPort => ("PCI".to_string(), None, None, None, None, None),
                SerialPortType::BluetoothPort => {
                    ("Bluetooth".to_string(), None, None, None, None, None)
                }
                SerialPortType::Unknown => ("Unknown".to_string(), None, None, None, None, None),
            };

            PortInfo {
                name: p.port_name,
                port_type,
                vid,
                pid,
                serial_number,
                manufacturer,
                product,
            }
        })
        .collect();

    Ok(port_infos)
}

/// Connect to a serial port
#[tauri::command]
pub fn serial_connect(
    state: State<'_, SerialState>,
    port_name: String,
    baud_rate: u32,
) -> Result<bool, String> {
    // Disconnect existing connection first
    let mut port_guard = state.port.lock().map_err(|e| e.to_string())?;
    if port_guard.is_some() {
        *port_guard = None;
    }

    // Open new connection
    let port = serialport::new(&port_name, baud_rate)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| format!("Failed to open port {}: {}", port_name, e))?;

    *port_guard = Some(port);

    // Store port name
    let mut name_guard = state.port_name.lock().map_err(|e| e.to_string())?;
    *name_guard = Some(port_name);

    log::info!("Serial port connected");
    Ok(true)
}

/// Disconnect from the serial port
#[tauri::command]
pub fn serial_disconnect(state: State<'_, SerialState>) -> Result<(), String> {
    let mut port_guard = state.port.lock().map_err(|e| e.to_string())?;
    *port_guard = None;

    let mut name_guard = state.port_name.lock().map_err(|e| e.to_string())?;
    *name_guard = None;

    log::info!("Serial port disconnected");
    Ok(())
}

/// Check if a serial port is currently connected
#[tauri::command]
pub fn serial_is_connected(state: State<'_, SerialState>) -> Result<bool, String> {
    let port_guard = state.port.lock().map_err(|e| e.to_string())?;
    Ok(port_guard.is_some())
}

/// Read data from the serial port
#[tauri::command]
pub fn serial_read(state: State<'_, SerialState>, max_bytes: usize) -> Result<Vec<u8>, String> {
    let mut port_guard = state.port.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut port) = *port_guard {
        let mut buf = vec![0u8; max_bytes];
        match port.read(&mut buf) {
            Ok(n) => {
                buf.truncate(n);
                Ok(buf)
            }
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {
                // Timeout is normal when no data available
                Ok(vec![])
            }
            Err(e) => Err(format!("Read error: {}", e)),
        }
    } else {
        Err("Serial port not connected".to_string())
    }
}

/// Write data to the serial port
#[tauri::command]
pub fn serial_write(state: State<'_, SerialState>, data: Vec<u8>) -> Result<usize, String> {
    let mut port_guard = state.port.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut port) = *port_guard {
        port.write(&data).map_err(|e| format!("Write error: {}", e))
    } else {
        Err("Serial port not connected".to_string())
    }
}
