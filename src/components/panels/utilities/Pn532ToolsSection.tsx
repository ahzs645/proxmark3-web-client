import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Copy, RefreshCw } from "lucide-react";
import { buildPn532Frame, formatHex, sanitizeHex, verifyPn532Frame } from "@/lib/rfidUtils";
import { copyText } from "./clipboard";
import { UtilitySection } from "./shared";

export function Pn532ToolsSection() {
  const [pn532Tfi, setPn532Tfi] = useState("D4");
  const [pn532Data, setPn532Data] = useState("4A0100");
  const [pn532FrameInput, setPn532FrameInput] = useState("");

  const builtPn532 = useMemo(() => buildPn532Frame(pn532Tfi, pn532Data), [pn532Data, pn532Tfi]);
  const verifiedPn532 = useMemo(() => verifyPn532Frame(pn532FrameInput), [pn532FrameInput]);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <UtilitySection title="Frame Builder">
        <div className="grid gap-3 md:grid-cols-[120px_1fr]">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">TFI</label>
            <Input
              value={pn532Tfi}
              onChange={(e) => setPn532Tfi(sanitizeHex(e.target.value, 2))}
              className="font-mono"
              placeholder="D4"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Payload Data</label>
            <Input
              value={pn532Data}
              onChange={(e) => setPn532Data(sanitizeHex(e.target.value))}
              className="font-mono"
              placeholder="4A0100"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Frame</span>
            {builtPn532 ? (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPn532FrameInput(builtPn532.frameHex)}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copyText(builtPn532.frameHex)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
          </div>
          <code className="block break-all">{formatHex(builtPn532?.frameHex || "") || "n/a"}</code>
          {builtPn532 ? (
            <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
              <div>LEN {builtPn532.lengthHex}</div>
              <div>LCS {builtPn532.lcsHex}</div>
              <div>DCS {builtPn532.dcsHex}</div>
              <div>Payload {formatHex(builtPn532.payloadHex)}</div>
            </div>
          ) : null}
        </div>
      </UtilitySection>

      <UtilitySection title="Frame Verifier">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Frame Hex</label>
          <Input
            value={pn532FrameInput}
            onChange={(e) => setPn532FrameInput(sanitizeHex(e.target.value))}
            className="font-mono"
            placeholder="0000FF04FCD44A0100E100"
          />
        </div>

        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
          <div className="flex items-center gap-2">
            {verifiedPn532.valid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <Badge variant={verifiedPn532.valid ? "success" : "warning"}>
              {verifiedPn532.valid ? "Valid" : "Needs Attention"}
            </Badge>
            {!verifiedPn532.valid && verifiedPn532.error ? (
              <span className="text-sm text-muted-foreground">{verifiedPn532.error}</span>
            ) : null}
          </div>

          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              LEN: <code>{verifiedPn532.lengthHex || "n/a"}</code>
            </div>
            <div>
              LCS: <code>{verifiedPn532.lcsHex || "n/a"}</code>
            </div>
            <div>
              DCS: <code>{verifiedPn532.dcsHex || "n/a"}</code>
            </div>
            <div>
              Expected DCS: <code>{verifiedPn532.expectedDcsHex || "n/a"}</code>
            </div>
            <div className="md:col-span-2">
              Payload: <code>{formatHex(verifiedPn532.payloadHex || "") || "n/a"}</code>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          This tool stays browser-only. It does checksum math and packet parsing locally and does
          not require a connected reader.
        </div>
      </UtilitySection>
    </div>
  );
}
