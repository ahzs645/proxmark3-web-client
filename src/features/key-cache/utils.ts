export function prettySize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function resolveCachePath(cachePathPrefix: string, name: string, relativePath?: string) {
  return `${cachePathPrefix}/${relativePath || name}`;
}

export function formatTemplate(template: string, cachePath: string) {
  return template.replace("{{path}}", cachePath);
}

export function downloadCachedAsset({
  base64,
  name,
  relativePath,
}: {
  base64?: string;
  name: string;
  relativePath?: string;
}) {
  if (!base64) return;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = relativePath?.split("/").pop() || name;
  anchor.click();
  URL.revokeObjectURL(url);
}
