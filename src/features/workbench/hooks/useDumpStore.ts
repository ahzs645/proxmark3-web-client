import { useCallback, useEffect, useMemo, useState } from "react";
import type { CachedDump, PM3DumpJson } from "@/components/panels/CardMemoryMap";

const DUMP_CACHE_KEY = "pm3-dumps";

interface UseDumpStoreOptions {
  onActivateMemory?: () => void;
  onLog?: (line: string) => void;
}

function loadCachedDumps(): CachedDump[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(DUMP_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedDump[]) : [];
  } catch (error) {
    console.error("Failed to parse cached dumps", error);
    return [];
  }
}

export function useDumpStore({ onActivateMemory, onLog }: UseDumpStoreOptions = {}) {
  const [cachedDumps, setCachedDumps] = useState<CachedDump[]>(() => loadCachedDumps());
  const [activeDumpId, setActiveDumpId] = useState<string | null>(null);

  const activeDump = useMemo(
    () => cachedDumps.find((dump) => dump.id === activeDumpId) || null,
    [cachedDumps, activeDumpId],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DUMP_CACHE_KEY, JSON.stringify(cachedDumps));
    }
  }, [cachedDumps]);

  const upsertCachedDump = useCallback(
    (
      dump: PM3DumpJson,
      name: string,
      options?: {
        activate?: boolean;
        announce?: boolean;
      },
    ) => {
      const activate = options?.activate ?? false;
      const announce = options?.announce ?? false;
      const uid = dump.Card?.UID;
      const existing = uid ? cachedDumps.find((entry) => entry.data.Card?.UID === uid) : undefined;
      const cachedAt = Date.now();

      if (existing) {
        const updated: CachedDump = {
          ...existing,
          name,
          data: dump,
          cachedAt,
        };
        setCachedDumps((prev) =>
          [updated, ...prev.filter((entry) => entry.id !== existing.id)].slice(0, 10),
        );
        if (activate) {
          setActiveDumpId(existing.id);
        }
      } else {
        const newDump: CachedDump = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${name}`,
          name,
          data: dump,
          cachedAt,
        };
        setCachedDumps((prev) => [newDump, ...prev].slice(0, 10));
        if (activate) {
          setActiveDumpId(newDump.id);
        }
      }

      if (activate) {
        onActivateMemory?.();
      }

      if (announce) {
        onLog?.(`\x1b[32mLoaded dump: ${name}\x1b[0m`);
        if (dump.Card?.UID) {
          onLog?.(`\x1b[36mCard UID: ${dump.Card.UID}\x1b[0m`);
        }
      }
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
      setCachedDumps((prev) =>
        prev.map((dump) => (dump.id === id ? { ...dump, name: newName } : dump)),
      );
      onLog?.(`\x1b[32mRenamed dump to: ${newName}\x1b[0m`);
    },
    [onLog],
  );

  const handleDumpDelete = useCallback(
    (id: string) => {
      const dump = cachedDumps.find((entry) => entry.id === id);
      setCachedDumps((prev) => prev.filter((entry) => entry.id !== id));
      if (activeDumpId === id) {
        setActiveDumpId(null);
      }
      if (dump) {
        onLog?.(`\x1b[33mDeleted dump: ${dump.name}\x1b[0m`);
      }
    },
    [activeDumpId, cachedDumps, onLog],
  );

  return {
    activeDump,
    activeDumpId,
    cachedDumps,
    handleDumpDelete,
    handleDumpLoad,
    handleDumpRename,
    setActiveDumpId,
    upsertCachedDump,
  };
}
