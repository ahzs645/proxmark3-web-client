import { CreditCard, HardDrive, ShieldCheck, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CachedDump } from "../../CardMemoryMap";

export interface LibraryWriteSource {
  name: string;
  uid: string;
  type: string;
  sak?: string;
  atqa?: string;
  dump?: CachedDump;
}

interface WriteCardDialogProps {
  source: LibraryWriteSource | null;
  onOpenFullDump: (source: LibraryWriteSource) => void;
  onOpenMemory: (source: LibraryWriteSource) => void;
  onOpenMagicIdentity: (source: LibraryWriteSource) => void;
  onClose: () => void;
}

export function WriteCardDialog({
  source,
  onOpenFullDump,
  onOpenMemory,
  onOpenMagicIdentity,
  onClose,
}: WriteCardDialogProps) {
  const blockCount = Object.keys(source?.dump?.data.blocks ?? {}).length;
  const dumpSize = blockCount === 256 ? "4K" : blockCount === 64 ? "1K" : `${blockCount} blocks`;

  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Write from Library</DialogTitle>
          <DialogDescription>
            Choose what the saved source contributes. The physical destination is scanned in the
            next workspace and remains separate from this Library record.
          </DialogDescription>
        </DialogHeader>

        {source ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {source.dump ? (
                  <HardDrive className="h-4 w-4 text-primary" />
                ) : (
                  <CreditCard className="h-4 w-4 text-primary" />
                )}
                <span className="font-medium">{source.name}</span>
                {source.uid ? (
                  <Badge variant="outline" className="font-mono">
                    {source.uid}
                  </Badge>
                ) : null}
                {source.dump ? <Badge variant="secondary">{dumpSize}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {source.type || "HF card"}
                {source.sak ? ` · SAK ${source.sak}` : ""}
                {source.atqa ? ` · ATQA ${source.atqa}` : ""}
              </p>
            </div>

            <div className="grid gap-2">
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-3 text-left"
                disabled={!source.dump}
                onClick={() => onOpenFullDump(source)}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">Full dump → magic card</span>
                  <span className="block whitespace-normal text-xs font-normal text-muted-foreground">
                    Open the Gen1a full-card workflow with optional backup and verification or an
                    explicit direct write.
                  </span>
                </span>
              </Button>

              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-3 text-left"
                disabled={!source.dump}
                onClick={() => onOpenMemory(source)}
              >
                <HardDrive className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">
                    Inspect or write selected blocks
                  </span>
                  <span className="block whitespace-normal text-xs font-normal text-muted-foreground">
                    Open Memory with this dump active for editing, direct block writes, and the same
                    optional guarded restore.
                  </span>
                </span>
              </Button>

              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-3 text-left"
                disabled={!source.uid}
                onClick={() => onOpenMagicIdentity(source)}
              >
                <Wand2 className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">UID or manufacturer block only</span>
                  <span className="block whitespace-normal text-xs font-normal text-muted-foreground">
                    Open Magic with UID, SAK, and ATQA prefilled for a generation-specific write.
                  </span>
                </span>
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
