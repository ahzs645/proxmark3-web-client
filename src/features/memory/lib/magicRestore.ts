import { validateAccessBits } from "@/lib/access-bits";
import type { PM3DumpJson } from "@/features/memory/types";
import type { CardTarget } from "@/features/target/types";

export type MagicRestoreState = "needs-scan" | "needs-detect" | "blocked" | "ready";

export interface MagicRestoreCheck {
  id: string;
  label: string;
  state: "ok" | "warning" | "error" | "info";
  detail: string;
  blocking: boolean;
}

export interface MagicRestorePlan {
  state: MagicRestoreState;
  sourceBlockCount: number;
  sourceSize?: "1k" | "4k";
  targetSize?: "1k" | "4k";
  checks: MagicRestoreCheck[];
  summary: string;
  nextStep: string;
}

function cleanHex(value?: string): string {
  return (value ?? "").replace(/[^0-9A-F]/gi, "").toUpperCase();
}

function expectedBlockCount(size?: string): number | undefined {
  if (size === "1k") return 64;
  if (size === "4k") return 256;
  return undefined;
}

function dumpSize(blockCount: number): "1k" | "4k" | undefined {
  if (blockCount === 64) return "1k";
  if (blockCount === 256) return "4k";
  return undefined;
}

function bccForUid(uid: string): string | undefined {
  if (uid.length !== 8) return undefined;
  let bcc = 0;
  for (let offset = 0; offset < uid.length; offset += 2) {
    bcc ^= Number.parseInt(uid.slice(offset, offset + 2), 16);
  }
  return bcc.toString(16).padStart(2, "0").toUpperCase();
}

