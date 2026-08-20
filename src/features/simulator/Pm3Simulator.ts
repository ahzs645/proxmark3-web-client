/**
 * Pm3Simulator — a stateful stand-in for the Proxmark3 client used by the app's
 * "Simulated mode". It never touches WASM or hardware: it holds a virtual card
 * (see {@link ./virtualCard}) and answers commands against it, so a whole
 * session — search, autopwn, read, write, dump — stays internally consistent.
 *
 * Output is modelled on real pm3 session logs (card-dumps/) so a simulated run
 * reads like an authentic one. The engine's only contract with the app is
 * {@link execute}: it emits pm3-style output through a callback and resolves
 * with a {@link CommandDispatchResult}, exactly like the real command channel.
 *
 * Dumps and key files behave like the real ones too: the engine writes them
 * into a small in-memory filesystem ({@link readFile}) and prints the same
 * "Saved to json file …" / "Found keys have been dumped to …" lines the app
 * watches for, so the existing library/vault ingest pipeline picks them up.
 */

import type { CommandDispatchResult } from "@/hooks/proxmark-wasm/types";
import { cyan, dim, fail, green, info, ok, prompt, warn, yellow } from "./format";
import {
  DEFAULT_KEY,
  buildInitialCardState,
  firstBlockOfSector,
  sectorCount,
  sectorForBlock,
  toDumpBin,
  toDumpJson,
  toKeyBin,
  totalBlocks,
  trailerBlockOfSector,
  type VirtualCardState,
  type VirtualHfCard,
} from "./virtualCard";

type Emit = (text: string) => void;

export interface Pm3SimulatorOptions {
  /** Card the session starts with (defaults to the real 4K capture). */
  cardType?: VirtualHfCard["kind"];
  /**
   * Delay between output steps, in ms. Real setTimeout by default so autopwn
   * etc. feel alive; tests pass 0 (or a fake) to run instantly.
   */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    if (ms <= 0) resolve();
    else setTimeout(resolve, ms);
  });

/** Home directory the real WASM client writes generated files into. */
const HOME = "/home/web_user";

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string>;
}

export class Pm3Simulator {
  private state: VirtualCardState;
  private readonly sleep: (ms: number) => Promise<void>;
  private aborted = false;
  /** In-memory stand-in for the client's filesystem (dump/key artifacts). */
  private readonly files = new Map<string, Uint8Array>();

  constructor(options: Pm3SimulatorOptions = {}) {
    this.state = buildInitialCardState(options.cardType ?? "mifare-4k");
    this.sleep = options.sleep ?? realSleep;
  }

  /** Signal a running command to stop early (maps to the app's Stop / break). */
  interrupt(): void {
    this.aborted = true;
  }

  /** Replace the presented card (used when the user swaps the demo card). */
  setCardType(kind: VirtualHfCard["kind"]): void {
    this.state = buildInitialCardState(kind);
    this.files.clear();
  }

  getState(): VirtualCardState {
    return this.state;
  }

  /**
   * Read a file this session generated. Accepts either the absolute path the
   * client printed or a bare filename, so the app's FS fallback can look it up
   * however the "Saved …" line was parsed.
   */
  readFile(path: string): Uint8Array | null {
    if (this.files.has(path)) return this.files.get(path) ?? null;
    const name = path.split("/").pop() ?? path;
    return this.files.get(`${HOME}/${name}`) ?? null;
  }

  async execute(command: string, emit: Emit): Promise<CommandDispatchResult> {
    this.aborted = false;
    const emitln = (text = "") => emit(`${text}\r\n`);
    try {
      await this.route(command.trim(), emitln);
    } catch (error) {
      emitln(fail(`simulator error: ${(error as Error).message}`));
    }
    emit(prompt());
    return "completed";
  }

  // --- routing -------------------------------------------------------------

