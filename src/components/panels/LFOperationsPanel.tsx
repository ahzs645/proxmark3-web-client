import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LFPanelHeader } from "@/features/lf-tools/lf/LFPanelHeader";
import { LFFrequencySection } from "@/features/lf-tools/lf/LFFrequencySection";
import { LFOperationsSection } from "@/features/lf-tools/lf/LFOperationsSection";
import { LFAdvancedSection } from "@/features/lf-tools/lf/LFAdvancedSection";
import { LFQuickCommandsSection } from "@/features/lf-tools/lf/LFQuickCommandsSection";
import { useLfOperationsState } from "@/features/lf-tools/lf/useLfOperationsState";
import {
  DEFAULT_LF_CONFIG,
  buildLfReadCommand,
  buildLfSniffCommand,
  buildLfTuneCommand,
  buildSetLfDivisorCommand,
  buildLfConfigCommand,
} from "@/features/lf-tools/commands";

interface LFOperationsPanelProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

export function LFOperationsPanel({ onCommand, disabled = false }: LFOperationsPanelProps) {
  const { config, frequency, samples, setSamples, setConfigValue, setDivisor, resetConfig } =
    useLfOperationsState();

  const handleSearch = () => onCommand("lf search");
  const handleRead = () => {
    onCommand(buildLfReadCommand(samples));
    onCommand("data plot");
  };
  const handleSniff = () => {
    onCommand(buildLfSniffCommand(samples));
    onCommand("data plot");
  };
  const handleTune = () => onCommand(buildLfTuneCommand(config.divisor));
  const handleGetConfig = () => onCommand("hw status");
  const handleSetConfig = () => {
    onCommand(buildLfConfigCommand(config));
    onCommand(buildSetLfDivisorCommand(config.divisor));
  };
  const handleResetConfig = () => {
    resetConfig();
    onCommand(buildLfConfigCommand(DEFAULT_LF_CONFIG));
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <LFPanelHeader frequency={frequency} />
      <CardContent className="flex-1 overflow-auto p-0">
        <LFFrequencySection
          config={config}
          frequency={frequency}
          onDivisorChange={setDivisor}
          onFrequencyPreset={setDivisor}
        />
        <LFOperationsSection
          samples={samples}
          onSamplesChange={setSamples}
          onSearch={handleSearch}
          onTune={handleTune}
          onRead={handleRead}
          onSniff={handleSniff}
          disabled={disabled}
        />
        <Separator />
        <LFAdvancedSection
          config={config}
          onConfigChange={setConfigValue}
          onGetConfig={handleGetConfig}
          onSetConfig={handleSetConfig}
          onResetConfig={handleResetConfig}
          disabled={disabled}
        />
        <Separator />
        <LFQuickCommandsSection onCommand={onCommand} disabled={disabled} />
      </CardContent>
    </Card>
  );
}

export default LFOperationsPanel;
