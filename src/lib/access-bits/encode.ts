/**
 * Encode access conditions into 3 access bytes.
 */
export function encodeAccessBits(c0: number, c1: number, c2: number, c3: number): string {
  const values = [
    Math.max(0, Math.min(7, c0)),
    Math.max(0, Math.min(7, c1)),
    Math.max(0, Math.min(7, c2)),
    Math.max(0, Math.min(7, c3)),
  ];

  let c1Nibble = 0;
  let c2Nibble = 0;
  let c3Nibble = 0;

  for (let i = 0; i < 4; i++) {
    const cVal = values[i];
    const c1Bit = cVal & 1;
    const c2Bit = (cVal >> 1) & 1;
    const c3Bit = (cVal >> 2) & 1;
    c1Nibble |= c1Bit << i;
    c2Nibble |= c2Bit << i;
    c3Nibble |= c3Bit << i;
  }

  const notC1 = ~c1Nibble & 0x0f;
  const notC2 = ~c2Nibble & 0x0f;
  const notC3 = ~c3Nibble & 0x0f;

  const byte6 = (notC2 << 4) | notC1;
  const byte7 = (c1Nibble << 4) | notC3;
  const byte8 = (c3Nibble << 4) | c2Nibble;

  return (
    byte6.toString(16).padStart(2, "0").toUpperCase() +
    byte7.toString(16).padStart(2, "0").toUpperCase() +
    byte8.toString(16).padStart(2, "0").toUpperCase()
  );
}
