import type { OperationCheckRecord } from "@/features/vault/db";
import type { Type2OperationOptions } from "@/features/operations/profiles";
import type { ParsedMfuDump } from "./mfu";
import { clearNdefTlvs, parseType2Tlvs } from "./tlv";
import { ndefLastPage, type Type2Profile } from "./profiles";

export interface PageWrite {
  page: number;
  data: Uint8Array;
}
export interface Type2WritePlan {
  profile: Type2Profile;
  targetArea: Uint8Array;
  changedPages: PageWrite[];
  invalidate?: PageWrite;
  bodyPages: PageWrite[];
  commit?: PageWrite;
}

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  blocking = true,
): OperationCheckRecord {
  return { id, label, state: passed ? "ok" : "error", detail, blocking: !passed && blocking };
}

function allZero(bytes?: Uint8Array): boolean {
  return Boolean(bytes && bytes.every((byte) => byte === 0));
}

export function type2Preflight(
  dump: ParsedMfuDump,
  options: Type2OperationOptions,
): OperationCheckRecord[] {
  const profile = dump.profile;
  const checks: OperationCheckRecord[] = [
    check(
      "profile",
      "Supported Type 2 profile",
      Boolean(profile && (!options.requireKnownProfile || profile.knownLayout)),
      profile
        ? `${profile.name}; ${profile.ndefCapacity} bytes available.`
        : "Memory profile could not be determined.",
    ),
  ];
  if (options.checkStaticLock)
    checks.push(
      check(
        "static-lock",
        "Static lock bytes",
        allZero(dump.staticLock),
        allZero(dump.staticLock) ? "Static locks are clear." : "Static lock bytes are set.",
      ),
    );
  if (options.checkDynamicLock)
    checks.push(
      check(
        "dynamic-lock",
        "Dynamic lock bytes",
        allZero(dump.dynamicLock),
        dump.dynamicLock
          ? allZero(dump.dynamicLock)
            ? "Dynamic locks are clear."
            : "Dynamic lock bytes are set."
          : "Dynamic locks are unavailable for this profile.",
      ),
    );
  if (options.checkAuth0)
    checks.push(
      check(
        "auth0",
        "Authentication boundary",
        dump.auth0 === 0xff,
        dump.auth0 === undefined
          ? "AUTH0 is unavailable."
          : dump.auth0 === 0xff
            ? "AUTH0 is FF; password protection is disabled."
            : `AUTH0 is ${dump.auth0.toString(16).padStart(2, "0").toUpperCase()}.`,
      ),
    );
  return checks;
}

export function hasBlockingChecks(checks: OperationCheckRecord[]): boolean {
  return checks.some((item) => item.blocking && item.state === "error");
}

function pageSlice(area: Uint8Array, profile: Type2Profile, page: number): Uint8Array {
  const offset = (page - profile.ndefFirstPage) * 4;
  return area.slice(offset, offset + 4);
}

function pagesForArea(area: Uint8Array, profile: Type2Profile): PageWrite[] {
  const pages: PageWrite[] = [];
  for (let offset = 0; offset < area.length; offset += 4)
    pages.push({ page: profile.ndefFirstPage + offset / 4, data: area.slice(offset, offset + 4) });
  return pages;
}

export function planType2Write(
  baseline: ParsedMfuDump,
  tlv: Uint8Array,
  options: Type2OperationOptions,
): Type2WritePlan {
  const profile = baseline.profile;
  if (!profile?.knownLayout || profile.userLastPage === undefined)
    throw new Error("Writing requires a known Type 2 memory profile.");
  if (tlv.length > profile.ndefCapacity)
    throw new Error("NDEF content exceeds the detected tag capacity.");
  const start = profile.ndefFirstPage * 4;
  const current = baseline.pages.slice(start, start + profile.ndefCapacity);
  const records = parseType2Tlvs(current);
  const foreign = records.filter((record) => ![0x00, 0x03, 0xfe].includes(record.type));
  const ndefCount = records.filter((record) => record.type === 0x03).length;
  if (foreign.length || ndefCount > 1)
    throw new Error(
      "The current user area has a non-standard TLV layout; full NDEF replacement is blocked.",
    );
  const targetArea = new Uint8Array(profile.ndefCapacity);
  targetArea.set(tlv);
  const changedPages = pagesForArea(targetArea, profile).filter(
    ({ page, data }) =>
      !data.every((byte, index) => byte === pageSlice(current, profile, page)[index]),
  );
  const first = pageSlice(targetArea, profile, profile.ndefFirstPage);
  const bodyPages = changedPages.filter((item) => item.page !== profile.ndefFirstPage);
  return {
    profile,
    targetArea,
    changedPages,
    invalidate: options.twoPhase
      ? { page: profile.ndefFirstPage, data: new Uint8Array(4) }
      : undefined,
    bodyPages: options.twoPhase ? bodyPages : changedPages,
    commit: options.twoPhase ? { page: profile.ndefFirstPage, data: first } : undefined,
  };
}

export function planType2Erase(baseline: ParsedMfuDump, scope: "ndef" | "user"): Type2WritePlan {
  const profile = baseline.profile;
  if (!profile?.knownLayout || profile.userLastPage === undefined)
    throw new Error("Erasing requires a known Type 2 memory profile.");
  const firstPage = scope === "ndef" ? profile.ndefFirstPage : profile.userFirstPage;
  const lastPage = scope === "ndef" ? ndefLastPage(profile) : profile.userLastPage;
  const start = firstPage * 4;
  const current = baseline.pages.slice(start, (lastPage + 1) * 4);
  const target = scope === "ndef" ? clearNdefTlvs(current).data : new Uint8Array(current.length);
  const changedPages = Array.from({ length: Math.ceil(target.length / 4) }, (_, index) => ({
    page: firstPage + index,
    data: target.slice(index * 4, index * 4 + 4),
  })).filter(
    ({ page, data }) => !data.every((byte, index) => byte === baseline.pages[page * 4 + index]),
  );
  return { profile, targetArea: target, changedPages, bodyPages: changedPages };
}

export function buildWriteCommands(pages: PageWrite[], maxPerBatch = 12): string[] {
  for (const item of pages) {
    if (!Number.isInteger(item.page) || item.page < 4 || item.page > 225 || item.data.length !== 4)
      throw new Error("Unsafe Type 2 page write was rejected.");
  }
  const atoms = pages.map(
    ({ page, data }) =>
      `hf mfu wrbl -b ${page} -d ${Array.from(data, (byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`,
  );
  const batches: string[] = [];
  for (let index = 0; index < atoms.length; index += maxPerBatch)
    batches.push(atoms.slice(index, index + maxPerBatch).join("; "));
  return batches;
}

export function verifyTargetArea(readback: ParsedMfuDump, plan: Type2WritePlan): boolean {
  const start = plan.profile.ndefFirstPage * 4;
  const actual = readback.pages.slice(start, start + plan.targetArea.length);
  return (
    actual.length === plan.targetArea.length &&
    actual.every((byte, index) => byte === plan.targetArea[index])
  );
}

export function protectedPagesUnchanged(
  before: ParsedMfuDump,
  after: ParsedMfuDump,
  profile: Type2Profile,
): boolean {
  const userStart = profile.userFirstPage * 4;
  const userEnd = ((profile.userLastPage ?? ndefLastPage(profile)) + 1) * 4;
  if (before.pages.length !== after.pages.length) return false;
  return before.pages.every((byte, index) =>
    index >= userStart && index < userEnd ? true : byte === after.pages[index],
  );
}
