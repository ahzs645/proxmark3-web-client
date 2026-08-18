import { useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, Loader2, RefreshCw, Usb, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TransportType } from "@/lib/transports";
import { SettingsSection } from "@/features/settings/components/SettingsSection";
import { FIRMWARE_SOURCE } from "./api";
import { useFirmwareUpdater } from "./useFirmwareUpdater";
import { firmwareVersionsMatch } from "./health";

const CONFIRMATION_TEXT = "FLASH PM3";

function platformLabel(platform: string) {
  if (platform === "PM3GENERIC") return "PM3 Easy / Generic";
  if (platform === "PM3RDV4") return "Proxmark3 RDV4";
  return "Unknown hardware";
}

interface FirmwareUpdateSectionProps {
  isDeviceConnected: boolean;
  activeTransportType: TransportType | null;
  onDisconnectApplication: () => Promise<void>;
  onReconnectApplication: () => Promise<boolean>;
  onLog?: (message: string) => void;
}

export function FirmwareUpdateSection({
  isDeviceConnected,
  activeTransportType,
  onDisconnectApplication,
  onReconnectApplication,
  onLog,
}: FirmwareUpdateSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const updater = useFirmwareUpdater({
    isDeviceConnected,
    activeTransportType,
    disconnectApplication: onDisconnectApplication,
    reconnectApplication: onReconnectApplication,
    onLog,
  });
  const isComplete = updater.progress.phase === "complete";
  const isActive = updater.busy || isComplete || updater.progress.phase === "error";
  const destructivePhase = !["idle", "inspecting", "downloading", "error", "complete"].includes(
    updater.progress.phase,
  );

  return (
    <>
      <SettingsSection icon={<Cpu className="h-3 w-3" />} title="Reader Firmware">
        <div className="space-y-3 rounded-lg border bg-secondary/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Proxmark3 firmware updater</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Identifies the connected hardware, selects only compatible firmware, verifies both
                SHA-256 checksums and ELF flash ranges, then verifies the installed version.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              Web Serial
            </Badge>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Remove cards before updating. Never unplug the reader after a flash write begins.
              Bootloader recovery instructions appear if reconnecting fails.
            </span>
          </div>

          {updater.manifestError ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <span>{updater.manifestError}</span>
              <Button size="sm" variant="outline" onClick={() => void updater.reloadManifest()}>
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void updater.inspect()}
              disabled={updater.busy}
            >
              {updater.progress.phase === "inspecting" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Usb className="h-3 w-3" />
              )}
              {updater.inspection ? "Inspect Again" : "Inspect Reader"}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Inspection is read-only and temporarily releases the terminal connection.
            </span>
          </div>

          {updater.inspection ? (
            <div className="space-y-2">
              <div className="grid gap-2 rounded-md border bg-background/60 p-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Hardware</span>
                  <p className="font-medium">{platformLabel(updater.inspection.platform)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mode</span>
                  <p className="font-medium capitalize">{updater.inspection.mode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Firmware</span>
                  <p className="font-mono">
                    {updater.inspection.firmware?.version || "Unknown"}
                    {updater.inspection.firmware?.buildDate
                      ? ` (${updater.inspection.firmware.buildDate})`
                      : ""}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bootrom</span>
                  <p className="font-mono">
                    {updater.inspection.bootrom?.version || updater.inspection.bootloaderType}
                  </p>
                </div>
              </div>
              <div
                className={`rounded-md border p-2 text-xs ${
                  updater.firmwareHealth.level === "recovery"
                    ? "border-destructive/40 bg-destructive/10"
                    : updater.firmwareHealth.level === "attention"
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-emerald-500/30 bg-emerald-500/10"
                }`}
              >
                <p className="font-medium">{updater.firmwareHealth.title}</p>
                {updater.firmwareHealth.details.map((detail) => (
                  <p key={detail} className="mt-1 text-muted-foreground">
                    {detail}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {updater.compatibleFirmware.length > 0 ? (
            <div className="space-y-2">
              {updater.compatibleFirmware.map((firmware) => {
                const selected = firmware.id === updater.selectedFirmwareId;
                const installed =
                  Boolean(updater.inspection?.firmware?.version) &&
                  Boolean(updater.inspection?.bootrom?.version) &&
                  firmwareVersionsMatch(
                    updater.inspection?.firmware?.version ?? "",
                    firmware.version,
                  ) &&
                  firmwareVersionsMatch(
                    updater.inspection?.bootrom?.version ?? "",
                    firmware.version,
                  );
                return (
                  <button
                    key={firmware.id}
                    type="button"
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selected ? "border-primary bg-primary/5" : "hover:bg-secondary/40"
                    }`}
                    onClick={() => updater.setSelectedFirmwareId(firmware.id)}
                    disabled={updater.busy}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{firmware.display_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{firmware.description}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {firmware.recommended ? <Badge variant="success">Recommended</Badge> : null}
                        {installed ? <Badge variant="outline">Installed</Badge> : null}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {platformLabel(firmware.platform)} · build {firmware.build_date || "unknown"}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : updater.inspection?.platform === "unknown" ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              The hardware platform could not be verified, so flashing is blocked.
            </p>
          ) : null}

          {isActive ? (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 font-medium">
                  {updater.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {isComplete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
                  {updater.progress.message}
                </span>
                <span className="font-mono">{updater.progress.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-secondary">
                <div
                  className={`h-full transition-[width] ${updater.error ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${updater.progress.percent}%` }}
                />
              </div>
              {updater.busy && destructivePhase ? (
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  DO NOT DISCONNECT OR CLOSE THIS PAGE
                </p>
              ) : null}
            </div>
          ) : null}

          {updater.error ? (
            <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <p>{updater.error}</p>
              <p>
                Recovery: unplug USB, hold the Proxmark3 button, reconnect USB, release the button,
                then use Inspect Reader again.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <a
              href={FIRMWARE_SOURCE}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Firmware source: proxmark3.app
            </a>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void updater.verifyPackage()}
                disabled={!updater.selectedFirmware || updater.busy}
              >
                {updater.progress.phase === "downloading" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : updater.packageVerified ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {updater.packageVerified ? "Package Verified" : "Verify Package"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setConfirmation("");
                  setConfirmOpen(true);
                }}
                disabled={!updater.selectedFirmware || !updater.packageVerified || updater.busy}
              >
                <Zap className="h-3 w-3" /> Flash Firmware…
              </Button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Flash {updater.selectedFirmware?.display_name}?</DialogTitle>
            <DialogDescription>
              This writes both the bootloader and firmware. A power loss or disconnect during the
              write can leave the reader requiring bootloader recovery.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Remove every card, keep USB connected, then type <strong>{CONFIRMATION_TEXT}</strong>.
            </p>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CONFIRMATION_TEXT}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmation !== CONFIRMATION_TEXT}
              onClick={() => {
                setConfirmOpen(false);
                void updater.flash();
              }}
            >
              Flash Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
