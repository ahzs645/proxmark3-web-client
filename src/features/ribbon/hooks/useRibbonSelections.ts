import { useEffect, useRef, useState } from "react";
import { useTarget } from "@/features/target/context";
import type { CardFamily } from "@/features/target/types";
import { HF_CARD_TYPES, LF_CARD_TYPES } from "../config";

/** Which HF ribbon entry a detected card family corresponds to. */
const HF_FAMILY_TO_CARD_TYPE: Partial<Record<CardFamily, string>> = {
  classic: "mfclassic",
  ultralight: "mfultralight",
  iclass: "iclass",
  desfire: "desfire",
};

/**
 * Card-type selections for the HF/LF command strips.
 *
 * They live above the strips because a strip unmounts whenever you flip to a
 * different one, and they follow the active card target: scan a MIFARE Classic
 * and the HF strip is already pointing at MIFARE Classic operations. A manual
 * pick stands until the detected card family actually changes.
 */
export function useRibbonSelections() {
  const { target } = useTarget();
  const [selectedLFCardType, setSelectedLFCardType] = useState(LF_CARD_TYPES[0]?.value || "em4x");
  const [selectedHFCardType, setSelectedHFCardType] = useState(
    HF_CARD_TYPES[0]?.value || "mfclassic",
  );

  const syncedFamilyRef = useRef<CardFamily | null>(null);

  useEffect(() => {
    const family = target.classification.family;
    if (family === syncedFamilyRef.current) return;
    syncedFamilyRef.current = family;

    const hfCardType = HF_FAMILY_TO_CARD_TYPE[family];
    if (hfCardType) setSelectedHFCardType(hfCardType);
  }, [target.classification.family]);

  return {
    selectedLFCardType,
    setSelectedLFCardType,
    selectedHFCardType,
    setSelectedHFCardType,
  };
}