  private async route(command: string, emitln: (text?: string) => void): Promise<void> {
    const lower = command.toLowerCase();
    const table: [string, () => Promise<void> | void][] = [
      ["hw version", () => this.hwVersion(emitln)],
      ["hw status", () => this.hwStatus(emitln)],
      ["hw tune", () => this.hwTune(emitln)],
      ["hw connect", () => this.hwConnect(emitln)],
      ["hf mf autopwn", () => this.mfAutopwn(emitln)],
      ["hf mf fchk", () => this.mfChk(emitln)],
      ["hf mf chk", () => this.mfChk(emitln)],
      ["hf mf rdbl", () => this.mfRdbl(command, emitln)],
      ["hf mf rdsc", () => this.mfRdsc(command, emitln)],
      ["hf mf wrbl", () => this.mfWrbl(command, emitln)],
      ["hf mf dump", () => this.mfDump(emitln)],
      ["hf mf view", () => this.mfView(emitln)],
      ["hf mf info", () => this.hf14aInfo(emitln)],
      ["hf 14a info", () => this.hf14aInfo(emitln)],
      ["hf 14a reader", () => this.hf14aInfo(emitln)],
      ["hf search", () => this.hfSearch(emitln)],
      ["lf hid read", () => this.hidRead(emitln)],
      ["lf hid reader", () => this.hidRead(emitln)],
      ["lf t55xx detect", () => this.t55Detect(emitln)],
      ["lf search", () => this.lfSearch(emitln)],
      ["help", () => this.help(emitln)],
    ];

    for (const [prefix, handler] of table) {
      if (lower === prefix || lower.startsWith(`${prefix} `)) {
        await handler();
        return;
      }
    }
    this.unknown(command, emitln);
  }

