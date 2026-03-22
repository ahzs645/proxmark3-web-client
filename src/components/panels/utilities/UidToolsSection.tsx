import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy } from "lucide-react";
import { calculateBcc, formatHex, sanitizeHex, verifyBlock0Bcc } from "@/lib/rfidUtils";
import { copyText } from "./clipboard";
import { UtilitySection } from "./shared";

export function UidToolsSection() {
  const [uidInput, setUidInput] = useState("A1B2C3D4");
  const [block0Input, setBlock0Input] = useState("");
  const [sakInput, setSakInput] = useState("08");
  const [atqaInput, setAtqaInput] = useState("0004");
  const [manufacturerInput, setManufacturerInput] = useState("00000000000000");

  const uidClean = useMemo(() => sanitizeHex(uidInput, 20), [uidInput]);
  const block0Clean = useMemo(() => sanitizeHex(block0Input, 32), [block0Input]);
  const block0Check = useMemo(() => verifyBlock0Bcc(block0Clean), [block0Clean]);
  const uidBcc = useMemo(() => calculateBcc(uidClean), [uidClean]);
  const uidLooksValid = [8, 14, 20].includes(uidClean.length);
  const block0Preview = useMemo(() => {
    if (uidClean.length < 8) return "";

    const uid4 = uidClean.slice(0, 8);
    const sak = sanitizeHex(sakInput, 2).padStart(2, "0");
    const atqa = sanitizeHex(atqaInput, 4).padStart(4, "0");
    const manufacturer = sanitizeHex(manufacturerInput, 14).padEnd(14, "0");
    const atqaReversed = reverseBytesLike(atqa);

    return `${uid4}${calculateBcc(uid4)}${sak}${atqaReversed}${manufacturer}`.toUpperCase();
  }, [atqaInput, manufacturerInput, sakInput, uidClean]);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <UtilitySection title="UID Checksum">
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">UID (4, 7, or 10 bytes)</label>
            <Input
              value={uidInput}
              onChange={(e) => setUidInput(sanitizeHex(e.target.value, 20))}
              className="font-mono"
              placeholder="A1B2C3D4"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={uidLooksValid ? "success" : "warning"}>
              {uidLooksValid ? "Valid Length" : "Needs 4, 7, or 10 bytes"}
            </Badge>
            {uidClean.length >= 8 ? <Badge variant="outline">BCC {uidBcc || "n/a"}</Badge> : null}
          </div>

          <div className="space-y-2 rounded-lg border bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">Formatted UID</div>
            <code className="block">{formatHex(uidClean) || "n/a"}</code>
            {uidClean.length >= 8 ? (
              <>
                <div className="pt-2 text-xs text-muted-foreground">4-byte UID + BCC</div>
                <div className="flex items-center justify-between gap-2">
                  <code>{formatHex(`${uidClean.slice(0, 8)}${uidBcc}`)}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(`${uidClean.slice(0, 8)}${uidBcc}`)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </UtilitySection>

      <UtilitySection title="Block 0 Preview">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">SAK</label>
            <Input
              value={sakInput}
              onChange={(e) => setSakInput(sanitizeHex(e.target.value, 2))}
              className="font-mono"
              placeholder="08"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">ATQA</label>
            <Input
              value={atqaInput}
              onChange={(e) => setAtqaInput(sanitizeHex(e.target.value, 4))}
              className="font-mono"
              placeholder="0004"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Manufacturer Tail (7 bytes)</label>
          <Input
            value={manufacturerInput}
            onChange={(e) => setManufacturerInput(sanitizeHex(e.target.value, 14))}
            className="font-mono"
            placeholder="00000000000000"
          />
        </div>

        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Preview</span>
            {block0Preview ? (
              <Button size="sm" variant="ghost" onClick={() => copyText(block0Preview)}>
                <Copy className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
          <code className="block break-all">
            {formatHex(block0Preview) || "Enter a 4-byte UID to build Block 0"}
          </code>
        </div>

        <Separator />

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Verify Existing Block 0</label>
          <Input
            value={block0Input}
            onChange={(e) => setBlock0Input(sanitizeHex(e.target.value, 32))}
            className="font-mono"
            placeholder="A1B2C3D4680804000000000000000000"
          />
        </div>

        {block0Check ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={block0Check.valid ? "success" : "destructive"}>
              {block0Check.valid ? "BCC Valid" : "BCC Mismatch"}
            </Badge>
            <span className="text-muted-foreground">
              expected <code>{block0Check.expected}</code>
            </span>
            <span className="text-muted-foreground">
              actual <code>{block0Check.actual}</code>
            </span>
          </div>
        ) : null}
      </UtilitySection>
    </div>
  );
}

function reverseBytesLike(value: string) {
  return value.match(/../g)?.reverse().join("") || "";
}
