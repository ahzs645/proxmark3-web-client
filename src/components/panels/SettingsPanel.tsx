import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollRail } from "@/components/ui/scroll-rail";
import { PanelHeader } from "@/components/panels/shared/PanelHeader";
import {
  Bluetooth,
  Check,
  Cpu,
  Key,
  MonitorCog,
  Palette,
  Settings,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Theme } from "@/hooks/useTheme";
import { AppearanceSection } from "@/features/settings/components/AppearanceSection";
import { BluetoothUartSection } from "@/features/settings/components/BluetoothUartSection";
import { BehaviorSection } from "@/features/settings/components/BehaviorSection";
import { DataManagementSection } from "@/features/settings/components/DataManagementSection";
import { DefaultsSection } from "@/features/settings/components/DefaultsSection";
import { useSettingsState } from "@/features/settings/useSettingsState";
import { FirmwareUpdateSection } from "@/features/firmware/FirmwareUpdateSection";
import type { TransportType } from "@/lib/transports";
import { NativeRuntimeSection } from "@/features/runtime/NativeRuntimeSection";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClearCache?: () => void;
  cacheCount?: number;
  isDeviceConnected: boolean;
  activeTransportType: TransportType | null;
  onDisconnectApplication: () => Promise<void>;
  onReconnectApplication: () => Promise<boolean>;
  onFirmwareLog?: (message: string) => void;
}

type SectionId =
  | "appearance"
  | "defaults"
  | "behavior"
  | "firmware"
  | "bluetooth"
  | "native"
  | "data";

/** Nav entries, in page order. Icons match each section's own heading. */
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "defaults", label: "Default Values", icon: Key },
  { id: "behavior", label: "Behavior", icon: Settings },
  { id: "bluetooth", label: "Bluetooth UART", icon: Bluetooth },
  { id: "firmware", label: "Reader Firmware", icon: Cpu },
  { id: "native", label: "Native Runtime", icon: MonitorCog },
  { id: "data", label: "Data Management", icon: Trash2 },
];

function findSection(scroller: HTMLElement, id: SectionId) {
  return scroller.querySelector<HTMLElement>(`[data-settings-section="${id}"]`);
}

/** A section counts as current once its top passes this share of the scroller. */
const SPY_LINE = 1 / 3;

