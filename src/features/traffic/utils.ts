import type { CapturedFrame, Protocol, ProtocolConfig } from "./types";

export const ISO14443A_COMMANDS: Record<string, string> = {
  "26": "REQA (Request Type A)",
  "52": "WUPA (Wake-Up)",
  "93": "ANTICOL/SELECT CL1",
  "95": "ANTICOL/SELECT CL2",
  "97": "ANTICOL/SELECT CL3",
  "50": "HALT",
  "60": "AUTH Key A",
  "61": "AUTH Key B",
  "30": "READ",
  A0: "WRITE",
  C0: "INCREMENT",
  C1: "DECREMENT",
  C2: "RESTORE",
  B0: "TRANSFER",
  E0: "RATS (Request ATS)",
  D0: "PPS",
  B2: "I-BLOCK",
  B3: "I-BLOCK",
  A2: "R-BLOCK (ACK)",
  A3: "R-BLOCK (ACK)",
  BA: "R-BLOCK (NAK)",
  BB: "R-BLOCK (NAK)",
  S2: "S-BLOCK (WTX)",
  F2: "S-BLOCK (DESELECT)",
};

export const ICLASS_COMMANDS: Record<string, string> = {
  "0A": "ACTALL",
  "0C": "IDENTIFY",
  "81": "SELECT",
  "88": "READCHECK",
  "82": "CHECK",
  "87": "READ",
  "89": "READ4",
  "06": "UPDATE",
  "8A": "DETECT",
  "0D": "PAGESEL",
  "07": "ACTALL",
};

export const PROTOCOL_CONFIG: Record<Protocol, ProtocolConfig> = {
  "14a": {
    label: "ISO14443-A",
    sniffCmd: "hf 14a sniff -c -r",
    listCmd: "trace list -t 14a -1",
  },
  "14b": {
    label: "ISO14443-B",
    sniffCmd: "hf 14b sniff",
    listCmd: "trace list -t 14b -1",
  },
  "15": {
    label: "ISO15693",
    sniffCmd: "hf 15 sniff",
    listCmd: "trace list -t 15 -1",
  },
  iclass: {
    label: "iCLASS",
    sniffCmd: "hf iclass sniff",
    listCmd: "trace list -t iclass -1",
  },
  lf: {
    label: "LF",
    sniffCmd: "lf sniff -s 50000",
    listCmd: "data plot",
  },
};

export const DEMO_FRAMES: CapturedFrame[] = [
  { id: "1", timestamp: 0, direction: "reader", data: "26", crcValid: true, command: "REQA" },
  { id: "2", timestamp: 0.128, direction: "tag", data: "0400", crcValid: true, annotation: "ATQA" },
  {
    id: "3",
    timestamp: 1.024,
    direction: "reader",
    data: "9320",
    crcValid: true,
    command: "ANTICOL CL1",
  },
  {
    id: "4",
    timestamp: 1.152,
    direction: "tag",
    data: "88049A5D24",
    crcValid: true,
    annotation: "UID0",
  },
  {
    id: "5",
    timestamp: 2.048,
    direction: "reader",
    data: "937088049A5D2489",
    crcValid: true,
    command: "SELECT CL1",
  },
  { id: "6", timestamp: 2.176, direction: "tag", data: "0418", crcValid: true, annotation: "SAK" },
  {
    id: "7",
    timestamp: 3.072,
    direction: "reader",
    data: "6000F57B",
    crcValid: true,
    command: "AUTH Key A (Blk 0)",
  },
  {
    id: "8",
    timestamp: 3.584,
    direction: "tag",
    data: "A13B48D2",
    crcValid: true,
    annotation: "NT (nonce)",
  },
];

export function decodeCommand(data: string, protocol: Protocol): string | undefined {
  const firstByte = data.slice(0, 2).toUpperCase();

  if (protocol === "14a") {
    return ISO14443A_COMMANDS[firstByte];
  }

  if (protocol === "iclass") {
    return ICLASS_COMMANDS[firstByte];
  }

  return undefined;
}

export function formatTimestamp(ts: number): string {
  return `${ts.toFixed(3)} ms`;
}

export function formatHex(hex: string, spaced = true): string {
  if (!spaced) return hex.toUpperCase();
  return (
    hex
      .toUpperCase()
      .match(/.{1,2}/g)
      ?.join(" ") || hex
  );
}

export function buildTraceText(frames: CapturedFrame[]): string {
  return frames
    .map(
      (frame) =>
        `${formatTimestamp(frame.timestamp)} ${frame.direction === "reader" ? ">>>" : "<<<"} ${frame.data}${frame.command ? ` (${frame.command})` : ""}`,
    )
    .join("\n");
}

export function downloadTraceJson(frames: CapturedFrame[], protocol: Protocol) {
  const traceJson = JSON.stringify(frames, null, 2);
  const blob = new Blob([traceJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `trace_${protocol}_${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