  private parseArgs(command: string, dropWords: number): ParsedArgs {
    const tokens = command.trim().split(/\s+/).slice(dropWords);
    const positional: string[] = [];
    const flags = new Map<string, string>();
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith("-")) {
        const key = token.replace(/^-+/, "");
        const next = tokens[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          flags.set(key, next);
          i++;
        } else {
          flags.set(key, "");
        }
      } else {
        positional.push(token);
      }
    }
    return { positional, flags };
  }

  // --- hardware ------------------------------------------------------------

  private async hwVersion(emitln: (text?: string) => void): Promise<void> {
    emitln(ok(cyan("Proxmark3 RFID instrument")));
    emitln();
    emitln(dim(" [ CLIENT ]"));
    emitln(`  client: RRG/Iceman/master/v4.19552-sim ${dim("(simulated)")}`);
    emitln(dim(" [ ARM ]"));
    emitln("  bootrom: RRG/Iceman/master/v4.19552");
    emitln("       os: RRG/Iceman/master/v4.19552");
    emitln(dim(" [ FPGA ]"));
    emitln("  LF image built for 2s30vq100 on 2024/ 8/12");
    emitln("  HF image built for 2s30vq100 on 2024/ 8/12");
    emitln(dim(" [ Hardware ]"));
    emitln("  --= uC: AT91SAM7S512 Rev B");
    emitln("  --= Embedded Processor: ARM7TDMI");
    await this.sleep(80);
    emitln(info("Running in simulated mode — no hardware attached."));
  }

  private async hwStatus(emitln: (text?: string) => void): Promise<void> {
    emitln(ok("Memory"));
    emitln("  BIGBUF_SIZE.............40000");
    emitln("  Available memory........40000");
    emitln(ok("Tracing"));
    emitln("  tracing ................1");
    emitln("  total traces ...........0");
    emitln(ok("Various"));
    emitln("  DBGLEVEL ...............1 ( ERROR )");
    emitln(ok("HF FPGA"));
    emitln("  Sampling config ........default");
    await this.sleep(60);
    emitln(info("Simulated device — status values are synthetic."));
  }

  private async hwTune(emitln: (text?: string) => void): Promise<void> {
    emitln(info("Measuring antenna characteristics, please wait..."));
    await this.sleep(200);
    emitln(ok("LF antenna: 32.14 V - 125.00 kHz"));
    emitln(ok("LF antenna: 25.63 V - 134.00 kHz"));
    emitln(ok("LF optimal: 33.02 V - 127.66 kHz"));
    emitln(ok("HF antenna: 42.88 V - 13.56 MHz"));
    emitln(green("Displaying LF tuning graph. Divisor 88 is 134 kHz, 95 is 125 kHz."));
  }

  private hwConnect(emitln: (text?: string) => void): void {
    emitln(ok("Simulated Proxmark3 already attached."));
  }

  // --- HF search / info ----------------------------------------------------

  private noCard(emitln: (text?: string) => void): void {
    emitln(fail("No known/supported 13.56 MHz tags found"));
  }

  private spaced(hex: string): string {
    return (hex.match(/.{1,2}/g) ?? [hex]).join(" ");
  }

  private async hfSearch(emitln: (text?: string) => void): Promise<void> {
    emitln(dim(" 🔍  Searching for ISO14443-A tag..."));
    await this.sleep(150);
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    emitln(ok(`UID: ${cyan(this.spaced(hf.uid))}`));
    emitln(ok(`ATQA: ${hf.atqa}`));
    emitln(ok(`SAK: ${hf.sak} [2]`));
    emitln(ok(`Possible types: ${green(hf.label)}`));
    emitln(info("proprietary non iso14443-4 card found, RATS not supported"));
    emitln(warn("PRNG detection: hard (hardnested required)"));
    emitln(ok("Valid ISO 14443-A tag found"));
  }

  private async hf14aInfo(emitln: (text?: string) => void): Promise<void> {
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    emitln(ok(`UID:  ${cyan(this.spaced(hf.uid))}`));
    emitln(ok(`ATQA: ${hf.atqa}`));
    emitln(ok(`SAK:  ${hf.sak} [2]`));
    emitln();
    emitln(ok("Manufacturer: NXP Semiconductors Germany"));
    emitln(ok(`Type: ${green(hf.label)}`));
    const recovered = hf.recovered.size;
    if (recovered > 0) {
      emitln(info(`${recovered}/${sectorCount(hf.kind)} sector keys recovered this session`));
    } else {
      emitln(warn(`Keys not recovered yet — run ${cyan("hf mf autopwn")}`));
    }
  }

  // --- MIFARE key recovery -------------------------------------------------

  private async mfAutopwn(emitln: (text?: string) => void): Promise<void> {
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    const sectors = sectorCount(hf.kind);
    emitln();
    emitln(warn("Known key failed. Can't authenticate to block   0 key type A"));
    emitln(warn("No known key was supplied, key recovery might fail"));
    emitln(ok("loaded 5 user keys"));
    emitln(ok("loaded 61 hardcoded keys"));
    emitln(info("Running strategy 1"));
    await this.sleep(200);
    emitln(info("Running strategy 2"));
    await this.sleep(150);
    emitln(ok(`Target sector   0 key type A -- found valid key [ ${green(DEFAULT_KEY)} ]`));

    // Recover every sector; non-default keys read as "hardnested", the rest
    // reuse the sector-key pattern the card actually uses.
    for (let s = 0; s < sectors; s++) {
      if (this.aborted) {
        emitln(warn("aborted by user"));
        return;
      }
      const isDefault = hf.keys[s].a === DEFAULT_KEY && hf.keys[s].b === DEFAULT_KEY;
      hf.recovered.add(s);
      const method = isDefault ? "dictionary" : s <= 4 ? "hardnested" : "reused";
      emitln(
        ok(
          `Target sector ${String(s).padStart(3)} key type A -- found valid key [ ${
            isDefault ? green(hf.keys[s].a) : yellow(hf.keys[s].a)
          } ] ${dim(`(${method})`)}`,
        ),
      );
      await this.sleep(s <= 4 ? 90 : 8);
    }

    emitln();
    emitln(ok("-----+-----+--------------+---+--------------+----"));
    emitln(ok(" Sec | Blk | key A        |res| key B        |res"));
    emitln(ok("-----+-----+--------------+---+--------------+----"));
    for (let s = 0; s < sectors; s++) {
      const blk = trailerBlockOfSector(s);
      const res = s === 0 ? "D" : hf.keys[s].a === DEFAULT_KEY ? "D" : s <= 4 ? "H" : "R";
      emitln(
        ok(
          ` ${String(s).padStart(3)} | ${String(blk).padStart(3)} | ${hf.keys[s].a} | ${res} | ${hf.keys[s].b} | ${res} `,
        ),
      );
    }
    emitln(ok("-----+-----+--------------+---+--------------+----"));
    emitln(
      info(
        "( D:Dictionary / S:darkSide / U:User / R:Reused / N:Nested / H:Hardnested / C:statiCnested )",
      ),
    );
    emitln();

    // Write the artifacts and print the exact lines the app watches for.
    this.saveCardArtifacts(hf, emitln);
    emitln(ok(green(`found keys for all ${sectors} sectors`)));
  }

  private async mfChk(emitln: (text?: string) => void): Promise<void> {
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    const sectors = sectorCount(hf.kind);
    emitln(info("Loaded 61 keys from hardcoded default array"));
    await this.sleep(150);
    let found = 0;
    for (let s = 0; s < sectors; s++) {
      if (hf.keys[s].a === DEFAULT_KEY) {
        hf.recovered.add(s);
        found++;
        emitln(ok(`[ ${String(s).padStart(3)} ] key A ${green(DEFAULT_KEY)} ${dim("(default)")}`));
      } else {
        emitln(fail(`[ ${String(s).padStart(3)} ] key A ${dim("not found in dictionary")}`));
      }
      await this.sleep(5);
    }
    emitln();
    emitln(
      found === sectors
        ? ok(green("all sector keys were default"))
        : warn(
            `${found}/${sectors} sectors used default keys — run ${cyan("hf mf autopwn")} for the rest`,
          ),
    );
  }

  // --- MIFARE read / write / dump -----------------------------------------

  private authOk(hf: VirtualHfCard, sector: number, providedKey?: string): boolean {
    if (hf.recovered.has(sector)) return true;
    if (!providedKey) return false;
    const key = providedKey.toUpperCase();
    return key === hf.keys[sector].a || key === hf.keys[sector].b;
  }

  private async mfRdbl(command: string, emitln: (text?: string) => void): Promise<void> {
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    const { flags } = this.parseArgs(command, 3);
    const block = Number(flags.get("blk") ?? flags.get("b") ?? "0");
    const key = flags.get("k");
    if (!Number.isFinite(block) || block < 0 || block >= totalBlocks(hf.kind)) {
      emitln(fail(`invalid block number ${flags.get("blk") ?? ""}`));
      return;
    }
    const sector = sectorForBlock(block);
    await this.sleep(60);
    if (!this.authOk(hf, sector, key)) {
      emitln(fail(`auth error on block ${block} (sector ${sector}) — wrong key`));
      emitln(dim("    supply the correct key or run hf mf autopwn first"));
      return;
    }
    emitln(ok(`block ${String(block).padStart(3)} | ${this.spaced(hf.blocks[block])}`));
  }

  private async mfRdsc(command: string, emitln: (text?: string) => void): Promise<void> {
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    const { flags } = this.parseArgs(command, 3);
    const sector = Number(flags.get("s") ?? flags.get("sec") ?? "0");
    const key = flags.get("k");
    if (!Number.isFinite(sector) || sector < 0 || sector >= sectorCount(hf.kind)) {
      emitln(fail(`invalid sector number ${flags.get("s") ?? ""}`));
      return;
    }
    await this.sleep(80);
    if (!this.authOk(hf, sector, key)) {
      emitln(fail(`auth error on sector ${sector} — wrong key`));
      return;
    }
    const first = firstBlockOfSector(sector);
    for (let b = first; b <= trailerBlockOfSector(sector); b++) {
      emitln(ok(`block ${String(b).padStart(3)} | ${this.spaced(hf.blocks[b])}`));
    }
  }

  private async mfWrbl(command: string, emitln: (text?: string) => void): Promise<void> {
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    const { flags } = this.parseArgs(command, 3);
    const block = Number(flags.get("blk") ?? flags.get("b") ?? "0");
    const key = flags.get("k");
    const data = (flags.get("d") ?? "").toUpperCase();
    if (!Number.isFinite(block) || block < 0 || block >= totalBlocks(hf.kind)) {
      emitln(fail(`invalid block number ${flags.get("blk") ?? ""}`));
      return;
    }
    if (!/^[0-9A-F]{32}$/.test(data)) {
      emitln(fail(`data must be 32 hex chars (16 bytes); got "${flags.get("d") ?? ""}"`));
      return;
    }
    const sector = sectorForBlock(block);
    await this.sleep(80);
    if (!this.authOk(hf, sector, key)) {
      emitln(fail(`auth error on block ${block} (sector ${sector}) — wrong key`));
      return;
    }
    if (block === 0) {
      emitln(fail("block 0 is read-only on a standard MIFARE Classic card"));
      return;
    }
    hf.blocks[block] = data;
    emitln(ok(`wrote block ${block}: ${this.spaced(data)}`));
    emitln(info("verified — read-back matches written data"));
  }

  private async mfDump(emitln: (text?: string) => void): Promise<void> {
    const hf = this.state.hf;
    if (!this.state.present || !hf) {
      this.noCard(emitln);
      return;
    }
    const sectors = sectorCount(hf.kind);
    const missing: number[] = [];
    for (let s = 0; s < sectors; s++) if (!this.authOk(hf, s, DEFAULT_KEY)) missing.push(s);
    if (missing.length > 0) {
      emitln(
        warn(
          `${missing.length} sector key(s) unknown — run ${cyan("hf mf autopwn")} first for a full dump`,
        ),
      );
      emitln(dim(`    unreadable sectors: ${missing.join(", ")}`));
      return;
    }

    emitln(info("Reading all blocks from card..."));
    await this.sleep(150);
    const total = totalBlocks(hf.kind);
    for (let s = 0; s < sectors; s++) {
      if (this.aborted) {
        emitln(warn("aborted by user"));
        return;
      }
      await this.sleep(4);
    }
    emitln(ok(green("Succeeded in dumping all blocks")));
    emitln();
    this.mfView(emitln);
    emitln();
    this.saveCardArtifacts(hf, emitln);
    emitln(ok(`Dumped ${total} blocks (${hf.label})`));
  }

  private mfView(emitln: (text?: string) => void): void {
    const hf = this.state.hf;
    if (!hf) return;
    emitln(info("-----+-----+-------------------------------------------------+-----------------"));
    emitln(info(" sec | blk | data                                            | ascii"));
    emitln(info("-----+-----+-------------------------------------------------+-----------------"));
    const total = totalBlocks(hf.kind);
    for (let b = 0; b < total; b++) {
      const sector = sectorForBlock(b);
      const first = b === firstBlockOfSector(sector);
      const secCol = first ? String(sector).padStart(4) : "    ";
      emitln(
        info(
          `${secCol} | ${String(b).padStart(3)} | ${this.spaced(hf.blocks[b])} | ${this.ascii(hf.blocks[b])}`,
        ),
      );
    }
  }

  private ascii(hex: string): string {
    const bytes = hex.match(/.{1,2}/g) ?? [];
    return bytes
      .map((h) => {
        const code = parseInt(h, 16);
        return code >= 0x20 && code <= 0x7e ? String.fromCharCode(code) : ".";
      })
      .join("");
  }

  /**
   * Write the dump/key artifacts into the virtual FS and print the exact lines
   * the app parses (`processGeneratedOutputLine`), so simulated dumps land in
   * the library and vault just like hardware dumps.
   */
  private saveCardArtifacts(hf: VirtualHfCard, emitln: (text?: string) => void): void {
    const jsonName = `hf-mf-${hf.uid}-dump.json`;
    const binName = `hf-mf-${hf.uid}-dump.bin`;
    const keyName = `hf-mf-${hf.uid}-key.bin`;
    const jsonPath = `${HOME}/${jsonName}`;
    const binPath = `${HOME}/${binName}`;
    const keyPath = `${HOME}/${keyName}`;

    const dumpBin = toDumpBin(hf);
    const keyBin = toKeyBin(hf);
    const jsonBytes = new TextEncoder().encode(JSON.stringify(toDumpJson(hf), null, 2));

    this.files.set(binPath, dumpBin);
    this.files.set(keyPath, keyBin);
    this.files.set(jsonPath, jsonBytes);

    emitln(ok("Generating binary key file"));
    emitln(ok(`Found keys have been dumped to \`${keyPath}\``));
    emitln(ok(`Saved ${dumpBin.byteLength} bytes to binary file \`${binPath}\``));
    emitln(ok(`Saved to json file ${jsonPath}`));
  }

  // --- LF ------------------------------------------------------------------

  private async hidRead(emitln: (text?: string) => void): Promise<void> {
    const lf = this.state.lf;
    await this.sleep(80);
    if (!this.state.present || !lf) {
      emitln(fail("No data found!"));
      return;
    }
    emitln(
      ok(
        `[${lf.format.padEnd(8)}] ${lf.formatLabel.padEnd(28)} FC: ${lf.facilityCode}  CN: ${lf.cardNumber}  parity ( ok )`,
      ),
    );
    emitln(info(`raw: ${lf.raw}`));
  }

  private async lfSearch(emitln: (text?: string) => void): Promise<void> {
    emitln(info("Note: False Positives ARE possible"));
    emitln(info("Checking for known tags..."));
    await this.sleep(150);
    const lf = this.state.lf;
    if (!this.state.present || !lf) {
      emitln(fail("No data found!"));
      return;
    }
    emitln(
      ok(
        `[${lf.format.padEnd(8)}] ${lf.formatLabel.padEnd(28)} FC: ${lf.facilityCode}  CN: ${lf.cardNumber}  parity ( ok )`,
      ),
    );
    emitln(info(`raw: ${lf.raw}`));
    emitln(ok(green("Valid HID Prox ID found!")));
    emitln();
    emitln(ok("Chipset... T55xx"));
    emitln(dim("Hint: Try `lf t55xx` commands"));
  }

  private async t55Detect(emitln: (text?: string) => void): Promise<void> {
    const lf = this.state.lf;
    emitln(info("Detecting T55xx configuration..."));
    await this.sleep(120);
    emitln(ok("Chip type......... T55x7"));
    emitln(ok("Modulation........ FSK2a"));
    emitln(ok("Bit rate.......... 4 - RF/50"));
    emitln(ok("Inverted.......... Yes"));
    emitln(ok("Offset............ 33"));
    emitln(ok(`Block0............ ${lf?.t55xxBlock0 ?? "00107060"} (auto detect)`));
    emitln(ok("Downlink mode..... default/fixed bit length"));
    emitln(ok("Password set...... No"));
  }

  // --- misc ----------------------------------------------------------------

  private help(emitln: (text?: string) => void): void {
    emitln(info("Simulated mode — a subset of pm3 commands respond with demo data:"));
    emitln(dim("  hw version | hw status | hw tune"));
    emitln(dim("  hf search | hf 14a info | hf mf autopwn | hf mf chk"));
    emitln(dim("  hf mf rdbl --blk N -k KEY | hf mf rdsc -s S -k KEY"));
    emitln(dim("  hf mf wrbl --blk N -k KEY -d DATA | hf mf dump | hf mf view"));
    emitln(dim("  lf search | lf hid read | lf t55xx detect"));
    emitln(info("Dumps and keys are written to the library, just like real captures."));
  }

  private unknown(command: string, emitln: (text?: string) => void): void {
    emitln(warn(`"${command}" — no simulated handler; returning a generic OK.`));
    emitln(dim("    In simulated mode only common commands produce realistic output."));
    emitln(ok("command completed (simulated)"));
  }
}

export function createPm3Simulator(options?: Pm3SimulatorOptions): Pm3Simulator {
  return new Pm3Simulator(options);
}
