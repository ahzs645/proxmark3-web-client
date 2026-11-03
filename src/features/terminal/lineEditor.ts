/**
 * Line editing for the xterm terminal: cursor movement, history recall and the
 * usual control keys. It works on xterm's `onData` stream, so pasted text and
 * mobile keyboards arrive the same way as typed keys.
 *
 * The prompt is printed by the client, not by us, so the editor never redraws
 * it. Instead it records the column the input started in and addresses every
 * offset in the line as a row/column from there, which keeps long commands
 * that wrap past the terminal width editable.
 */
export interface LineEditorIO {
  write: (data: string) => void;
  /** Enter on a line. */
  submit: (line: string) => void;
  /** Ctrl+C on an empty line. */
  interrupt: () => void;
  /** Ctrl+L. */
  clearScreen: () => void;
  /** Ctrl+C with text selected: copy it instead of interrupting. Returns true when it copied. */
  copySelection: () => boolean;
  /** Terminal width in columns. */
  columns: () => number;
  /** Column the terminal cursor is in right now (0-based). */
  cursorColumn: () => number;
}

const KEY = {
  enter: "\r",
  backspace: "\x7f",
  ctrlH: "\b",
  ctrlA: "\x01",
  ctrlC: "\x03",
  ctrlE: "\x05",
  ctrlK: "\x0b",
  ctrlL: "\x0c",
  ctrlU: "\x15",
  ctrlW: "\x17",
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
  home: ["\x1b[H", "\x1bOH", "\x1b[1~"],
  end: ["\x1b[F", "\x1bOF", "\x1b[4~"],
  delete: "\x1b[3~",
  wordLeft: ["\x1b[1;5D", "\x1bb"],
  wordRight: ["\x1b[1;5C", "\x1bf"],
} as const;

const ESC = String.fromCharCode(27);
const ESCAPE_SEQUENCE = new RegExp(`^${ESC}(?:\\[[0-9;]*[A-Za-z~]|O[A-Za-z]|[a-z])`);
const ERASE_BELOW = "\x1b[J";

export class LineEditor {
  private line = "";
  /** Offset in `line` the terminal cursor is physically at. */
  private cursor = 0;
  /** Column the line started in, captured on its first edit. */
  private originColumn: number | null = null;
  /** Position in history while recalling; history.length means "the draft". */
  private historyIndex: number | null = null;
  private draft = "";
  private readonly io: LineEditorIO;
  private readonly getHistory: () => readonly string[];

  constructor(io: LineEditorIO, getHistory: () => readonly string[]) {
    this.io = io;
    this.getHistory = getHistory;
  }

  get value(): string {
    return this.line;
  }

  /** Feeds raw terminal input: a keypress, an escape sequence or pasted text. */
  handleData(data: string): void {
    let rest = data;
    while (rest.length > 0) {
      const sequence = rest.match(ESCAPE_SEQUENCE)?.[0];
      if (sequence) {
        this.handleKey(sequence);
        rest = rest.slice(sequence.length);
        continue;
      }
      // A pasted CRLF is one Enter.
      if (rest.startsWith("\r\n")) {
        this.handleKey(KEY.enter);
        rest = rest.slice(2);
        continue;
      }
      const char = rest[0] === "\n" ? KEY.enter : rest[0];
      this.handleKey(char);
      rest = rest.slice(1);
    }
  }

  private handleKey(key: string): void {
    switch (key) {
      case KEY.enter:
        return this.submit();
      case KEY.backspace:
      case KEY.ctrlH:
        return this.deleteBefore(1);
      case KEY.delete:
        return this.deleteAfter(1);
      case KEY.left:
        return this.moveTo(this.cursor - 1);
      case KEY.right:
        return this.moveTo(this.cursor + 1);
      case KEY.ctrlA:
        return this.moveTo(0);
      case KEY.ctrlE:
        return this.moveTo(this.line.length);
      case KEY.ctrlK:
        return this.deleteAfter(this.line.length - this.cursor);
      case KEY.ctrlU:
        return this.deleteBefore(this.cursor);
      case KEY.ctrlW:
        return this.deleteBefore(this.cursor - this.wordStartBefore(this.cursor));
      case KEY.up:
        return this.recall(-1);
      case KEY.down:
        return this.recall(1);
      case KEY.ctrlL:
        return this.io.clearScreen();
      case KEY.ctrlC:
        return this.interrupt();
    }
    if ((KEY.home as readonly string[]).includes(key)) return this.moveTo(0);
    if ((KEY.end as readonly string[]).includes(key)) return this.moveTo(this.line.length);
    if ((KEY.wordLeft as readonly string[]).includes(key)) {
      return this.moveTo(this.wordStartBefore(this.cursor));
    }
    if ((KEY.wordRight as readonly string[]).includes(key)) {
      return this.moveTo(this.wordEndAfter(this.cursor));
    }
    // Remaining control characters and unknown sequences (Tab, F-keys, ...).
    if (key.length !== 1 || key < " ") return;
    this.insert(key);
  }

