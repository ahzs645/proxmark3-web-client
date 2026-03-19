import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Wand2,
  CreditCard,
  Key,
  Lock,
  Unlock,
  Trash2,
  Copy,
  RefreshCw,
  AlertTriangle,
  Shuffle,
  ChevronDown,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MagicCardType = "gen1a" | "gen2" | "gen3" | "gen4" | "unknown";
type KeyType = "A" | "B";

interface MagicCardPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
  currentUid?: string;
  currentAtqa?: string;
  currentSak?: string;
}

const CARD_TYPES: Record<MagicCardType, { label: string; description: string; color: string }> = {
  gen1a: {
    label: "Gen1a",
    description: "Chinese Magic Card with backdoor commands",
    color: "text-blue-400",
  },
  gen2: {
    label: "Gen2 (CUID)",
    description: "Direct writable Block 0, no backdoor needed",
    color: "text-green-400",
  },
  gen3: {
    label: "Gen3 (APDU)",
    description: "Block 0 writable via APDU commands",
    color: "text-amber-400",
  },
  gen4: {
    label: "Gen4 (GTU)",
    description: "Ultimate magic card with password protection",
    color: "text-purple-400",
  },
  unknown: {
    label: "Unknown",
    description: "Card type not detected",
    color: "text-muted-foreground",
  },
};

// Common SAK values for MIFARE cards
const SAK_PRESETS = [
  { value: "08", label: "Classic 1K" },
  { value: "18", label: "Classic 4K" },
  { value: "09", label: "Mini" },
  { value: "01", label: "Pro" },
  { value: "00", label: "Ultralight" },
  { value: "20", label: "Plus/DESFire" },
];


function calculateBcc(uid: string): string {
  const bytes = uid.match(/.{2}/g) || [];
  if (bytes.length < 4) return "??";
  let bcc = 0;
  for (let i = 0; i < 4; i++) {
    bcc ^= parseInt(bytes[i], 16);
  }
  return bcc.toString(16).padStart(2, "0").toUpperCase();
}

function generateRandomUid(length: 4 | 7 | 10 = 4): string {
  const bytes: string[] = [];
  for (let i = 0; i < length; i++) {
    bytes.push(Math.floor(Math.random() * 256).toString(16).padStart(2, "0"));
  }
  return bytes.join("").toUpperCase();
}

function validateUid(uid: string): { valid: boolean; error?: string } {
  const clean = uid.replace(/\s/g, "").toUpperCase();
  if (!/^[0-9A-F]*$/.test(clean)) {
    return { valid: false, error: "Invalid hex characters" };
  }
  if (clean.length !== 8 && clean.length !== 14 && clean.length !== 20) {
    return { valid: false, error: "UID must be 4, 7, or 10 bytes" };
  }
  return { valid: true };
}

