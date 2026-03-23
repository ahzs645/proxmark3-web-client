import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCESS_PRESETS,
  decodeAccessBits,
  encodeAccessBits,
  isKeyBReadable,
  type AccessPresetKey,
} from "@/lib/accessBits";
import type { TrailerDecoderState } from "../types";

interface UseTrailerDecoderStateOptions {
  initialTrailer: string;
  open: boolean;
}

function parseInitialAccessBits(initialTrailer: string) {
  const clean = initialTrailer.replace(/\s/g, "").toUpperCase();
  if (clean.length >= 32) return clean.slice(12, 18);
  if (clean.length >= 6) return clean.slice(0, 6);
  return "FF0780";
}

function parseInitialKeys(initialTrailer: string) {
  const clean = initialTrailer.replace(/\s/g, "").toUpperCase();
  if (clean.length >= 32) {
    return {
      keyA: clean.slice(0, 12),
      keyB: clean.slice(20, 32),
      gpb: clean.slice(18, 20),
    };
  }
  return {
    keyA: "FFFFFFFFFFFF",
    keyB: "FFFFFFFFFFFF",
    gpb: "69",
  };
}

function sanitizeHex(value: string, maxLength: number) {
  return value
    .toUpperCase()
    .replace(/[^A-F0-9]/gi, "")
    .slice(0, maxLength);
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

export function useTrailerDecoderState({
  initialTrailer,
  open,
}: UseTrailerDecoderStateOptions): TrailerDecoderState {
  const [accessBitsHex, setAccessBitsHex] = useState(() => parseInitialAccessBits(initialTrailer));
  const [keyA, setKeyA] = useState(() => parseInitialKeys(initialTrailer).keyA);
  const [keyB, setKeyB] = useState(() => parseInitialKeys(initialTrailer).keyB);
  const [gpb, setGpb] = useState(() => parseInitialKeys(initialTrailer).gpb);
  const [c0, setC0] = useState(0);
  const [c1, setC1] = useState(0);
  const [c2, setC2] = useState(0);
  const [c3, setC3] = useState(1);

  useEffect(() => {
    if (!open) return;

    const bits = parseInitialAccessBits(initialTrailer);
    const keys = parseInitialKeys(initialTrailer);
    setAccessBitsHex(bits);
    setKeyA(keys.keyA);
    setKeyB(keys.keyB);
    setGpb(keys.gpb);

    const decoded = decodeAccessBits(bits);
    if (decoded.valid) {
      setC0(decoded.c0);
      setC1(decoded.c1);
      setC2(decoded.c2);
      setC3(decoded.c3);
    }
  }, [initialTrailer, open]);

  const decoded = useMemo(() => decodeAccessBits(accessBitsHex), [accessBitsHex]);

  useEffect(() => {
    if (!decoded.valid) return;
    setC0(decoded.c0);
    setC1(decoded.c1);
    setC2(decoded.c2);
    setC3(decoded.c3);
  }, [decoded]);

  const handleCValueChange = useCallback(
    (index: number, value: number) => {
      const next = Math.max(0, Math.min(7, value));
      const values = [c0, c1, c2, c3];
      values[index] = next;

      setC0(values[0]);
      setC1(values[1]);
      setC2(values[2]);
      setC3(values[3]);
      setAccessBitsHex(encodeAccessBits(values[0], values[1], values[2], values[3]));
    },
    [c0, c1, c2, c3],
  );

  const handleAccessBitsChange = useCallback((value: string) => {
    setAccessBitsHex(sanitizeHex(value, 6));
  }, []);

  const handleKeyAChange = useCallback((value: string) => setKeyA(sanitizeHex(value, 12)), []);
  const handleKeyBChange = useCallback((value: string) => setKeyB(sanitizeHex(value, 12)), []);
  const handleGpbChange = useCallback((value: string) => setGpb(sanitizeHex(value, 2)), []);

  const handlePresetClick = useCallback((presetKey: AccessPresetKey) => {
    const preset = ACCESS_PRESETS[presetKey];
    setC0(preset.c0);
    setC1(preset.c1);
    setC2(preset.c2);
    setC3(preset.c3);
    setAccessBitsHex(preset.hex);
  }, []);

  const fullTrailer = useMemo(() => {
    const paddedKeyA = keyA.padEnd(12, "F").slice(0, 12);
    const paddedKeyB = keyB.padEnd(12, "F").slice(0, 12);
    const paddedAccess = accessBitsHex.padEnd(6, "0").slice(0, 6);
    const paddedGpb = gpb.padEnd(2, "0").slice(0, 2);
    return `${paddedKeyA}${paddedAccess}${paddedGpb}${paddedKeyB}`;
  }, [accessBitsHex, gpb, keyA, keyB]);

  return {
    accessBitsHex,
    keyA,
    keyB,
    gpb,
    c0,
    c1,
    c2,
    c3,
    decoded,
    fullTrailer,
    keyBReadable: isKeyBReadable(c3),
    handleCValueChange,
    handleAccessBitsChange,
    handleKeyAChange,
    handleKeyBChange,
    handleGpbChange,
    handlePresetClick,
    copyToClipboard,
  };
}
