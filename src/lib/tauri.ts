/**
 * Tauri environment detection and helpers
 */

declare global {
  interface Window {
    __TAURI__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
    __TAURI_IPC__?: unknown;
  }
}

/**
 * Check if running in Tauri desktop environment
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Check if running in a web browser (not Tauri)
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && !isTauri();
}

/**
 * Invoke a Tauri command
 * Only works when running in Tauri environment
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error("Tauri APIs not available - not running in Tauri environment");
  }

  // Use the global __TAURI__ object directly instead of dynamic import
  // This avoids bundling issues in web-only builds
  if (window.__TAURI__?.invoke) {
    return window.__TAURI__.invoke<T>(cmd, args);
  }

  throw new Error("Tauri invoke not available");
}

/**
 * Get current platform (only available in Tauri)
 * Returns: 'darwin' | 'linux' | 'win32' | null
 */
export async function getPlatform(): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    // Platform detection via Tauri command (will be implemented in Phase 2)
    return await invoke<string>("get_platform");
  } catch {
    return null;
  }
}
