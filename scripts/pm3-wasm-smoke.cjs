#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let SerialPort = null;

try {
  ({ SerialPort } = require('serialport'));
} catch {
  SerialPort = null;
}

const repoRoot = path.resolve(__dirname, '..');
const defaultWasmDir = path.join(repoRoot, 'public', 'wasm');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    port: process.env.PM3_SERIAL_PORT || null,
    baud: Number(process.env.PM3_SERIAL_BAUD || 115200),
    timeoutMs: Number(process.env.PM3_SMOKE_TIMEOUT_MS || 30000),
    startupDelayMs: Number(process.env.PM3_STARTUP_DELAY_MS || 500),
    settleMs: Number(process.env.PM3_SETTLE_MS || 1500),
    advanceIdleMs: Number(process.env.PM3_ADVANCE_IDLE_MS || 1500),
    commands: [],
    expect: [],
    wasmDir: process.env.PM3_WASM_DIR || defaultWasmDir,
    autoQuit: true,
    quiet: false,
    debugSerial: process.env.PM3_DEBUG_SERIAL === '1',
    waitForPrompt: process.env.PM3_WAIT_FOR_PROMPT === '1',
    timings: process.env.PM3_TIMINGS === '1',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--port':
        options.port = argv[++i] || fail('missing value for --port');
        break;
      case '--baud':
        options.baud = Number(argv[++i] || fail('missing value for --baud'));
        break;
      case '--timeout-ms':
        options.timeoutMs = Number(argv[++i] || fail('missing value for --timeout-ms'));
        break;
      case '--startup-delay-ms':
        options.startupDelayMs = Number(argv[++i] || fail('missing value for --startup-delay-ms'));
        break;
      case '--settle-ms':
        options.settleMs = Number(argv[++i] || fail('missing value for --settle-ms'));
        break;
      case '--advance-idle-ms':
        options.advanceIdleMs = Number(argv[++i] || fail('missing value for --advance-idle-ms'));
        break;
      case '--wasm-dir':
        options.wasmDir = path.resolve(argv[++i] || fail('missing value for --wasm-dir'));
        break;
      case '--command':
        options.commands.push(argv[++i] || fail('missing value for --command'));
        break;
      case '--expect':
        options.expect.push(argv[++i] || fail('missing value for --expect'));
        break;
      case '--no-auto-quit':
        options.autoQuit = false;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      case '--debug-serial':
        options.debugSerial = true;
        break;
      case '--wait-for-prompt':
        options.waitForPrompt = true;
        break;
      case '--timings':
        options.timings = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.baud) || options.baud <= 0) {
    fail(`invalid baud rate: ${options.baud}`);
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    fail(`invalid timeout: ${options.timeoutMs}`);
  }
  if (!Number.isFinite(options.startupDelayMs) || options.startupDelayMs < 0) {
    fail(`invalid startup delay: ${options.startupDelayMs}`);
  }
  if (!Number.isFinite(options.settleMs) || options.settleMs < 0) {
    fail(`invalid settle delay: ${options.settleMs}`);
  }
  if (!Number.isFinite(options.advanceIdleMs) || options.advanceIdleMs < 0) {
    fail(`invalid advance idle delay: ${options.advanceIdleMs}`);
  }

  if (!options.port) {
    options.port = autoDetectPort();
  }
  if (!options.port) {
    fail('no serial port found, pass --port or set PM3_SERIAL_PORT');
  }

  if (options.commands.length === 0) {
    options.commands = [
      'hw connect -p /dev/webserial',
      'hw version',
    ];
  }

  if (options.autoQuit && options.commands[options.commands.length - 1] !== 'quit') {
    options.commands.push('quit');
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/pm3-wasm-smoke.cjs [options]

Options:
  --port <path>              Serial port path. Defaults to PM3_SERIAL_PORT or auto-detect.
  --baud <rate>              Serial baud rate. Default: 115200.
  --command <text>           PM3 command to send. Repeat for multiple commands.
  --expect <text>            Require substring in captured output. Repeatable.
  --timeout-ms <n>           Hard timeout for the run. Default: 30000.
  --startup-delay-ms <n>     Delay before sending commands. Default: 500.
  --settle-ms <n>            Extra wait before exit after commands. Default: 1500.
  --advance-idle-ms <n>      Idle time before advancing to the next command. Default: 1500.
  --wasm-dir <path>          Directory containing proxmark3.js/wasm. Default: public/wasm.
  --no-auto-quit             Do not append "quit" automatically.
  --wait-for-prompt          Wait for the PM3 prompt before advancing commands. The initial
                             "hw connect" still falls back to idle detection.
  --timings                  Print per-command completion timings.
  --quiet                    Suppress live output, keep summary only.
  --debug-serial             Print TX/RX byte counts for the raw serial bridge.
  --help, -h                 Show this help.

Examples:
  node scripts/pm3-wasm-smoke.cjs --command "hw connect -p /dev/webserial" --command "hw version"
  node scripts/pm3-wasm-smoke.cjs --command "hw connect -p /dev/webserial" --command "hf 14a info" --expect "ISO14443-A Information"`);
}

function autoDetectPort() {
  try {
    const devEntries = fs.readdirSync('/dev');
    const patterns = [
      /^cu\.usbmodem/i,
      /^cu\.usbserial/i,
      /^cu\..*prox/i,
      /^ttyACM/i,
      /^ttyUSB/i,
      /^tty\..*usb/i,
      /^cu\..*usb/i,
    ];

    for (const pattern of patterns) {
      const match = devEntries.find((entry) => pattern.test(entry));
      if (match) {
        return path.join('/dev', match);
      }
    }
  } catch {
    // Ignore auto-detect failures and let the caller provide --port.
  }

  return null;
}

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
}

class WasmSmokeRunner {
  constructor(options) {
    this.options = options;
    this.output = [];
    this.fd = null;
    this.rxInterval = null;
    this.serialPort = null;
    this.txInterval = null;
    this.hardTimeout = null;
    this.finishTimer = null;
    this.commandAdvanceTimer = null;
    this.finished = false;
    this.commandSent = false;
    this.commandIndex = 0;
    this.awaitingPrompt = false;
    this.quitSent = false;
    this.currentCommand = null;
  }

  log(kind, text) {
    const line = String(text);
    this.output.push(line);
    if (this.commandSent) {
      if (this.currentCommand && this.isQuitCommand(this.currentCommand.command) && line.includes('program exited')) {
        this.completeCurrentCommand('exit');
        this.scheduleFinish();
      }
      if (this.awaitingPrompt && this.currentCommand && !this.isPromptLine(line)) {
        this.currentCommand.sawNonPromptOutput = true;
      }
      if (
        this.awaitingPrompt &&
        this.currentCommand &&
        this.isPromptLine(line) &&
        this.currentCommand.sawNonPromptOutput
      ) {
        if (this.commandAdvanceTimer) {
          clearTimeout(this.commandAdvanceTimer);
          this.commandAdvanceTimer = null;
        }
        this.completeCurrentCommand('prompt');
        this.dispatchNextCommand();
      } else if (
        this.awaitingPrompt &&
        this.currentCommand?.allowIdleAdvance &&
        this.currentCommand.sawNonPromptOutput
      ) {
        this.scheduleCommandAdvance();
      }
    }
    if (!this.options.quiet) {
      const printer = kind === 'err' ? console.error : console.log;
      printer(line);
    }
  }

  isPromptLine(line) {
    return stripAnsi(line).trimEnd().endsWith('pm3 -->');
  }

  isQuitCommand(command) {
    return command.trim() === 'quit';
  }

  printRunner(text) {
    const line = String(text);
    this.output.push(line);
    if (!this.options.quiet) {
      console.log(line);
    }
  }

  shouldUseIdleAdvance(commandText, sequence) {
    if (this.isQuitCommand(commandText)) {
      return false;
    }
    if (!this.options.waitForPrompt) {
      return true;
    }
    return sequence === 1 && /^\s*hw\s+connect\b/i.test(commandText);
  }

  completeCurrentCommand(reason) {
    if (!this.currentCommand) {
      return;
    }

    const completed = this.currentCommand;
    this.currentCommand = null;
    this.awaitingPrompt = false;

    if (this.commandAdvanceTimer) {
      clearTimeout(this.commandAdvanceTimer);
      this.commandAdvanceTimer = null;
    }

    if (this.options.timings) {
      const elapsedMs = Date.now() - completed.startedAt;
      this.printRunner(`[runner] command ${completed.sequence}/${this.options.commands.length} ${reason} after ${formatDuration(elapsedMs)}: ${completed.command}`);
    }
  }

  scheduleFinish() {
    if (this.finishTimer) {
      clearTimeout(this.finishTimer);
    }
    this.finishTimer = setTimeout(() => {
      this.finish(0);
    }, this.options.settleMs);
  }

  scheduleCommandAdvance() {
    if (this.commandAdvanceTimer) {
      clearTimeout(this.commandAdvanceTimer);
    }
    this.commandAdvanceTimer = setTimeout(() => {
      this.commandAdvanceTimer = null;
      if (!this.finished && this.awaitingPrompt) {
        this.completeCurrentCommand('idle');
        this.dispatchNextCommand();
      }
    }, this.options.advanceIdleMs);
  }

  configurePort() {
    const { port, baud } = this.options;

    if (process.platform === 'darwin') {
      execFileSync('stty', ['-f', port, String(baud), 'raw', '-echo', '-isig', '-icanon', '-opost']);
      return;
    }

    if (process.platform === 'linux') {
      execFileSync('stty', ['-F', port, String(baud), 'raw', '-echo', '-isig', '-icanon', '-opost']);
      return;
    }

    this.log('err', `warning: no stty preset for platform ${process.platform}; continuing without TTY setup`);
  }

  pushStdin(text) {
    const module = globalThis.Module;
    const heapU8 = module.HEAPU8;
    const heapU32 = module.HEAPU32;
    const cap = module._pm3_uart_rb_capacity();
    const headIdx = module._pm3_uart_stdin_head_ptr() >> 2;
    const tailIdx = module._pm3_uart_stdin_tail_ptr() >> 2;
    const buf = module._pm3_uart_stdin_buf_ptr();

    for (const byte of Buffer.from(text, 'utf8')) {
      const head = Atomics.load(heapU32, headIdx) >>> 0;
      const tail = Atomics.load(heapU32, tailIdx) >>> 0;
      const free = cap - ((head - tail) >>> 0);
      if (free <= 0) {
        throw new Error('stdin ring buffer is full');
      }

      heapU8[buf + (head % cap)] = byte;
      Atomics.store(heapU32, headIdx, (head + 1) >>> 0);
    }
  }

  pushRx(chunk) {
    const module = globalThis.Module;
    const heapU8 = module.HEAPU8;
    const heapU32 = module.HEAPU32;
    const cap = module._pm3_uart_rb_capacity();
    const headIdx = module._pm3_uart_rx_head_ptr() >> 2;
    const tailIdx = module._pm3_uart_rx_tail_ptr() >> 2;
    const buf = module._pm3_uart_rx_buf_ptr();

    let head = Atomics.load(heapU32, headIdx) >>> 0;
    const tail = Atomics.load(heapU32, tailIdx) >>> 0;
    let free = cap - ((head - tail) >>> 0);
    let offset = 0;

    while (offset < chunk.length && free > 0) {
      const toWrite = Math.min(free, chunk.length - offset);
      const headPos = head % cap;
      const first = Math.min(toWrite, cap - headPos);

      heapU8.set(chunk.subarray(offset, offset + first), buf + headPos);
      if (toWrite > first) {
        heapU8.set(chunk.subarray(offset + first, offset + toWrite), buf);
      }

      offset += toWrite;
      head = (head + toWrite) >>> 0;
      Atomics.store(heapU32, headIdx, head);
      free -= toWrite;
    }

    if (offset < chunk.length) {
      this.log('err', `warning: dropped ${chunk.length - offset} RX bytes because the WASM ring buffer is full`);
    }
  }

  popTx(maxBytes = 4096) {
    const module = globalThis.Module;
    const heapU8 = module.HEAPU8;
    const heapU32 = module.HEAPU32;
    const cap = module._pm3_uart_rb_capacity();
    const headIdx = module._pm3_uart_tx_head_ptr() >> 2;
    const tailIdx = module._pm3_uart_tx_tail_ptr() >> 2;
    const buf = module._pm3_uart_tx_buf_ptr();

    const head = Atomics.load(heapU32, headIdx) >>> 0;
    const tail = Atomics.load(heapU32, tailIdx) >>> 0;
    let available = (head - tail) >>> 0;
    if (available === 0) {
      return null;
    }
    available = Math.min(available, maxBytes);

    const out = Buffer.allocUnsafe(available);
    const tailPos = tail % cap;
    const first = Math.min(available, cap - tailPos);
    out.set(heapU8.subarray(buf + tailPos, buf + tailPos + first), 0);
    if (available > first) {
      out.set(heapU8.subarray(buf, buf + (available - first)), first);
    }

    Atomics.store(heapU32, tailIdx, (tail + available) >>> 0);
    return out;
  }

  startBridge() {
    if (SerialPort) {
      return this.startSerialPortBridge();
    }
    return this.startRawFdBridge();
  }

  startSerialPortBridge() {
    return new Promise((resolve, reject) => {
      this.serialPort = new SerialPort({
        path: this.options.port,
        baudRate: this.options.baud,
        autoOpen: false,
      });

      this.serialPort.on('data', (chunk) => {
        if (this.options.debugSerial) {
          this.log('log', `[serial] rx ${chunk.length} bytes`);
        }
        if (!this.finished) {
          this.pushRx(new Uint8Array(chunk));
        }
      });

      this.serialPort.on('error', (error) => {
        if (!this.finished) {
          this.finish(1, `serial error: ${error.message}`);
        }
      });

      this.serialPort.open((error) => {
        if (error) {
          reject(new Error(`failed to open serial port ${this.options.port}: ${error.message}`));
          return;
        }

        this.txInterval = setInterval(() => {
          if (this.finished || !this.serialPort?.isOpen) {
            return;
          }

          const pending = this.popTx();
          if (!pending || pending.length === 0) {
            return;
          }

          if (this.options.debugSerial) {
            this.log('log', `[serial] tx ${pending.length} bytes`);
          }
          this.serialPort.write(pending, (writeError) => {
            if (writeError) {
              this.finish(1, `serial write failed: ${writeError.message}`);
            }
          });
        }, 5);

        resolve();
      });
    });
  }

  startRawFdBridge() {
    this.configurePort();
    const constants = fs.constants;
    const openFlags =
      constants.O_RDWR |
      (constants.O_NOCTTY || 0) |
      (constants.O_NONBLOCK || 0);
    this.fd = fs.openSync(this.options.port, openFlags);

    const rxBuffer = Buffer.allocUnsafe(4096);
    this.rxInterval = setInterval(() => {
      if (this.finished || this.fd === null) {
        return;
      }

      try {
        const bytesRead = fs.readSync(this.fd, rxBuffer, 0, rxBuffer.length, null);
        if (bytesRead > 0) {
          if (this.options.debugSerial) {
            this.log('log', `[serial] rx ${bytesRead} bytes`);
          }
          this.pushRx(new Uint8Array(rxBuffer.subarray(0, bytesRead)));
        }
      } catch (error) {
        if (error.code === 'EAGAIN' || error.code === 'EWOULDBLOCK') {
          return;
        }
        this.finish(1, `serial read failed: ${error.message}`);
      }
    }, 5);

    this.txInterval = setInterval(() => {
      if (this.finished || this.fd === null) {
        return;
      }

      const pending = this.popTx();
      if (!pending || pending.length === 0) {
        return;
      }

      try {
        if (this.options.debugSerial) {
          this.log('log', `[serial] tx ${pending.length} bytes`);
        }
        fs.writeSync(this.fd, pending, 0, pending.length);
      } catch (error) {
        this.finish(1, `serial write failed: ${error.message}`);
      }
    }, 5);
    return Promise.resolve();
  }

  dispatchNextCommand() {
    if (this.finished || this.awaitingPrompt) {
      return;
    }

    if (this.commandAdvanceTimer) {
      clearTimeout(this.commandAdvanceTimer);
      this.commandAdvanceTimer = null;
    }

    if (this.commandIndex < this.options.commands.length) {
      const command = this.options.commands[this.commandIndex];
      this.commandIndex += 1;
      this.currentCommand = {
        sequence: this.commandIndex,
        command,
        startedAt: Date.now(),
        allowIdleAdvance: this.shouldUseIdleAdvance(command, this.commandIndex),
        sawNonPromptOutput: false,
      };
      this.awaitingPrompt = true;
      if (this.isQuitCommand(command)) {
        this.quitSent = true;
      }
      if (this.options.timings) {
        this.printRunner(`[runner] command ${this.commandIndex}/${this.options.commands.length} start: ${command}`);
      }
      this.pushStdin(`${command}\n`);
      return;
    }

    if (!this.quitSent) {
      this.scheduleFinish();
    }
  }

  finish(code, reason = null) {
    if (this.finished) {
      return;
    }
    this.finished = true;

    if (reason) {
      this.log('err', reason);
    }

    if (this.currentCommand) {
      this.completeCurrentCommand(reason ? 'stopped' : 'complete');
    }

    if (this.finishTimer) {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
    if (this.commandAdvanceTimer) {
      clearTimeout(this.commandAdvanceTimer);
      this.commandAdvanceTimer = null;
    }
    if (this.hardTimeout) {
      clearTimeout(this.hardTimeout);
      this.hardTimeout = null;
    }
    if (this.txInterval) {
      clearInterval(this.txInterval);
      this.txInterval = null;
    }
    if (this.serialPort) {
      try {
        if (this.serialPort.isOpen) {
          this.serialPort.close();
        }
      } catch {
        // Ignore close failures during teardown.
      }
      this.serialPort = null;
    }
    if (this.rxInterval) {
      clearInterval(this.rxInterval);
      this.rxInterval = null;
    }
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        // Ignore close failures during teardown.
      }
      this.fd = null;
    }

    const joined = this.output.join('\n');
    const missing = this.options.expect.filter((needle) => !joined.includes(needle));
    if (missing.length > 0) {
      for (const needle of missing) {
        this.log('err', `missing expected output: ${needle}`);
      }
      process.exit(1);
    }

    process.exit(code);
  }

  run() {
    this.hardTimeout = setTimeout(() => {
      this.finish(1, `timed out after ${this.options.timeoutMs} ms`);
    }, this.options.timeoutMs);

    // The generated client snapshots process.argv during bootstrap and feeds it
    // into pm3 main(). Keep only a synthetic executable path so the WASM client
    // does not try to parse the smoke runner's own CLI flags.
    process.argv = [process.argv[0], path.join(__dirname, 'proxmark3.node.cjs')];

    globalThis.Module = {
      locateFile: (wasmPath) => path.join(this.options.wasmDir, wasmPath),
      onRuntimeInitialized: () => {
        this.startBridge()
          .then(() => {
            setTimeout(() => {
              try {
                this.commandSent = true;
                this.dispatchNextCommand();
              } catch (error) {
                this.finish(1, `failed to send commands: ${error.message}`);
              }
            }, this.options.startupDelayMs);
          })
          .catch((error) => {
            this.finish(1, `bridge setup failed: ${error.message}`);
          });
      },
      print: (...args) => this.log('log', args.join(' ')),
      printErr: (...args) => this.log('err', args.join(' ')),
    };

    require('./proxmark3.node.cjs');
  }
}

const options = parseArgs(process.argv.slice(2));
const runner = new WasmSmokeRunner(options);

process.on('SIGINT', () => runner.finish(130, 'interrupted'));
process.on('SIGTERM', () => runner.finish(143, 'terminated'));

runner.run();
