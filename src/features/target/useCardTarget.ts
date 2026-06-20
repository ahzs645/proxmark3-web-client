import { useCallback, useEffect, useMemo, useState } from "react";
import type { CachedDump } from "@/components/panels/CardMemoryMap";
import type { StoredKey } from "@/components/panels/library/types";
import {
  KEYS_STORAGE_KEY,
  LIBRARY_KEYS_UPDATED_EVENT,
  buildKeyDictionary,
  loadStoredState,
} from "@/components/panels/library/utils";
import type { TagInfo } from "@/features/tag-info/types";
import { sanitizeHex } from "@/lib/rfidUtils";
import { classifyCard } from "./classify";
import type { CardSource, CardTarget, CardTargetContextValue } from "./types";

function countSavedKeys(uid: string): number {
  if (typeof window === "undefined") return 0;
  const keys = loadStoredState<StoredKey[]>(KEYS_STORAGE_KEY, []);
  const dictionary = buildKeyDictionary(keys, uid);
  return dictionary ? dictionary.split("\n").filter(Boolean).length : 0;
}

interface UseCardTargetArgs {
  /** Active dump from the dump store, bridged in as the target's memory. */
  activeDump: CachedDump | null;
}

/**
 * Owns the single "active card" the workbench operates on. App.tsx calls this
 * once, feeds scan/dump results into it, and shares the result through
 * {@link CardTargetContext} so every panel reads the same card.
 */
export function useCardTarget({ activeDump }: UseCardTargetArgs): CardTargetContextValue {
  const [identity, setIdentityState] = useState<TagInfo | null>(null);
  const [source, setSource] = useState<CardSource>(null);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  // Bumped whenever the library's keys change, so savedKeyCount recomputes.
  const [keysVersion, setKeysVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setKeysVersion((value) => value + 1);
    window.addEventListener(LIBRARY_KEYS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(LIBRARY_KEYS_UPDATED_EVENT, handler);
  }, []);

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

  const savedKeyCount = useMemo(() => countSavedKeys(uid), [uid, keysVersion]);

  const target = useMemo<CardTarget>(() => {
    const hasCard = Boolean(identity || activeDump);
    return {
      identity,
      dump: activeDump,
      source: hasCard ? source : null,
      classification: classifyCard(identity),
      uid,
      savedKeyCount,
      hasCard,
      updatedAt,
    };
  }, [identity, activeDump, source, uid, savedKeyCount, updatedAt]);

  return useMemo(
    () => ({ target, mergeIdentity, setIdentity, clearTarget }),
    [target, mergeIdentity, setIdentity, clearTarget],
  );
}
