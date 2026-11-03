# Proxmark3 Web Client

A browser-based client for the [Proxmark3](https://github.com/RfidResearchGroup/proxmark3) and [Proxmark5](https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/md/Installation_Instructions/Proxmark5-Instructions.md) RFID research tools. Runs the full Iceman client as WebAssembly in your browser, communicating with real hardware over WebSerial, Web Bluetooth, or (in the desktop app) native serial, Bluetooth SPP and TCP.

## Features

- Full Proxmark3 client compiled to WASM via Emscripten
- WebSerial bridge to real PM3/PM5 hardware (Chrome/Edge)
- Web Bluetooth (BLE) link to the Proxmark5 Battery/Wireless Module (Chrome/Edge)
- Interactive xterm.js terminal with live PM3 output
- GUI panels for MIFARE Classic attacks (Autopwn, Nested, Hardnested, Darkside, etc.)
- Card detection and tag info display
- Card memory map visualization and dump management
- Raw Classic `.bin`/`.dump`, Proxmark `.eml`, JSON, and PM3 MFU import/export
- NFC Type 2/NDEF reader and editor with NTAG213/215/216 safety profiles
- Browser-native before-image backups, structured reports, and byte-for-byte verification
- Multi-select MIFARE block read/write with key fallback and failed-block retry
- LF/HF operations, traffic capture, magic card support
- Optional Tauri desktop app with native serial, Bluetooth SPP (Proxmark3 X) and Wi-Fi/TCP (Proxmark5 BWM, serial bridges) transports

## Requirements

- **Browser**: Chrome or Edge (WebSerial API required)
- **Hardware**: Proxmark3 or Proxmark5 connected via USB (or a Proxmark5 BWM over BLE / Wi-Fi)
- **Node.js**: 18+ (for building)
- **Emscripten SDK**: For rebuilding the WASM binary

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome/Edge, click **Connect**, and select your Proxmark3 from the serial port picker.

## Building

```bash
# Build the web app
npm run build

# Rebuild the PM3 WASM binary (requires Emscripten SDK)
# One-time: the Emscripten build compiles lz4 from source (not vendored in the submodule)
git -C proxmark3wasm/client clone --depth 1 --branch v1.10.0 https://github.com/lz4/lz4.git deps/lz4
printf 'CACHED_PLATFORM=PM3RDV4\nCACHED_PLATFORM_EXTRAS=\nCACHED_PLATFORM_DEFS=\n' > proxmark3wasm/.Makefile.options.cache
npm run build:pm3-wasm

# Copy rebuilt WASM to public directory
cp proxmark3wasm/client/proxmark3.js proxmark3wasm/client/proxmark3.wasm public/wasm/

# Repack the client's dictionaries, Lua scripts and resource files
npm run pack:pm3-resources

# Ship matching device firmware with the app (the flasher lists these first).
# Build bootrom + fullimage from the same submodule commit into one folder per
# platform (pm3generic/, pm3rdv4/, pm5/), then:
node scripts/bundle-firmware.cjs firmware-builds/<version>
```

The WASM binary only embeds the hardnested tables. `public/pm3-resources/` carries everything else the client loads from `~/.proxmark3` (dictionaries such as `mfc_default_keys`, `luascripts/`, `lualibs/`, `cmdscripts/` and resource JSON like `mad.json` and `aidlist.json`); the app writes it into the WASM filesystem at startup. The large `dictionaries/extras/` set is not packed: the first command that names one (`-f extras/16_byte_words`) fetches that file from GitHub, pinned to the submodule commit. Re-run the pack whenever the submodule moves, and commit the output alongside `public/wasm/`.

## Testing without Hardware

`npm run smoke:pm3-wasm-offline` boots the bundled WASM client in Node, runs `hw version` offline and checks that the client answers. Pass `--command`/`--expect` to run other offline commands.

## Testing with Hardware

A Node.js smoke test runner is included for validating the WASM binary against real hardware without a browser:

The runner advances to the next command after the output has been idle for `--advance-idle-ms` (default 1500 ms). Commands with long silent phases (`hf search`, `lf search`, `hf mf autopwn`) need a larger value, otherwise the next command is typed while the previous one is still running and the reader can be left waiting inside it (press its button to abort). A connected Proxmark5 prints `pm5 -->` as its prompt; the runner and the app accept both.

```bash
# Auto-detect port, run default commands (hw connect + hw version)
node scripts/pm3-wasm-smoke.cjs

# Specify port and commands
# Stage a dump into the WASM filesystem and load it into the reader's emulator memory
node scripts/pm3-wasm-smoke.cjs --port /dev/cu.usbmodem101 --advance-idle-ms 4000 \
  --file card-dumps/hf-mf-84F0B240-dump.bin:/tmp/hf-mf-84F0B240-dump.bin \
  --command "hw connect -p /dev/webserial" \
  --command "hf mf eload --4k -f /tmp/hf-mf-84F0B240-dump.bin" \
  --command "hf mf eview --4k"

# Probe a reader's identity without the client (works even when the client refuses a
# capabilities-version mismatch, e.g. Proxmark5 factory firmware)
node scripts/pm3-probe.cjs --port /dev/cu.usbmodem101

node scripts/pm3-wasm-smoke.cjs --port /dev/cu.usbmodemiceman1 \
  --command "hw connect -p /dev/webserial" \
  --command "hf 14a info" \
  --timings

# Run with assertions
node scripts/pm3-wasm-smoke.cjs \
  --command "hw connect -p /dev/webserial" \
  --command "hw version" \
  --expect "Proxmark3"
```

See `node scripts/pm3-wasm-smoke.cjs --help` for all options.

## Architecture

```
Browser
  ├── React UI (panels, terminal, toolbar)
  ├── xterm.js (terminal display)
  ├── WebSerial API ↔ USB ↔ Proxmark3 hardware
  │
  └── Emscripten WASM Module
      ├── Full PM3 C client (compiled with emmake)
      ├── Shared ring buffers (RX/TX/stdin)
      │   └── Atomic head/tail pointers in WASM heap
      ├── Pthreads via Web Workers
      └── ASYNCIFY for non-blocking I/O
```

**Data flow**: User input → xterm → stdin ring buffer → WASM PM3 client → TX ring buffer → WebSerial → PM3 hardware → WebSerial → RX ring buffer → WASM PM3 client → stdout → xterm.

---

## Proxmark5 support

The Proxmark5 (AT32F437 + GOWIN FPGA, RfidResearchGroup, 2026) speaks the same client protocol as the Proxmark3, and upstream keeps a single client for both. Support in this project:

| Area                    | Status                                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USB (WebSerial / Tauri) | Works like a Proxmark3. No vendor filter, so the PM5's `2D2D:504D` identity appears in the picker.                                                                                                                                                        |
| WASM client             | Built from the upstream master merge in `proxmark3wasm` (branch `pm5-upstream-merge`), which contains PM5 detection, `hw version` output and PM5-only commands (`hw fpga config`, `hw ant_pm5`, `hw qc_pm5`, `hw bwm*`).                                  |
| Device profile          | `hw version` / `hw status` output is recognised as `pm5` (MCU `AT32F4xx`, `Target.... PM5`, `[ Proxmark5 ]`).                                                                                                                                             |
| Bluetooth LE (browser)  | `WebBluetoothTransport` talks to the Battery/Wireless Module's BLE SPP service (`0xAE86` / `0xAE88`, name `Proxmark5`).                                                                                                                                   |
| Wi-Fi (desktop)         | `TauriTcpTransport` connects to the BWM TCP server started with `hw bwm wifi` (default port 18888) or any PM3 TCP bridge.                                                                                                                                 |
| Firmware updater        | Flashes Proxmark3 (AT91) and Proxmark5 (AT32) boards over Web Serial, from a published package or a local `bootrom.elf` + `fullimage.elf` build; each image's chip family is checked against the reader first. proxmark3.app publishes no PM5 images yet. |

Factory units ship with firmware whose capabilities struct is **v6**; every current client (including this one, v9) refuses to attach to it. Update the board first, per upstream's Proxmark5 instructions: build `bootrom`/`fullimage` with `PLATFORM=PM5` (Arm GNU toolchain), enter boot mode by holding the button while plugging in (~4 s, LEDs B+D), flash the bootrom, repeat for the full image, then upload the FPGA image with `hw fpga config -f PM5_FPGA_fix_loedge_bug.bin`. The PM5 keeps the classic `9AC4:4B8F` / "proxmark.org" USB identity after flashing. Verified 2026-08-31 on an AT32F435RGT7 unit: USB, `hw version`/`hw status`, `hf mf eload` all work through the WASM client.

Caveats: upstream marks PM5 firmware as unstable and the BWM as not fully supported; the wireless transports here follow the documented BWM interfaces but have not been exercised against shipping hardware.

## WASM Build: Technical Decisions and Notes

This section documents the non-obvious choices made when porting the Proxmark3 client to WebAssembly, particularly around the hardnested attack and threading.

### Enabling Hardnested in WASM

The upstream PM3 codebase intentionally stubbed out `hf mf hardnested` for Emscripten builds (returned `PM3_ENOTIMPL` silently). We re-enabled it with the following changes:

#### 1. Re-include `cmdhfmfhard.c` in the build

**File**: `proxmark3wasm/client/Makefile` line ~878

The original Makefile filtered out the hardnested source for Emscripten:

```makefile
# Original
SRCS := $(filter-out cmdhfmfhard.c uart/..., $(SRCS))

# Changed to
SRCS := $(filter-out uart/..., $(SRCS))
```

**Why**: The stub returned `PM3_ENOTIMPL` with no error message, making it silently appear broken. The real implementation works with the fixes below.

#### 2. Remove the inline stub

**File**: `proxmark3wasm/client/src/cmdhfmfhard.h`

Removed the `#ifdef __EMSCRIPTEN__` block that replaced `mfnestedhard()` with a no-op stub. The real function declaration is now used for all platforms.

#### 3. Stub lz4/bz2 APIs (not libraries)

**File**: `proxmark3wasm/client/src/cmdhfmfhard.c` (top of file)

The hardnested code loads precomputed bitflip state tables from `.lz4` and `.bz2` compressed files. Since lz4 and bz2 libraries are not linked in the Emscripten build (intentionally excluded at Makefile line ~274), we provide minimal inline stub definitions for the API types and functions:

```c
#ifdef __EMSCRIPTEN__
// Stub typedefs and functions for LZ4F_* and BZ2_bz* APIs
// The compressed table paths will fail gracefully at runtime
// since .lz4/.bz2 files are not shipped in the WASM filesystem
...
#else
#include <lz4frame.h>
#include <bzlib.h>
#endif
```

**Why not link real lz4/bz2?** The Emscripten build was designed to exclude them. The stubs let the code compile and the compressed paths fail gracefully (returning errors that the loading code already handles). The attack works without the tables -- it just takes longer to reduce the state space since it relies entirely on collected nonces rather than precomputed bitflip arrays.

**Trade-off**: Without bitflip tables, the nonce collection phase takes longer before brute force can begin. If you want faster reduction, you could embed raw (uncompressed) `.bin` tables into the Emscripten virtual filesystem using `--embed-file` or `--preload-file`.

#### 4. Force NOSIMD for WASM

**File**: `proxmark3wasm/client/deps/hardnested/Makefile`

```makefile
ifdef EMSCRIPTEN
cpu_arch = wasm
else
cpu_arch = $(shell uname -m)
endif
```

**Why**: The hardnested brute-force core (`hardnested_bf_core.c`) is compiled multiple times with different SIMD instruction sets (AVX512, AVX2, SSE2, NEON, MMX) and dispatches at runtime. WASM doesn't support x86/ARM SIMD intrinsics. Setting `cpu_arch = wasm` means no SIMD architecture is detected, falling through to the `NOSIMD_BUILD` path which uses plain 64-bit integer operations.

**Future improvement**: WASM SIMD128 support could be added as a new dispatch target for better performance. Emscripten supports `wasm_simd128.h` intrinsics.

#### 5. Cap thread count for Emscripten

**File**: `proxmark3wasm/client/src/util.c` in `detect_num_CPUs()`

```c
#if defined(__EMSCRIPTEN__)
    int count = sysconf(_SC_NPROCESSORS_ONLN);
    if (count <= 0) count = 1;
    return (count > 4) ? 4 : count;
```

**Why**: `sysconf(_SC_NPROCESSORS_ONLN)` in Emscripten returns the host machine's core count (potentially 8, 16, 32). Each thread becomes a Web Worker with its own WASM memory copy. Spawning too many workers wastes memory and can cause instability. Capped at 4.

#### 6. Add pthread worker pool

**File**: `proxmark3wasm/client/Makefile`

```makefile
PM3LDFLAGS += -sPTHREAD_POOL_SIZE=8
```

**Why**: Without a pre-allocated pool, `pthread_create()` must spin up new Web Workers on demand, which requires async initialization and can deadlock in synchronous code paths. A pool of 8 pre-created workers avoids this.

#### 7. Increase memory limit

**File**: `proxmark3wasm/client/Makefile`

```makefile
# Original
PM3LDFLAGS += -sMAXIMUM_MEMORY=536870912   # 512 MB

# Changed to
PM3LDFLAGS += -sMAXIMUM_MEMORY=2147483648  # 2 GB
```

**Why**: Hardnested allocates large state arrays during nonce processing. With 512MB it hit `Cannot enlarge memory` and aborted. 2GB is the WASM limit for 32-bit address space and works in modern browsers.

#### 8. Emscripten's newer clang

**File**: `proxmark3wasm/client/Makefile`

`-Wno-error` is added to `CFLAGS` for Emscripten builds, and the deprecated `-sUSE_PTHREADS=1` link flag was dropped in favour of plain `-pthread`. Upstream targets older GCC/clang and builds with `-Werror`; emsdk's clang adds diagnostics (e.g. `-Wunused-but-set-global`) that would otherwise fail on unmodified upstream sources.

#### 9. Remove SAFE_HEAP

**File**: `proxmark3wasm/client/Makefile`

Removed `-sSAFE_HEAP=1` from the linker flags.

**Why**: `SAFE_HEAP` instruments all memory accesses for debugging but is incompatible with `SharedArrayBuffer` (required by pthreads). It caused segfaults when the hardnested brute-force threads accessed shared WASM memory. `ASSERTIONS=2` and `STACK_OVERFLOW_CHECK=2` are still enabled for safety.

### What Works

| Feature                                            | Status  | Notes                                                                  |
| -------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `hw connect`, `hw version`, `hw status`, `hw ping` | Working |                                                                        |
| `hf 14a info`, `hf search`, `hf 14a reader`        | Working |                                                                        |
| `hf mf info`, `hf mf chk`, `hf mf fchk`            | Working | Full 4K key check in ~54s                                              |
| `hf mf rdbl`, `hf mf rdsc`                         | Working | Reads sectors with known keys                                          |
| `hf mf darkside`                                   | Working | Correctly reports "not vulnerable" for hard PRNG cards                 |
| `hf mf nested`                                     | Working | Correctly reports "not vulnerable" for hard PRNG cards                 |
| `hf mf nack`                                       | Working |                                                                        |
| `hf mf isen`                                       | Working | Static encrypted nonce collection                                      |
| `hf mf hardnested`                                 | Working | Collects nonces, reduces state space, brute forces (slow without SIMD) |
| `hf mf autopwn`                                    | Working | Now uses hardnested for hard-PRNG cards instead of silently failing    |

### Known Limitations

- **No precomputed bitflip tables**: The `hardnested_tables/` directory contains `.lz4` files that aren't embedded in the WASM filesystem. The attack still works but the reduction phase relies entirely on collected nonces, making it slower.
- **NOSIMD brute force**: The brute-force phase runs ~4-8x slower than native due to no SIMD and WASM overhead. A card that takes 30 seconds natively may take several minutes in WASM.
- **Memory usage**: Hardnested can consume 1+ GB of memory. Ensure the browser tab has sufficient resources.
- **WebSerial port locking**: Chrome holds the serial port open even after navigating away. If the port doesn't appear in the picker, close all tabs that previously connected or unplug/replug the device.
- **No `hf mf dump`/`hf mf restore` file I/O**: The WASM virtual filesystem is ephemeral. Dumps are lost on page reload unless saved via the UI's cache mechanism.

### Troubleshooting

**"No port selected by the user"**: The Proxmark3 didn't appear in Chrome's serial picker. Check:

1. Is the device plugged in? (`ls /dev/cu.usbmodem*`)
2. Is another process holding the port? (`lsof /dev/cu.usbmodem*`)
3. Close any other tabs/apps that previously connected to the PM3.

**Hardnested hangs with no output**: Before these fixes, `hf mf hardnested` returned `PM3_ENOTIMPL` silently. If you see the target block info printed but no progress table, ensure you're running the patched WASM build.

**"Cannot enlarge memory"**: The WASM module hit its memory limit. Ensure `MAXIMUM_MEMORY` is set to at least 2GB in the Makefile.

**Segfault during hardnested**: If `SAFE_HEAP=1` is enabled, it conflicts with pthreads SharedArrayBuffer. Remove it from the linker flags.

## Project Structure

```
proxmark3-web-client/
├── src/                          # React web app
│   ├── App.tsx                   # Main container, state, output parsing
│   ├── hooks/useProxmarkWasm.ts  # WASM lifecycle and command execution
│   ├── lib/
│   │   ├── pm3WebUSB.ts          # Shared ring buffer (UartShared)
│   │   └── transports/           # WebSerial, Tauri serial/BT
│   └── components/
│       ├── terminal/Terminal.tsx  # xterm.js wrapper
│       ├── panels/               # MifareAttacks, CardMemoryMap, LF, etc.
│       └── ribbon/               # Toolbar, command deck, key cache
├── public/wasm/                  # Compiled WASM binary
│   ├── proxmark3.js              # Emscripten JS glue
│   └── proxmark3.wasm            # PM3 client binary
├── proxmark3wasm/                # PM3 source (git submodule)
│   └── client/                   # C client with WASM patches
├── scripts/
│   ├── pm3-wasm-smoke.cjs        # Node.js hardware test runner
│   └── proxmark3.node.cjs        # Node.js WASM bootstrap
└── src-tauri/                    # Optional Tauri desktop shell
```

## License

See [proxmark3wasm/LICENSE.txt](proxmark3wasm/LICENSE.txt) for the Proxmark3 client license (GPLv3).
