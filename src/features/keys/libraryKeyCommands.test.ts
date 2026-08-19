import { describe, expect, test } from "vite-plus/test";
import {
  acceptsLibraryKeyDictionary,
  appendKeyDictionary,
  hasKeyDictionary,
  libraryKeyDictionaryName,
} from "./libraryKeyCommands";

describe("Library key command seeding", () => {
  test("recognizes Autopwn and Check Keys commands", () => {
    expect(acceptsLibraryKeyDictionary("hf mf autopwn --4k")).toBe(true);
    expect(acceptsLibraryKeyDictionary("hf mf chk --1k -a")).toBe(true);
    expect(acceptsLibraryKeyDictionary("hf mf dump --1k")).toBe(false);
  });

  test("adds a dictionary only when the command does not already select one", () => {
    expect(appendKeyDictionary("hf mf autopwn --1k", "/pm3-cache/library.dic")).toBe(
      "hf mf autopwn --1k -f /pm3-cache/library.dic",
    );
    expect(
      appendKeyDictionary("hf mf chk --1k -f /pm3-cache/manual.dic", "/pm3-cache/library.dic"),
    ).toBe("hf mf chk --1k -f /pm3-cache/manual.dic");
    expect(hasKeyDictionary("hf mf autopwn --1k -f=/tmp/keys.dic")).toBe(true);
  });

  test("creates a filesystem-safe UID-scoped filename", () => {
    expect(libraryKeyDictionaryName("84:F0:B2:40")).toBe("hf-mf-84F0B240-library-keys.dic");
    expect(libraryKeyDictionaryName("84:F0:B2:40", "matching")).toBe(
      "hf-mf-84F0B240-matching-keys.dic",
    );
  });
});