export function MagicCardPanel({
  onCommand,
  disabled = false,
  currentUid = "",
  currentAtqa = "0004",
  currentSak = "08",
}: MagicCardPanelProps) {
  const [cardType, setCardType] = useState<MagicCardType>("gen1a");
  const [uid, setUid] = useState(currentUid || "");
  const [atqa, setAtqa] = useState(currentAtqa);
  const [sak, setSak] = useState(currentSak);
  const [gen4Password, setGen4Password] = useState("00000000");
  const [authKey, setAuthKey] = useState("FFFFFFFFFFFF");
  const [authKeyType, setAuthKeyType] = useState<KeyType>("A");
  const [showBlock0Builder, setShowBlock0Builder] = useState(false);

  // Block 0 builder
  const [block0Uid, setBlock0Uid] = useState("");
  const [block0Bcc, setBlock0Bcc] = useState("");
  const [block0Sak, setBlock0Sak] = useState("08");
  const [block0Atqa, setBlock0Atqa] = useState("0004");
  const [block0Manufacturer, setBlock0Manufacturer] = useState("00000000000000");

  const uidValidation = useMemo(() => validateUid(uid), [uid]);
  const calculatedBcc = useMemo(() => calculateBcc(block0Uid), [block0Uid]);

  const handleUidChange = useCallback((value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 20);
    setUid(sanitized);
  }, []);

  const handleRandomUid = useCallback(() => {
    const length = uid.length === 14 ? 7 : uid.length === 20 ? 10 : 4;
    setUid(generateRandomUid(length));
  }, [uid.length]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Build Block 0 preview
  const block0Preview = useMemo(() => {
    const paddedUid = block0Uid.padEnd(8, "0").slice(0, 8);
    const bcc = block0Bcc || calculatedBcc;
    const paddedSak = block0Sak.padStart(2, "0").slice(0, 2);
    // ATQA is stored reversed in block 0
    const atqaBytes = block0Atqa.padStart(4, "0").slice(0, 4);
    const atqaReversed = atqaBytes.slice(2, 4) + atqaBytes.slice(0, 2);
    const mfr = block0Manufacturer.padEnd(14, "0").slice(0, 14);
    return `${paddedUid}${bcc}${paddedSak}${atqaReversed}${mfr}`.toUpperCase();
  }, [block0Uid, block0Bcc, calculatedBcc, block0Sak, block0Atqa, block0Manufacturer]);

  // Commands based on card type
  const handleDetect = useCallback(() => {
    onCommand("hf mf info");
  }, [onCommand]);

  const handleSetUid = useCallback(() => {
    if (!uidValidation.valid) return;

    switch (cardType) {
      case "gen1a":
        onCommand(`hf mf csetuid -u ${uid}`);
        break;
      case "gen2":
        // Gen2 writes directly to block 0 with standard auth
        onCommand(`hf mf csetuid -u ${uid} --atqa ${atqa} --sak ${sak}`);
        break;
      case "gen3":
        onCommand(`hf mf gen3uid -u ${uid}`);
        break;
      case "gen4":
        onCommand(`hf mf gdmsetuid -u ${uid} -p ${gen4Password}`);
        break;
    }
  }, [cardType, uid, atqa, sak, gen4Password, uidValidation.valid, onCommand]);

  const handleWriteBlock0 = useCallback(() => {
    if (block0Preview.length !== 32) return;

    switch (cardType) {
      case "gen1a":
        onCommand(`hf mf csetblk --blk 0 -d ${block0Preview}`);
        break;
      case "gen2":
        onCommand(`hf mf wrbl 0 ${authKeyType.toLowerCase()} ${authKey} ${block0Preview}`);
        break;
      case "gen4":
        onCommand(`hf mf gdmsetblk --blk 0 -d ${block0Preview} -p ${gen4Password}`);
        break;
      default:
        onCommand(`hf mf csetblk --blk 0 -d ${block0Preview}`);
    }
  }, [cardType, block0Preview, authKeyType, authKey, gen4Password, onCommand]);

  const handleUnlock = useCallback(() => {
    switch (cardType) {
      case "gen1a":
        // Gen1a unlock sequence
        onCommand("hf 14a raw -a -k -b 7 40");
        onCommand("hf 14a raw -a -k 43");
        break;
      case "gen4":
        onCommand(`hf mf gdmcfg -p ${gen4Password}`);
        break;
    }
  }, [cardType, gen4Password, onCommand]);

  const handleWipe = useCallback(() => {
    switch (cardType) {
      case "gen1a":
        onCommand("hf mf cwipe");
        break;
      case "gen2":
        onCommand("hf mf cwipe --gen2");
        break;
      case "gen4":
        onCommand(`hf mf gdmwipe -p ${gen4Password}`);
        break;
      default:
        onCommand("hf mf cwipe");
    }
  }, [cardType, gen4Password, onCommand]);

  const typeConfig = CARD_TYPES[cardType];

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Magic Card Operations
            <Badge variant="outline" className="ml-1">
              UID Writable
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetect}
            disabled={disabled}
            className="h-7 text-xs gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Detect
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {/* Card Type Selector */}
        <div className="p-3 bg-secondary/20 border-b space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Card Type:</label>
            <div className="flex flex-wrap rounded-md overflow-hidden border">
              {(Object.entries(CARD_TYPES) as [MagicCardType, typeof CARD_TYPES[MagicCardType]][])
                .filter(([key]) => key !== "unknown")
                .map(([key, cfg]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={cardType === key ? "default" : "ghost"}
                    onClick={() => setCardType(key)}
                    className="h-7 rounded-none text-xs px-3"
                  >
                    {cfg.label}
                  </Button>
                ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CreditCard className={cn("h-3 w-3", typeConfig.color)} />
            {typeConfig.description}
          </p>
        </div>

        {/* UID Section */}
        <div className="p-3 space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Key className="h-3 w-3" />
            Set UID
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground">UID (4/7/10 bytes)</label>
              <div className="flex gap-2">
                <Input
                  value={uid}
                  onChange={(e) => handleUidChange(e.target.value)}
                  placeholder="12345678"
                  className={cn(
                    "font-mono text-xs",
                    uidValidation.valid ? "border-green-500/50" : uid.length > 0 ? "border-red-500/50" : ""
                  )}
                  maxLength={20}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleRandomUid}
                  title="Generate random UID"
                  className="shrink-0"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(uid)}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {!uidValidation.valid && uid.length > 0 && (
                <p className="text-[10px] text-red-400">{uidValidation.error}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground">ATQA</label>
                <div className="flex gap-1">
                  <Input
                    value={atqa}
                    onChange={(e) => setAtqa(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 4))}
                    placeholder="0004"
                    className="font-mono text-xs"
                    maxLength={4}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground">SAK</label>
                <Input
                  value={sak}
                  onChange={(e) => setSak(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 2))}
                  placeholder="08"
                  className="font-mono text-xs"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1">
            {SAK_PRESETS.slice(0, 4).map((preset) => (
              <Button
                key={preset.value}
                size="sm"
                variant="ghost"
                onClick={() => setSak(preset.value)}
                className="h-5 text-[9px] px-1.5"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Gen4 Password */}
          {cardType === "gen4" && (
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground">Gen4 Password (4 bytes)</label>
              <Input
                value={gen4Password}
                onChange={(e) =>
                  setGen4Password(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 8))
                }
                placeholder="00000000"
                className="font-mono text-xs w-32"
                maxLength={8}
              />
            </div>
          )}

          <Button
            onClick={handleSetUid}
            disabled={disabled || !uidValidation.valid}
            className="w-full gap-2"
          >
            <Zap className="h-4 w-4" />
            Write UID
          </Button>
        </div>

        <Separator />

        {/* Block 0 Builder */}
        <div className="border-t">
          <button
            onClick={() => setShowBlock0Builder(!showBlock0Builder)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-amber-500" />
              <span className="font-medium">Block 0 Builder (Advanced)</span>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showBlock0Builder && "rotate-180")}
            />
          </button>

          {showBlock0Builder && (
            <div className="p-3 bg-secondary/20 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">UID (4 bytes)</label>
                  <Input
                    value={block0Uid}
                    onChange={(e) =>
                      setBlock0Uid(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 8))
                    }
                    placeholder="12345678"
                    className="h-8 text-xs font-mono"
                    maxLength={8}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">BCC</label>
                  <Input
                    value={block0Bcc || calculatedBcc}
                    onChange={(e) =>
                      setBlock0Bcc(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 2))
                    }
                    placeholder="Auto"
                    className="h-8 text-xs font-mono"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">SAK</label>
                  <Input
                    value={block0Sak}
                    onChange={(e) =>
                      setBlock0Sak(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 2))
                    }
                    placeholder="08"
                    className="h-8 text-xs font-mono"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">ATQA</label>
                  <Input
                    value={block0Atqa}
                    onChange={(e) =>
                      setBlock0Atqa(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 4))
                    }
                    placeholder="0004"
                    className="h-8 text-xs font-mono"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Manufacturer Data (7 bytes)</label>
                <Input
                  value={block0Manufacturer}
                  onChange={(e) =>
                    setBlock0Manufacturer(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 14))
                  }
                  placeholder="00000000000000"
                  className="h-8 text-xs font-mono"
                  maxLength={14}
                />
              </div>

              {/* Block 0 Preview */}
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <Badge variant="outline" className="text-[10px]">Block 0</Badge>
                <code className="text-[11px] font-mono flex-1 break-all">
                  <span className="text-blue-400">{block0Preview.slice(0, 8)}</span>
                  <span className="text-amber-400">{block0Preview.slice(8, 10)}</span>
                  <span className="text-green-400">{block0Preview.slice(10, 14)}</span>
                  <span className="text-muted-foreground">{block0Preview.slice(14)}</span>
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(block0Preview)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex gap-4 text-[9px] text-muted-foreground">
                <span><span className="text-blue-400">UID</span></span>
                <span><span className="text-amber-400">BCC</span></span>
                <span><span className="text-green-400">SAK+ATQA</span></span>
                <span><span className="text-muted-foreground">Manufacturer</span></span>
              </div>

              {/* Auth for Gen2 */}
              {cardType === "gen2" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Auth:</span>
                  <Input
                    value={authKey}
                    onChange={(e) =>
                      setAuthKey(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 12))
                    }
                    className="h-7 w-32 text-xs font-mono"
                    maxLength={12}
                  />
                  <div className="flex rounded-md overflow-hidden border">
                    <Button
                      size="sm"
                      variant={authKeyType === "A" ? "default" : "ghost"}
                      onClick={() => setAuthKeyType("A")}
                      className="h-7 w-8 rounded-none text-xs"
                    >
                      A
                    </Button>
                    <Button
                      size="sm"
                      variant={authKeyType === "B" ? "default" : "ghost"}
                      onClick={() => setAuthKeyType("B")}
                      className="h-7 w-8 rounded-none text-xs"
                    >
                      B
                    </Button>
                  </div>
                </div>
              )}

              <Button
                size="sm"
                onClick={handleWriteBlock0}
                disabled={disabled || block0Preview.length !== 32}
                className="w-full gap-2"
              >
                <Shield className="h-3 w-3" />
                Write Block 0
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Operations */}
        <div className="p-3 space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Quick Operations
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleUnlock}
              disabled={disabled || (cardType !== "gen1a" && cardType !== "gen4")}
              className="gap-1"
            >
              <Unlock className="h-3 w-3" />
              Unlock
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCommand("hf mf cview")}
              disabled={disabled}
              className="gap-1"
            >
              <CreditCard className="h-3 w-3" />
              View Card
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleWipe}
              disabled={disabled}
              className="gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Wipe Card
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCommand("hf mf cload")}
              disabled={disabled}
              className="gap-1"
            >
              <Lock className="h-3 w-3" />
              Load Dump
            </Button>
          </div>
        </div>

        {/* Warning */}
        <div className="p-3">
          <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-[10px] text-amber-400">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Magic cards are for educational purposes. Cloning access cards without authorization
              may be illegal in your jurisdiction.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MagicCardPanel;
