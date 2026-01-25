import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  decodeAccessBits,
  encodeAccessBits,
  permissionToString,
  isKeyBReadable,
  ACCESS_PRESETS,
  type AccessPresetKey,
  type Permission,
} from "@/lib/accessBits";
import {
  Lock,
  Unlock,
  Key,
  AlertTriangle,
  Check,
  X,
  Copy,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TrailerDecoderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTrailer?: string; // Full 32-char trailer hex or just access bits
  onApply?: (trailer: string) => void;
}

function PermissionBadge({ perm }: { perm: Permission }) {
  const variants: Record<Permission, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    "A": { variant: "default", icon: <Key className="h-2.5 w-2.5" /> },
    "B": { variant: "secondary", icon: <Key className="h-2.5 w-2.5" /> },
    "A|B": { variant: "outline", icon: <Unlock className="h-2.5 w-2.5" /> },
    "never": { variant: "destructive", icon: <Lock className="h-2.5 w-2.5" /> },
  };
  const { variant, icon } = variants[perm];

  return (
    <Badge variant={variant} className="text-[9px] gap-0.5 px-1 py-0">
      {icon}
      {permissionToString(perm)}
    </Badge>
  );
}

export function TrailerDecoderDialog({
  open,
  onOpenChange,
  initialTrailer = "",
  onApply,
}: TrailerDecoderDialogProps) {
  // Parse initial trailer - could be full 32 chars or just 6 char access bits
  const getInitialAccessBits = () => {
    const clean = initialTrailer.replace(/\s/g, "").toUpperCase();
    if (clean.length >= 32) {
      // Full trailer: KeyA(12) + Access(6) + GPB(2) + KeyB(12)
      return clean.slice(12, 18);
    } else if (clean.length >= 6) {
      return clean.slice(0, 6);
    }
    return "FF0780"; // Default transport
  };

  const getInitialKeys = () => {
    const clean = initialTrailer.replace(/\s/g, "").toUpperCase();
    if (clean.length >= 32) {
      return {
        keyA: clean.slice(0, 12),
        keyB: clean.slice(20, 32),
        gpb: clean.slice(18, 20),
      };
    }
    return { keyA: "FFFFFFFFFFFF", keyB: "FFFFFFFFFFFF", gpb: "69" };
  };

  const [accessBitsHex, setAccessBitsHex] = useState(getInitialAccessBits);
  const [keyA, setKeyA] = useState(() => getInitialKeys().keyA);
  const [keyB, setKeyB] = useState(() => getInitialKeys().keyB);
  const [gpb, setGpb] = useState(() => getInitialKeys().gpb);

  // Manual C values
  const [c0, setC0] = useState(0);
  const [c1, setC1] = useState(0);
  const [c2, setC2] = useState(0);
  const [c3, setC3] = useState(1);

  // Reset state when dialog opens with new initial value
  useEffect(() => {
    if (open) {
      const bits = getInitialAccessBits();
      const keys = getInitialKeys();
      setAccessBitsHex(bits);
      setKeyA(keys.keyA);
      setKeyB(keys.keyB);
      setGpb(keys.gpb);

      const decoded = decodeAccessBits(bits);
      if (decoded.valid) {
        setC0(decoded.c0);
        setC1(decoded.c1);
        setC2(decoded.c2);
        setC3(decoded.c3);
      }
    }
  }, [open, initialTrailer]);

  // Decode current access bits
  const decoded = useMemo(() => decodeAccessBits(accessBitsHex), [accessBitsHex]);

  // Sync C values when hex changes
  useEffect(() => {
    if (decoded.valid) {
      setC0(decoded.c0);
      setC1(decoded.c1);
      setC2(decoded.c2);
      setC3(decoded.c3);
    }
  }, [decoded]);

  // Update hex when C values change manually
  const handleCValueChange = useCallback(
    (index: number, value: number) => {
      const newValue = Math.max(0, Math.min(7, value));
      const values = [c0, c1, c2, c3];
      values[index] = newValue;

      if (index === 0) setC0(newValue);
      else if (index === 1) setC1(newValue);
      else if (index === 2) setC2(newValue);
      else setC3(newValue);

      setAccessBitsHex(encodeAccessBits(values[0], values[1], values[2], values[3]));
    },
    [c0, c1, c2, c3]
  );

  const handleAccessBitsChange = useCallback((value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-F0-9\s]/gi, "").slice(0, 8);
    setAccessBitsHex(sanitized.replace(/\s/g, ""));
  }, []);

  const handleKeyChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
      const sanitized = value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 12);
      setter(sanitized);
    },
    []
  );

  const handlePresetClick = useCallback((presetKey: AccessPresetKey) => {
    const preset = ACCESS_PRESETS[presetKey];
    setC0(preset.c0);
    setC1(preset.c1);
    setC2(preset.c2);
    setC3(preset.c3);
    setAccessBitsHex(preset.hex);
  }, []);

  // Build full trailer
  const fullTrailer = useMemo(() => {
    const paddedKeyA = keyA.padEnd(12, "F").slice(0, 12);
    const paddedKeyB = keyB.padEnd(12, "F").slice(0, 12);
    const paddedAccess = accessBitsHex.padEnd(6, "0").slice(0, 6);
    const paddedGpb = gpb.padEnd(2, "0").slice(0, 2);
    return `${paddedKeyA}${paddedAccess}${paddedGpb}${paddedKeyB}`;
  }, [keyA, keyB, accessBitsHex, gpb]);

  const handleApply = useCallback(() => {
    onApply?.(fullTrailer);
    onOpenChange(false);
  }, [fullTrailer, onApply, onOpenChange]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const keyBReadable = isKeyBReadable(c3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Sector Trailer Decoder
          </DialogTitle>
          <DialogDescription>
            Decode and configure MIFARE Classic sector trailer access bits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Access Bits Input */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Access Bits (3 bytes hex)
              </label>
              <div className="flex gap-2">
                <Input
                  value={accessBitsHex}
                  onChange={(e) => handleAccessBitsChange(e.target.value)}
                  placeholder="FF0780"
                  className={cn(
                    "font-mono text-sm",
                    decoded.valid ? "border-green-500/50" : "border-red-500/50"
                  )}
                  maxLength={6}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(accessBitsHex)}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {decoded.valid ? (
                <div className="flex items-center gap-1 text-xs text-green-500">
                  <Check className="h-3 w-3" />
                  Valid access bits
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <X className="h-3 w-3" />
                  {decoded.error}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Manual C Values (0-7)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "C0", value: c0, index: 0 },
                  { label: "C1", value: c1, index: 1 },
                  { label: "C2", value: c2, index: 2 },
                  { label: "C3", value: c3, index: 3 },
                ].map(({ label, value, index }) => (
                  <div key={label} className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">
                      {label} {index < 3 ? `(Blk ${index})` : "(Trailer)"}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={7}
                      value={value}
                      onChange={(e) =>
                        handleCValueChange(index, parseInt(e.target.value) || 0)
                      }
                      className="h-8 text-xs font-mono text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Wand2 className="h-3 w-3" />
              Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(ACCESS_PRESETS) as [AccessPresetKey, typeof ACCESS_PRESETS[AccessPresetKey]][]).map(
                ([key, preset]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={accessBitsHex === preset.hex ? "default" : "outline"}
                    onClick={() => handlePresetClick(key)}
                    className="h-7 text-xs"
                    title={preset.description}
                  >
                    {preset.label}
                  </Button>
                )
              )}
            </div>
          </div>

          <Separator />

          {/* Permission Matrix */}
          <div className="space-y-3">
            <label className="text-xs text-muted-foreground font-medium">
              Data Blocks Permission Matrix
            </label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Block</th>
                    <th className="px-3 py-2 text-center font-medium">Read</th>
                    <th className="px-3 py-2 text-center font-medium">Write</th>
                    <th className="px-3 py-2 text-center font-medium">Increment</th>
                    <th className="px-3 py-2 text-center font-medium">Dec/Trans/Rest</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Block 0", access: decoded.sectorAccess.block0, c: c0 },
                    { label: "Block 1", access: decoded.sectorAccess.block1, c: c1 },
                    { label: "Block 2", access: decoded.sectorAccess.block2, c: c2 },
                  ].map((row, idx) => (
                    <tr key={idx} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium">
                        {row.label}
                        <Badge variant="outline" className="ml-2 text-[9px]">
                          C={row.c}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PermissionBadge perm={row.access.read} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PermissionBadge perm={row.access.write} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PermissionBadge perm={row.access.increment} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PermissionBadge perm={row.access.decrement} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="text-xs text-muted-foreground font-medium">
              Trailer Block Permissions
            </label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Operation</th>
                    <th className="px-3 py-2 text-center font-medium">Key A</th>
                    <th className="px-3 py-2 text-center font-medium">Access Bits</th>
                    <th className="px-3 py-2 text-center font-medium">Key B</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/50">
                    <td className="px-3 py-2 font-medium">
                      Read
                      <Badge variant="outline" className="ml-2 text-[9px]">
                        C3={c3}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PermissionBadge perm={decoded.sectorAccess.trailer.keyARead} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PermissionBadge perm={decoded.sectorAccess.trailer.accessBitsRead} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PermissionBadge perm={decoded.sectorAccess.trailer.keyBRead} />
                    </td>
                  </tr>
                  <tr className="border-t border-border/50">
                    <td className="px-3 py-2 font-medium">Write</td>
                    <td className="px-3 py-2 text-center">
                      <PermissionBadge perm={decoded.sectorAccess.trailer.keyAWrite} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PermissionBadge perm={decoded.sectorAccess.trailer.accessBitsWrite} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PermissionBadge perm={decoded.sectorAccess.trailer.keyBWrite} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Key B Warning */}
          {keyBReadable && (
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Key B is readable with this configuration. This means Key B{" "}
                <strong>cannot</strong> be used for authentication - it's effectively
                just extra data storage.
              </span>
            </div>
          )}

          <Separator />

          {/* Key Configuration */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Key A (6 bytes)</label>
              <Input
                value={keyA}
                onChange={(e) => handleKeyChange(setKeyA)(e.target.value)}
                placeholder="FFFFFFFFFFFF"
                className="font-mono text-xs"
                maxLength={12}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Key B (6 bytes)</label>
              <Input
                value={keyB}
                onChange={(e) => handleKeyChange(setKeyB)(e.target.value)}
                placeholder="FFFFFFFFFFFF"
                className="font-mono text-xs"
                maxLength={12}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">GPB (1 byte)</label>
              <Input
                value={gpb}
                onChange={(e) =>
                  setGpb(e.target.value.toUpperCase().replace(/[^A-F0-9]/gi, "").slice(0, 2))
                }
                placeholder="69"
                className="font-mono text-xs"
                maxLength={2}
              />
            </div>
          </div>

          {/* Full Trailer Preview */}
          <div className="p-3 bg-secondary/30 rounded space-y-2">
            <label className="text-xs text-muted-foreground">
              Full Trailer (32 hex chars)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-background p-2 rounded border break-all">
                <span className="text-blue-400">{fullTrailer.slice(0, 12)}</span>
                <span className="text-amber-400">{fullTrailer.slice(12, 18)}</span>
                <span className="text-gray-400">{fullTrailer.slice(18, 20)}</span>
                <span className="text-green-400">{fullTrailer.slice(20, 32)}</span>
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copyToClipboard(fullTrailer)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-4 text-[10px] text-muted-foreground">
              <span>
                <span className="text-blue-400">Key A</span>
              </span>
              <span>
                <span className="text-amber-400">Access</span>
              </span>
              <span>
                <span className="text-gray-400">GPB</span>
              </span>
              <span>
                <span className="text-green-400">Key B</span>
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!decoded.valid}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TrailerDecoderDialog;
