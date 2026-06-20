import { useCallback, useMemo, useState } from "react";
import type { CachedDump, PM3DumpJson } from "@/components/panels/CardMemoryMap";
import type { DumpRecord } from "@/features/vault/db";
import { useVaultDumps } from "@/features/vault/hooks";
import { deleteDump, makeVaultId, putDump, renameDump } from "@/features/vault/operations";
import { normalizeUid } from "@/features/vault/uid";

interface UseDumpStoreOptions {
  onActivateMemory?: () => void;
  onLog?: (line: string) => void;
}

/**
 * Owns the active dump selection on top of the Dexie-backed dump table. The
 * dump list is a live query, so writes elsewhere (e.g. a generated dump cached
 * from terminal output) show up here automatically. The public API is unchanged
 * from the old localStorage version, so callers did not have to change.
 */
export function useDumpStore({ onActivateMemory, onLog }: UseDumpStoreOptions = {}) {
  const cachedDumps = useVaultDumps();
  const [activeDumpId, setActiveDumpId] = useState<string | null>(null);

  const activeDump = useMemo(
    () => cachedDumps.find((dump) => dump.id === activeDumpId) || null,
    [cachedDumps, activeDumpId],
  );

  const upsertCachedDump = useCallback(
    (
      dump: PM3DumpJson,
      name: string,
      options?: {
        activate?: boolean;
        announce?: boolean;
      },
    ): DumpRecord => {
      const activate = options?.activate ?? false;
      const announce = options?.announce ?? false;
      const uid = normalizeUid(dump.Card?.UID);
      const existing = uid ? cachedDumps.find((entry) => entry.uid === uid) : undefined;
      const now = Date.now();

      const record: DumpRecord = existing
        ? { ...existing, name, data: dump, cachedAt: now, updatedAt: now }
        : {
            id: makeVaultId("dump"),
            name,
            data: dump,
            uid,
            cachedAt: now,
            favorite: false,
            notes: "",
            updatedAt: now,
          };

      // Fire-and-forget; the live query refreshes the list once Dexie commits.
      void putDump(record);

      if (activate) setActiveDumpId(record.id);
      if (announce) {
        onLog?.(`\x1b[32mLoaded dump: ${name}\x1b[0m`);
        if (dump.Card?.UID) {
          onLog?.(`\x1b[36mCard UID: ${dump.Card.UID}\x1b[0m`);
        }
      }
      if (activate) onActivateMemory?.();

      return record;
    },
    [cachedDumps, onActivateMemory, onLog],
  );

  const handleDumpLoad = useCallback(
    (dump: PM3DumpJson, name: string) => {
      upsertCachedDump(dump, name, { activate: true, announce: true });
    },
    [upsertCachedDump],
  );

  const handleDumpRename = useCallback(
    (id: string, newName: string) => {
      void renameDump(id, newName);
      onLog?.(`\x1b[32mRenamed dump to: ${newName}\x1b[0m`);
    },
    [onLog],
  );

  const handleDumpDelete = useCallback(
    (id: string) => {
      const dump = cachedDumps.find((entry) => entry.id === id);
      void deleteDump(id);
      if (activeDumpId === id) setActiveDumpId(null);
      if (dump) onLog?.(`\x1b[33mDeleted dump: ${dump.name}\x1b[0m`);
    },
    [activeDumpId, cachedDumps, onLog],
  );

  const cachedDumpsView: CachedDump[] = cachedDumps;

  return {
    activeDump,
    activeDumpId,
    cachedDumps: cachedDumpsView,
    handleDumpDelete,
    handleDumpLoad,
    handleDumpRename,
    setActiveDumpId,
    upsertCachedDump,
  };
}
