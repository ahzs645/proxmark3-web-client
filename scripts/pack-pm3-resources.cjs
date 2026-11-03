#!/usr/bin/env node
// Packs the client's support files (dictionaries, Lua, cmdscripts, resource
// JSON) from the proxmark3wasm submodule into public/pm3-resources/, where the
// web app installs them into the WASM filesystem at ~/.proxmark3 on boot. The
// native client finds these files next to its binary; the WASM build only
// embeds the hardnested tables, so without this pack `-f mfc_default_keys`,
// `script run ...` and the AID/MAD lookups all miss.
//
//   node scripts/pack-pm3-resources.cjs [--client-dir <dir>] [--out-dir <dir>]
//
// Output (commit it, like public/wasm/ -- the Pages build does not check out
// the submodule):
//   manifest.json  file table + the extras list
//   core.bin       every core file concatenated, addressed by manifest offsets
//
// dictionaries/extras/ (~28 MB) is not packed. The manifest lists those files
// and the app fetches one from raw.githubusercontent.com, pinned to the
// submodule commit, the first time a command names it.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const options = {
  clientDir: path.join(repoRoot, "proxmark3wasm", "client"),
  outDir: path.join(repoRoot, "public", "pm3-resources"),
};

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--client-dir") options.clientDir = path.resolve(process.argv[++i]);
  else if (arg === "--out-dir") options.outDir = path.resolve(process.argv[++i]);
  else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}

// Already embedded in the WASM binary (see client/Makefile), or device
// firmware the app flashes through its own updater rather than the client.
const EXCLUDED = new Set([
  "resources/hardnested_tables",
  "resources/hardnested_bf_bench_data.bin",
  "resources/proxmark5_ble_wifi_module.bin",
  "resources/proxmark5_ble_wifi_module.sha512.txt",
]);

const CORE_DIRS = ["cmdscripts", "lualibs", "luascripts", "resources"];

function walk(relDir, out) {
  const absDir = path.join(options.clientDir, relDir);
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (EXCLUDED.has(rel) || entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) walk(rel, out);
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function submoduleCommit() {
  try {
    return execFileSync("git", ["-C", options.clientDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function submoduleRepo() {
  try {
    const url = execFileSync("git", ["-C", options.clientDir, "remote", "get-url", "origin"], {
      encoding: "utf8",
    }).trim();
    return url.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

if (!fs.existsSync(path.join(options.clientDir, "dictionaries"))) {
  console.error(
    `No client sources at ${options.clientDir}. Run: git submodule update --init proxmark3wasm`,
  );
  process.exit(1);
}

const dictionaryDir = path.join(options.clientDir, "dictionaries");
const corePaths = fs
  .readdirSync(dictionaryDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".dic"))
  .map((entry) => `dictionaries/${entry.name}`);
for (const dir of CORE_DIRS) walk(dir, corePaths);
corePaths.sort();

const chunks = [];
const files = [];
let offset = 0;
for (const rel of corePaths) {
  const bytes = fs.readFileSync(path.join(options.clientDir, rel));
  files.push({ path: rel, offset, size: bytes.length });
  chunks.push(bytes);
  offset += bytes.length;
}

const extras = walk("dictionaries/extras", [])
  .filter((rel) => rel.endsWith(".dic"))
  .sort()
  .map((rel) => ({ path: rel, size: fs.statSync(path.join(options.clientDir, rel)).size }));

const commit = submoduleCommit();
const repo = submoduleRepo();
const manifest = {
  version: 1,
  source: { repo, commit },
  bundle: "core.bin",
  bundleSize: offset,
  files,
  extras,
  extrasBaseUrl:
    repo && commit ? `https://raw.githubusercontent.com/${repo}/${commit}/client/` : null,
};

fs.mkdirSync(options.outDir, { recursive: true });
fs.writeFileSync(path.join(options.outDir, "core.bin"), Buffer.concat(chunks));
fs.writeFileSync(
  path.join(options.outDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
console.log(
  `Packed ${files.length} files (${kb(offset)}) into ${path.relative(repoRoot, options.outDir)}/core.bin; ` +
    `${extras.length} extras dictionaries listed for on-demand fetch` +
    (commit ? ` @ ${commit.slice(0, 10)}` : " (no submodule commit: extras disabled)"),
);