export function SettingsPanel({
  theme,
  onThemeChange,
  onClearCache,
  cacheCount = 0,
  isDeviceConnected,
  activeTransportType,
  onDisconnectApplication,
  onReconnectApplication,
  onFirmwareLog,
}: SettingsPanelProps) {
  const {
    settings,
    saved,
    importError,
    clearImportError,
    setDefaultCardType,
    setDefaultAuthKey,
    setConfirmDestructiveOps,
    setTerminalFontSize,
    setShowAdvancedOptions,
    setOperationProfile,
    setNativePm3BinaryPath,
    setNativePm3Port,
    setBleCustomUuids,
    exportSettings,
    importSettings,
    resetSettings,
  } = useSettingsState();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<SectionId>("appearance");
  // After a nav click the clicked entry stays highlighted until the user scrolls
  // by hand; otherwise the smooth scroll lights up every section it passes, and
  // a short section near the bottom (which can never reach the top) would never
  // be selectable at all.
  const navLockRef = useRef(false);

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || navLockRef.current) return;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
    if (atBottom) {
      setActiveId(SECTIONS[SECTIONS.length - 1].id);
      return;
    }
    const top = scroller.getBoundingClientRect().top + scroller.clientHeight * SPY_LINE;
    let current = SECTIONS[0].id;
    for (const { id } of SECTIONS) {
      const node = findSection(scroller, id);
      if (node && node.getBoundingClientRect().top <= top) current = id;
    }
    setActiveId(current);
  }, []);

  const releaseNavLock = useCallback(() => {
    navLockRef.current = false;
  }, []);

  const jumpTo = (id: SectionId) => {
    const scroller = scrollerRef.current;
    const node = scroller ? findSection(scroller, id) : null;
    if (!scroller || !node) return;
    navLockRef.current = true;
    setActiveId(id);
    // Scroll only the settings column; scrollIntoView would also nudge the
    // overflow-hidden workbench ancestors.
    const offset = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + offset - 16, behavior: "smooth" });
  };

  // Keep the active tab visible in the phone-width strip.
  useEffect(() => {
    const active = railRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  const section = (id: SectionId, children: ReactNode, className?: string) => (
    <div data-settings-section={id} className={cn("min-w-0", className)}>
      {children}
    </div>
  );

  return (
    // The page fills the workspace: no outer card, so the sections get the
    // whole width and height instead of a box inside a box.
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <PanelHeader
        icon={Settings}
        title="Settings"
        tag="Preferences"
        actions={
          saved ? (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" />
              Saved
            </Badge>
          ) : null
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Wide screens: a section list beside the page. */}
        <nav
          aria-label="Settings sections"
          className="hidden w-52 shrink-0 space-y-0.5 overflow-y-auto border-r bg-secondary/20 p-2 md:block"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={activeId === id ? "true" : undefined}
              onClick={() => jumpTo(id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeId === id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone width: the same list as a scrollable tab strip. */}
          <ScrollRail className="flex-none border-b md:hidden" aria-label="Settings sections">
            <div ref={railRef} className="flex min-w-max items-stretch px-1">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={activeId === id ? "true" : undefined}
                  onClick={() => jumpTo(id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap px-2.5 text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    activeId === id
                      ? "text-foreground shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </ScrollRail>

          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            onWheel={releaseNavLock}
            onTouchStart={releaseNavLock}
            onPointerDown={releaseNavLock}
            onKeyDown={releaseNavLock}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {/* Two sections per row on wide screens; the firmware updater needs
                the full width for its file pickers and progress. */}
            <div className="grid w-full items-start gap-4 p-4 xl:grid-cols-2">
              {section(
                "appearance",
                <AppearanceSection
                  theme={theme}
                  onThemeChange={onThemeChange}
                  terminalFontSize={settings.terminalFontSize}
                  onTerminalFontSizeChange={setTerminalFontSize}
                />,
              )}

              {section(
                "defaults",
                <DefaultsSection
                  defaultCardType={settings.defaultCardType}
                  defaultAuthKey={settings.defaultAuthKey}
                  onDefaultCardTypeChange={setDefaultCardType}
                  onDefaultAuthKeyChange={setDefaultAuthKey}
                />,
              )}

              {section(
                "behavior",
                <BehaviorSection
                  confirmDestructiveOps={settings.confirmDestructiveOps}
                  showAdvancedOptions={settings.showAdvancedOptions}
                  onConfirmDestructiveOpsChange={setConfirmDestructiveOps}
                  onShowAdvancedOptionsChange={setShowAdvancedOptions}
                  operationProfile={settings.operationProfile}
                  onOperationProfileChange={setOperationProfile}
                />,
              )}

              {section(
                "bluetooth",
                <BluetoothUartSection
                  value={{
                    service: settings.bleCustomServiceUuid,
                    write: settings.bleCustomWriteUuid,
                    notify: settings.bleCustomNotifyUuid,
                  }}
                  onChange={setBleCustomUuids}
                />,
              )}

              {section(
                "firmware",
                <FirmwareUpdateSection
                  isDeviceConnected={isDeviceConnected}
                  activeTransportType={activeTransportType}
                  onDisconnectApplication={onDisconnectApplication}
                  onReconnectApplication={onReconnectApplication}
                  onLog={onFirmwareLog}
                />,
                "xl:col-span-2",
              )}

              {section(
                "native",
                <NativeRuntimeSection
                  binaryPath={settings.nativePm3BinaryPath}
                  port={settings.nativePm3Port}
                  onBinaryPathChange={setNativePm3BinaryPath}
                  onPortChange={setNativePm3Port}
                  onLog={onFirmwareLog}
                />,
              )}

              {section(
                "data",
                <DataManagementSection
                  cacheCount={cacheCount}
                  importError={importError}
                  onClearImportError={clearImportError}
                  onExportSettings={exportSettings}
                  onImportSettings={importSettings}
                  onResetSettings={resetSettings}
                  onClearCache={onClearCache}
                />,
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
