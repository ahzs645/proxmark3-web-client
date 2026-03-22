import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Copy, RefreshCw } from "lucide-react";
import {
  buildApdu,
  formatHex,
  parseApdu,
  parseApduResponse,
  sanitizeHex,
  type ParsedApdu,
} from "@/lib/rfidUtils";
import { copyText } from "./clipboard";
import { UtilitySection } from "./shared";

const APDU_TEMPLATES = [
  { label: "Get UID", value: "FFCA000000" },
  { label: "Select AID", value: "00A4040000" },
  { label: "Get Data", value: "00CA000000" },
  { label: "Read Binary", value: "00B0000010" },
  { label: "Read Record", value: "00B2010C00" },
];

export function ApduToolsSection() {
  const [apduCla, setApduCla] = useState("FF");
  const [apduIns, setApduIns] = useState("CA");
  const [apduP1, setApduP1] = useState("00");
  const [apduP2, setApduP2] = useState("00");
  const [apduData, setApduData] = useState("");
  const [apduLe, setApduLe] = useState("00");
  const [apduInput, setApduInput] = useState("FFCA000000");
  const [apduResponseInput, setApduResponseInput] = useState("04A2B3C4D5E6079000");

  const builtApdu = useMemo(
    () =>
      buildApdu({
        cla: apduCla,
        ins: apduIns,
        p1: apduP1,
        p2: apduP2,
        data: apduData,
        le: apduLe,
      }),
    [apduCla, apduData, apduIns, apduLe, apduP1, apduP2],
  );
  const parsedApdu = useMemo(() => parseApdu(apduInput), [apduInput]);
  const parsedResponse = useMemo(() => parseApduResponse(apduResponseInput), [apduResponseInput]);

  const applyParsedApdu = useCallback((parsed: ParsedApdu | null) => {
    if (!parsed) return;

    setApduCla(parsed.cla);
    setApduIns(parsed.ins);
    setApduP1(parsed.p1);
    setApduP2(parsed.p2);
    setApduData(parsed.data);
    setApduLe(parsed.le || "");
  }, []);

  const loadApduTemplate = useCallback(
    (value: string) => {
      setApduInput(value);
      applyParsedApdu(parseApdu(value));
    },
    [applyParsedApdu],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <UtilitySection title="APDU Builder">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">CLA</label>
            <Input
              value={apduCla}
              onChange={(e) => setApduCla(sanitizeHex(e.target.value, 2))}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">INS</label>
            <Input
              value={apduIns}
              onChange={(e) => setApduIns(sanitizeHex(e.target.value, 2))}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">P1</label>
            <Input
              value={apduP1}
              onChange={(e) => setApduP1(sanitizeHex(e.target.value, 2))}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">P2</label>
            <Input
              value={apduP2}
              onChange={(e) => setApduP2(sanitizeHex(e.target.value, 2))}
              className="font-mono"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_120px]">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Data</label>
            <Input
              value={apduData}
              onChange={(e) => setApduData(sanitizeHex(e.target.value))}
              className="font-mono"
              placeholder="A0000002471001"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Le</label>
            <Input
              value={apduLe}
              onChange={(e) => setApduLe(sanitizeHex(e.target.value, 2))}
              className="font-mono"
              placeholder="00"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Built APDU</span>
            {builtApdu ? (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setApduInput(builtApdu);
                    applyParsedApdu(parseApdu(builtApdu));
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copyText(builtApdu)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
          </div>
          <code className="block break-all">{formatHex(builtApdu || "") || "n/a"}</code>
        </div>

        <div className="flex flex-wrap gap-2">
          {APDU_TEMPLATES.map((template) => (
            <Button
              key={template.label}
              size="sm"
              variant="outline"
              onClick={() => loadApduTemplate(template.value)}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </UtilitySection>

      <UtilitySection title="APDU Parser">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Command Hex</label>
          <Input
            value={apduInput}
            onChange={(e) => setApduInput(sanitizeHex(e.target.value))}
            className="font-mono"
            placeholder="FFCA000000"
          />
        </div>

        <div className="rounded-lg border bg-background/60 p-3">
          {parsedApdu ? (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div>
                CLA: <code>{parsedApdu.cla}</code>
              </div>
              <div>
                INS: <code>{parsedApdu.ins}</code>
              </div>
              <div>
                P1: <code>{parsedApdu.p1}</code>
              </div>
              <div>
                P2: <code>{parsedApdu.p2}</code>
              </div>
              <div>
                LC: <code>{parsedApdu.lc ?? "n/a"}</code>
              </div>
              <div>
                LE: <code>{parsedApdu.le || "n/a"}</code>
              </div>
              <div className="md:col-span-2">
                Data: <code>{formatHex(parsedApdu.data) || "n/a"}</code>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Enter a valid short APDU command.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Response Hex</label>
          <Input
            value={apduResponseInput}
            onChange={(e) => setApduResponseInput(sanitizeHex(e.target.value))}
            className="font-mono"
            placeholder="04A2B3C4D5E6079000"
          />
        </div>

        <div className="rounded-lg border bg-background/60 p-3">
          {parsedResponse ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {parsedResponse.isSuccess ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span>{parsedResponse.description}</span>
                <Badge variant={parsedResponse.isSuccess ? "success" : "warning"}>
                  {parsedResponse.statusWord}
                </Badge>
              </div>
              <div>
                SW1: <code>{parsedResponse.sw1}</code>
              </div>
              <div>
                SW2: <code>{parsedResponse.sw2}</code>
              </div>
              <div>
                Data: <code>{formatHex(parsedResponse.data) || "n/a"}</code>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Enter a response ending with `SW1 SW2`.
            </div>
          )}
        </div>
      </UtilitySection>
    </div>
  );
}
