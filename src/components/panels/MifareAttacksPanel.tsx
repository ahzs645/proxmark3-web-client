import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import { KeyRound, Shield, Sparkles } from "lucide-react";
import type { CachedAsset } from "./KeyCachePanel";
import { useTarget } from "@/features/target/context";
import { toAttackCardType } from "@/features/target/classify";
import { AttacksHeader } from "@/features/attacks/components/AttacksHeader";
import { QuickAttacksBar } from "@/features/attacks/components/QuickAttacksBar";
import { AttackTabsBar } from "@/features/attacks/components/AttackTabsBar";
import { AttackDescription } from "@/features/attacks/components/AttackDescription";
import { KnownKeySection } from "@/features/attacks/components/KnownKeySection";
import { TargetKeySection } from "@/features/attacks/components/TargetKeySection";
import { KeyDictionarySection } from "@/features/attacks/components/KeyDictionarySection";
import { AdvancedOptionsSection } from "@/features/attacks/components/AdvancedOptionsSection";
import { AttackWarnings } from "@/features/attacks/components/AttackWarnings";
import { useMifareAttacksState } from "@/features/attacks/useMifareAttacksState";
import type { LibraryKeyMode } from "@/features/keys/libraryKeyCommands";

interface MifareAttacksPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
  cachedAssets?: CachedAsset[];
  cachePathPrefix?: string;
  libraryKeyMode: LibraryKeyMode;
  onLibraryKeyModeChange: (mode: LibraryKeyMode) => void;
}

export function MifareAttacksPanel({
  onCommand,
  disabled = false,
  cachedAssets = [],
  cachePathPrefix = "/pm3-cache",
  libraryKeyMode,
  onLibraryKeyModeChange,
}: MifareAttacksPanelProps) {
  const { target } = useTarget();
  const detectedCardType = target.classification.isClassic
    ? toAttackCardType(target.classification.size)
    : null;
  const detectedUid = target.identity?.uid ?? null;
  const attacks = useMifareAttacksState({
    cachedAssets,
    cachePathPrefix,
    detectedCardType,
    detectedUid,
  });

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <PanelHeader
        icon={Shield}
        title="MIFARE Attacks"
        tag="Key Recovery"
        actions={
          <AttacksHeader cardType={attacks.cardType} onCardTypeChange={attacks.setCardType} />
        }
      />

      <CardContent className="flex-1 overflow-auto p-0">
        {detectedCardType ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">
              Targeting {target.identity?.type || "MIFARE Classic"}
            </span>
            <Badge variant="outline" className="uppercase">
              {detectedCardType}
            </Badge>
            {detectedUid ? <span className="font-mono">UID {detectedUid}</span> : null}
            {target.savedKeyCount > 0 ? (
              <span className="flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                {target.savedKeyCount} saved key{target.savedKeyCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        ) : null}

        <QuickAttacksBar onRunCommand={onCommand} disabled={disabled} />

        <AttackTabsBar
          activeAttack={attacks.activeAttack}
          onActiveAttackChange={attacks.setActiveAttack}
        />

        <div className="space-y-4 p-3">
          <AttackDescription config={attacks.config} />

          {attacks.config.requiresKnownKey ? (
            <KnownKeySection
              knownBlock={attacks.knownBlock}
              knownKeyType={attacks.knownKeyType}
              knownKey={attacks.knownKey}
              onKnownBlockChange={attacks.handleKnownBlockChange}
              onKnownKeyTypeChange={attacks.setKnownKeyType}
              onKnownKeyChange={attacks.handleKnownKeyChange}
              defaultKeys={attacks.defaultKeys}
            />
          ) : null}

          {attacks.config.requiresTargetBlock ? (
            <TargetKeySection
              targetBlock={attacks.targetBlock}
              targetKeyType={attacks.targetKeyType}
              onTargetBlockChange={attacks.handleTargetBlockChange}
              onTargetKeyTypeChange={attacks.setTargetKeyType}
            />
          ) : null}

          {attacks.showKeyFileSection ? (
            <KeyDictionarySection
              keyFiles={attacks.keyFiles}
              selectedKeyFile={attacks.selectedKeyFile}
              onSelectedKeyFileChange={attacks.setSelectedKeyFile}
              libraryKeyMode={libraryKeyMode}
              matchingKeyCount={target.savedKeyCount}
              libraryKeyCount={target.libraryKeyCount}
              onLibraryKeyModeChange={onLibraryKeyModeChange}
            />
          ) : null}

          <AdvancedOptionsSection
            activeAttack={attacks.activeAttack}
            slowMode={attacks.slowMode}
            showAdvanced={attacks.showAdvanced}
            onToggleAdvanced={attacks.toggleAdvanced}
            onSlowModeChange={attacks.setSlowMode}
            buildCommand={attacks.buildCommand}
          />

          <div className="flex items-center gap-2">
            <Button
              size="lg"
              onClick={() => onCommand(attacks.buildCommand())}
              disabled={disabled || !attacks.isValid}
              className="flex-1 gap-2"
            >
              Run {attacks.config.label}
            </Button>
          </div>

          <AttackWarnings activeAttack={attacks.activeAttack} />
        </div>
      </CardContent>
    </Card>
  );
}

export default MifareAttacksPanel;
