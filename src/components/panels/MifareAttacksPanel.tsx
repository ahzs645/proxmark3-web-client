import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import type { CachedAsset } from "./KeyCachePanel";
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

interface MifareAttacksPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
  cachedAssets?: CachedAsset[];
  cachePathPrefix?: string;
}

export function MifareAttacksPanel({
  onCommand,
  disabled = false,
  cachedAssets = [],
  cachePathPrefix = "/pm3-cache",
}: MifareAttacksPanelProps) {
  const attacks = useMifareAttacksState({ cachedAssets, cachePathPrefix });

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="border-b pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-primary" />
            MIFARE Attacks
            <Badge variant="outline" className="ml-1">
              Key Recovery
            </Badge>
          </CardTitle>
          <AttacksHeader cardType={attacks.cardType} onCardTypeChange={attacks.setCardType} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-0">
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
