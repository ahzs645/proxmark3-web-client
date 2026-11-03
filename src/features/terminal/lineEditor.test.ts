import { describe, expect, test } from "vite-plus/test";
import { LineEditor } from "./lineEditor";

const CSI = new RegExp(`^${String.fromCharCode(27)}\\[(\\d*)([ABGJ])`);

/**
 * Just enough VT100 to check what the user sees: wrapping with xterm's
 * pending-wrap rule, CUU/CUD/CHA, ED and backspace.
 */
function createScreen(columns: number, prompt = "") {
  const rows: string[][] = [[]];
  let row = 0;
  let col = 0;
  let pendingWrap = false;

  const put = (char: string) => {
    if (pendingWrap) {
      row += 1;
      col = 0;
      pendingWrap = false;
    }
    rows[row] ??= [];
    rows[row][col] = char;
    if (col === columns - 1) pendingWrap = true;
    else col += 1;
  };

  const write = (data: string) => {
    let rest = data;
    while (rest.length > 0) {
      const csi = rest.match(CSI);
      if (csi) {
        const n = Number(csi[1] || 1);
        pendingWrap = false;
        if (csi[2] === "A") row = Math.max(0, row - n);
        else if (csi[2] === "B") row += n;
        else if (csi[2] === "G") col = Math.min(columns - 1, n - 1);
        else {
          rows[row] = (rows[row] ?? []).slice(0, col);
          rows.length = row + 1;
        }
        rest = rest.slice(csi[0].length);
        continue;
      }
      const char = rest[0];
      rest = rest.slice(1);
      if (char === "\r") {
        col = 0;
        pendingWrap = false;
      } else if (char === "\n") {
        row += 1;
        pendingWrap = false;
      } else if (char === "\b") {
        if (pendingWrap) pendingWrap = false;
        else col = Math.max(0, col - 1);
      } else put(char);
    }
  };

  write(prompt);
  return {
    write,
    columns: () => columns,
    cursorColumn: () => (pendingWrap ? columns : col),
    text: () =>
      rows
        .map((cells) => Array.from(cells ?? [], (cell) => cell ?? " ").join(""))
        .join("")
        .trimEnd(),
    position: () => ({ row, col }),
  };
}

function createHarness(
  { history = [], selection = "", columns = 80, prompt = "" } = {} as {
    history?: string[];
    selection?: string;
    columns?: number;
    prompt?: string;
  },
) {
  const screen = createScreen(columns, prompt);
  const submitted: string[] = [];
  let interrupts = 0;
  let copied = "";

  const editor = new LineEditor(
    {
      write: screen.write,
      columns: screen.columns,
      cursorColumn: screen.cursorColumn,
      submit: (line) => submitted.push(line),
      interrupt: () => {
        interrupts += 1;
      },
      clearScreen: () => undefined,
      copySelection: () => {
        if (!selection) return false;
        copied = selection;
        return true;
      },
    },
    () => history,
  );

  return {
    editor,
    submitted,
    visible: () => screen.text().slice(prompt.length),
    position: screen.position,
    interrupts: () => interrupts,
    copied: () => copied,
  };
}

