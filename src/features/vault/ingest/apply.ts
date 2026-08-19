import { extractDumpKeysFromData } from "@/components/panels/library/utils";
import type { KeyDraft } from "@/components/panels/library/types";
import type { SectorKeysRecord } from "@/features/memory/types";
import { db } from "../db";
import {
  importKeyDrafts,
  lfMatchKey,
  makeVaultId,
  putAsset,
  putDump,
  saveVirtualCard,
  setVirtualCardMembers,
  upsertLfCard,
} from "../operations";
import { normalizeUid } from "../uid";
import type { VirtualCardMemberKind } from "../db";
import type { IngestPlan } from "./types";

/** What an import actually wrote, for the confirmation message. */
export interface IngestOutcome {
  dumps: number;
  keys: number;
  lfCards: number;
  assets: number;
  virtualCardId: string | null;
}

export interface ApplyIngestOptions {
  /** Group everything imported under a new virtual card with this nickname. */
  virtualCardName?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunked so a multi-megabyte capture does not blow the argument limit.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

/**
 * The UID an LF credential is filed under. This field is the join key that
 * pairs an LF card with its HF twin, so the HF UID wins when a capture names
 * one. Otherwise the credential's own id stands in — unless it is longer than a
 * UID can be (a 96-bit HID raw), where storing a truncated value would create a
 * join key that matches the wrong card.
 */
function lfCardUid(pairedUid: string, raw?: string): string {
  if (pairedUid) return pairedUid;
  const clean = (raw ?? "").toUpperCase().replace(/[^0-9A-F]/g, "");
  return clean.length > 0 && clean.length <= 20 ? normalizeUid(clean) : "";
}

/** Library key drafts for sector keys that never found a dump to live on. */
function looseKeyDrafts(keys: SectorKeysRecord, uid: string): KeyDraft[] {
  const drafts: KeyDraft[] = [];

  for (const [sector, entry] of Object.entries(keys)) {
    for (const [slot, value] of [
      ["A", entry.KeyA],
      ["B", entry.KeyB],
    ] as const) {
      if (!value || value.includes("?")) continue;
      drafts.push({
        label: `Sector ${sector} Key ${slot}`,
        value,
        kind: "history",
        uidFilter: uid,
        sourceDumpId: null,
      });
    }
  }

  return drafts;
}

/**
 * Write a planned import into the vault. Dumps, LF credentials and files go
 * through the same operations the live workflows use, so an imported card is
 * indistinguishable from one captured on hardware. When a nickname is given the
 * whole import is grouped under a new virtual card.
 */
export async function applyIngest(
  plan: IngestPlan,
  options: ApplyIngestOptions = {},
): Promise<IngestOutcome> {
  const now = Date.now();
  const members: { kind: VirtualCardMemberKind; refId: string }[] = [];
  const keyDrafts: KeyDraft[] = [];
  let assetCount = 0;

  for (const entry of plan.dumps) {
    const id = makeVaultId("dump");
    await putDump({
      id,
      name: entry.name,
      data: entry.dump,
      uid: entry.uid,
      cachedAt: now,
      favorite: false,
      notes: `Imported from ${entry.sources.join(", ")}`,
      updatedAt: now,
    });
    members.push({ kind: "dump", refId: id });
    keyDrafts.push(...extractDumpKeysFromData(entry.dump, id));
  }

  for (const entry of plan.looseKeys) {
    keyDrafts.push(...looseKeyDrafts(entry.keys, plan.uids[0] ?? ""));
  }

  for (const entry of plan.lfCards) {
    const { credential, carrier } = entry;
    const record = await upsertLfCard(
      {
        ...credential,
        uid: lfCardUid(entry.pairedUid, credential.raw),
        chip: carrier?.chip,
        config: carrier?.config,
        writable: carrier?.writable,
      },
      lfMatchKey(credential),
    );
    members.push({ kind: "lfCard", refId: record.id });
  }

  for (const entry of plan.assets) {
    const id = makeVaultId("asset");
    await putAsset({
      id,
      name: entry.name,
      relativePath: entry.relativePath,
      kind: entry.kind,
      size: entry.bytes.length,
      base64: bytesToBase64(entry.bytes),
      updatedAt: now,
    });
    assetCount += 1;
  }

  // putAsset de-duplicates by path, so the ids it actually stored are read back
  // rather than assumed, keeping the virtual card's links pointing at live rows.
  for (const entry of plan.assets) {
    const stored = await db.assets
      .filter((row) => (row.relativePath || row.name) === entry.relativePath)
      .first();
    if (stored) members.push({ kind: "asset", refId: stored.id });
  }

  if (keyDrafts.length) await importKeyDrafts(keyDrafts, await db.keys.toArray());

  // Read the keys back rather than trusting the insert count: loading a dump
  // also imports its keys elsewhere in the app, so this import may legitimately
  // add none while the card still has every key it needs. Reading back gives an
  // honest count and the row ids needed to attach them to the virtual card.
  const dumpIds = new Set(members.filter((m) => m.kind === "dump").map((m) => m.refId));
  const planUids = new Set(plan.uids);
  const cardKeys = await db.keys
    .filter(
      (key) =>
        (key.sourceDumpId != null && dumpIds.has(key.sourceDumpId)) ||
        (key.uidFilter !== "" && planUids.has(normalizeUid(key.uidFilter))),
    )
    .toArray();

  for (const key of cardKeys) members.push({ kind: "key", refId: key.id });

  let virtualCardId: string | null = null;
  if (options.virtualCardName) {
    virtualCardId = await saveVirtualCard({
      name: options.virtualCardName,
      form: "card",
      role: "original",
      issuer: "",
      color: "sky",
      tags: ["imported"],
      notes: plan.uids.length ? `UID ${plan.uids.join(", ")}` : "",
      favorite: false,
    });
    await setVirtualCardMembers(virtualCardId, members);
  }

  return {
    dumps: plan.dumps.length,
    keys: cardKeys.length,
    lfCards: plan.lfCards.length,
    assets: assetCount,
    virtualCardId,
  };
}
