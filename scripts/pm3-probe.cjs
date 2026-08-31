#!/usr/bin/env node
// Raw identity probe: speaks the PM3 NG protocol over a serial port without the
// client, so it works even when the client refuses a capabilities-version
// mismatch. Prints chip id, version banner and the raw capabilities struct.
// Uses a non-blocking fd with polling (same approach as pm3-wasm-smoke.cjs).
//
//   node scripts/pm3-probe.cjs --port /dev/cu.usbmodem101 [--debug]
const fs = require("fs");
const { execFileSync } = require("child_process");

const argv = process.argv.slice(2);
const portPath = argv[argv.indexOf("--port") + 1] || process.env.PM3_SERIAL_PORT;
const debug = argv.includes("--debug");
if (!portPath || portPath.startsWith("--")) {
  console.error("usage: pm3-probe.cjs --port <path> [--debug]");
  process.exit(1);
}

const NG_CMD_MAGIC = 0x61334d50;
const NG_RESP_MAGIC = 0x62334d50;
const NG_POSTAMBLE = 0x3361;
const CMD = { VERSION: 263, CAPABILITIES: 274, DEBUG_PRINT_STRING: 0x100 };

const AT32_IDCODES = {
  0x70084540: "AT32F435ZMT7",
  0x70083341: "AT32F435ZGT7",
  0x70083242: "AT32F435ZCT7",
  0x70084543: "AT32F435VMT7",
  0x70083344: "AT32F435VGT7",
  0x70083245: "AT32F435VCT7",
  0x70084546: "AT32F435RMT7",
  0x70083347: "AT32F435RGT7",
  0x70083248: "AT32F435RCT7",
  0x70084549: "AT32F435CMT7",
  0x7008334a: "AT32F435CGT7",
  0x7008324b: "AT32F435CCT7",
  0x7008454c: "AT32F435CMU7",
  0x7008334d: "AT32F435CGU7",
  0x7008324e: "AT32F435CCU7",
  0x7008454f: "AT32F437ZMT7",
  0x70083350: "AT32F437ZGT7",
  0x70083251: "AT32F437ZCT7",
  0x70084552: "AT32F437VMT7",
  0x70083353: "AT32F437VGT7",
  0x70083254: "AT32F437VCT7",
  0x70084555: "AT32F437RMT7",
  0x70083356: "AT32F437RGT7",
  0x70083257: "AT32F437RCT7",
};
const AT91_IDCODES = {
  0x270b0a40: "AT91SAM7S512 Rev A",
  0x270b0a4e: "AT91SAM7S512 Rev B",
  0x270b0a4f: "AT91SAM7S512 Rev B",
  0x270d0940: "AT91SAM7S256 Rev A",
  0x270b0941: "AT91SAM7S256 Rev B",
  0x270b0942: "AT91SAM7S256 Rev C",
  0x270b0943: "AT91SAM7S256 Rev D",
};

function encodeNg(cmd, payload = Buffer.alloc(0)) {
  const packet = Buffer.alloc(10 + payload.length);
  packet.writeUInt32LE(NG_CMD_MAGIC, 0);
  packet.writeUInt16LE(0x8000 | payload.length, 4);
  packet.writeUInt16LE(cmd, 6);
  payload.copy(packet, 8);
  packet.writeUInt16LE(NG_POSTAMBLE, 8 + payload.length);
  return packet;
}

const sttyFlag = process.platform === "darwin" ? "-f" : "-F";
try {
  execFileSync("stty", [
    sttyFlag,
    portPath,
    "115200",
    "raw",
    "-echo",
    "-isig",
    "-icanon",
    "-opost",
  ]);
} catch (error) {
  console.error(`stty failed: ${error.message}`);
}
const fd = fs.openSync(
  portPath,
  fs.constants.O_RDWR | fs.constants.O_NOCTTY | fs.constants.O_NONBLOCK,
);

