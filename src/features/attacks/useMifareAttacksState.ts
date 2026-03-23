import { useCallback, useMemo, useState } from "react";
import type { CachedAsset } from "@/components/panels/KeyCachePanel";
import { ATTACK_CONFIGS, DEFAULT_KEYS } from "./config";
import type { AttackType, CardType, KeyType } from "./types";

interface UseMifareAttacksStateArgs {
  cachedAssets: CachedAsset[];
  cachePathPrefix: string;
}

export function useMifareAttacksState({
  cachedAssets,
  cachePathPrefix,
}: UseMifareAttacksStateArgs) {
  const [activeAttack, setActiveAttack] = useState<AttackType>("autopwn");
  const [cardType, setCardType] = useState<CardType>("1k");
  const [knownBlock, setKnownBlock] = useState("0");
  const [knownKeyType, setKnownKeyType] = useState<KeyType>("A");
  const [knownKey, setKnownKey] = useState("FFFFFFFFFFFF");
  const [targetBlock, setTargetBlock] = useState("4");
  const [targetKeyType, setTargetKeyType] = useState<KeyType>("A");
  const [selectedKeyFile, setSelectedKeyFile] = useState<string | null>(null);
  const [slowMode, setSlowMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const keyFiles = useMemo(
    () => cachedAssets.filter((asset) => asset.kind === "keys"),
    [cachedAssets],
  );
  const config = ATTACK_CONFIGS[activeAttack];
  const showKeyFileSection = activeAttack === "autopwn" || activeAttack === "chk";

  const handleKnownKeyChange = useCallback((value: string) => {
    const sanitized = value
      .toUpperCase()
      .replace(/[^A-F0-9]/gi, "")
      .slice(0, 12);
    setKnownKey(sanitized);
  }, []);

  const handleKnownBlockChange = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 3);
    setKnownBlock(sanitized);
  }, []);

  const handleTargetBlockChange = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 3);
    setTargetBlock(sanitized);
  }, []);

  const buildCommand = useCallback(() => {
    return config.command({
      cardType,
      knownBlock,
      knownKeyType,
      knownKey,
      targetBlock,
      targetKeyType,
      keyFile: selectedKeyFile ? `${cachePathPrefix}/${selectedKeyFile}` : undefined,
      slow: slowMode,
    });
  }, [
    cachePathPrefix,
    cardType,
    config,
    knownBlock,
    knownKey,
    knownKeyType,
    selectedKeyFile,
    slowMode,
    targetBlock,
    targetKeyType,
  ]);

  const isValid = useMemo(() => {
    if (config.requiresKnownKey && knownKey.length !== 12) return false;
    if (config.requiresKnownKey && !knownBlock) return false;
    if (config.requiresTargetBlock && !targetBlock) return false;
    return true;
  }, [config, knownBlock, knownKey, targetBlock]);

  const toggleAdvanced = useCallback(() => setShowAdvanced((prev) => !prev), []);

  return {
    activeAttack,
    setActiveAttack,
    cardType,
    setCardType,
    knownBlock,
    knownKeyType,
    knownKey,
    targetBlock,
    targetKeyType,
    selectedKeyFile,
    slowMode,
    showAdvanced,
    keyFiles,
    config,
    defaultKeys: DEFAULT_KEYS,
    showKeyFileSection,
    buildCommand,
    isValid,
    handleKnownKeyChange,
    handleKnownBlockChange,
    handleTargetBlockChange,
    setKnownKeyType,
    setTargetKeyType,
    setSelectedKeyFile,
    setSlowMode,
    toggleAdvanced,
  };
}
