import { describe, expect, test } from "vite-plus/test";
import type { EmscriptenFSLike } from "../workbench/types";
import { extrasReferencedBy, installPm3Resources, PM3_USER_DIR } from "./pm3Resources";

const EXTRAS = [
  { path: "dictionaries/extras/16_byte_words.dic", size: 10 },
  { path: "dictionaries/extras/4_byte_words.dic", size: 10 },
];

describe("extras dictionary detection", () => {
  test("matches a bare name and installs it where the bare lookup lands", () => {
    expect(extrasReferencedBy("hf mfu cchk -f 16_byte_words", EXTRAS)).toEqual([
      { extra: EXTRAS[0], installPath: "dictionaries/16_byte_words.dic" },
    ]);
  });

  test("matches an extras/ path with or without .dic", () => {
    expect(extrasReferencedBy('hf mf chk --1k -f "extras/4_byte_words.dic"', EXTRAS)).toEqual([
      { extra: EXTRAS[1], installPath: "dictionaries/extras/4_byte_words.dic" },
    ]);
  });

  test("ignores core dictionaries, flags and unrelated paths", () => {
    expect(extrasReferencedBy("hf mf autopwn -f mfc_default_keys", EXTRAS)).toEqual([]);
    expect(extrasReferencedBy("hf mf chk -f /tmp/4_byte_words.dic", EXTRAS)).toEqual([]);
  });
});

describe("resource install", () => {
  test("writes each packed file under the user directory", () => {
    const written = new Map<string, Uint8Array>();
    const dirs = new Set<string>();
    const fs: EmscriptenFSLike = {
      analyzePath: (path) => ({ exists: dirs.has(path) }),
      mkdirTree: (path) => void dirs.add(path),
      writeFile: (path, data) => void written.set(path, data.slice()),
    };

    const count = installPm3Resources(fs, {
      manifest: {
        version: 1,
        source: { repo: null, commit: null },
        bundle: "core.bin",
        bundleSize: 5,
        files: [
          { path: "dictionaries/mfc_default_keys.dic", offset: 0, size: 3 },
          { path: "lualibs/utils.lua", offset: 3, size: 2 },
        ],
        extras: [],
        extrasBaseUrl: null,
      },
      bundle: new Uint8Array([1, 2, 3, 4, 5]),
    });

    expect(count).toBe(2);
    expect(written.get(`${PM3_USER_DIR}/dictionaries/mfc_default_keys.dic`)).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(written.get(`${PM3_USER_DIR}/lualibs/utils.lua`)).toEqual(new Uint8Array([4, 5]));
    expect(dirs.has(`${PM3_USER_DIR}/lualibs`)).toBe(true);
  });
});
