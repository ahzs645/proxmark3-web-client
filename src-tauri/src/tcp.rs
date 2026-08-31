//! TCP socket transport for Tauri
//!
//! Carries the PM3 protocol over a plain TCP stream. Used for the Proxmark5
//! Battery/Wireless Module in Wi-Fi station mode (`hw bwmwifi`, default port
//! 7777) and for generic serial-to-TCP bridges.

use std::io::{ErrorKind, Read, Write};
use std::net::{Shutdown, TcpStream, ToSocketAddrs};
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const READ_TIMEOUT: Duration = Duration::from_millis(50);
const WRITE_TIMEOUT: Duration = Duration::from_secs(5);

/// Managed state for the TCP connection
pub struct TcpState {
    stream: Mutex<Option<TcpStream>>,
    address: Mutex<Option<String>>,
}

impl TcpState {
    pub fn new() -> Self {
        Self {
            stream: Mutex::new(None),
            address: Mutex::new(None),
        }
    }
}

impl Default for TcpState {
    fn default() -> Self {
        Self::new()
    }
}

/// Connect to `host:port`
#[tauri::command]
pub fn tcp_connect(state: State<'_, TcpState>, address: String) -> Result<bool, String> {
    let mut guard = state.stream.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = guard.take() {
        let _ = existing.shutdown(Shutdown::Both);
    }

    let addrs: Vec<_> = address
        .to_socket_addrs()
        .map_err(|e| format!("Could not resolve {}: {}", address, e))?
        .collect();
    if addrs.is_empty() {
        return Err(format!("Could not resolve {}", address));
    }

    let mut last_error = None;
    let mut connected = None;
    for addr in addrs {
        match TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT) {
            Ok(stream) => {
                connected = Some(stream);
                break;
            }
            Err(e) => last_error = Some(e),
        }
    }
    let stream = connected.ok_or_else(|| {
        format!(
            "Failed to connect to {}: {}",
            address,
            last_error
                .map(|e| e.to_string())
                .unwrap_or_else(|| "unknown error".to_string())
        )
    })?;

    stream
        .set_read_timeout(Some(READ_TIMEOUT))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(WRITE_TIMEOUT))
        .map_err(|e| e.to_string())?;
    // PM3 frames are small and latency sensitive; never let Nagle batch them.
    stream.set_nodelay(true).map_err(|e| e.to_string())?;

    *guard = Some(stream);
    let mut addr_guard = state.address.lock().map_err(|e| e.to_string())?;
    *addr_guard = Some(address.clone());

    log::info!("TCP connected to {}", address);
    Ok(true)
}

/// Close the connection
#[tauri::command]
pub fn tcp_disconnect(state: State<'_, TcpState>) -> Result<(), String> {
    let mut guard = state.stream.lock().map_err(|e| e.to_string())?;
    if let Some(stream) = guard.take() {
        let _ = stream.shutdown(Shutdown::Both);
    }
    let mut addr_guard = state.address.lock().map_err(|e| e.to_string())?;
    *addr_guard = None;
    log::info!("TCP disconnected");
    Ok(())
}

/// Whether a socket is currently open
#[tauri::command]
pub fn tcp_is_connected(state: State<'_, TcpState>) -> Result<bool, String> {
    let guard = state.stream.lock().map_err(|e| e.to_string())?;
    Ok(guard.is_some())
}

/// Read up to `max_bytes`. Returns an empty vector when nothing is pending and
/// an error once the peer has closed the connection.
#[tauri::command]
pub fn tcp_read(state: State<'_, TcpState>, max_bytes: usize) -> Result<Vec<u8>, String> {
    let mut guard = state.stream.lock().map_err(|e| e.to_string())?;
    let stream = guard.as_mut().ok_or_else(|| "TCP not connected".to_string())?;

    let mut buf = vec![0u8; max_bytes.max(1)];
    match stream.read(&mut buf) {
        Ok(0) => {
            let _ = stream.shutdown(Shutdown::Both);
            *guard = None;
            Err("TCP connection closed by peer".to_string())
        }
        Ok(n) => {
            buf.truncate(n);
            Ok(buf)
        }
        Err(e) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => Ok(vec![]),
        Err(e) if e.kind() == ErrorKind::Interrupted => Ok(vec![]),
        Err(e) => {
            *guard = None;
            Err(format!("TCP read error: {}", e))
        }
    }
}

/// Write all bytes
#[tauri::command]
pub fn tcp_write(state: State<'_, TcpState>, data: Vec<u8>) -> Result<usize, String> {
    let mut guard = state.stream.lock().map_err(|e| e.to_string())?;
    let stream = guard.as_mut().ok_or_else(|| "TCP not connected".to_string())?;
    stream
        .write_all(&data)
        .map_err(|e| format!("TCP write error: {}", e))?;
    Ok(data.len())
}
