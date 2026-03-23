import { useState } from "react";
import { sanitizeHexInput, validateEM410xId } from "../commands";
import type { ChipType } from "../types";

export function useT55xxPanelState() {
  const [emId, setEmId] = useState("");
  const [chipType, setChipType] = useState<ChipType>("t55x7");
  const [clockRate, setClockRate] = useState(64);
  const [password, setPassword] = useState("00000000");
  const [usePassword, setUsePassword] = useState(false);
  const [blockNumber, setBlockNumber] = useState("0");
  const [blockData, setBlockData] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  return {
    emId,
    chipType,
    clockRate,
    password,
    usePassword,
    blockNumber,
    blockData,
    showAdvanced,
    isEmIdValid: validateEM410xId(emId),
    setChipType,
    setClockRate,
    setPassword,
    setUsePassword,
    setBlockNumber,
    setBlockData,
    setShowAdvanced,
    setEmIdFromInput: (value: string) => setEmId(sanitizeHexInput(value, 10)),
    setPasswordFromInput: (value: string) => setPassword(sanitizeHexInput(value, 8)),
    setBlockDataFromInput: (value: string) => setBlockData(sanitizeHexInput(value, 8)),
  };
}
