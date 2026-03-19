# Proxmark3 Web Client

A browser-based client for the [Proxmark3](https://github.com/RfidResearchGroup/proxmark3) RFID research tool. Runs the full PM3 client as WebAssembly in your browser, communicating with real hardware over WebSerial.

## Features

- Full Proxmark3 client compiled to WASM via Emscripten
- WebSerial bridge to real PM3 hardware (Chrome/Edge)
- Interactive xterm.js terminal with live PM3 output
- GUI panels for MIFARE Classic attacks (Autopwn, Nested, Hardnested, Darkside, etc.)
- Card detection and tag info display
- Card memory map visualization and dump management
- LF/HF operations, traffic capture, magic card support
- Optional Tauri desktop app with native serial and Bluetooth transports

## Requirements

- **Browser**: Chrome or Edge (WebSerial API required)
- **Hardware**: Proxmark3 connected via USB
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
npm run build:pm3-wasm

# Copy rebuilt WASM to public directory
cp proxmark3wasm/client/proxmark3.js proxmark3wasm/client/proxmark3.wasm public/wasm/
```

## Testing with Hardware

A Node.js smoke test runner is included for validating the WASM binary against real hardware without a browser:

```bash
# Auto-detect port, run default commands (hw connect + hw version)
node scripts/pm3-wasm-smoke.cjs

# Specify port and commands
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

#### 8. Remove SAFE_HEAP

**File**: `proxmark3wasm/client/Makefile`

Removed `-sSAFE_HEAP=1` from the linker flags.

**Why**: `SAFE_HEAP` instruments all memory accesses for debugging but is incompatible with `SharedArrayBuffer` (required by pthreads). It caused segfaults when the hardnested brute-force threads accessed shared WASM memory. `ASSERTIONS=2` and `STACK_OVERFLOW_CHECK=2` are still enabled for safety.

### What Works

| Feature | Status | Notes |
|---------|--------|-------|
| `hw connect`, `hw version`, `hw status`, `hw ping` | Working | |
| `hf 14a info`, `hf search`, `hf 14a reader` | Working | |
| `hf mf info`, `hf mf chk`, `hf mf fchk` | Working | Full 4K key check in ~54s |
| `hf mf rdbl`, `hf mf rdsc` | Working | Reads sectors with known keys |
| `hf mf darkside` | Working | Correctly reports "not vulnerable" for hard PRNG cards |
| `hf mf nested` | Working | Correctly reports "not vulnerable" for hard PRNG cards |
| `hf mf nack` | Working | |
| `hf mf isen` | Working | Static encrypted nonce collection |
| `hf mf hardnested` | Working | Collects nonces, reduces state space, brute forces (slow without SIMD) |
| `hf mf autopwn` | Working | Now uses hardnested for hard-PRNG cards instead of silently failing |

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