let rx = Buffer.alloc(0);
const frames = [];
function pump() {
  const buf = Buffer.alloc(4096);
  for (;;) {
    let n = 0;
    try {
      n = fs.readSync(fd, buf, 0, buf.length, null);
    } catch (error) {
      if (error.code === "EAGAIN" || error.code === "EWOULDBLOCK") return;
      throw error;
    }
    if (n <= 0) return;
    if (debug) console.log(`[rx ${n}] ${buf.subarray(0, n).toString("hex")}`);
    rx = Buffer.concat([rx, buf.subarray(0, n)]);
    for (;;) {
      if (rx.length < 12) break;
      if (rx.readUInt32LE(0) !== NG_RESP_MAGIC) {
        rx = rx.subarray(1);
        continue;
      }
      const length = rx.readUInt16LE(4) & 0x7fff;
      const frameLength = 12 + length;
      if (rx.length < frameLength) break;
      const frame = rx.subarray(0, frameLength);
      rx = rx.subarray(frameLength);
      frames.push({
        status: frame.readInt8(6),
        reason: frame.readInt8(7),
        cmd: frame.readUInt16LE(8),
        data: Buffer.from(frame.subarray(10, 10 + length)),
      });
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(cmd, timeoutMs = 5000) {
  const packet = encodeNg(cmd);
  if (debug) console.log(`[tx ${packet.length}] ${packet.toString("hex")}`);
  fs.writeSync(fd, packet, 0, packet.length);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    pump();
    const index = frames.findIndex((f) => f.cmd === cmd);
    if (index >= 0) return frames.splice(index, 1)[0];
    for (const f of frames.splice(0, frames.length)) {
      if (f.cmd === CMD.DEBUG_PRINT_STRING)
        console.log(`[device] ${f.data.subarray(2).toString("utf8").trim()}`);
    }
    await sleep(5);
  }
  throw new Error(`command ${cmd} timed out after ${timeoutMs} ms`);
}

function decodeCapabilities(data) {
  const names = [
    "via_fpc",
    "via_usb",
    "compiled_with_flash",
    "compiled_with_smartcard",
    "compiled_with_fpc_usart",
    "compiled_with_fpc_usart_dev",
    "compiled_with_fpc_usart_host",
    "compiled_with_lf",
    "compiled_with_hitag",
    "compiled_with_em4x50",
    "compiled_with_em4x70",
    "compiled_with_zx8211",
    "compiled_with_hfsniff",
    "compiled_with_hfplot",
    "compiled_with_iso14443a",
    "compiled_with_iso14443b",
    "compiled_with_iso15693",
    "compiled_with_felica",
    "compiled_with_legicrf",
    "compiled_with_iclass",
    "compiled_with_seos",
    "compiled_with_nfcbarcode",
    "compiled_with_lcd",
    "hw_available_flash",
    "hw_available_smartcard",
    "is_rdv4",
    "hw_available_fpga_flash",
    "hw_available_i2c_eeprom",
    "is_pm5",
    "is_pm5_std_ant",
  ];
  const flags = data.readUInt32LE(9);
  return {
    version: data.readUInt8(0),
    baudrate: data.readUInt32LE(1),
    bigbuf_size: data.readUInt32LE(5),
    flags: `0x${flags.toString(16)}`,
    set: names.filter((_, bit) => (flags >>> bit) & 1),
    struct_length: data.length,
    max_cmd_data_size: data.length >= 15 ? data.readUInt16LE(13) : null,
  };
}

void (async () => {
  try {
    const version = await send(CMD.VERSION);
    const chipId = version.data.readUInt32LE(0);
    const sectionSize = version.data.readUInt32LE(4);
    const strLen = version.data.readUInt32LE(8);
    const text = version.data
      .subarray(12, 12 + strLen)
      .toString("utf8")
      .split("\0")
      .join("");
    const flashSize =
      version.data.length >= 12 + strLen + 4 ? version.data.readUInt32LE(12 + strLen) : null;
    const mcu = AT32_IDCODES[chipId] || AT91_IDCODES[chipId] || "unknown";
    const family =
      chipId >>> 16 === 0x7008
        ? "AT32 (Proxmark5)"
        : chipId >>> 24 === 0x27
          ? "AT91SAM7 (Proxmark3)"
          : "unknown";
    console.log(`port          : ${portPath}`);
    console.log(`chip id       : 0x${chipId.toString(16).padStart(8, "0")}  ${mcu}  [${family}]`);
    console.log(`image size    : ${sectionSize} bytes used`);
    console.log(
      `flash size    : ${flashSize === null ? "(not reported by this firmware)" : `${flashSize} bytes`}`,
    );
    console.log("version text  :");
    const ansiEscape = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
    for (const line of text.replace(ansiEscape, "").split("\n")) console.log(`  ${line}`);
    const caps = await send(CMD.CAPABILITIES);
    console.log("capabilities  :", JSON.stringify(decodeCapabilities(caps.data), null, 2));
  } catch (error) {
    console.error(`probe failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    fs.closeSync(fd);
  }
})();
