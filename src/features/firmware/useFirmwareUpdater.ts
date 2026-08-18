import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadFirmware, fetchFirmwareManifest } from "./api";
import {
  enterBootloader,
  eraseFirmwareEntryPoint,
  flashSegments,
  inspectBootloader,
  inspectReader,
  resetReader,
} from "./protocol";
import {
  type FirmwareSerialConnection,
  openFirmwareSerial,
  reconnectFirmwareSerial,
} from "./serial";
import type {
  FirmwareEntry,
  FirmwareManifest,
  FirmwarePhase,
  FirmwareProgress,
  ReaderInspection,
} from "./types";
import { getTransportManager } from "@/lib/transports";
import { WebSerialTransport } from "@/lib/transports/WebSerialTransport";
import { assessReaderFirmwareHealth, firmwareVersionsMatch } from "./health";

const PHASE_RANGE: Partial<Record<FirmwarePhase, [number, number]>> = {
  inspecting: [0, 5],
  downloading: [5, 12],
  entering_bootloader: [12, 16],
  reconnecting: [16, 20],
  flashing_bootrom: [20, 35],
  rebooting_bootloader: [35, 42],
  flashing_fullimage: [42, 92],
  rebooting: [92, 96],
  verifying: [96, 100],
  complete: [100, 100],
};

function withGlobalProgress(progress: FirmwareProgress): FirmwareProgress {
  const range = PHASE_RANGE[progress.phase];
  if (!range) return progress;
  const [start, end] = range;
  return { ...progress, percent: Math.round(start + (end - start) * (progress.percent / 100)) };
}

interface UseFirmwareUpdaterOptions {
  isDeviceConnected: boolean;
  activeTransportType: string | null;
  disconnectApplication: () => Promise<void>;
  reconnectApplication: () => Promise<boolean>;
  onLog?: (message: string) => void;
}