  private insert(text: string): void {
    const at = this.cursor;
    this.rewrite(at, this.line.slice(0, at) + text + this.line.slice(at), at + text.length);
  }

  private deleteBefore(count: number): void {
    const n = Math.min(count, this.cursor);
    if (n <= 0) return;
    const at = this.cursor - n;
    this.rewrite(at, this.line.slice(0, at) + this.line.slice(this.cursor), at);
  }

  private deleteAfter(count: number): void {
    const n = Math.min(count, this.line.length - this.cursor);
    if (n <= 0) return;
    const at = this.cursor;
    this.rewrite(at, this.line.slice(0, at) + this.line.slice(at + n), at);
  }

  private replaceLine(next: string): void {
    this.rewrite(0, next, next.length);
  }

  /**
   * Replaces everything from offset `from` on with the matching part of
   * `next`, then parks the cursor at `cursorAfter`. Erasing below rather than
   * overwriting with spaces also clears rows a longer old line wrapped into.
   */
  private rewrite(from: number, next: string, cursorAfter: number): void {
    // Read the start column before anything is written: xterm parses writes
    // asynchronously, so its cursor would lag behind afterwards.
    this.origin();
    this.moveTo(from);
    this.io.write(ERASE_BELOW + next.slice(from));
    this.line = next;
    this.cursor = next.length;
    // Text that ends exactly on the last column leaves xterm in its "pending
    // wrap" state, one row above where the offset maths says the cursor is.
    // Writing a space and backing up commits the wrap so the two agree.
    if (next.length > from && (this.origin() + next.length) % this.io.columns() === 0) {
      this.io.write(" \b");
    }
    this.moveTo(cursorAfter);
  }

  private moveTo(position: number): void {
    const target = Math.max(0, Math.min(this.line.length, position));
    if (target === this.cursor) return;
    const columns = this.io.columns();
    const from = this.origin() + this.cursor;
    const to = this.origin() + target;
    const rows = Math.floor(to / columns) - Math.floor(from / columns);
    const vertical = rows < 0 ? `\x1b[${-rows}A` : rows > 0 ? `\x1b[${rows}B` : "";
    this.io.write(`${vertical}\x1b[${(to % columns) + 1}G`);
    this.cursor = target;
  }

  private origin(): number {
    this.originColumn ??= Math.max(0, Math.min(this.io.columns(), this.io.cursorColumn()));
    return this.originColumn;
  }

  private recall(direction: -1 | 1): void {
    const history = this.historyWithoutRepeats();
    if (history.length === 0) return;
    const current = this.historyIndex ?? history.length;
    const next = Math.max(0, Math.min(history.length, current + direction));
    if (next === current) return;
    if (this.historyIndex === null) this.draft = this.line;
    this.historyIndex = next;
    this.replaceLine(next === history.length ? this.draft : history[next]);
  }

  private historyWithoutRepeats(): string[] {
    const out: string[] = [];
    for (const entry of this.getHistory()) {
      if (entry && entry !== out[out.length - 1]) out.push(entry);
    }
    return out;
  }

  private submit(): void {
    const line = this.line;
    this.moveTo(this.line.length);
    this.io.write("\r\n");
    this.reset();
    this.io.submit(line);
  }

  private interrupt(): void {
    if (this.io.copySelection()) return;
    if (this.line.length > 0) {
      this.moveTo(this.line.length);
      this.io.write("^C\r\n");
      this.reset();
      return;
    }
    this.io.write("^C\r\n");
    this.io.interrupt();
  }

  private reset(): void {
    this.line = "";
    this.cursor = 0;
    this.originColumn = null;
    this.historyIndex = null;
    this.draft = "";
  }

  private wordStartBefore(position: number): number {
    let i = position;
    while (i > 0 && this.line[i - 1] === " ") i--;
    while (i > 0 && this.line[i - 1] !== " ") i--;
    return i;
  }

  private wordEndAfter(position: number): number {
    let i = position;
    while (i < this.line.length && this.line[i] === " ") i++;
    while (i < this.line.length && this.line[i] !== " ") i++;
    return i;
  }
}
