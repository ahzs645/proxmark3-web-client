import { useState } from "react";
import { HF_CARD_TYPES, LF_CARD_TYPES } from "../config";

export function useRibbonSelections() {
  const [selectedLFCardType, setSelectedLFCardType] = useState(LF_CARD_TYPES[0]?.value || "em4x");
  const [selectedHFCardType, setSelectedHFCardType] = useState(
    HF_CARD_TYPES[0]?.value || "mfclassic",
  );

  return {
    selectedLFCardType,
    setSelectedLFCardType,
    selectedHFCardType,
    setSelectedHFCardType,
  };
}
