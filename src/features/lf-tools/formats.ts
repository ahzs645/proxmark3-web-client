import type { LfTech } from "@/features/vault/db";

export type LfCredentialFieldValue = string | number;

export interface ParsedLfCredential {
  tech: LfTech;
  format?: string;
  facilityCode?: number;
  cardNumber?: number;
  raw?: string;
  fields?: Record<string, LfCredentialFieldValue>;
  name: string;
}

export interface LfEditableField {
  id: string;
  label: string;
  input: "decimal" | "hex" | "text" | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface LfFormatCapability {
  tech: LfTech;
  label: string;
  readerCommand: string;
  editableFields: LfEditableField[];
  compatibleBlanks: Array<"t55xx" | "em4x05">;
  verificationFields: string[];
  parse: (output: string) => ParsedLfCredential | null;
  buildClone: (credential: ParsedLfCredential) => string | null;
  buildSimulation?: (credential: ParsedLfCredential) => string | null;
}

const decimal = (value: LfCredentialFieldValue | null | undefined): number | undefined => {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? Number(text) : undefined;
};

const hex = (value: LfCredentialFieldValue | null | undefined): string | undefined => {
  const text = String(value ?? "")
    .replace(/[^0-9A-F]/gi, "")
    .toUpperCase();
  return text || undefined;
};

export function credentialField(
  credential: ParsedLfCredential,
  field: string,
): LfCredentialFieldValue | undefined {
  if (field === "format") return credential.format;
  if (field === "facilityCode") return credential.facilityCode;
  if (field === "cardNumber") return credential.cardNumber;
  if (field === "raw") return credential.raw;
  return credential.fields?.[field];
}

function withSimulation(builder: (credential: ParsedLfCredential) => string | null) {
  return (credential: ParsedLfCredential): string | null =>
    builder(credential)?.replace(/\bclone\b/, "sim") ?? null;
}

function parseHid(output: string): ParsedLfCredential | null {
  if (!/HID Prox ID found|\bHID\b/i.test(output)) return null;
  const facilityCode = decimal(output.match(/FC:\s*(\d+)/i)?.[1]);
  const cardNumber = decimal(output.match(/CN:\s*(\d+)/i)?.[1]);
  if (facilityCode == null || cardNumber == null) return null;
  const format =
    output.match(/HID\s+(H\d{5})\b/i)?.[1]?.toUpperCase() ??
    output.match(/\[\s*(H\d{5})\s*\]/i)?.[1]?.toUpperCase() ??
    "H10301";
  const raw = hex(output.match(/raw:\s*([0-9A-F]+)/i)?.[1]);
  return {
    tech: "hid",
    format,
    facilityCode,
    cardNumber,
    raw,
    name: `HID ${format} FC ${facilityCode} CN ${cardNumber}`,
  };
}

function parseEm410x(output: string): ParsedLfCredential | null {
  const raw = hex(output.match(/EM\s*410x?\s*ID\s*([0-9A-F]{10})/i)?.[1]);
  return raw ? { tech: "em410x", raw, name: `EM410x ${raw}` } : null;
}

function parseIndala(output: string): ParsedLfCredential | null {
  if (!/Indala/i.test(output)) return null;
  const raw = hex(output.match(/Indala.*?(?:UID|ID|raw)[.:/\s]*([0-9A-F]{8,})/is)?.[1]);
  return raw ? { tech: "indala", raw, name: `Indala ${raw}` } : null;
}

function parseAwid(output: string): ParsedLfCredential | null {
  if (!/AWID/i.test(output)) return null;
  const facilityCode = decimal(output.match(/AWID.*?FC[.:/\s]*(\d+)/is)?.[1]);
  const cardNumber = decimal(output.match(/AWID.*?(?:CN|Card)[.:/\s]*(\d+)/is)?.[1]);
  if (facilityCode == null || cardNumber == null) return null;
  const format = output.match(/AWID\s*(?:-\s*)?(?:len[.:/\s]*)?(\d+)(?:\s*bit)?/i)?.[1];
  const raw = hex(output.match(/AWID.*?Raw[.:/\s]*([0-9A-F]+)/is)?.[1]);
  return {
    tech: "awid",
    format,
    facilityCode,
    cardNumber,
    raw,
    name: `AWID${format ? ` ${format}-bit` : ""} FC ${facilityCode} CN ${cardNumber}`,
  };
}

function parseIoProx(output: string): ParsedLfCredential | null {
  if (!/IO\s*Prox/i.test(output)) return null;
  const xsf = output.match(/IO\s*Prox.*?XSF\((\d+)\)([0-9A-F]+):(\d+)/is);
  const direct = output.match(
    /IO\s*Prox.*?(?:VN[.:/\s]*(\d+))?.*?FC[.:/\s]*(\d+).*?CN[.:/\s]*(\d+)/is,
  );
  const versionNumber = decimal(xsf?.[1] ?? direct?.[1] ?? 0);
  const facilityCode = xsf ? Number.parseInt(xsf[2], 16) : decimal(direct?.[2]);
  const cardNumber = decimal(xsf?.[3] ?? direct?.[3]);
  // Require a labelled value and enough data to represent a credential.  The
  // PM3 status line `Valid IO Prox ID found!` previously matched `ID f` here,
  // because F is a valid hexadecimal digit, and created a bogus raw-F card.
  const raw = hex(output.match(/IO\s*Prox.*?\b(?:ID|Raw)\b\s*[:=]\s*([0-9A-F]{8,})\b/is)?.[1]);
  if (facilityCode == null || cardNumber == null) {
    return raw ? { tech: "ioprox", raw, name: `IO Prox ${raw}` } : null;
  }
  return {
    tech: "ioprox",
    facilityCode,
    cardNumber,
    raw,
    fields: { versionNumber: versionNumber ?? 0 },
    name: `IO Prox VN ${versionNumber ?? 0} FC ${facilityCode} CN ${cardNumber}`,
  };
}

function parseFdxb(output: string): ParsedLfCredential | null {
  if (!/FDX-?B|Animal\s+ID/i.test(output)) return null;
  const combined = output.match(
    /FDX-?B.*?Country[.:/\s]*(\d+).*?(?:National(?:\s+ID)?|ID)[.:/\s]*(\d+)/is,
  );
  const animalId = output.match(/Animal\s+ID[.\s]+(\d+)-(\d+)/i);
  const countryCode = decimal(combined?.[1] ?? animalId?.[1]);
  const nationalId = combined?.[2] ?? animalId?.[2];
  if (countryCode == null || !nationalId) return null;
  return {
    tech: "fdxb",
    fields: { countryCode, nationalId },
    name: `FDX-B ${countryCode}-${nationalId}`,
  };
}

function parseFcCard(
  output: string,
  tech: Extract<LfTech, "paradox" | "pyramid">,
  label: string,
): ParsedLfCredential | null {
  if (!new RegExp(label, "i").test(output)) return null;
  const facilityCode = decimal(output.match(new RegExp(`${label}.*?FC[.:/\\s]*(\\d+)`, "is"))?.[1]);
  const cardNumber = decimal(
    output.match(new RegExp(`${label}.*?(?:Card|CN)[.:/\\s]*(\\d+)`, "is"))?.[1],
  );
  const raw = hex(output.match(new RegExp(`${label}.*?Raw[.:/\\s]*([0-9A-F]+)`, "is"))?.[1]);
  if (facilityCode == null || cardNumber == null) {
    return raw ? { tech, raw, name: `${label} ${raw}` } : null;
  }
  return {
    tech,
    facilityCode,
    cardNumber,
    raw,
    name: `${label} FC ${facilityCode} CN ${cardNumber}`,
  };
}

function parseKeri(output: string): ParsedLfCredential | null {
  if (!/KERI|Descrambled\s+MS/i.test(output)) return null;
  const internal = decimal(output.match(/Internal\s+ID[.:/\s]*(\d+)/i)?.[1]);
  const ms = output.match(/(?:Descrambled\s+)?MS.*?FC[.:/\s]*(\d+).*?Card[.:/\s]*(\d+)/is);
  const raw = hex(output.match(/(?:KERI|Internal|MS).*?Raw[.:/\s]*([0-9A-F]+)/is)?.[1]);
  if (internal != null) {
    return {
      tech: "keri",
      cardNumber: internal,
      raw,
      fields: { keriType: "i" },
      name: `Keri Internal ${internal}`,
    };
  }
  const facilityCode = decimal(ms?.[1]);
  const cardNumber = decimal(ms?.[2]);
  if (facilityCode != null && cardNumber != null) {
    return {
      tech: "keri",
      facilityCode,
      cardNumber,
      raw,
      fields: { keriType: "m" },
      name: `Keri MS FC ${facilityCode} CN ${cardNumber}`,
    };
  }
  return raw ? { tech: "keri", raw, name: `Keri ${raw}` } : null;
}

const fcCnFields: LfEditableField[] = [
  { id: "facilityCode", label: "Facility code", input: "decimal", required: true },
  { id: "cardNumber", label: "Card number", input: "decimal", required: true },
];

function fcCnBuilder(command: string, credential: ParsedLfCredential): string | null {
  if (credential.facilityCode == null || credential.cardNumber == null) {
    return credential.raw ? `lf ${command} clone --raw ${credential.raw}` : null;
  }
  return `lf ${command} clone --fc ${credential.facilityCode} --cn ${credential.cardNumber}`;
}

export const LF_FORMATS: readonly LfFormatCapability[] = [
  {
    tech: "hid",
    label: "HID Prox",
    readerCommand: "lf hid reader",
    editableFields: [
      { id: "format", label: "Wiegand format", input: "text", required: true },
      ...fcCnFields,
      { id: "raw", label: "Raw", input: "hex" },
    ],
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "format", "facilityCode", "cardNumber"],
    parse: parseHid,
    buildClone: (credential) => {
      if (credential.format && credential.facilityCode != null && credential.cardNumber != null) {
        return `lf hid clone -w ${credential.format} --fc ${credential.facilityCode} --cn ${credential.cardNumber}`;
      }
      return credential.raw ? `lf hid clone -r ${credential.raw}` : null;
    },
    buildSimulation: withSimulation(
      (credential) => LF_FORMATS_BY_TECH.get("hid")?.buildClone(credential) ?? null,
    ),
  },
  {
    tech: "em410x",
    label: "EM410x",
    readerCommand: "lf em 410x reader",
    editableFields: [{ id: "raw", label: "EM410x ID", input: "hex", required: true }],
    compatibleBlanks: ["t55xx", "em4x05"],
    verificationFields: ["tech", "raw"],
    parse: parseEm410x,
    buildClone: (credential) =>
      credential.raw?.length === 10 ? `lf em 410x clone --id ${credential.raw}` : null,
    buildSimulation: (credential) =>
      credential.raw?.length === 10 ? `lf em 410x sim --id ${credential.raw}` : null,
  },
  {
    tech: "indala",
    label: "Indala",
    readerCommand: "lf indala read",
    editableFields: [{ id: "raw", label: "Raw", input: "hex", required: true }],
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "raw"],
    parse: parseIndala,
    buildClone: (credential) => (credential.raw ? `lf indala clone --raw ${credential.raw}` : null),
    buildSimulation: (credential) =>
      credential.raw ? `lf indala sim --raw ${credential.raw}` : null,
  },
  {
    tech: "awid",
    label: "AWID",
    readerCommand: "lf awid read",
    editableFields: [{ id: "format", label: "Bit length", input: "decimal" }, ...fcCnFields],
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "format", "facilityCode", "cardNumber"],
    parse: parseAwid,
    buildClone: (credential) =>
      credential.facilityCode != null && credential.cardNumber != null
        ? `lf awid clone${credential.format ? ` --fmt ${credential.format}` : ""} --fc ${credential.facilityCode} --cn ${credential.cardNumber}`
        : null,
    buildSimulation: withSimulation(
      (credential) => LF_FORMATS_BY_TECH.get("awid")?.buildClone(credential) ?? null,
    ),
  },
  {
    tech: "ioprox",
    label: "IO Prox",
    readerCommand: "lf io read",
    editableFields: [
      { id: "versionNumber", label: "Version number", input: "decimal", required: true },
      ...fcCnFields,
    ],
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "versionNumber", "facilityCode", "cardNumber"],
    parse: parseIoProx,
    buildClone: (credential) => {
      const versionNumber = decimal(credential.fields?.versionNumber ?? 0);
      if (credential.facilityCode == null || credential.cardNumber == null) {
        const raw = hex(credential.raw);
        return raw && raw.length >= 8 ? `lf io clone --raw ${raw}` : null;
      }
      return `lf io clone --vn ${versionNumber ?? 0} --fc ${credential.facilityCode} --cn ${credential.cardNumber}`;
    },
    buildSimulation: withSimulation(
      (credential) => LF_FORMATS_BY_TECH.get("ioprox")?.buildClone(credential) ?? null,
    ),
  },
  {
    tech: "fdxb",
    label: "FDX-B",
    readerCommand: "lf fdxb read",
    editableFields: [
      { id: "countryCode", label: "Country code", input: "decimal", required: true },
      { id: "nationalId", label: "National ID", input: "decimal", required: true },
    ],
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "countryCode", "nationalId"],
    parse: parseFdxb,
    buildClone: (credential) => {
      const country = decimal(credential.fields?.countryCode);
      const national = String(credential.fields?.nationalId ?? "");
      return country != null && /^\d+$/.test(national)
        ? `lf fdxb clone --country ${country} --national ${national}`
        : null;
    },
    buildSimulation: withSimulation(
      (credential) => LF_FORMATS_BY_TECH.get("fdxb")?.buildClone(credential) ?? null,
    ),
  },
  {
    tech: "paradox",
    label: "Paradox",
    readerCommand: "lf paradox read",
    editableFields: fcCnFields,
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "facilityCode", "cardNumber"],
    parse: (output) => parseFcCard(output, "paradox", "Paradox"),
    buildClone: (credential) => fcCnBuilder("paradox", credential),
    buildSimulation: withSimulation((credential) => fcCnBuilder("paradox", credential)),
  },
  {
    tech: "keri",
    label: "Keri",
    readerCommand: "lf keri read",
    editableFields: [
      {
        id: "keriType",
        label: "Encoding",
        input: "select",
        required: true,
        options: [
          { value: "i", label: "Internal" },
          { value: "m", label: "MS" },
        ],
      },
      ...fcCnFields,
    ],
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "keriType", "facilityCode", "cardNumber"],
    parse: parseKeri,
    buildClone: (credential) => {
      if (credential.cardNumber == null) return null;
      const type = String(credential.fields?.keriType ?? "i");
      return type === "m" && credential.facilityCode != null
        ? `lf keri clone -t m --fc ${credential.facilityCode} --cn ${credential.cardNumber}`
        : `lf keri clone -t ${type} --cn ${credential.cardNumber}`;
    },
    buildSimulation: withSimulation(
      (credential) => LF_FORMATS_BY_TECH.get("keri")?.buildClone(credential) ?? null,
    ),
  },
  {
    tech: "pyramid",
    label: "Pyramid",
    readerCommand: "lf pyramid read",
    editableFields: fcCnFields,
    compatibleBlanks: ["t55xx"],
    verificationFields: ["tech", "facilityCode", "cardNumber"],
    parse: (output) => parseFcCard(output, "pyramid", "Pyramid"),
    buildClone: (credential) => fcCnBuilder("pyramid", credential),
    buildSimulation: withSimulation((credential) => fcCnBuilder("pyramid", credential)),
  },
] as const;

export const LF_FORMATS_BY_TECH = new Map<LfTech, LfFormatCapability>(
  LF_FORMATS.map((capability) => [capability.tech, capability]),
);

export function parseRegisteredLfCredential(output: string): ParsedLfCredential | null {
  for (const capability of LF_FORMATS) {
    const credential = capability.parse(output);
    if (credential) return credential;
  }
  return null;
}

export function buildRegisteredLfClone(credential: ParsedLfCredential): string | null {
  return LF_FORMATS_BY_TECH.get(credential.tech)?.buildClone(credential) ?? null;
}

export function buildRegisteredLfSimulation(credential: ParsedLfCredential): string | null {
  return LF_FORMATS_BY_TECH.get(credential.tech)?.buildSimulation?.(credential) ?? null;
}

export function describeLfCredential(credential: ParsedLfCredential): string {
  const capability = LF_FORMATS_BY_TECH.get(credential.tech);
  return (
    capability?.verificationFields
      .filter((field) => field !== "tech")
      .map((field) => `${field}: ${credentialField(credential, field) ?? "—"}`)
      .join(" · ") ||
    credential.raw ||
    credential.name
  );
}
