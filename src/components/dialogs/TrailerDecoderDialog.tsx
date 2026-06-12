import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Lock } from "lucide-react";
import { TrailerBitsSection } from "@/features/mifare-editor/components/TrailerBitsSection";
import { TrailerFullPreview } from "@/features/mifare-editor/components/TrailerFullPreview";
import { TrailerKeyConfig } from "@/features/mifare-editor/components/TrailerKeyConfig";
import { TrailerPermissionTables } from "@/features/mifare-editor/components/TrailerPermissionTables";
import { useTrailerDecoderState } from "@/features/mifare-editor/hooks/useTrailerDecoderState";

interface TrailerDecoderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTrailer?: string;
  onApply?: (trailer: string) => void;
}

export function TrailerDecoderDialog({
  open,
  onOpenChange,
  initialTrailer = "",
  onApply,
}: TrailerDecoderDialogProps) {
  const state = useTrailerDecoderState({ initialTrailer, open });

  const handleApply = useCallback(() => {
    onApply?.(state.fullTrailer);
    onOpenChange(false);
  }, [onApply, onOpenChange, state.fullTrailer]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
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
          <TrailerBitsSection
            accessBitsHex={state.accessBitsHex}
            decoded={state.decoded}
            cValues={[state.c0, state.c1, state.c2, state.c3]}
            onAccessBitsChange={state.handleAccessBitsChange}
            onCValueChange={state.handleCValueChange}
            onPresetClick={state.handlePresetClick}
            onCopy={state.copyToClipboard}
          />

          <Separator />

          <TrailerPermissionTables
            decoded={state.decoded}
            cValues={[state.c0, state.c1, state.c2, state.c3]}
          />

          {state.keyBReadable ? (
            <div className="flex items-start gap-2 rounded bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Key B is readable with this configuration. This means Key B <strong>cannot</strong>{" "}
                be used for authentication - it is effectively extra data storage.
              </span>
            </div>
          ) : null}

          <Separator />

          <TrailerKeyConfig
            keyA={state.keyA}
            keyB={state.keyB}
            gpb={state.gpb}
            onKeyAChange={state.handleKeyAChange}
            onKeyBChange={state.handleKeyBChange}
            onGpbChange={state.handleGpbChange}
          />

          <TrailerFullPreview trailer={state.fullTrailer} onCopy={state.copyToClipboard} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!state.decoded.valid}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TrailerDecoderDialog;
