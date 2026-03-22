import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Copy } from "lucide-react";
import {
  applyHexMath,
  asciiToHex,
  decimalToHexString,
  formatHex,
  hexToAscii,
  hexToBinary,
  hexToDecimalString,
  reverseBytes,
  sanitizeHex,
  type HexMathOperation,
} from "@/lib/rfidUtils";
import { copyText } from "./clipboard";
import { UtilitySection } from "./shared";

const HEX_OPS: { value: HexMathOperation; label: string }[] = [
  { value: "add", label: "ADD" },
  { value: "sub", label: "SUB" },
  { value: "xor", label: "XOR" },
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
  { value: "not", label: "NOT A" },
];

export function HexToolsSection() {
  const [hexLeft, setHexLeft] = useState("A1B2");
  const [hexRight, setHexRight] = useState("0102");
  const [hexOp, setHexOp] = useState<HexMathOperation>("xor");
  const [conversionHex, setConversionHex] = useState("3D06CCC2E5884400");
  const [asciiInput, setAsciiInput] = useState("PM3");
  const [decimalInput, setDecimalInput] = useState("255");

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

  return (
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

        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
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
              <div className="mb-1 text-xs text-muted-foreground">ASCII</div>
              <code className="break-all">{conversionAscii || "."}</code>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="mb-1 text-xs text-muted-foreground">Decimal</div>
              <code className="break-all">{conversionDecimal || "n/a"}</code>
            </div>
            <div className="rounded-lg border bg-background/60 p-3 md:col-span-2">
              <div className="mb-1 text-xs text-muted-foreground">Binary</div>
              <code className="break-all text-xs">{conversionBinary || "n/a"}</code>
            </div>
            <div className="rounded-lg border bg-background/60 p-3 md:col-span-2">
              <div className="mb-1 text-xs text-muted-foreground">Reverse Bytes</div>
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
              <code className="block break-all rounded-lg border bg-background/60 p-3">
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
              <code className="block break-all rounded-lg border bg-background/60 p-3">
                {formatHex(decimalHex || "") || "n/a"}
              </code>
            </div>
          </div>
        </div>
      </UtilitySection>
    </div>
  );
}
