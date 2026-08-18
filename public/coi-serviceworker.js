/*
 * Proxmark3 PWA service worker.
 *
 * This worker intentionally owns both offline caching and cross-origin
 * isolation. Registering separate workers at the app root would cause one to
 * replace the other and either break offline mode or threaded WASM support.
 */

const CACHE_PREFIX = "proxmark3-web-client";
const CACHE_VERSION = "v2";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const APP_SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icons/pwa-256.png",
  "./icons/pwa-512.png",
  "./wasm/proxmark3.js",
  "./wasm/proxmark3.wasm",
];
const CACHEABLE_DESTINATIONS = new Set([
  "audio",
  "font",
  "image",
  "script",
  "style",
  "video",
  "worker",
]);

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function withIsolationHeaders(response) {
  if (!response || response.status === 0) return response;

  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function fetchWithoutCredentials(request) {
  if (request.mode !== "no-cors") return fetch(request);
  return fetch(new Request(request, { credentials: "omit" }));
}

function canCache(response) {
  return response.ok || response.type === "opaque";
}

async function cacheResponse(cache, request, response) {
  if (canCache(response)) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetchWithoutCredentials(request);
    await cacheResponse(cache, request, response);
    return withIsolationHeaders(response);
  } catch {
    const cached = await cache.match(request);
    if (cached) return withIsolationHeaders(cached);

    const appShell = await cache.match(scopedUrl("./"));
    if (appShell) return withIsolationHeaders(appShell);

    return new Response("Proxmark3 Web Client is unavailable offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function cacheKeyWithoutSearch(request) {
  const url = new URL(request.url);
  url.search = "";
  return url.href;
}

async function cacheFirst(request, ignoreSearch = false) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = ignoreSearch ? cacheKeyWithoutSearch(request) : request;
  const cached = await cache.match(cacheKey);
  if (cached) return withIsolationHeaders(cached);

  const response = await fetchWithoutCredentials(request);
  await cacheResponse(cache, cacheKey, response);
  return withIsolationHeaders(response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map(scopedUrl)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
              .map((name) => caches.delete(name)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith("http")) return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const url = new URL(request.url);
  const isWasmAsset =
    url.origin === self.location.origin && /\/wasm\/.*\.(?:data|js|wasm)$/.test(url.pathname);
  if (CACHEABLE_DESTINATIONS.has(request.destination) || isWasmAsset) {
    event.respondWith(cacheFirst(request, isWasmAsset));
    return;
  }

  event.respondWith(fetchWithoutCredentials(request).then(withIsolationHeaders));
});
