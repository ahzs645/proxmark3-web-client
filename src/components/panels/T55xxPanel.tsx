import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Cpu,
  Copy,
  Download,
  Upload,
  Trash2,
  Search,
  Key,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface T55xxPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

type ChipType = "t55x7" | "t5555";

const CHIP_TYPES: Record<ChipType, { label: string; flag: string }> = {
  t55x7: { label: "T55x7", flag: "1" },
  t5555: { label: "T5555", flag: "0" },
};

const CLOCK_RATES = [16, 32, 40, 50, 64];

const DEFAULT_PASSWORDS = [
  "00000000",
  "51243648",
  "20206666",
  "50524F58",
  "AA55BBBB",
  "A0A1A2A3",
  "5A5A5A5A",
  "31415926",
];

function validateEM410xId(id: string): boolean {
  const clean = id.replace(/\s/g, "").toUpperCase();
  return /^[0-9A-F]{10}$/.test(clean);
}

export function T55xxPanel({ onCommand, disabled = false }: T55xxPanelProps) {
  // EM410x state
  const [emId, setEmId] = useState("");
  const [chipType, setChipType] = useState<ChipType>("t55x7");
  const [clockRate, setClockRate] = useState(64);

  // T55xx state
  const [password, setPassword] = useState("00000000");
  const [usePassword, setUsePassword] = useState(false);
  const [blockNumber, setBlockNumber] = useState("0");
  const [blockData, setBlockData] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isEmIdValid = validateEM410xId(emId);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleEmIdChange = useCallback((value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 10);
    setEmId(sanitized);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 8);
    setPassword(sanitized);
  }, []);

  const handleBlockDataChange = useCallback((value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 8);
    setBlockData(sanitized);
  }, []);

  // EM410x Operations
  const handleReadEM410x = useCallback(() => {
    onCommand("lf em 410x reader");
  }, [onCommand]);

  const handleCloneEM410x = useCallback(() => {
    if (!isEmIdValid) return;
    const cmd = `lf em 410x clone --id ${emId}`;
    onCommand(cmd);
  }, [onCommand, emId, isEmIdValid]);

  // T55xx Operations
  const handleDetect = useCallback(() => {
    const cmd = usePassword ? `lf t55xx detect -p ${password}` : "lf t55xx detect";
    onCommand(cmd);
  }, [onCommand, usePassword, password]);

  const handleDump = useCallback(() => {
    const cmd = usePassword ? `lf t55xx dump -p ${password}` : "lf t55xx dump";
    onCommand(cmd);
  }, [onCommand, usePassword, password]);

  const handleReadBlock = useCallback(() => {
    const cmd = usePassword
      ? `lf t55xx read -b ${blockNumber} -p ${password}`
      : `lf t55xx read -b ${blockNumber}`;
    onCommand(cmd);
  }, [onCommand, blockNumber, usePassword, password]);

  const handleWriteBlock = useCallback(() => {
    if (blockData.length !== 8) return;
    const cmd = usePassword
      ? `lf t55xx write -b ${blockNumber} -d ${blockData} -p ${password}`
      : `lf t55xx write -b ${blockNumber} -d ${blockData}`;
    onCommand(cmd);
  }, [onCommand, blockNumber, blockData, usePassword, password]);

  const handleWipe = useCallback(() => {
    const cmd = usePassword ? `lf t55xx wipe -p ${password}` : "lf t55xx wipe";
    onCommand(cmd);
  }, [onCommand, usePassword, password]);

  const handleTryPasswords = useCallback(() => {
    onCommand("lf t55xx chk");
  }, [onCommand]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            T55xx / EM410x
            <Badge variant="outline" className="ml-1">
              LF Cloning
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDetect}
            disabled={disabled}
            className="h-7 text-xs gap-1"
          >
            <Search className="h-3 w-3" />
            Detect
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {/* EM410x Section */}
        <div className="p-3 space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Zap className="h-3 w-3" />
            EM410x Clone
          </label>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReadEM410x}
              disabled={disabled}
              className="gap-1"
            >
              <Download className="h-3 w-3" />
              Read
            </Button>
            <Input
              value={emId}
              onChange={(e) => handleEmIdChange(e.target.value)}
              placeholder="EM410x ID (10 hex)"
              className={cn(
                "font-mono text-xs flex-1",
                isEmIdValid ? "border-green-500/50" : emId.length > 0 ? "border-red-500/50" : ""
              )}
              maxLength={10}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(emId)}
              disabled={!emId}
              className="shrink-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>

          {/* Clone Options */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Target:</span>
              <div className="flex rounded-md overflow-hidden border">
                {(Object.entries(CHIP_TYPES) as [ChipType, typeof CHIP_TYPES[ChipType]][]).map(
                  ([key, cfg]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={chipType === key ? "default" : "ghost"}
                      onClick={() => setChipType(key)}
                      className="h-7 rounded-none text-xs px-3"
                    >
                      {cfg.label}
                    </Button>
                  )
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Clock:</span>
              <select
                value={clockRate}
                onChange={(e) => setClockRate(parseInt(e.target.value))}
                className="h-7 rounded border bg-background px-2 text-xs"
              >
                {CLOCK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            onClick={handleCloneEM410x}
            disabled={disabled || !isEmIdValid}
            className="w-full gap-2"
          >
            <Upload className="h-4 w-4" />
            Clone to {CHIP_TYPES[chipType].label}
          </Button>
        </div>

        <Separator />

        {/* T55xx Section */}
        <div className="p-3 space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            T55xx Operations
          </label>

          {/* Password */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>Use Password</span>
            </label>
            {usePassword && (
              <Input
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Password (8 hex)"
                className="font-mono text-xs w-28"
                maxLength={8}
              />
            )}
          </div>

          {/* Default Passwords */}
          {usePassword && (
            <div className="flex flex-wrap gap-1">
              {DEFAULT_PASSWORDS.slice(0, 4).map((pwd) => (
                <Button
                  key={pwd}
                  size="sm"
                  variant="ghost"
                  onClick={() => setPassword(pwd)}
                  className="h-5 text-[9px] font-mono px-1.5"
                >
                  {pwd}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleTryPasswords}
                disabled={disabled}
                className="h-5 text-[9px] px-1.5"
              >
                <Key className="h-2.5 w-2.5 mr-1" />
                Try All
              </Button>
            </div>
          )}

          {/* Main Operations */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDetect}
              disabled={disabled}
              className="gap-1"
            >
              <Search className="h-3 w-3" />
              Detect
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDump}
              disabled={disabled}
              className="gap-1"
            >
              <Download className="h-3 w-3" />
              Dump
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleWipe}
              disabled={disabled}
              className="gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Wipe
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCommand("lf t55xx info")}
              disabled={disabled}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Info
            </Button>
          </div>
        </div>

        <Separator />

        {/* Block Operations */}
        <div className="border-t">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Cpu className="h-3 w-3 text-amber-500" />
              <span className="font-medium">Block Read/Write</span>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")}
            />
          </button>

          {showAdvanced && (
            <div className="p-3 bg-secondary/20 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Block (0-7)</label>
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    value={blockNumber}
                    onChange={(e) => setBlockNumber(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Data (8 hex)</label>
                  <Input
                    value={blockData}
                    onChange={(e) => handleBlockDataChange(e.target.value)}
                    placeholder="00000000"
                    className="h-8 text-xs font-mono"
                    maxLength={8}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReadBlock}
                  disabled={disabled}
                  className="flex-1 gap-1"
                >
                  <Download className="h-3 w-3" />
                  Read Block
                </Button>
                <Button
                  size="sm"
                  onClick={handleWriteBlock}
                  disabled={disabled || blockData.length !== 8}
                  className="flex-1 gap-1"
                >
                  <Upload className="h-3 w-3" />
                  Write Block
                </Button>
              </div>

              {/* Block 0 Config Info */}
              <div className="p-2 bg-background rounded border text-[10px] text-muted-foreground">
                <strong>Block 0 (Config):</strong> Contains modulation, bit rate, and password settings.
                <br />
                <strong>Block 7:</strong> Password block (if password protection enabled).
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Commands */}
        <div className="p-3 space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Quick Commands
          </label>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("lf t55xx config")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              Show Config
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("lf t55xx trace")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              Trace
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("lf t55xx restore")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("lf search")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              LF Search
            </Button>
          </div>
        </div>

        {/* Warning */}
        <div className="p-3">
          <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-[10px] text-amber-400">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Writing incorrect Block 0 configuration can make the card unusable. Always dump
              the card first and save a backup.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default T55xxPanel;
