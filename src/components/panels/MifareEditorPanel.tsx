import type { CachedAsset } from "./KeyCachePanel";
import { Card, CardContent } from "@/components/ui/card";
import { MifareEditorHeader } from "@/features/mifare-editor/components/MifareEditorHeader";
import { MifareEditorAuthBar } from "@/features/mifare-editor/components/MifareEditorAuthBar";
import { MifareBlockTable } from "@/features/mifare-editor/components/MifareBlockTable";
import { MifareTrailerBuilder } from "@/features/mifare-editor/components/MifareTrailerBuilder";
import { useMifareEditorState } from "@/features/mifare-editor/hooks/useMifareEditorState";

interface MifareEditorPanelProps {
  onCommand: (cmd: string) => void;
  cacheItems: CachedAsset[];
  disabled?: boolean;
  cachePathPrefix: string;
}

export function MifareEditorPanel({
  onCommand,
  cacheItems,
  disabled,
  cachePathPrefix,
}: MifareEditorPanelProps) {
  const state = useMifareEditorState({
    onCommand,
    cacheItems,
    cachePathPrefix,
  });

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <MifareEditorHeader disabled={disabled} onCommand={onCommand} />

      <CardContent className="flex-1 overflow-auto p-0">
        <MifareEditorAuthBar
          keyValue={state.keyValue}
          keyType={state.keyType}
          targetBlock={state.targetBlock}
          dumpChoices={state.dumpChoices}
          keyChoices={state.keyChoices}
          disabled={disabled}
          onKeyChange={state.setKeyValue}
          onKeyTypeChange={state.setKeyType}
          onTargetBlockChange={state.setTargetBlock}
          onReadTargetBlock={() => state.readBlock(Number(state.targetBlock))}
          onLoadDump={state.loadDump}
          onLoadKeys={state.loadKeys}
        />

        <MifareBlockTable
          rows={state.rows}
          selectedRow={state.selectedRow}
          disabled={disabled}
          onDataChange={state.handleDataChange}
          onSelectRow={state.setSelectedRow}
          onReadBlock={state.readBlock}
          onWriteBlock={state.writeBlock}
          onEmulatorGet={(block) => onCommand(`hf mf eget ${block}`)}
          onCopy={state.copyToClipboard}
        />

        <MifareTrailerBuilder
          disabled={disabled}
          keyType={state.keyType}
          authKey={state.keyValue}
          open={state.showTrailerBuilder}
          trailerBlock={state.trailerBlock}
          trailerKeyA={state.trailerKeyA}
          trailerKeyB={state.trailerKeyB}
          trailerAccess={state.trailerAccess}
          trailerGpb={state.trailerGpb}
          trailerPreview={state.trailerPreview}
          presets={state.trailerPresets}
          onOpenChange={state.setShowTrailerBuilder}
          onTrailerBlockChange={state.setTrailerBlock}
          onTrailerKeyAChange={state.setTrailerKeyA}
          onTrailerKeyBChange={state.setTrailerKeyB}
          onTrailerAccessChange={state.setTrailerAccess}
          onTrailerGpbChange={state.setTrailerGpb}
          onApplyPreset={state.applyTrailerPreset}
          onCopy={state.copyToClipboard}
          onWriteTrailer={state.writeTrailer}
          onReadTrailer={state.readTrailer}
        />
      </CardContent>
    </Card>
  );
}

export default MifareEditorPanel;
