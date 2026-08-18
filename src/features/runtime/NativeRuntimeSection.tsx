import { useState } from "react";
import { CheckCircle2, Cpu, Loader2, Play, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import {
  combineNativePm3Output,
  nativePm3Supported,
  probeNativePm3,
  runNativePm3,
  type NativePm3Probe,
} from "./nativePm3";

interface NativeRuntimeSectionProps {
  binaryPath: string;
  port: string;
  onBinaryPathChange: (value: string) => void;
  onPortChange: (value: string) => void;
  onLog?: (message: string) => void;
}

export function NativeRuntimeSection({
  binaryPath,
  port,
  onBinaryPathChange,
  onPortChange,
  onLog,
}: NativeRuntimeSectionProps) {
  const supported = nativePm3Supported();
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<NativePm3Probe | null>(null);
  const [output, setOutput] = useState("");

  const inspect = async () => {
    setBusy(true);
    setOutput("");
    try {
      setProbe(await probeNativePm3(binaryPath));
    } catch (error) {
      setProbe({
        available: false,
        path: null,
        version: null,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const runHealthCheck = async () => {
    setBusy(true);
    setOutput("");
    try {
      const result = await runNativePm3({ binaryPath, port }, "hw version");
      const text = combineNativePm3Output(result);
      setOutput(text || `PM3 exited with code ${result.exitCode ?? "unknown"}.`);
      onLog?.(`[Native PM3] hw version ${result.success ? "completed" : "failed"}`);
      if (text) text.split(/\r?\n/).forEach((line) => onLog?.(line));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutput(message);
      onLog?.(`[Native PM3] ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection icon={<Cpu className="h-3 w-3" />} title="Native desktop runtime">
      <div className="space-y-3 rounded-lg border bg-secondary/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Installed PM3 client</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Optional one-shot runner for the desktop app. It uses a PM3 client already installed
              on this computer; this app does not bundle or download a native executable.
            </p>
          </div>
          <Badge variant={supported ? "outline" : "secondary"}>
            {supported ? "Desktop" : "Desktop only"}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Executable (optional absolute path)</span>
            <Input
              value={binaryPath}
              onChange={(event) => onBinaryPathChange(event.target.value)}
              placeholder="Search PATH, or /opt/homebrew/bin/proxmark3"
              disabled={!supported || busy}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Serial port</span>
            <Input
              value={port}
              onChange={(event) => onPortChange(event.target.value)}
              placeholder="/dev/cu.usbmodemiceman1"
              disabled={!supported || busy}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void inspect()}
            disabled={!supported || busy}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Detect client
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runHealthCheck()}
            disabled={!supported || busy || !port.trim() || probe?.available !== true}
          >
            <Play className="h-3 w-3" /> Run native health check
          </Button>
        </div>

        {probe ? (
          <div
            className={`flex items-start gap-2 rounded-md border p-2 text-xs ${probe.available ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}`}
          >
            {probe.available ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <div>
              <p>
                {probe.available ? probe.version || "Installed PM3 client detected" : probe.error}
              </p>
              {probe.path ? (
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {probe.path}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {output ? (
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-2 text-[11px]">
            {output}
          </pre>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Close any active browser/WASM serial connection before running the installed client; a
          serial port can be owned by only one PM3 client at a time.
        </p>
      </div>
    </SettingsSection>
  );
}
