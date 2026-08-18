export type NdefFieldKind = "text" | "uri";

export interface NdefField {
  id: string;
  name: string;
  value: string;
  writeName: boolean;
  kind: NdefFieldKind;
}

export interface NdefRecord {
  tnf: number;
  type: Uint8Array;
  payload: Uint8Array;
  identifier: Uint8Array;
  messageBegin: boolean;
  messageEnd: boolean;
  decoded?: string;
}

const URI_PREFIXES: Record<number, string> = {
  0x00: "",
  0x01: "http://www.",
  0x02: "https://www.",
  0x03: "http://",
  0x04: "https://",
  0x05: "tel:",
  0x06: "mailto:",
  0x07: "ftp://anonymous:anonymous@",
  0x08: "ftp://ftp.",
  0x09: "ftps://",
  0x0a: "sftp://",
  0x0b: "smb://",
  0x0c: "nfs://",
  0x0d: "ftp://",
  0x0e: "dav://",
  0x0f: "news:",
  0x10: "telnet://",
  0x11: "imap:",
  0x12: "rtsp://",
  0x13: "urn:",
  0x14: "pop:",
  0x15: "sip:",
  0x16: "sips:",
  0x17: "tftp:",
  0x18: "btspp://",
  0x19: "btl2cap://",
  0x1a: "btgoep://",
  0x1b: "tcpobex://",
  0x1c: "irdaobex://",
  0x1d: "file://",
  0x1e: "urn:epc:id:",
  0x1f: "urn:epc:tag:",
  0x20: "urn:epc:pat:",
  0x21: "urn:epc:raw:",
  0x22: "urn:epc:",
  0x23: "urn:nfc:",
};

const encoder = new TextEncoder();

function containsCodeUnit(value: string, predicate: (codeUnit: number) => boolean): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (predicate(value.charCodeAt(index))) return true;
  }
  return false;
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function encodeRecord(header: number, type: Uint8Array, payload: Uint8Array): Uint8Array {
  if (type.length > 0xff) throw new Error("NDEF record type is too long.");
  const short = payload.length <= 0xff;
  const length = short
    ? new Uint8Array([payload.length])
    : new Uint8Array([
        (payload.length >>> 24) & 0xff,
        (payload.length >>> 16) & 0xff,
        (payload.length >>> 8) & 0xff,
        payload.length & 0xff,
      ]);
  return concat(
    new Uint8Array([short ? header | 0x10 : header & ~0x10, type.length]),
    length,
    type,
    payload,
  );
}

function uriPayload(url: string): Uint8Array {
  let bestCode = 0;
  let bestPrefix = "";
  for (const [rawCode, prefix] of Object.entries(URI_PREFIXES)) {
    if (prefix.length > bestPrefix.length && url.toLowerCase().startsWith(prefix.toLowerCase())) {
      bestCode = Number(rawCode);
      bestPrefix = prefix;
    }
  }
  return concat(new Uint8Array([bestCode]), encoder.encode(url.slice(bestPrefix.length)));
}

