import type { Terminal as XTerm } from "@xterm/xterm";

export function writeTerminalWelcome(term: XTerm, rawMode: boolean) {
  if (rawMode) {
    term.writeln("\x1b[36mLoading Proxmark3 WASM client...\x1b[0m");
    term.writeln("");
    return;
  }

  term.writeln("\x1b[32m╔══════════════════════════════════════════════════════════╗\x1b[0m");
  term.writeln(
    "\x1b[32m║\x1b[0m  \x1b[1;36mProxmark3 Web Client\x1b[0m                                    \x1b[32m║\x1b[0m",
  );
  term.writeln(
    "\x1b[32m║\x1b[0m  Browser-based RFID research tool                        \x1b[32m║\x1b[0m",
  );
  term.writeln("\x1b[32m╚══════════════════════════════════════════════════════════╝\x1b[0m");
  term.writeln("");
  term.writeln("\x1b[33mConnect your Proxmark3 device to get started.\x1b[0m");
  term.writeln('\x1b[90mType "help" for available commands.\x1b[0m');
  term.writeln("");
  term.write("\x1b[32m[pm3]\x1b[0m ");
}
