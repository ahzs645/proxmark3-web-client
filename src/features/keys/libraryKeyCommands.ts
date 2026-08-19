export function acceptsLibraryKeyDictionary(command: string): boolean {
  return /^\s*hf\s+mf\s+(?:autopwn|chk)\b/i.test(command);
}

export function hasKeyDictionary(command: string): boolean {
  return /(?:^|\s)-f(?:\s|=|$)/i.test(command);
}

export function appendKeyDictionary(command: string, path: string): string {
  const trimmed = command.trim();
  if (!acceptsLibraryKeyDictionary(trimmed) || hasKeyDictionary(trimmed) || !path.trim()) {
    return trimmed;
  }
  return `${trimmed} -f ${path}`;
}

export function libraryKeyDictionaryName(
  uid: string,
  mode: Exclude<LibraryKeyMode, "default"> = "all",
): string {
  const clean = uid.replace(/[^0-9A-F]/gi, "").toUpperCase();
  const scope = mode === "matching" ? "matching" : "library";
  return `hf-mf-${clean || "card"}-${scope}-keys.dic`;
}
export type LibraryKeyMode = "default" | "matching" | "all";

export function libraryKeyModeOptions(matchingCount: number, libraryCount: number) {
  return [
    { value: "default", label: "PM3 defaults" },
    { value: "matching", label: `Matching card (${matchingCount})` },
    { value: "all", label: `Entire Library (${libraryCount})` },
  ];
}