export function buildNdefTlv(fields: NdefField[], capacity: number, language = "en"): Uint8Array {
  if (fields.length === 0) throw new Error("At least one NDEF field is required.");
  const languageBytes = encoder.encode(language);
  if (containsCodeUnit(language, (codeUnit) => codeUnit > 0x7f) || languageBytes.length > 63)
    throw new Error("NDEF language must be ASCII and at most 63 bytes.");
  const uriCount = fields.filter((field) => field.kind === "uri").length;
  if (uriCount > 1) throw new Error("Only one URI field is supported.");

  const records: { type: Uint8Array; payload: Uint8Array }[] = [];
  let textLines: string[] = [];
  const flushText = () => {
    if (textLines.length === 0) return;
    records.push({
      type: encoder.encode("T"),
      payload: concat(
        new Uint8Array([languageBytes.length]),
        languageBytes,
        encoder.encode(textLines.join("\n")),
      ),
    });
    textLines = [];
  };
  for (const field of fields) {
    const name = field.name.trim();
    const value = field.value.trim();
    if (!name || !value) throw new Error("Every NDEF field needs a name and value.");
    if (name.length > 80) throw new Error(`Field name “${name}” is too long.`);
    if (containsCodeUnit(name + value, (codeUnit) => codeUnit < 0x20))
      throw new Error("NDEF fields cannot contain control characters.");
    if (field.kind === "uri") {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error("Enter a complete web address.");
      }
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("URI fields must begin with https:// or http://.");
      flushText();
      records.push({ type: encoder.encode("U"), payload: uriPayload(value) });
    } else {
      textLines.push(field.writeName ? `${name} ${value}` : value);
    }
  }
  flushText();

  const message = concat(
    ...records.map((record, index) =>
      encodeRecord(
        0x01 | (index === 0 ? 0x80 : 0) | (index === records.length - 1 ? 0x40 : 0),
        record.type,
        record.payload,
      ),
    ),
  );
  const length =
    message.length <= 0xfe
      ? new Uint8Array([message.length])
      : new Uint8Array([0xff, (message.length >>> 8) & 0xff, message.length & 0xff]);
  const tlv = concat(new Uint8Array([0x03]), length, message, new Uint8Array([0xfe]));
  if (tlv.length > capacity)
    throw new Error(`NDEF content exceeds capacity by ${tlv.length - capacity} bytes.`);
  return tlv;
}

function decodeRecord(record: Omit<NdefRecord, "decoded">): string | undefined {
  if (record.tnf !== 1 || record.payload.length === 0) return undefined;
  const type = new TextDecoder().decode(record.type);
  if (type === "U") {
    const prefix = URI_PREFIXES[record.payload[0]];
    return prefix === undefined
      ? undefined
      : prefix + new TextDecoder().decode(record.payload.slice(1));
  }
  if (type === "T") {
    const status = record.payload[0];
    const start = 1 + (status & 0x3f);
    if (start > record.payload.length) return undefined;
    return new TextDecoder(status & 0x80 ? "utf-16" : "utf-8", { fatal: true }).decode(
      record.payload.slice(start),
    );
  }
  return undefined;
}

export function parseNdefMessage(data: Uint8Array): NdefRecord[] {
  const records: NdefRecord[] = [];
  let cursor = 0;
  while (cursor < data.length) {
    const header = data[cursor++];
    if (header & 0x20) throw new Error("Chunked NDEF records are not supported.");
    if (cursor >= data.length) throw new Error("Incomplete NDEF record.");
    const typeLength = data[cursor++];
    const short = Boolean(header & 0x10);
    let payloadLength: number;
    if (short) {
      if (cursor >= data.length) throw new Error("Missing NDEF payload length.");
      payloadLength = data[cursor++];
    } else {
      if (cursor + 4 > data.length) throw new Error("Missing long NDEF payload length.");
      payloadLength =
        ((data[cursor] << 24) |
          (data[cursor + 1] << 16) |
          (data[cursor + 2] << 8) |
          data[cursor + 3]) >>>
        0;
      cursor += 4;
    }
    const idLength = header & 0x08 ? data[cursor++] : 0;
    const end = cursor + typeLength + idLength + payloadLength;
    if (end > data.length) throw new Error("NDEF record extends beyond the message.");
    const type = data.slice(cursor, (cursor += typeLength));
    const identifier = data.slice(cursor, (cursor += idLength));
    const payload = data.slice(cursor, (cursor += payloadLength));
    const base = {
      tnf: header & 0x07,
      type,
      identifier,
      payload,
      messageBegin: Boolean(header & 0x80),
      messageEnd: Boolean(header & 0x40),
    };
    records.push({ ...base, decoded: decodeRecord(base) });
    if (base.messageEnd) {
      if (cursor !== data.length) throw new Error("Unexpected data follows the final NDEF record.");
      break;
    }
  }
  if (!records.length || !records[0].messageBegin || !records.at(-1)?.messageEnd)
    throw new Error("Invalid NDEF message flags.");
  return records;
}
