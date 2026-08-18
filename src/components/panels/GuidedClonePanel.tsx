import { ArrowRight, CheckCircle2, Copy, Radio, ShieldCheck, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { LFWriteSection } from "@/features/lf-tools/write/LFWriteSection";
import { useVaultLfCards, useVaultOperations } from "@/features/vault/hooks";

interface GuidedClonePanelProps {
  onCommand: (command: string) => void;
  onOpenTab: (tab: string) => void;
  disabled?: boolean;
}

const STEPS = ["Scan source", "Decode", "Select blank", "Validate", "Write", "Verify"];

/**
 * An LF-first guided clone workspace. It intentionally composes the shared
 * parser, vault and verified-write pipeline instead of maintaining a second
 * workflow state machine alongside the expert tools.
 */
export function GuidedClonePanel({
  onCommand,
  onOpenTab,
  disabled = false,
}: GuidedClonePanelProps) {
  const lfCards = useVaultLfCards();
  const operations = useVaultOperations();
  const newestSource = lfCards[0];
  const latestVerifiedWrite = operations.find(
    (operation) => operation.workflow === "lf-verified-write",
  );

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <PanelHeader icon={Wand2} title="Guided Clone" tag="LF workflow" />
      <CardContent className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {STEPS.map((step, index) => (
                <div key={step} className="flex items-center gap-1.5">
                  <span className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium">
                    {index + 1}. {step}
                  </span>
                  {index < STEPS.length - 1 ? (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The first guided path supports decoded HID Prox and EM410x credentials on validated
              T55xx carriers. Other formats stay in the expert workbench until they have parser,
              command-builder, blank-compatibility, and verification fixtures.
            </p>
          </div>

          <section className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Radio className="h-4 w-4 text-primary" />
                  1–2. Scan and decode the source
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep the source credential on the LF antenna until the scan finishes. Recognized
                  credentials are saved locally and selected in the write form below.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onCommand("lf search")}
                disabled={disabled}
                className="gap-1"
              >
                <Radio className="h-3.5 w-3.5" />
                Scan source
              </Button>
            </div>

            {newestSource ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-xs">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <strong>{newestSource.name}</strong>
                <Badge variant="secondary">{newestSource.tech.toUpperCase()}</Badge>
                {newestSource.raw ? <code>{newestSource.raw}</code> : null}
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                No decoded LF source is saved yet. Scan a supported source to continue.
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Copy className="h-4 w-4 text-primary" />
                  3–6. Validate, write, and verify the target
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Remove the source, place the target carrier on the antenna, then validate it.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpenTab("t55xx")}>
                Open expert T55xx tools
              </Button>
            </div>
            <LFWriteSection onCommand={onCommand} disabled={disabled || !newestSource} />
          </section>

          {latestVerifiedWrite ? (
            <section className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck
                  className={`h-4 w-4 ${latestVerifiedWrite.verified ? "text-green-600" : "text-destructive"}`}
                />
                <h2 className="text-sm font-semibold">Latest guided result</h2>
                <Badge variant={latestVerifiedWrite.verified ? "success" : "destructive"}>
                  {latestVerifiedWrite.verified ? "verified" : "failed verification"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {latestVerifiedWrite.summary ?? latestVerifiedWrite.status}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => onOpenTab("library")}
              >
                Open audit report
              </Button>
            </section>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default GuidedClonePanel;
