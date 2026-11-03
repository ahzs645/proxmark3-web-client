import type { EmscriptenFSLike } from "@/features/workbench/types";
import { getEmscriptenFs } from "@/lib/emscriptenFs";

/**
 * Client support files (dictionaries, Lua, cmdscripts, resource JSON) packed by
 * scripts/pack-pm3-resources.cjs. The native client finds them next to its
 * binary; in the browser they are written into the WASM filesystem under the
 * user directory the client already searches (~/.proxmark3/<subdir>/).
 */
export const PM3_USER_DIR = "/home/web_user/.proxmark3";
export const PM3_RESOURCES_BASE_URL = "pm3-resources/";

export interface Pm3ResourceFile {
  path: string;
  offset: number;
  size: number;
}

export interface Pm3ExtraFile {
  path: string;
  size: number;
}

export interface Pm3ResourceManifest {
  version: number;
  source: { repo: string | null; commit: string | null };
  bundle: string;
  bundleSize: number;
  files: Pm3ResourceFile[];
  extras: Pm3ExtraFile[];
  extrasBaseUrl: string | null;
}

export interface Pm3ResourcePack {
  manifest: Pm3ResourceManifest;
  bundle: Uint8Array;
}

let packPromise: Promise<Pm3ResourcePack | null> | null = null;
let installedManifest: Pm3ResourceManifest | null = null;
const fetchedExtras = new Set<string>();

/** Starts the download once; later calls share it. Resolves null when the pack is missing. */
export function prefetchPm3Resources(
  baseUrl = PM3_RESOURCES_BASE_URL,
): Promise<Pm3ResourcePack | null> {
  packPromise ??= (async () => {
    try {
      const manifestResponse = await fetch(`${baseUrl}manifest.json`);
      if (!manifestResponse.ok) throw new Error(`manifest HTTP ${manifestResponse.status}`);
      const manifest = (await manifestResponse.json()) as Pm3ResourceManifest;
      const bundleResponse = await fetch(`${baseUrl}${manifest.bundle}`);
      if (!bundleResponse.ok) throw new Error(`bundle HTTP ${bundleResponse.status}`);
      const bundle = new Uint8Array(await bundleResponse.arrayBuffer());
      if (bundle.length !== manifest.bundleSize) {
        throw new Error(
          `bundle is ${bundle.length} bytes, manifest expects ${manifest.bundleSize}`,
        );
      }
      return { manifest, bundle };
    } catch (error) {
      console.warn(
        "[PM3] Client resources unavailable; dictionaries and Lua scripts missing",
        error,
      );
      return null;
    }
  })();
  return packPromise;
}

function ensureParentDir(fs: EmscriptenFSLike, filePath: string): void {
  const dir = filePath.slice(0, filePath.lastIndexOf("/"));
  if (!dir || fs.analyzePath?.(dir)?.exists) return;
  if (fs.mkdirTree) {
    fs.mkdirTree(dir);
    return;
  }
  let current = "";
  for (const part of dir.split("/").filter(Boolean)) {
    current += `/${part}`;
    if (!fs.analyzePath?.(current)?.exists) fs.mkdir?.(current);
  }
}

/** Writes every packed file under {@link PM3_USER_DIR}. Returns the count written. */
export function installPm3Resources(fs: EmscriptenFSLike, pack: Pm3ResourcePack): number {
  if (!fs.writeFile) return 0;
  let written = 0;
  for (const file of pack.manifest.files) {
    const target = `${PM3_USER_DIR}/${file.path}`;
    try {
      ensureParentDir(fs, target);
      fs.writeFile(target, pack.bundle.subarray(file.offset, file.offset + file.size), {
        flags: "w+",
      });
      written += 1;
    } catch (error) {
      console.warn(`[PM3] Could not install ${target}`, error);
    }
  }
  installedManifest = pack.manifest;
  return written;
}

/**
 * Extras dictionaries a command names, paired with where the client will look
 * for them. `-f extras/16_byte_words` resolves to dictionaries/extras/…, and a
 * bare `-f 16_byte_words` to dictionaries/16_byte_words.dic, so each form is
 * installed where its own lookup lands. `.dic` is optional, as in the client.
 */
export function extrasReferencedBy(
  command: string,
  extras: Pm3ExtraFile[],
): Array<{ extra: Pm3ExtraFile; installPath: string }> {
  const byName = new Map<string, Pm3ExtraFile>();
  for (const extra of extras) byName.set(extra.path.slice(extra.path.lastIndexOf("/") + 1), extra);

  const matches: Array<{ extra: Pm3ExtraFile; installPath: string }> = [];
  for (const raw of command.split(/\s+/)) {
    const token = raw.replace(/^["']|["']$/g, "");
    if (!token || token.startsWith("-")) continue;
    const withSuffix = token.endsWith(".dic") ? token : `${token}.dic`;
    const prefixed = withSuffix.startsWith("extras/");
    const name = prefixed ? withSuffix.slice("extras/".length) : withSuffix;
    if (name.includes("/")) continue;
    const extra = byName.get(name);
    if (!extra) continue;
    matches.push({ extra, installPath: `dictionaries/${prefixed ? `extras/${name}` : name}` });
  }
  return matches;
}

/**
 * Fetches any extras dictionary the command names and is not yet in the WASM
 * filesystem. Failures are logged and swallowed: the client then reports the
 * missing file itself, which is the same outcome as before.
 */
export async function ensureExtraDictionaries(command: string): Promise<string[]> {
  const manifest = installedManifest;
  if (!manifest?.extrasBaseUrl || manifest.extras.length === 0) return [];
  const fs = getEmscriptenFs();
  if (!fs?.writeFile) return [];

  const installed: string[] = [];
  for (const { extra, installPath } of extrasReferencedBy(command, manifest.extras)) {
    const target = `${PM3_USER_DIR}/${installPath}`;
    if (fetchedExtras.has(target) || fs.analyzePath?.(target)?.exists) continue;
    try {
      const response = await fetch(`${manifest.extrasBaseUrl}${extra.path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      ensureParentDir(fs, target);
      fs.writeFile(target, bytes, { flags: "w+" });
      fetchedExtras.add(target);
      installed.push(installPath);
    } catch (error) {
      console.warn(`[PM3] Could not fetch extras dictionary ${extra.path}`, error);
    }
  }
  return installed;
}