export function useFirmwareUpdater({
  isDeviceConnected,
  activeTransportType,
  disconnectApplication,
  reconnectApplication,
  onLog,
}: UseFirmwareUpdaterOptions) {
  const [manifest, setManifest] = useState<FirmwareManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<ReaderInspection | null>(null);
  const [selectedFirmwareId, setSelectedFirmwareId] = useState<string | null>(null);
  const [verifiedPackageId, setVerifiedPackageId] = useState<string | null>(null);
  const [progress, setProgress] = useState<FirmwareProgress>({
    phase: "idle",
    percent: 0,
    message: "Ready to inspect the reader",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connectionRef = useRef<FirmwareSerialConnection | null>(null);

  const report = useCallback(
    (next: FirmwareProgress) => {
      const mapped = withGlobalProgress(next);
      setProgress(mapped);
      onLog?.(`[Firmware] ${mapped.message}`);
    },
    [onLog],
  );

  const loadManifest = useCallback(async () => {
    setManifestError(null);
    try {
      const next = await fetchFirmwareManifest();
      setManifest(next);
    } catch (caught) {
      setManifestError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(
    () => () => {
      void connectionRef.current?.close();
    },
    [],
  );

  const compatibleFirmware = useMemo(() => {
    if (!manifest || !inspection || inspection.platform === "unknown") return [];
    return manifest.firmwares.filter((entry) => entry.platform === inspection.platform);
  }, [inspection, manifest]);

  useEffect(() => {
    if (compatibleFirmware.length === 0) {
      setSelectedFirmwareId(null);
      return;
    }
    setSelectedFirmwareId((current) => {
      if (compatibleFirmware.some((entry) => entry.id === current)) return current;
      return compatibleFirmware.find((entry) => entry.recommended)?.id ?? compatibleFirmware[0].id;
    });
  }, [compatibleFirmware]);

  useEffect(() => {
    if (verifiedPackageId !== selectedFirmwareId) setVerifiedPackageId(null);
  }, [selectedFirmwareId, verifiedPackageId]);

  const selectedFirmware = useMemo<FirmwareEntry | null>(
    () => manifest?.firmwares.find((entry) => entry.id === selectedFirmwareId) ?? null,
    [manifest, selectedFirmwareId],
  );
  const firmwareHealth = useMemo(
    () => assessReaderFirmwareHealth(inspection, compatibleFirmware),
    [compatibleFirmware, inspection],
  );

  const releaseConnection = useCallback(async () => {
    const current = connectionRef.current;
    connectionRef.current = null;
    if (current) await current.close();
  }, []);

  const prepareExclusiveSerial = useCallback(async () => {
    let preferredPort: SerialPort | null = null;
    const transport = getTransportManager().getTransport("webserial");
    if (transport instanceof WebSerialTransport) preferredPort = transport.getSerialPort();

    if (isDeviceConnected) {
      if (activeTransportType && activeTransportType !== "webserial") {
        throw new Error("Firmware updates currently require a USB Web Serial connection");
      }
    }

    // A bootloader does not speak the normal PM3 client protocol. The
    // application transport can therefore own an open Web Serial port while
    // the UI correctly reports the reader as offline. Always release that
    // partially-attached transport before firmware inspection or flashing.
    if (isDeviceConnected || preferredPort) {
      await disconnectApplication();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const connection = await openFirmwareSerial(true, preferredPort);
    connectionRef.current = connection;
    return connection;
  }, [activeTransportType, disconnectApplication, isDeviceConnected]);

  const inspect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    report({
      phase: "inspecting",
      percent: 10,
      message: "Opening an exclusive reader connection…",
    });
    try {
      const connection = await prepareExclusiveSerial();
      report({
        phase: "inspecting",
        percent: 45,
        message: "Reading hardware and firmware identity…",
      });
      const result = await inspectReader(connection);
      setInspection(result);
      report({ phase: "idle", percent: 0, message: "Reader inspection complete" });
      await releaseConnection();
      await reconnectApplication();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      report({ phase: "error", percent: 0, message });
      await releaseConnection();
      try {
        await reconnectApplication();
      } catch {
        // The actionable inspection error remains the primary message.
      }
    } finally {
      setBusy(false);
    }
  }, [busy, prepareExclusiveSerial, reconnectApplication, releaseConnection, report]);

  const verifyPackage = useCallback(async () => {
    if (busy || !selectedFirmware) return;
    setBusy(true);
    setError(null);
    try {
      report({ phase: "downloading", percent: 0, message: "Downloading firmware files…" });
      await downloadFirmware(selectedFirmware);
      setVerifiedPackageId(selectedFirmware.id);
      report({ phase: "idle", percent: 0, message: "Firmware package verified" });
      onLog?.(`[Firmware] Package ${selectedFirmware.id} is ready to flash`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setVerifiedPackageId(null);
      setError(message);
      report({ phase: "error", percent: 0, message });
    } finally {
      setBusy(false);
    }
  }, [busy, onLog, report, selectedFirmware]);

  const flash = useCallback(async () => {
    if (busy || !selectedFirmware || !inspection) return;
    let writesStarted = false;
    setBusy(true);
    setError(null);
    try {
      report({ phase: "downloading", percent: 0, message: "Downloading firmware files…" });
      const images = await downloadFirmware(selectedFirmware);
      report({ phase: "downloading", percent: 100, message: "Checksums and ELF ranges verified" });

      let connection = await prepareExclusiveSerial();
      const current = await inspectReader(connection);
      setInspection(current);
      if (current.platform === "unknown") {
        throw new Error("Hardware platform could not be verified; flashing is blocked for safety");
      }
      if (current.platform !== selectedFirmware.platform) {
        throw new Error(
          `Firmware is for ${selectedFirmware.platform}, but the reader reports ${current.platform}`,
        );
      }

      if (current.mode !== "bootloader") {
        report({ phase: "entering_bootloader", percent: 30, message: "Entering bootloader mode…" });
        await enterBootloader(connection);
        await releaseConnection();
        report({ phase: "reconnecting", percent: 20, message: "Waiting for the bootloader port…" });
        connection = await reconnectFirmwareSerial(10, 1_500);
        connectionRef.current = connection;
      }

      const bootloader = await inspectBootloader(connection);
      if (!bootloader.inBootloader) {
        throw new Error(
          "Reader did not enter bootloader mode; hold its button while reconnecting USB",
        );
      }

      writesStarted = true;
      report({ phase: "flashing_bootrom", percent: 0, message: "Preparing bootloader flash…" });
      await flashSegments(connection, images.bootromSegments, "flashing_bootrom", report);
      await eraseFirmwareEntryPoint(connection);
      report({
        phase: "rebooting_bootloader",
        percent: 30,
        message: "Bootloader written; restarting the reader…",
      });
      await resetReader(connection);
      await releaseConnection();

      await new Promise((resolve) => setTimeout(resolve, 5_000));
      report({
        phase: "rebooting_bootloader",
        percent: 70,
        message: "Reconnecting to the new bootloader…",
      });
      connection = await reconnectFirmwareSerial(10, 1_500);
      connectionRef.current = connection;
      const newBootloader = await inspectBootloader(connection);
      if (!newBootloader.inBootloader) throw new Error("New bootloader did not start correctly");

      report({ phase: "flashing_fullimage", percent: 0, message: "Preparing firmware flash…" });
      await flashSegments(connection, images.fullimageSegments, "flashing_fullimage", report);
      report({ phase: "rebooting", percent: 50, message: "Firmware written; restarting reader…" });
      await resetReader(connection);
      await releaseConnection();

      report({ phase: "verifying", percent: 15, message: "Waiting for firmware to start…" });
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      connection = await reconnectFirmwareSerial(10, 1_500);
      connectionRef.current = connection;
      const verified = await inspectReader(connection);
      setInspection(verified);
      if (
        !verified.firmware?.version ||
        !firmwareVersionsMatch(verified.firmware.version, selectedFirmware.version)
      ) {
        throw new Error(
          `Verification expected ${selectedFirmware.version}, received ${verified.firmware?.version || "unknown"}`,
        );
      }
      await releaseConnection();
      report({
        phase: "complete",
        percent: 100,
        message: `Firmware ${selectedFirmware.version} verified`,
      });
      await reconnectApplication();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(
        writesStarted
          ? `${message}. The reader may be in bootloader mode; do not retry card operations yet.`
          : message,
      );
      report({ phase: "error", percent: progress.percent, message });
      await releaseConnection();
      if (!writesStarted) {
        try {
          await reconnectApplication();
        } catch {
          // Preserve the firmware error.
        }
      }
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    inspection,
    prepareExclusiveSerial,
    progress.percent,
    reconnectApplication,
    releaseConnection,
    report,
    selectedFirmware,
  ]);

  return {
    manifest,
    manifestError,
    inspection,
    firmwareHealth,
    compatibleFirmware,
    selectedFirmware,
    selectedFirmwareId,
    packageVerified: Boolean(selectedFirmware && verifiedPackageId === selectedFirmware.id),
    setSelectedFirmwareId,
    progress,
    error,
    busy,
    inspect,
    verifyPackage,
    flash,
    reloadManifest: loadManifest,
  };
}
