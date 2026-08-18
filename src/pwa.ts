import { isBrowser } from "@/lib/tauri";

const RELOAD_KEY = "pwa-controller-reload";

/**
 * Register the single worker responsible for both offline support and the
 * cross-origin isolation headers required by the threaded Proxmark3 WASM build.
 */
export async function registerPwa(): Promise<void> {
  if (!isBrowser() || !("serviceWorker" in navigator) || !window.isSecureContext) return;

  const scopeUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  const workerUrl = new URL("coi-serviceworker.js", scopeUrl);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, "true");
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register(workerUrl, {
      scope: scopeUrl.pathname,
      updateViaCache: "none",
    });
    if (registration.active) await registration.update().catch(() => undefined);
    await navigator.serviceWorker.ready;
    sessionStorage.removeItem(RELOAD_KEY);
  } catch (error) {
    // The web client remains usable online if registration is unavailable.
    console.error("PWA service worker registration failed", error);
  }
}
