import { Input } from "@/components/ui/input";

interface TrailerKeyConfigProps {
  keyA: string;
  keyB: string;
  gpb: string;
  onKeyAChange: (value: string) => void;
  onKeyBChange: (value: string) => void;
  onGpbChange: (value: string) => void;
}

export function TrailerKeyConfig({
  keyA,
  keyB,
  gpb,
  onKeyAChange,
  onKeyBChange,
  onGpbChange,
}: TrailerKeyConfigProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Key A (6 bytes)</label>
        <Input
          value={keyA}
          onChange={(e) => onKeyAChange(e.target.value)}
          placeholder="FFFFFFFFFFFF"
          className="font-mono text-xs"
          maxLength={12}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Key B (6 bytes)</label>
        <Input
          value={keyB}
          onChange={(e) => onKeyBChange(e.target.value)}
          placeholder="FFFFFFFFFFFF"
          className="font-mono text-xs"
          maxLength={12}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">GPB (1 byte)</label>
        <Input
          value={gpb}
          onChange={(e) => onGpbChange(e.target.value)}
          placeholder="69"
          className="font-mono text-xs"
          maxLength={2}
        />
      </div>
    </div>
  );
}