function sourceChecks(dump: PM3DumpJson | null | undefined): {
  blockCount: number;
  size?: "1k" | "4k";
  checks: MagicRestoreCheck[];
} {
  if (!dump) {
    return {
      blockCount: 0,
      checks: [
        {
          id: "source-dump",
          label: "Source dump",
          state: "error",
          detail: "Load or capture a MIFARE Classic dump first.",
          blocking: true,
        },
      ],
    };
  }

  const rows = Object.entries(dump.blocks ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const blockCount = rows.length;
  const size = dumpSize(blockCount);
  const indexesComplete = rows.every(([key], index) => Number(key) === index);
  const blocksComplete = rows.every(([, value]) => cleanHex(value).length === 32);
  const checks: MagicRestoreCheck[] = [
    {
      id: "source-dump",
      label: "Source dump",
      state: size && indexesComplete && blocksComplete ? "ok" : "error",
      detail:
        size && indexesComplete && blocksComplete
          ? `Complete MIFARE Classic ${size.toUpperCase()} image (${blockCount} blocks).`
          : `Expected a contiguous 64-block (1K) or 256-block (4K) image; found ${blockCount} block(s).`,
      blocking: true,
    },
  ];

  const uid = cleanHex(dump.Card?.UID);
  const block0 = cleanHex(dump.blocks?.["0"]);
  const expectedBcc = bccForUid(uid);
  const block0Valid =
    uid.length === 8 &&
    block0.length === 32 &&
    block0.slice(0, 8) === uid &&
    block0.slice(8, 10) === expectedBcc;
  checks.push({
    id: "manufacturer-block",
    label: "Manufacturer block",
    state: block0Valid ? "ok" : "error",
    detail: block0Valid
      ? `Block 0 contains UID ${uid} with a valid BCC (${expectedBcc}).`
      : "Block 0 must contain the dump's 4-byte UID and a valid BCC before an automated restore.",
    blocking: true,
  });

  const invalidTrailers = rows
    .filter(([key]) => {
      const block = Number(key);
      return (block < 128 && block % 4 === 3) || (block >= 128 && (block - 128) % 16 === 15);
    })
    .filter(([, value]) => !validateAccessBits(cleanHex(value).slice(12, 18)))
    .map(([key]) => Number(key));
  checks.push({
    id: "access-bits",
    label: "Sector access bits",
    state: invalidTrailers.length ? "error" : "ok",
    detail: invalidTrailers.length
      ? `Invalid access bits in trailer block(s): ${invalidTrailers.join(", ")}.`
      : "All sector trailers contain internally valid access bits.",
    blocking: true,
  });

  return { blockCount, size, checks };
}

export function planMagicRestore(
  dump: PM3DumpJson | null | undefined,
  target: CardTarget,
): MagicRestorePlan {
  const source = sourceChecks(dump);
  const checks = [...source.checks];
  if (checks.some((check) => check.blocking && check.state === "error")) {
    return {
      state: "blocked",
      sourceBlockCount: source.blockCount,
      sourceSize: source.size,
      checks,
      summary: "The guarded restore cannot use this source dump.",
      nextStep:
        "Repair or recapture the dump, or use the direct controls below if you intentionally want to bypass the guarded workflow.",
    };
  }

  if (target.source !== "scan" || !target.identity || target.identity.protocol !== "HF") {
    checks.push({
      id: "target-scan",
      label: "Physical target",
      state: "info",
      detail: "The active identity still comes from the dump, not a fresh physical-card scan.",
      blocking: true,
    });
    return {
      state: "needs-scan",
      sourceBlockCount: source.blockCount,
      sourceSize: source.size,
      checks,
      summary: "Scan the physical target card before any write decision.",
      nextStep: "Place the target on the HF antenna and run HF Search.",
    };
  }

  const targetSize =
    target.classification.size === "1k" || target.classification.size === "4k"
      ? target.classification.size
      : undefined;
  const targetClassic = target.classification.isClassic && Boolean(targetSize);
  checks.push({
    id: "target-type",
    label: "Target type and capacity",
    state: targetClassic ? "ok" : "error",
    detail: targetClassic
      ? `Detected MIFARE Classic ${targetSize?.toUpperCase()} target (${expectedBlockCount(targetSize)} blocks).`
      : "The target is not a recognized MIFARE Classic 1K/4K card.",
    blocking: true,
  });
  if (!targetClassic) {
    return {
      state: "blocked",
      sourceBlockCount: source.blockCount,
      sourceSize: source.size,
      checks,
      summary: "The guarded restore does not support this target.",
      nextStep:
        "Use a compatible magic target, or use the direct controls below with the appropriate card-specific command.",
    };
  }

  const sameCapacity = source.size === targetSize;
  checks.push({
    id: "capacity-match",
    label: "Capacity match",
    state: sameCapacity ? "ok" : "error",
    detail: sameCapacity
      ? `Source and target are both ${source.size?.toUpperCase()}.`
      : `Source is ${source.size?.toUpperCase()}, but target is ${targetSize?.toUpperCase()}. Changing SAK cannot add memory.`,
    blocking: true,
  });
  if (!sameCapacity) {
    return {
      state: "blocked",
      sourceBlockCount: source.blockCount,
      sourceSize: source.size,
      targetSize,
      checks,
      summary: "The guarded full restore is unavailable because the capacities differ.",
      nextStep: `Use a ${source.size?.toUpperCase()} magic target, choose UID-only, or intentionally use the direct controls below.`,
    };
  }

  if (!target.magic) {
    checks.push({
      id: "magic-generation",
      label: "Magic generation",
      state: "info",
      detail: "Magic capability has not been checked for this freshly scanned target.",
      blocking: true,
    });
    return {
      state: "needs-detect",
      sourceBlockCount: source.blockCount,
      sourceSize: source.size,
      targetSize,
      checks,
      summary: "Identify the target's magic-card generation before writing block 0.",
      nextStep: "Run Magic Detect (`hf mf info`) with the target still in place.",
    };
  }

  const supported = target.magic.isMagic && target.magic.gen === "gen1a";
  checks.push({
    id: "magic-generation",
    label: "Magic generation",
    state: supported ? "ok" : "error",
    detail: supported
      ? `${target.magic.label || "Gen1a"} supports guarded csave/cload backup and restore.`
      : target.magic.isMagic
        ? `${target.magic.label || target.magic.gen} is identifiable, but this automated full-dump pipeline currently supports Gen1a only.`
        : "No supported magic write capability was detected.",
    blocking: true,
  });
  if (!supported) {
    return {
      state: "blocked",
      sourceBlockCount: source.blockCount,
      sourceSize: source.size,
      targetSize,
      checks,
      summary: "The guarded restore needs a generation-specific method for this target.",
      nextStep:
        target.magic.gen === "gen4"
          ? "Use a password-aware Gen4 gsave/gload workflow; do not send Gen1a commands."
          : target.magic.gen === "gen2"
            ? "Use the Gen2 direct-write workflow with target authentication and exact readback."
            : target.magic.gen === "gen3"
              ? "Use Gen3 UID/block-0 tools only; full-dump automation is not enabled."
              : "Use a supported Gen1a target or perform a UID-only operation.",
    };
  }

  return {
    state: "ready",
    sourceBlockCount: source.blockCount,
    sourceSize: source.size,
    targetSize,
    checks,
    summary: "Ready for a guarded Gen1a full restore with target backup and exact readback.",
    nextStep: "Keep the target still, then confirm Backup → Write → Verify.",
  };
}

export function magicSizeFlag(size: "1k" | "4k"): "--1k" | "--4k" {
  return size === "4k" ? "--4k" : "--1k";
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
