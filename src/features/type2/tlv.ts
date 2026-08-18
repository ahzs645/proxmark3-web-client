export interface Type2Tlv {
  type: number;
  offset: number;
  end: number;
  value: Uint8Array;
  raw: Uint8Array;
  extendedLength: boolean;
}

export function parseType2Tlvs(data: Uint8Array): Type2Tlv[] {
  const records: Type2Tlv[] = [];
  let cursor = 0;
  while (cursor < data.length) {
    const start = cursor;
    const type = data[cursor++];
    if (type === 0x00 || type === 0xfe) {
      records.push({
        type,
        offset: start,
        end: cursor,
        value: new Uint8Array(),
        raw: data.slice(start, cursor),
        extendedLength: false,
      });
      if (type === 0xfe) break;
      continue;
    }
    if (cursor >= data.length) throw new Error("Incomplete Type 2 TLV length.");
    let length = data[cursor++];
    let extendedLength = false;
    if (length === 0xff) {
      extendedLength = true;
      if (cursor + 2 > data.length) throw new Error("Incomplete extended Type 2 TLV length.");
      length = (data[cursor] << 8) | data[cursor + 1];
      cursor += 2;
    }
    const end = cursor + length;
    if (end > data.length) throw new Error("Type 2 TLV extends beyond user memory.");
    records.push({
      type,
      offset: start,
      end,
      value: data.slice(cursor, end),
      raw: data.slice(start, end),
      extendedLength,
    });
    cursor = end;
  }
  return records;
}

export function extractNdefTlv(data: Uint8Array): Uint8Array | undefined {
  return parseType2Tlvs(data).find((record) => record.type === 0x03)?.value;
}

export function clearNdefTlvs(data: Uint8Array): { data: Uint8Array; changed: boolean } {
  const records = parseType2Tlvs(data).filter((record) => record.type === 0x03);
  if (!records.length) return { data, changed: false };
  const output = data.slice();
  for (const record of records) {
    output[record.offset + 1] = 0;
    output.fill(0, record.offset + 2, record.end);
  }
  return { data: output, changed: true };
}
