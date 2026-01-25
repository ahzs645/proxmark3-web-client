import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { CachedAsset } from "./KeyCachePanel";
import {
  Key,
  Shield,
  Zap,
  Target,
  Search,
  Play,
  ChevronDown,
  FileKey,
  AlertTriangle,
  Lock,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CardType = "1k" | "4k";
type KeyType = "A" | "B";
type AttackType = "autopwn" | "nested" | "staticnested" | "darkside" | "hardnested" | "chk";

interface MifareAttacksPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
  cachedAssets?: CachedAsset[];
  cachePathPrefix?: string;
}

interface AttackConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresKnownKey: boolean;
  requiresTargetBlock: boolean;
  command: (params: AttackParams) => string;
}

interface AttackParams {
  cardType: CardType;
  knownBlock: string;
  knownKeyType: KeyType;
  knownKey: string;
  targetBlock: string;
  targetKeyType: KeyType;
  keyFile?: string;
  slow?: boolean;
}

const ATTACK_CONFIGS: Record<AttackType, AttackConfig> = {
  autopwn: {
    label: "Autopwn",
    description: "Automatic key recovery using all available attacks",
    icon: <Zap className="h-4 w-4" />,
    requiresKnownKey: false,
    requiresTargetBlock: false,
    command: (p) => `hf mf autopwn --${p.cardType}${p.keyFile ? ` -f ${p.keyFile}` : ""}`,
  },
  nested: {
    label: "Nested",
    description: "Recover keys using a known key (fast, requires one known key)",
    icon: <Key className="h-4 w-4" />,
    requiresKnownKey: true,
    requiresTargetBlock: false,
    command: (p) =>
      `hf mf nested --${p.cardType} --blk ${p.knownBlock} -${p.knownKeyType.toLowerCase()} -k ${p.knownKey}`,
  },
  staticnested: {
    label: "Static Nested",
    description: "For cards with static encrypted nonce (some Chinese clones)",
    icon: <Lock className="h-4 w-4" />,
    requiresKnownKey: true,
    requiresTargetBlock: false,
    command: (p) =>
      `hf mf staticnested --${p.cardType} --blk ${p.knownBlock} -${p.knownKeyType.toLowerCase()} -k ${p.knownKey}`,
  },
  darkside: {
    label: "Darkside",
    description: "Recover first key with no prior knowledge (slow, ~5-30 min)",
    icon: <Unlock className="h-4 w-4" />,
    requiresKnownKey: false,
    requiresTargetBlock: false,
    command: () => `hf mf darkside`,
  },
  hardnested: {
    label: "Hardnested",
    description: "Recover specific key using known key (works on hardened cards)",
    icon: <Target className="h-4 w-4" />,
    requiresKnownKey: true,
    requiresTargetBlock: true,
    command: (p) =>
      `hf mf hardnested --blk ${p.knownBlock} -${p.knownKeyType.toLowerCase()} -k ${p.knownKey} --tblk ${p.targetBlock} --t${p.targetKeyType.toLowerCase()}${p.slow ? " -s" : ""}`,
  },
  chk: {
    label: "Check Keys",
    description: "Test a list of known keys against all sectors",
    icon: <Search className="h-4 w-4" />,
    requiresKnownKey: false,
    requiresTargetBlock: false,
    command: (p) => `hf mf chk --${p.cardType}${p.keyFile ? ` -f ${p.keyFile}` : ""}`,
  },
};

const QUICK_ATTACKS = [
  { label: "Autopwn 1K", command: "hf mf autopwn --1k", variant: "default" as const },
  { label: "Autopwn 4K", command: "hf mf autopwn --4k", variant: "secondary" as const },
  { label: "Darkside", command: "hf mf darkside", variant: "outline" as const },
  { label: "Check Default Keys", command: "hf mf chk --1k", variant: "outline" as const },
];

const DEFAULT_KEYS = [
  "FFFFFFFFFFFF",
  "A0A1A2A3A4A5",
  "D3F7D3F7D3F7",
  "000000000000",
  "B0B1B2B3B4B5",
  "4D3A99C351DD",
  "1A982C7E459A",
  "AABBCCDDEEFF",
];

