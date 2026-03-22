import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Copy, Cpu, RefreshCw } from "lucide-react";
import {
  applyHexMath,
  asciiToHex,
  buildApdu,
  buildPn532Frame,
  calculateBcc,
  decimalToHexString,
  formatHex,
  hexToAscii,
  hexToBinary,
  hexToDecimalString,
  parseApdu,
  parseApduResponse,
  reverseBytes,
  sanitizeHex,
  verifyBlock0Bcc,
  verifyPn532Frame,
  type HexMathOperation,
  type ParsedApdu,
} from "@/lib/rfidUtils";

const HEX_OPS: { value: HexMathOperation; label: string }[] = [
  { value: "add", label: "ADD" },
  { value: "sub", label: "SUB" },
  { value: "xor", label: "XOR" },
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
  { value: "not", label: "NOT A" },
];

const APDU_TEMPLATES = [
  { label: "Get UID", value: "FFCA000000" },
  { label: "Select AID", value: "00A4040000" },
  { label: "Get Data", value: "00CA000000" },
  { label: "Read Binary", value: "00B0000010" },
  { label: "Read Record", value: "00B2010C00" },
];

function UtilitySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/40 p-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

export function UtilitiesPanel() {
  const [hexLeft, setHexLeft] = useState("A1B2");
  const [hexRight, setHexRight] = useState("0102");
  const [hexOp, setHexOp] = useState<HexMathOperation>("xor");
  const [conversionHex, setConversionHex] = useState("3D06CCC2E5884400");
  const [asciiInput, setAsciiInput] = useState("PM3");
  const [decimalInput, setDecimalInput] = useState("255");

  const [uidInput, setUidInput] = useState("A1B2C3D4");
  const [block0Input, setBlock0Input] = useState("");
  const [sakInput, setSakInput] = useState("08");
  const [atqaInput, setAtqaInput] = useState("0004");
  const [manufacturerInput, setManufacturerInput] = useState("00000000000000");

  const [apduCla, setApduCla] = useState("FF");
  const [apduIns, setApduIns] = useState("CA");
  const [apduP1, setApduP1] = useState("00");
  const [apduP2, setApduP2] = useState("00");
  const [apduData, setApduData] = useState("");
  const [apduLe, setApduLe] = useState("00");
  const [apduInput, setApduInput] = useState("FFCA000000");
  const [apduResponseInput, setApduResponseInput] = useState("04A2B3C4D5E6079000");

  const [pn532Tfi, setPn532Tfi] = useState("D4");
  const [pn532Data, setPn532Data] = useState("4A0100");
  const [pn532FrameInput, setPn532FrameInput] = useState("");

  const hexResult = useMemo(
    () => applyHexMath(hexLeft, hexRight, hexOp),
    [hexLeft, hexRight, hexOp],
  );
  const asciiHex = useMemo(() => asciiToHex(asciiInput), [asciiInput]);
  const decimalHex = useMemo(() => decimalToHexString(decimalInput), [decimalInput]);
  const conversionDecimal = useMemo(() => hexToDecimalString(conversionHex), [conversionHex]);
  const conversionAscii = useMemo(() => hexToAscii(conversionHex), [conversionHex]);
  const conversionBinary = useMemo(() => hexToBinary(conversionHex), [conversionHex]);
  const reversedHex = useMemo(() => reverseBytes(conversionHex), [conversionHex]);

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
    const atqaReversed = reverseBytes(atqa);

    return `${uid4}${calculateBcc(uid4)}${sak}${atqaReversed}${manufacturer}`.toUpperCase();
  }, [atqaInput, manufacturerInput, sakInput, uidClean]);

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

  const builtPn532 = useMemo(() => buildPn532Frame(pn532Tfi, pn532Data), [pn532Data, pn532Tfi]);
  const verifiedPn532 = useMemo(() => verifyPn532Frame(pn532FrameInput), [pn532FrameInput]);

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
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          Browser Utilities
          <Badge variant="outline">Offline</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="hex" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="hex">Hex</TabsTrigger>
            <TabsTrigger value="uid">UID / BCC</TabsTrigger>
            <TabsTrigger value="apdu">APDU</TabsTrigger>
            <TabsTrigger value="pn532">PN532</TabsTrigger>
          </TabsList>

          <TabsContent value="hex" className="m-0 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <UtilitySection title="Hex Math">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Value A</label>
                    <Input
                      value={hexLeft}
                      onChange={(e) => setHexLeft(sanitizeHex(e.target.value))}
                      className="font-mono"
                      placeholder="A1B2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Value B</label>
                    <Input
                      value={hexRight}
                      onChange={(e) => setHexRight(sanitizeHex(e.target.value))}
                      className="font-mono"
                      placeholder="0102"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {HEX_OPS.map((op) => (
                    <Button
                      key={op.value}
                      size="sm"
                      variant={hexOp === op.value ? "default" : "outline"}
                      onClick={() => setHexOp(op.value)}
                    >
                      {op.label}
                    </Button>
                  ))}
                </div>

                <div className="rounded-lg border bg-background/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Result</span>
                    {hexResult ? (
                      <Button size="sm" variant="ghost" onClick={() => copyText(hexResult)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                  <code className="block break-all text-sm font-mono">
                    {hexResult || "Enter valid hex values"}
                  </code>
                  {hexResult ? (
                    <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                      <div>Decimal: {hexToDecimalString(hexResult) || "n/a"}</div>
                      <div>ASCII: {hexToAscii(hexResult) || "n/a"}</div>
                      <div>Binary: {hexToBinary(hexResult) || "n/a"}</div>
                    </div>
                  ) : null}
                </div>
              </UtilitySection>

              <UtilitySection title="Conversions">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Hex Input</label>
                    <Input
                      value={conversionHex}
                      onChange={(e) => setConversionHex(sanitizeHex(e.target.value))}
                      className="font-mono"
                      placeholder="3D06CCC2E5884400"
                    />
                  </div>

                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-lg border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">ASCII</div>
                      <code className="break-all">{conversionAscii || "."}</code>
                    </div>
                    <div className="rounded-lg border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Decimal</div>
                      <code className="break-all">{conversionDecimal || "n/a"}</code>
                    </div>
                    <div className="rounded-lg border bg-background/60 p-3 md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Binary</div>
                      <code className="break-all text-xs">{conversionBinary || "n/a"}</code>
                    </div>
                    <div className="rounded-lg border bg-background/60 p-3 md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Reverse Bytes</div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="break-all">{formatHex(reversedHex)}</code>
                        <Button size="sm" variant="ghost" onClick={() => copyText(reversedHex)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">ASCII to Hex</label>
                      <Input
                        value={asciiInput}
                        onChange={(e) => setAsciiInput(e.target.value)}
                        placeholder="PM3"
                      />
                      <code className="block rounded-lg border bg-background/60 p-3 break-all">
                        {formatHex(asciiHex)}
                      </code>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Decimal to Hex</label>
                      <Input
                        value={decimalInput}
                        onChange={(e) => setDecimalInput(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="255"
                      />
                      <code className="block rounded-lg border bg-background/60 p-3 break-all">
                        {formatHex(decimalHex || "") || "n/a"}
                      </code>
                    </div>
                  </div>
                </div>
              </UtilitySection>
            </div>
          </TabsContent>

          <TabsContent value="uid" className="m-0 space-y-4">
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
                    {uidClean.length >= 8 ? (
                      <Badge variant="outline">BCC {uidBcc || "n/a"}</Badge>
                    ) : null}
                  </div>

                  <div className="rounded-lg border bg-background/60 p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">Formatted UID</div>
                    <code className="block">{formatHex(uidClean) || "n/a"}</code>
                    {uidClean.length >= 8 ? (
                      <>
                        <div className="text-xs text-muted-foreground pt-2">4-byte UID + BCC</div>
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
                  <label className="text-xs text-muted-foreground">
                    Manufacturer Tail (7 bytes)
                  </label>
                  <Input
                    value={manufacturerInput}
                    onChange={(e) => setManufacturerInput(sanitizeHex(e.target.value, 14))}
                    className="font-mono"
                    placeholder="00000000000000"
                  />
                </div>

                <div className="rounded-lg border bg-background/60 p-3 space-y-2">
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
          </TabsContent>

          <TabsContent value="apdu" className="m-0 space-y-4">
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

                <div className="rounded-lg border bg-background/60 p-3 space-y-2">
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
          </TabsContent>

          <TabsContent value="pn532" className="m-0 space-y-4">
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

                <div className="rounded-lg border bg-background/60 p-3 space-y-2">
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyText(builtPn532.frameHex)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <code className="block break-all">
                    {formatHex(builtPn532?.frameHex || "") || "n/a"}
                  </code>
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

                <div className="rounded-lg border bg-background/60 p-3 space-y-2">
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
                  This tool stays browser-only. It does checksum math and packet parsing locally and
                  does not require a connected reader.
                </div>
              </UtilitySection>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default UtilitiesPanel;
