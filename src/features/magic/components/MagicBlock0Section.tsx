import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, Copy, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyType, MagicCardType } from "../types";

interface MagicBlock0SectionProps {
  disabled?: boolean;
  cardType: MagicCardType;
  showBlock0Builder: boolean;
  onToggleBlock0Builder: () => void;
  block0Uid: string;
  onBlock0UidChange: (value: string) => void;
  block0Bcc: string;
  onBlock0BccChange: (value: string) => void;
  calculatedBcc: string;
  block0Sak: string;
  onBlock0SakChange: (value: string) => void;
  block0Atqa: string;
  onBlock0AtqaChange: (value: string) => void;
  block0Manufacturer: string;
  onBlock0ManufacturerChange: (value: string) => void;
  block0Preview: string;
  authKey: string;
  onAuthKeyChange: (value: string) => void;
  authKeyType: KeyType;
  onAuthKeyTypeChange: (value: KeyType) => void;
  gen4Password: string;
  onGen4PasswordChange: (value: string) => void;
  onCopyBlock0Preview: (value: string) => void;
  onWriteBlock0: () => void;
}

export function MagicBlock0Section({
  disabled = false,
  cardType,
  showBlock0Builder,
  onToggleBlock0Builder,
  block0Uid,
  onBlock0UidChange,
  block0Bcc,
  onBlock0BccChange,
  calculatedBcc,
  block0Sak,
  onBlock0SakChange,
  block0Atqa,
  onBlock0AtqaChange,
  block0Manufacturer,
  onBlock0ManufacturerChange,
  block0Preview,
  authKey,
  onAuthKeyChange,
  authKeyType,
  onAuthKeyTypeChange,
  gen4Password,
  onGen4PasswordChange,
  onCopyBlock0Preview,
  onWriteBlock0,
}: MagicBlock0SectionProps) {
  return (
    <div className="border-t">
      <button
        onClick={onToggleBlock0Builder}
        className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-secondary/30"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-3 w-3 text-amber-500" />
          <span className="font-medium">Block 0 Builder (Advanced)</span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", showBlock0Builder && "rotate-180")}
        />
      </button>

      {showBlock0Builder ? (
        <div className="space-y-3 bg-secondary/20 p-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">UID (4 bytes)</label>
              <Input
                value={block0Uid}
                onChange={(e) =>
                  onBlock0UidChange(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/gi, "")
                      .slice(0, 8),
                  )
                }
                placeholder="12345678"
                className="h-8 font-mono text-xs"
                maxLength={8}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">BCC</label>
              <Input
                value={block0Bcc || calculatedBcc}
                onChange={(e) =>
                  onBlock0BccChange(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/gi, "")
                      .slice(0, 2),
                  )
                }
                placeholder="Auto"
                className="h-8 font-mono text-xs"
                maxLength={2}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">SAK</label>
              <Input
                value={block0Sak}
                onChange={(e) =>
                  onBlock0SakChange(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/gi, "")
                      .slice(0, 2),
                  )
                }
                placeholder="08"
                className="h-8 font-mono text-xs"
                maxLength={2}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">ATQA</label>
              <Input
                value={block0Atqa}
                onChange={(e) =>
                  onBlock0AtqaChange(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/gi, "")
                      .slice(0, 4),
                  )
                }
                placeholder="0004"
                className="h-8 font-mono text-xs"
                maxLength={4}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Manufacturer Data (7 bytes)</label>
            <Input
              value={block0Manufacturer}
              onChange={(e) =>
                onBlock0ManufacturerChange(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-F0-9]/gi, "")
                    .slice(0, 14),
                )
              }
              placeholder="00000000000000"
              className="h-8 font-mono text-xs"
              maxLength={14}
            />
          </div>

          <div className="flex items-center gap-2 rounded border bg-background p-2">
            <Badge variant="outline" className="text-[10px]">
              Block 0
            </Badge>
            <code className="flex-1 break-all font-mono text-[11px]">
              <span className="text-blue-600 dark:text-blue-400">{block0Preview.slice(0, 8)}</span>
              <span className="text-amber-600 dark:text-amber-400">
                {block0Preview.slice(8, 10)}
              </span>
              <span className="text-green-600 dark:text-green-400">
                {block0Preview.slice(10, 14)}
              </span>
              <span className="text-muted-foreground">{block0Preview.slice(14)}</span>
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCopyBlock0Preview(block0Preview)}
              className="h-6 w-6 p-0"
              aria-label="Copy block 0 preview"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex gap-4 text-[9px] text-muted-foreground">
            <span>
              <span className="text-blue-600 dark:text-blue-400">UID</span>
            </span>
            <span>
              <span className="text-amber-600 dark:text-amber-400">BCC</span>
            </span>
            <span>
              <span className="text-green-600 dark:text-green-400">SAK+ATQA</span>
            </span>
            <span>
              <span className="text-muted-foreground">Manufacturer</span>
            </span>
          </div>

          {cardType === "gen2" ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Auth:</span>
              <Input
                value={authKey}
                onChange={(e) =>
                  onAuthKeyChange(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/gi, "")
                      .slice(0, 12),
                  )
                }
                className="h-7 w-32 font-mono text-xs"
                maxLength={12}
              />
              <div className="flex overflow-hidden rounded-md border">
                <Button
                  size="sm"
                  variant={authKeyType === "A" ? "default" : "ghost"}
                  onClick={() => onAuthKeyTypeChange("A")}
                  className="h-7 w-8 rounded-none text-xs"
                >
                  A
                </Button>
                <Button
                  size="sm"
                  variant={authKeyType === "B" ? "default" : "ghost"}
                  onClick={() => onAuthKeyTypeChange("B")}
                  className="h-7 w-8 rounded-none text-xs"
                >
                  B
                </Button>
              </div>
            </div>
          ) : null}

          {cardType === "gen4" ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Gen4 Password:</span>
              <Input
                value={gen4Password}
                onChange={(e) =>
                  onGen4PasswordChange(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-F0-9]/gi, "")
                      .slice(0, 8),
                  )
                }
                className="h-7 w-32 font-mono text-xs"
                maxLength={8}
              />
            </div>
          ) : null}

          <Button
            size="sm"
            onClick={onWriteBlock0}
            disabled={disabled || block0Preview.length !== 32}
            className="w-full gap-2"
          >
            <Shield className="h-3 w-3" />
            Write Block 0
          </Button>
        </div>
      ) : null}
      <Separator />
    </div>
  );
}
