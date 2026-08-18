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

function cleanName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "_") || "pm3-dump";
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function dumpBytes(dump: PM3DumpJson): Uint8Array {
  const rows = Object.entries(dump.blocks ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const bytes: number[] = [];
  for (const [, value] of rows) {
    const clean = value.replace(/[^a-fA-F0-9]/g, "");
    if (clean.length % 2 !== 0) throw new Error("Dump contains an odd-length hex row.");
    for (let index = 0; index < clean.length; index += 2) {
      bytes.push(Number.parseInt(clean.slice(index, index + 2), 16));
    }
  }
  return new Uint8Array(bytes);
}

export function exportDumpBinary(dump: ExportableDump): void {
  const body = dumpBytes(dump.data);
  const header = dump.data.MfuHeader?.match(/../g)?.map((value) => Number.parseInt(value, 16));
  const bytes = header?.length === 56 ? new Uint8Array([...header, ...body]) : body;
  download(
    `${cleanName(dump.name)}.bin`,
    new Blob([Uint8Array.from(bytes).buffer], { type: "application/octet-stream" }),
  );
}

export function exportDumpEml(dump: ExportableDump): void {
  const lines = Object.entries(dump.data.blocks ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(
      ([block, value]) => `${block.padStart(3, "0")}: ${value.replace(/\s/g, "").toUpperCase()}`,
    );
  download(
    `${cleanName(dump.name)}.eml`,
    new Blob([`${lines.join("\n")}\n`], { type: "text/plain" }),
  );
}
