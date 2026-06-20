import { useCallback, useMemo, useState } from "react";
import type { CachedDump } from "@/components/panels/CardMemoryMap";
import { buildKeyDictionary } from "@/components/panels/library/utils";
import type { StoredKey } from "@/components/panels/library/types";
import type { CachedAsset } from "@/features/key-cache/types";
import type { TagInfo } from "@/features/tag-info/types";
import { assetsForUid, dumpsForUid, keysForUid } from "@/features/vault/vault";
import { sanitizeHex } from "@/lib/rfidUtils";
import { classifyCard } from "./classify";
import type { CardSource, CardTarget, CardTargetContextValue } from "./types";

interface UseCardTargetArgs {
  /** Active dump from the dump store, bridged in as the target's memory. */
  activeDump: CachedDump | null;
  /** All cached dumps, so the target can surface ones sharing its UID. */
  cachedDumps?: CachedDump[];
  /** All cached files, so the target can surface ones referencing its UID. */
  cachedAssets?: CachedAsset[];
  /** All library keys (live), so the target can resolve its saved keys. */
  allKeys?: StoredKey[];
}

/**
 * Owns the single "active card" the workbench operates on. App.tsx calls this
 * once, feeds scan/dump results into it, and shares the result through
 * {@link CardTargetContext} so every panel reads the same card. The card's vault
 * bundle — saved keys, related dumps, and related files — is resolved from the
 * live vault arrays passed in, so it stays in sync without an event bus.
 */
export function useCardTarget({
  activeDump,
  cachedDumps = [],
  cachedAssets = [],
  allKeys = [],
}: UseCardTargetArgs): CardTargetContextValue {
  const [identity, setIdentityState] = useState<TagInfo | null>(null);
  const [source, setSource] = useState<CardSource>(null);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());

  const mergeIdentity = useCallback(
    (partial: Partial<TagInfo>, nextSource: CardSource = "scan") => {
      setIdentityState((prev) => ({ ...prev, ...partial }));
      setSource(nextSource);
      setUpdatedAt(Date.now());
    },
    [],
  );

  const setIdentity = useCallback((next: TagInfo | null, nextSource: CardSource = "scan") => {
    setIdentityState(next);
    setSource(next ? nextSource : null);
    setUpdatedAt(Date.now());
  }, []);

  const clearTarget = useCallback(() => {
    setIdentityState(null);
    setSource(null);
    setUpdatedAt(Date.now());
  }, []);

  // UID prefers the scanned identity, falling back to the active dump's card.
  const uid = useMemo(() => {
    const fromIdentity = identity?.uid ? sanitizeHex(identity.uid, 20) : "";
    if (fromIdentity) return fromIdentity;
    return activeDump?.data.Card?.UID ? sanitizeHex(activeDump.data.Card.UID, 20) : "";
  }, [identity?.uid, activeDump]);

  // The card's vault bundle, resolved through the single vault read surface.
  const savedKeys = useMemo(() => keysForUid(uid, allKeys), [uid, allKeys]);
  const savedKeyCount = useMemo(() => {
    const dictionary = buildKeyDictionary(savedKeys, uid);
    return dictionary ? dictionary.split("\n").filter(Boolean).length : 0;
  }, [savedKeys, uid]);
  const relatedDumps = useMemo(() => dumpsForUid(uid, cachedDumps), [uid, cachedDumps]);
  const relatedAssets = useMemo(() => assetsForUid(uid, cachedAssets), [uid, cachedAssets]);

  const target = useMemo<CardTarget>(() => {
    const hasCard = Boolean(identity || activeDump);
    return {
      identity,
      dump: activeDump,
      source: hasCard ? source : null,
      classification: classifyCard(identity),
      uid,
      savedKeys,
      savedKeyCount,
      relatedDumps,
      relatedAssets,
      hasCard,
      updatedAt,
    };
  }, [
    identity,
    activeDump,
    source,
    uid,
    savedKeys,
    savedKeyCount,
    relatedDumps,
    relatedAssets,
    updatedAt,
  ]);

  return useMemo(
    () => ({ target, mergeIdentity, setIdentity, clearTarget }),
    [target, mergeIdentity, setIdentity, clearTarget],
  );
}