describe("LineEditor", () => {
  test("inserts and deletes in the middle of the line", () => {
    const h = createHarness();
    h.editor.handleData("hf serch");
    h.editor.handleData("\x1b[D\x1b[D\x1b[D");
    h.editor.handleData("a");
    expect(h.visible()).toBe("hf search");
    expect(h.position()).toEqual({ row: 0, col: 6 });

    h.editor.handleData("\x7f\x7f");
    expect(h.visible()).toBe("hf srch");
    h.editor.handleData("\x1b[3~");
    expect(h.visible()).toBe("hf sch");
    expect(h.editor.value).toBe("hf sch");
  });

  test("submits the whole line even with the cursor mid-line", () => {
    const h = createHarness();
    h.editor.handleData("hw version\x01\r");
    expect(h.submitted).toEqual(["hw version"]);
    expect(h.editor.value).toBe("");
  });

  test("recalls history, skips repeats and restores the draft", () => {
    const h = createHarness({ history: ["hf search", "hw tune", "hw tune"] });
    h.editor.handleData("lf");
    h.editor.handleData("\x1b[A");
    expect(h.visible()).toBe("hw tune");
    h.editor.handleData("\x1b[A");
    expect(h.visible()).toBe("hf search");
    h.editor.handleData("\x1b[A");
    expect(h.visible()).toBe("hf search");
    h.editor.handleData("\x1b[B\x1b[B");
    expect(h.visible()).toBe("lf");
  });

  test("Ctrl+W, Ctrl+U and Ctrl+K edit by word and line", () => {
    const h = createHarness();
    h.editor.handleData("hf mf chk --1k");
    h.editor.handleData("\x17");
    expect(h.visible()).toBe("hf mf chk");
    h.editor.handleData("\x1b[1;5D\x0b");
    expect(h.visible()).toBe("hf mf");
    h.editor.handleData("\x15");
    expect(h.visible()).toBe("");
  });

  test("pasted lines submit one by one", () => {
    const h = createHarness();
    h.editor.handleData("hw version\r\nhw status\n");
    expect(h.submitted).toEqual(["hw version", "hw status"]);
  });

  test("Ctrl+C clears a typed line, interrupts on an empty one, copies a selection", () => {
    const h = createHarness();
    h.editor.handleData("hf 14a sim\x03");
    expect(h.interrupts()).toBe(0);
    expect(h.editor.value).toBe("");
    h.editor.handleData("\x03");
    expect(h.interrupts()).toBe(1);

    const withSelection = createHarness({ selection: "UID: 01 02 03 04" });
    withSelection.editor.handleData("\x03");
    expect(withSelection.copied()).toBe("UID: 01 02 03 04");
    expect(withSelection.interrupts()).toBe(0);
  });

  test("ignores Tab and unknown escape sequences", () => {
    const h = createHarness();
    h.editor.handleData("hf\t\x1b[15~");
    expect(h.editor.value).toBe("hf");
  });
});

describe("LineEditor with wrapped input", () => {
  const LONG = "hf mf autopwn --1k -f mfc_default_keys";

  test("edits across the wrap after a client-printed prompt", () => {
    const h = createHarness({ columns: 16, prompt: "pm3 --> " });
    h.editor.handleData(LONG);
    expect(h.visible()).toBe(LONG);

    // Jump to the start (a different row) and insert there.
    h.editor.handleData("\x01");
    expect(h.position()).toEqual({ row: 0, col: 8 });
    h.editor.handleData("x");
    expect(h.visible()).toBe(`x${LONG}`);
    h.editor.handleData("\x7f");
    expect(h.visible()).toBe(LONG);
  });

  test("recalling a short command after a long one clears the wrapped rows", () => {
    const h = createHarness({ columns: 16, prompt: "pm3 --> ", history: ["hw ver", LONG] });
    h.editor.handleData("\x1b[A");
    expect(h.visible()).toBe(LONG);
    h.editor.handleData("\x1b[A");
    expect(h.visible()).toBe("hw ver");
    h.editor.handleData("\x1b[B");
    expect(h.visible()).toBe(LONG);
  });

  test("text ending exactly on the last column keeps the cursor in step", () => {
    // 8-column prompt + 8 chars fills a 16-column row exactly.
    const h = createHarness({ columns: 16, prompt: "pm3 --> " });
    h.editor.handleData("hw versi");
    expect(h.position()).toEqual({ row: 1, col: 0 });
    h.editor.handleData("on");
    expect(h.visible()).toBe("hw version");
    h.editor.handleData("\x1b[D\x1b[D\x1b[D\x7f");
    expect(h.visible()).toBe("hw verion");
  });
});
