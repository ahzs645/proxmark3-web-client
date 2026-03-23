import type { CachedDump, PM3DumpJson } from "@/features/memory/types";

type ExportableDump = Pick<CachedDump, "name" | "data"> | { name: string; data: PM3DumpJson };

export function exportDumpJson(dump: ExportableDump) {
  const blob = new Blob([JSON.stringify(dump.data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${dump.name.replace(/[^a-z0-9-_]+/gi, "_") || "pm3-dump"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
