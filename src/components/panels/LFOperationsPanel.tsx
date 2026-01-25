import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Radio,
  Search,
  Download,
  Activity,
  Settings,
  RefreshCw,
  Sliders,
  Zap,
  ChevronDown,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LFOperationsPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

interface LFConfig {
  divisor: number;
  bitsPerSample: number;
  decimation: number;
  averaging: boolean;
  triggerThreshold: number;
  samplesToSkip: number;
}

const DEFAULT_CONFIG: LFConfig = {
  divisor: 95, // 125kHz
  bitsPerSample: 8,
  decimation: 1,
  averaging: true,
  triggerThreshold: 0,
  samplesToSkip: 0,
};

const FREQUENCY_PRESETS = [
  { label: "125 kHz", divisor: 95 },
  { label: "134 kHz", divisor: 88 },
];

// Calculate frequency from divisor: freq = 12000 / (divisor + 1)
function divisorToFreq(divisor: number): number {
  return 12000 / (divisor + 1);
}

// Calculate divisor from frequency
function freqToDivisor(freq: number): number {
  return Math.round(12000 / freq - 1);
}

export function LFOperationsPanel({ onCommand, disabled = false }: LFOperationsPanelProps) {
  const [config, setConfig] = useState<LFConfig>(DEFAULT_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [samples, setSamples] = useState("40000");

  const frequency = useMemo(() => divisorToFreq(config.divisor), [config.divisor]);

  const handleDivisorChange = useCallback((value: number) => {
    const clamped = Math.max(19, Math.min(255, value));
    setConfig((prev) => ({ ...prev, divisor: clamped }));
  }, []);

  const handleFrequencyPreset = useCallback((divisor: number) => {
    setConfig((prev) => ({ ...prev, divisor }));
  }, []);

  const handleConfigChange = useCallback(
    <K extends keyof LFConfig>(key: K, value: LFConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleGetConfig = useCallback(() => {
    onCommand("hw status");
  }, [onCommand]);

  const handleSetConfig = useCallback(() => {
    const cmd = `lf config -d ${config.divisor} -b ${config.bitsPerSample} -c ${config.decimation} -a ${config.averaging ? 1 : 0} -t ${config.triggerThreshold} -s ${config.samplesToSkip}`;
    onCommand(cmd);
    onCommand(`hw setlfdivisor ${config.divisor}`);
  }, [onCommand, config]);

  const handleResetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    onCommand("lf config -d 95 -b 8 -c 1 -a 1 -t 0 -s 0");
  }, [onCommand]);

  const handleSearch = useCallback(() => {
    onCommand("lf search");
  }, [onCommand]);

  const handleRead = useCallback(() => {
    onCommand(`lf read -s ${samples}`);
    onCommand("data plot");
  }, [onCommand, samples]);

  const handleSniff = useCallback(() => {
    onCommand(`lf sniff -s ${samples}`);
    onCommand("data plot");
  }, [onCommand, samples]);

  const handleTune = useCallback(() => {
    onCommand(`hw tune --lf --divisor ${config.divisor}`);
  }, [onCommand, config.divisor]);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            LF Operations
            <Badge variant="outline" className="ml-1">
              Low Frequency
            </Badge>
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">
            {frequency.toFixed(1)} kHz
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
        {/* Frequency Configuration */}
        <div className="p-3 bg-secondary/20 border-b space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Frequency
            </label>
            <div className="flex gap-1">
              {FREQUENCY_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  variant={config.divisor === preset.divisor ? "default" : "outline"}
                  onClick={() => handleFrequencyPreset(preset.divisor)}
                  className="h-6 text-[10px] px-2"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Divisor Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Divisor</span>
              <span className="font-mono">{config.divisor}</span>
            </div>
            <input
              type="range"
              min={19}
              max={255}
              value={config.divisor}
              onChange={(e) => handleDivisorChange(parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>~600 kHz</span>
              <span>~47 kHz</span>
            </div>
          </div>

          {/* Manual Divisor Input */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={19}
              max={255}
              value={config.divisor}
              onChange={(e) => handleDivisorChange(parseInt(e.target.value) || 95)}
              className="h-8 w-20 text-xs font-mono"
            />
            <span className="text-xs text-muted-foreground">
              = {frequency.toFixed(3)} kHz
            </span>
          </div>
        </div>

        {/* Main Operations */}
        <div className="p-3 space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Operations
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              onClick={handleSearch}
              disabled={disabled}
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              <Search className="h-5 w-5" />
              <span className="text-xs font-medium">Search</span>
              <span className="text-[9px] text-muted-foreground">Auto-detect tag</span>
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={handleTune}
              disabled={disabled}
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              <Volume2 className="h-5 w-5" />
              <span className="text-xs font-medium">Tune</span>
              <span className="text-[9px] text-muted-foreground">Antenna check</span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleRead}
              disabled={disabled}
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              <Download className="h-5 w-5" />
              <span className="text-xs font-medium">Read</span>
              <span className="text-[9px] text-muted-foreground">Field ON</span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleSniff}
              disabled={disabled}
              className="h-auto py-3 flex flex-col items-center gap-1"
            >
              <Radio className="h-5 w-5" />
              <span className="text-xs font-medium">Sniff</span>
              <span className="text-[9px] text-muted-foreground">Field OFF</span>
            </Button>
          </div>

          {/* Samples Input */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Samples:</label>
            <Input
              type="number"
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
              className="h-7 w-24 text-xs font-mono"
              min={1000}
              max={100000}
              step={1000}
            />
          </div>
        </div>

        <Separator />

        {/* Advanced Configuration */}
        <div className="border-t">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sliders className="h-3 w-3 text-amber-500" />
              <span className="font-medium">Advanced Configuration</span>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")}
            />
          </button>

          {showAdvanced && (
            <div className="p-3 bg-secondary/20 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Bits per Sample</label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={config.bitsPerSample}
                    onChange={(e) =>
                      handleConfigChange("bitsPerSample", parseInt(e.target.value) || 8)
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Decimation</label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={config.decimation}
                    onChange={(e) =>
                      handleConfigChange("decimation", parseInt(e.target.value) || 1)
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Trigger Threshold</label>
                  <Input
                    type="number"
                    min={0}
                    max={128}
                    value={config.triggerThreshold}
                    onChange={(e) =>
                      handleConfigChange("triggerThreshold", parseInt(e.target.value) || 0)
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Samples to Skip</label>
                  <Input
                    type="number"
                    min={0}
                    max={65535}
                    value={config.samplesToSkip}
                    onChange={(e) =>
                      handleConfigChange("samplesToSkip", parseInt(e.target.value) || 0)
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.averaging}
                  onChange={(e) => handleConfigChange("averaging", e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Enable Averaging</span>
              </label>

              {/* Config Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGetConfig}
                  disabled={disabled}
                  className="flex-1 gap-1"
                >
                  <Download className="h-3 w-3" />
                  Get Config
                </Button>
                <Button
                  size="sm"
                  onClick={handleSetConfig}
                  disabled={disabled}
                  className="flex-1 gap-1"
                >
                  <Settings className="h-3 w-3" />
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetConfig}
                  className="gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </Button>
              </div>

              {/* Config Preview */}
              <div className="p-2 bg-background rounded border">
                <code className="text-[10px] font-mono text-muted-foreground break-all">
                  lf config -d {config.divisor} -b {config.bitsPerSample} -c {config.decimation} -a{" "}
                  {config.averaging ? 1 : 0} -t {config.triggerThreshold} -s {config.samplesToSkip}
                </code>
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
              onClick={() => onCommand("lf t55xx detect")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              T55xx Detect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("lf em 410x reader")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              EM410x Read
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("lf hid read")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              HID Read
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("lf awid read")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              AWID Read
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCommand("data plot")}
              disabled={disabled}
              className="h-6 text-[10px]"
            >
              Plot Data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LFOperationsPanel;
