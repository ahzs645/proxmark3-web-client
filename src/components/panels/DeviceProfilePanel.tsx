import { AlertTriangle, Cpu, RefreshCw, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeviceProfile } from "@/features/device/context";
import type { SupportLevel } from "@/features/device/types";

function SupportBadge({ value }: { value: SupportLevel }) {
  return (
    <Badge
      variant={
        value === "supported" ? "success" : value === "unsupported" ? "destructive" : "outline"
      }
    >
      {value}
    </Badge>
  );
}

export function DeviceProfilePanel() {
  const { profile, refreshProfile } = useDeviceProfile();
  const FirmwareIcon =
    profile.firmwareCompatible === true
      ? ShieldCheck
      : profile.firmwareCompatible === false
        ? ShieldX
        : ShieldQuestion;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Cpu className="h-4 w-4" />
            Observed device profile
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Derived from the connected reader and PM3 output; unknown values remain safely disabled.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={refreshProfile}>
          <RefreshCw className="h-3 w-3" />
          Probe again
        </Button>
      </CardHeader>
      <CardContent className="flex-1 space-y-5 overflow-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Fact label="Model" value={profile.model ?? "Not observed"} />
          <Fact label="Hardware variant" value={profile.hardwareVariant} />
          <Fact label="Microcontroller" value={profile.microcontroller ?? "Not observed"} />
          <Fact label="Runtime" value="WebAssembly client" />
          <Fact label="Client" value={profile.clientVersion ?? "Not observed"} mono />
          <Fact label="Firmware" value={profile.firmwareVersion ?? "Not observed"} mono />
          <Fact label="Bootrom" value={profile.bootromVersion ?? "Not observed"} mono />
          <Fact label="FPGA" value={profile.fpgaVersion ?? "Not observed"} mono />
        </div>

        <section className="rounded-md border border-border/70 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <FirmwareIcon className="h-4 w-4" />
            Firmware compatibility
            <Badge
              variant={
                profile.firmwareCompatible === true
                  ? "success"
                  : profile.firmwareCompatible === false
                    ? "destructive"
                    : "outline"
              }
            >
              {profile.firmwareCompatible === true
                ? "matched"
                : profile.firmwareCompatible === false
                  ? "mismatch"
                  : "unknown"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {profile.firmwareHealth.summary}. The probe is read-only and never assumes an unknown
            component is healthy.
          </p>
          {profile.firmwareHealth.issues.length > 0 ? (
            <div className="mt-3 space-y-2">
              {profile.firmwareHealth.issues.map((finding) => (
                <div
                  key={finding.code}
                  className={`rounded-md border p-2 text-xs ${finding.level === "critical" ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"}`}
                >
                  <p className="flex items-center gap-1 font-medium">
                    <AlertTriangle className="h-3 w-3" /> {finding.summary}
                  </p>
                  <p className="mt-1 text-muted-foreground">{finding.action}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {finding.evidence}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hardware features
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(profile.features).map(([name, value]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded border px-3 py-2 text-xs"
              >
                <span>{name.replace(/([A-Z])/g, " $1")}</span>
                <SupportBadge value={value} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Observed command surface
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <CommandList title="Supported" commands={profile.supportedCommands} />
            <CommandList title="Rejected" commands={profile.unsupportedCommands} />
          </div>
        </section>

        {profile.evidence.length > 0 ? (
          <details className="rounded-md border border-border/70 p-3">
            <summary className="cursor-pointer text-xs font-medium">Raw inference evidence</summary>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
              {profile.evidence.join("\n")}
            </pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border/70 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1 text-sm font-medium"}>
        {value}
      </div>
    </div>
  );
}

function CommandList({ title, commands }: { title: string; commands: string[] }) {
  return (
    <div className="rounded-md border border-border/70 p-3">
      <div className="mb-2 text-xs font-medium">{title}</div>
      {commands.length ? (
        <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
          {commands.map((command) => (
            <li key={command}>{command}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing observed yet.</p>
      )}
    </div>
  );
}

export default DeviceProfilePanel;
