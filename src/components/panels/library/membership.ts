import { createContext, useContext } from "react";
import type { VirtualCardRecord } from "@/features/vault/db";
import { memberRefKey } from "@/features/vault/virtualCards";
import type { VirtualCardMemberKind } from "@/features/vault/db";

/**
 * Reverse index of virtual-card membership, keyed by `kind:refId`. Provided once
 * by the Library panel so every tab can show "this row belongs to X" without
 * each list row opening its own live query.
 */
export const VirtualCardMembershipContext = createContext<Map<string, VirtualCardRecord[]>>(
  new Map(),
);

/** Virtual cards claiming a given vault row (empty when it belongs to none). */
export function useMemberOf(kind: VirtualCardMemberKind, refId: string): VirtualCardRecord[] {
  return useContext(VirtualCardMembershipContext).get(memberRefKey(kind, refId)) ?? [];
}
