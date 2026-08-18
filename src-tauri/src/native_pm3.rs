//! Optional bridge to an already-installed Proxmark3 client.
//!
//! The desktop app does not bundle or download a native PM3 executable. The
//! executable is launched directly (never through a shell), and a command is
//! supplied as one `-c` argument so PM3 remains responsible for parsing it.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const CANDIDATE_BINARIES: [&str; 2] = ["proxmark3", "pm3"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativePm3Probe {
    available: bool,
    path: Option<String>,
    version: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativePm3Result {
    success: bool,
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

fn first_nonempty_line(output: &Output) -> Option<String> {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    stdout
        .lines()
        .chain(stderr.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_owned)
}

fn validate_explicit_binary(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if !path.is_absolute() {
        return Err("The custom PM3 executable path must be absolute".to_string());
    }
    if !path.is_file() {
        return Err(format!("No executable file exists at {value}"));
    }
    Ok(path.to_owned())
}

fn probe_candidate(path: &Path) -> Result<(PathBuf, Output), String> {
    let version_output = Command::new(path)
        .arg("--version")
        .output()
        .map_err(|error| error.to_string())?;
    let output = if version_output.status.success() {
        version_output
    } else {
        Command::new(path)
            .arg("-h")
            .output()
            .unwrap_or(version_output)
    };
    Ok((path.to_owned(), output))
}

fn resolve_binary(explicit_path: Option<&str>) -> Result<(PathBuf, Output), String> {
    if let Some(value) = explicit_path.map(str::trim).filter(|value| !value.is_empty()) {
        return probe_candidate(&validate_explicit_binary(value)?);
    }

    let mut errors = Vec::new();
    for candidate in CANDIDATE_BINARIES {
        match probe_candidate(Path::new(candidate)) {
            Ok(found) => return Ok(found),
            Err(error) => errors.push(format!("{candidate}: {error}")),
        }
    }
    Err(format!(
        "No installed PM3 client was found on PATH ({})",
        errors.join("; ")
    ))
}

#[tauri::command]
pub fn native_pm3_probe(binary_path: Option<String>) -> NativePm3Probe {
    match resolve_binary(binary_path.as_deref()) {
        Ok((path, output)) => NativePm3Probe {
            available: output.status.success(),
            path: Some(path.to_string_lossy().into_owned()),
            version: first_nonempty_line(&output),
            error: (!output.status.success()).then(|| {
                format!(
                    "PM3 client exited with status {}",
                    output
                        .status
                        .code()
                        .map_or_else(|| "unknown".to_string(), |code| code.to_string())
                )
            }),
        },
        Err(error) => NativePm3Probe {
            available: false,
            path: None,
            version: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn native_pm3_run(
    binary_path: Option<String>,
    port: String,
    command: String,
) -> Result<NativePm3Result, String> {
    let port = port.trim();
    let command = command.trim();
    if port.is_empty() {
        return Err("A serial port is required".to_string());
    }
    if command.is_empty() {
        return Err("A PM3 command is required".to_string());
    }
    if port.len() > 512 || command.len() > 16_384 {
        return Err("Native PM3 request is too long".to_string());
    }

    let (binary, _) = resolve_binary(binary_path.as_deref())?;
    let output = Command::new(binary)
        .arg(port)
        .arg("-c")
        .arg(command)
        .output()
        .map_err(|error| format!("Failed to start installed PM3 client: {error}"))?;

    Ok(NativePm3Result {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code(),
    })
}
