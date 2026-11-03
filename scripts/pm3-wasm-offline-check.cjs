#!/usr/bin/env node
// Boots the WASM client without any hardware, runs a few offline commands
// through the stdin ring buffer and checks the output. Useful after a rebuild
// to confirm the module loads, threads start and the client answers.
//
//   node scripts/pm3-wasm-offline-check.cjs [--wasm-dir <dir>] [--resources [<dir>]]
//       [--command "<cmd>"]... [--expect "<text>"]...
//
// --resources installs the public/pm3-resources pack into ~/.proxmark3 the way
// the web app does, so dictionary, Lua and resource-file lookups can be tested.
//
// Note: device-gated commands (e.g. the Proxmark5-only `hw qc_pm5`) are hidden
// from `help` while offline; check for them with `strings proxmark3.wasm`.

const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const options = {
  wasmDir: process.env.PM3_WASM_DIR || path.join(repoRoot, "public", "wasm"),
  commands: [],
  expect: [],
  timeoutMs: Number(process.env.PM3_SMOKE_TIMEOUT_MS || 30000),
  idleMs: 1500,
  quiet: false,
  resourcesDir: null,
};

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--wasm-dir") options.wasmDir = path.resolve(argv[++i]);
  else if (arg === "--command") options.commands.push(argv[++i]);
  else if (arg === "--expect") options.expect.push(argv[++i]);
  else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++i]);
  else if (arg === "--quiet") options.quiet = true;
  else if (arg === "--resources") {
    options.resourcesDir =
      argv[i + 1] && !argv[i + 1].startsWith("--")
        ? path.resolve(argv[++i])
        : path.join(repoRoot, "public", "pm3-resources");
  } else {
    console.error(`unknown argument: ${arg}`);
    process.exit(1);
  }
}
if (options.commands.length === 0) options.commands = ["hw version"];
if (options.expect.length === 0) options.expect = ["Iceman/"];

const output = [];
let finished = false;
let lastOutputAt = 0;

function log(line) {
  output.push(line);
  lastOutputAt = Date.now();
  if (!options.quiet) console.log(line);
}

function finish(code, reason) {
  if (finished) return;
  finished = true;
  if (reason) console.error(reason);
  const joined = output.join("\n");
  const missing = options.expect.filter((needle) => !joined.includes(needle));
  for (const needle of missing) console.error(`missing expected output: ${needle}`);
  process.exit(missing.length > 0 ? 1 : code);
}

function pushStdin(text) {
  const module = globalThis.Module;
  const heapU8 = module.HEAPU8;
  const heapU32 = module.HEAPU32;
  const cap = module._pm3_uart_rb_capacity();
  const headIdx = module._pm3_uart_stdin_head_ptr() >> 2;
  const tailIdx = module._pm3_uart_stdin_tail_ptr() >> 2;
  const buf = module._pm3_uart_stdin_buf_ptr();
  for (const byte of Buffer.from(text, "utf8")) {
    const head = Atomics.load(heapU32, headIdx) >>> 0;
    const tail = Atomics.load(heapU32, tailIdx) >>> 0;
    if (cap - ((head - tail) >>> 0) <= 0) throw new Error("stdin ring buffer is full");
    heapU8[buf + (head % cap)] = byte;
    Atomics.store(heapU32, headIdx, (head + 1) >>> 0);
  }
}

function installResources() {
  if (!options.resourcesDir) return;
  const fs = require("fs");
  const FS = globalThis.FS || globalThis.Module?.FS;
  if (!FS?.writeFile) throw new Error("Emscripten FS is not available in this build");
  const manifest = JSON.parse(fs.readFileSync(path.join(options.resourcesDir, "manifest.json")));
  const bundle = fs.readFileSync(path.join(options.resourcesDir, manifest.bundle));
  for (const file of manifest.files) {
    const target = `/home/web_user/.proxmark3/${file.path}`;
    FS.mkdirTree(path.posix.dirname(target));
    FS.writeFile(target, new Uint8Array(bundle.subarray(file.offset, file.offset + file.size)));
  }
  log(`[offline-check] installed ${manifest.files.length} resource files`);
}

function runCommands() {
  const queue = [...options.commands, "quit"];
  const next = () => {
    if (finished) return;
    if (queue.length === 0) return;
    // Advance once the client has gone quiet for a while.
    if (Date.now() - lastOutputAt < options.idleMs) {
      setTimeout(next, 100);
      return;
    }
    const command = queue.shift();
    log(`[offline-check] > ${command}`);
    pushStdin(`${command}\n`);
    if (command === "quit") {
      setTimeout(() => finish(0), options.idleMs);
      return;
    }
    setTimeout(next, 100);
  };
  setTimeout(next, 500);
}

setTimeout(() => finish(1, `timed out after ${options.timeoutMs} ms`), options.timeoutMs).unref();

process.argv = [process.argv[0], path.join(__dirname, "proxmark3.node.cjs")];
globalThis.Module = {
  locateFile: (file) => path.join(options.wasmDir, file),
  onRuntimeInitialized: () => {
    log("[offline-check] runtime initialised");
    installResources();
    runCommands();
  },
  print: (...args) => log(args.join(" ")),
  printErr: (...args) => log(args.join(" ")),
};

require("./proxmark3.node.cjs");