export function MifareAttacksPanel({
  onCommand,
  disabled = false,
  cachedAssets = [],
  cachePathPrefix = "/pm3-cache",
}: MifareAttacksPanelProps) {
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
    () => cachedAssets.filter((a) => a.kind === "keys"),
    [cachedAssets]
  );

  const config = ATTACK_CONFIGS[activeAttack];

  const handleKeyChange = useCallback((value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 12);
    setKnownKey(sanitized);
  }, []);

  const handleBlockChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
      const sanitized = value.replace(/\D/g, "").slice(0, 3);
      setter(sanitized);
    },
    []
  );

  const buildCommand = useCallback(() => {
    const params: AttackParams = {
      cardType,
      knownBlock,
      knownKeyType,
      knownKey,
      targetBlock,
      targetKeyType,
      keyFile: selectedKeyFile
        ? `${cachePathPrefix}/${selectedKeyFile}`
        : undefined,
      slow: slowMode,
    };
    return config.command(params);
  }, [
    cardType,
    knownBlock,
    knownKeyType,
    knownKey,
    targetBlock,
    targetKeyType,
    selectedKeyFile,
    slowMode,
    config,
    cachePathPrefix,
  ]);

  const handleRun = useCallback(() => {
    const cmd = buildCommand();
    onCommand(cmd);
  }, [buildCommand, onCommand]);

  const isValid = useMemo(() => {
    if (config.requiresKnownKey && knownKey.length !== 12) return false;
    if (config.requiresKnownKey && !knownBlock) return false;
    if (config.requiresTargetBlock && !targetBlock) return false;
    return true;
  }, [config, knownKey, knownBlock, targetBlock]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            MIFARE Attacks
            <Badge variant="outline" className="ml-1">
              Key Recovery
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={cardType === "1k" ? "default" : "ghost"}
              onClick={() => setCardType("1k")}
              className="h-7 text-xs px-2"
            >
              1K
            </Button>
            <Button
              size="sm"
              variant={cardType === "4k" ? "default" : "ghost"}
              onClick={() => setCardType("4k")}
              className="h-7 text-xs px-2"
            >
              4K
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {/* Quick Actions */}
        <div className="p-3 bg-secondary/20 border-b">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
            <Zap className="h-3 w-3" />
            Quick Attacks
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_ATTACKS.map((attack) => (
              <Button
                key={attack.label}
                size="sm"
                variant={attack.variant}
                onClick={() => onCommand(attack.command)}
                disabled={disabled}
                className="h-7 text-xs"
              >
                {attack.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Attack Type Tabs */}
        <Tabs
          value={activeAttack}
          onValueChange={(v) => setActiveAttack(v as AttackType)}
          className="flex-1"
        >
          <div className="px-3 pt-3">
            <TabsList className="grid grid-cols-3 lg:grid-cols-6 h-auto gap-1">
              {(Object.entries(ATTACK_CONFIGS) as [AttackType, AttackConfig][]).map(
                ([key, cfg]) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="text-xs py-1.5 px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <span className="flex items-center gap-1">
                      {cfg.icon}
                      <span className="hidden sm:inline">{cfg.label}</span>
                    </span>
                  </TabsTrigger>
                )
              )}
            </TabsList>
          </div>

          {/* Attack Configuration */}
          <div className="p-3 space-y-4">
            {/* Description */}
            <div className="flex items-start gap-2 p-2 bg-secondary/30 rounded text-xs">
              {config.icon}
              <div>
                <span className="font-medium">{config.label}:</span>{" "}
                <span className="text-muted-foreground">{config.description}</span>
              </div>
            </div>

            {/* Known Key Section */}
            {config.requiresKnownKey && (
              <div className="space-y-3">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Key className="h-3 w-3" />
                  Known Key (Source)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Block</label>
                    <Input
                      value={knownBlock}
                      onChange={(e) => handleBlockChange(setKnownBlock)(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Key Type</label>
                    <div className="flex rounded-md overflow-hidden border h-8">
                      <Button
                        size="sm"
                        variant={knownKeyType === "A" ? "default" : "ghost"}
                        onClick={() => setKnownKeyType("A")}
                        className="flex-1 h-full rounded-none text-xs"
                      >
                        A
                      </Button>
                      <Button
                        size="sm"
                        variant={knownKeyType === "B" ? "default" : "ghost"}
                        onClick={() => setKnownKeyType("B")}
                        className="flex-1 h-full rounded-none text-xs"
                      >
                        B
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] text-muted-foreground">Key (12 hex)</label>
                    <Input
                      value={knownKey}
                      onChange={(e) => handleKeyChange(e.target.value)}
                      className={cn(
                        "h-8 text-xs font-mono",
                        knownKey.length === 12
                          ? "border-green-500/50"
                          : "border-amber-500/50"
                      )}
                      placeholder="FFFFFFFFFFFF"
                      maxLength={12}
                    />
                  </div>
                </div>

                {/* Default Keys */}
                <div className="flex flex-wrap gap-1">
                  {DEFAULT_KEYS.slice(0, 4).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant="ghost"
                      onClick={() => setKnownKey(k)}
                      className="h-6 text-[10px] font-mono px-2"
                    >
                      {k}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Target Key Section (for Hardnested) */}
            {config.requiresTargetBlock && (
              <div className="space-y-3">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Target Key
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Block</label>
                    <Input
                      value={targetBlock}
                      onChange={(e) => handleBlockChange(setTargetBlock)(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="4"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Key Type</label>
                    <div className="flex rounded-md overflow-hidden border h-8">
                      <Button
                        size="sm"
                        variant={targetKeyType === "A" ? "default" : "ghost"}
                        onClick={() => setTargetKeyType("A")}
                        className="flex-1 h-full rounded-none text-xs"
                      >
                        A
                      </Button>
                      <Button
                        size="sm"
                        variant={targetKeyType === "B" ? "default" : "ghost"}
                        onClick={() => setTargetKeyType("B")}
                        className="flex-1 h-full rounded-none text-xs"
                      >
                        B
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Key File Section */}
            {(activeAttack === "autopwn" || activeAttack === "chk") && keyFiles.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <FileKey className="h-3 w-3" />
                  Key Dictionary (Optional)
                </label>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant={selectedKeyFile === null ? "secondary" : "ghost"}
                    onClick={() => setSelectedKeyFile(null)}
                    className="h-6 text-[10px]"
                  >
                    Default
                  </Button>
                  {keyFiles.map((kf) => (
                    <Button
                      key={kf.id}
                      size="sm"
                      variant={
                        selectedKeyFile === (kf.relativePath || kf.name)
                          ? "secondary"
                          : "ghost"
                      }
                      onClick={() => setSelectedKeyFile(kf.relativePath || kf.name)}
                      className="h-6 text-[10px]"
                    >
                      {kf.relativePath || kf.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Advanced Options */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Advanced Options</span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")}
              />
            </button>

            {showAdvanced && (
              <div className="space-y-2 p-2 bg-secondary/20 rounded">
                {activeAttack === "hardnested" && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slowMode}
                      onChange={(e) => setSlowMode(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>Slow mode (more reliable, slower)</span>
                  </label>
                )}
                <div className="text-[10px] text-muted-foreground">
                  Command preview:
                  <code className="block mt-1 p-2 bg-background rounded font-mono text-foreground break-all">
                    {buildCommand()}
                  </code>
                </div>
              </div>
            )}

            {/* Run Button */}
            <div className="flex items-center gap-2">
              <Button
                size="lg"
                onClick={handleRun}
                disabled={disabled || !isValid}
                className="flex-1 gap-2"
              >
                <Play className="h-4 w-4" />
                Run {config.label}
              </Button>
            </div>

            {/* Warnings */}
            {activeAttack === "darkside" && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-[10px] text-amber-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Darkside attack can take 5-30 minutes. Ensure stable connection and don't
                  move the card during the attack.
                </span>
              </div>
            )}

            {activeAttack === "hardnested" && (
              <div className="flex items-start gap-2 p-2 bg-blue-500/10 rounded text-[10px] text-blue-400">
                <Shield className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Hardnested works on cards with hardened PRNG. It requires one known key
                  and recovers one target key per run.
                </span>
              </div>
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default MifareAttacksPanel;
