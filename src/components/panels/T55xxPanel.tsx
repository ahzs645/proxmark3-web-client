import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { T55xxPanelHeader } from "@/features/lf-tools/t55xx/T55xxPanelHeader";
import { T55xxEm410xSection } from "@/features/lf-tools/t55xx/T55xxEm410xSection";
import { T55xxOperationsSection } from "@/features/lf-tools/t55xx/T55xxOperationsSection";
import { T55xxAdvancedSection } from "@/features/lf-tools/t55xx/T55xxAdvancedSection";
import { T55xxQuickCommandsSection } from "@/features/lf-tools/t55xx/T55xxQuickCommandsSection";
import { T55xxWarningSection } from "@/features/lf-tools/t55xx/T55xxWarningSection";
import { useT55xxPanelState } from "@/features/lf-tools/t55xx/useT55xxPanelState";
import {
  buildEm410xCloneCommand,
  buildT55xxDetectCommand,
  buildT55xxDumpCommand,
  buildT55xxReadBlockCommand,
  buildT55xxWriteBlockCommand,
  buildT55xxWipeCommand,
} from "@/features/lf-tools/commands";

interface T55xxPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

export function T55xxPanel({ onCommand, disabled = false }: T55xxPanelProps) {
  const {
    emId,
    chipType,
    clockRate,
    password,
    usePassword,
    blockNumber,
    blockData,
    isEmIdValid,
    setChipType,
    setClockRate,
    setUsePassword,
    setBlockNumber,
    setEmIdFromInput,
    setPasswordFromInput,
    setBlockDataFromInput,
  } = useT55xxPanelState();

  const handleDetect = () => onCommand(buildT55xxDetectCommand(usePassword, password));
  const handleDump = () => onCommand(buildT55xxDumpCommand(usePassword, password));
  const handleReadBlock = () =>
    onCommand(buildT55xxReadBlockCommand(blockNumber, usePassword, password));
  const handleWriteBlock = () => {
    const cmd = buildT55xxWriteBlockCommand(blockNumber, blockData, usePassword, password);
    if (cmd) onCommand(cmd);
  };
  const handleWipe = () => onCommand(buildT55xxWipeCommand(usePassword, password));
  const handleTryPasswords = () => onCommand("lf t55xx chk");
  const handleCloneEM410x = () => {
    const cmd = buildEm410xCloneCommand(emId);
    if (cmd) onCommand(cmd);
  };
  const handleReadEM410x = () => onCommand("lf em 410x reader");
  const handleInfo = () => onCommand("lf t55xx info");

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <T55xxPanelHeader disabled={disabled} onDetect={handleDetect} />
      <CardContent className="flex-1 overflow-auto p-0">
        <T55xxEm410xSection
          emId={emId}
          chipType={chipType}
          clockRate={clockRate}
          isEmIdValid={isEmIdValid}
          onEmIdChange={setEmIdFromInput}
          onChipTypeChange={setChipType}
          onClockRateChange={setClockRate}
          onRead={handleReadEM410x}
          onClone={handleCloneEM410x}
          disabled={disabled}
        />
        <Separator />
        <T55xxOperationsSection
          password={password}
          usePassword={usePassword}
          onPasswordChange={setPasswordFromInput}
          onUsePasswordChange={setUsePassword}
          onDetect={handleDetect}
          onDump={handleDump}
          onWipe={handleWipe}
          onInfo={handleInfo}
          onTryPasswords={handleTryPasswords}
          disabled={disabled}
        />
        <Separator />
        <T55xxAdvancedSection
          blockNumber={blockNumber}
          blockData={blockData}
          onBlockNumberChange={setBlockNumber}
          onBlockDataChange={setBlockDataFromInput}
          onReadBlock={handleReadBlock}
          onWriteBlock={handleWriteBlock}
          disabled={disabled}
        />
        <Separator />
        <T55xxQuickCommandsSection onCommand={onCommand} disabled={disabled} />
        <T55xxWarningSection />
      </CardContent>
    </Card>
  );
}

export default T55xxPanel;
