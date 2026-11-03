import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadFirmware,
  fetchFirmwareManifest,
  readLocalFirmware,
  type FirmwareImages,
} from "./api";
import { imageFamilyFromMagic, type FlashGeometry } from "./flashDevice";
import {
  enterBootloader,
  eraseFirmwareEntryPoint,
  flashSegments,
  flashTargetFor,
  inspectBootloader,
  inspectReader,
  resetReader,
} from "./protocol";
import {
  type FirmwareSerialConnection,
  openFirmwareSerial,
  reconnectFirmwareSerial,
} from "./serial";
import {
  isFlashablePlatform,
  type FirmwareEntry,
  type FirmwareManifest,
  type FirmwarePhase,
  type FirmwareProgress,
  type ReaderInspection,
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

/** A locally built image pair chosen with the file picker instead of the manifest. */
export interface LocalFirmware {
  label: string;
  images: FirmwareImages;
  /** Chip family the images were built for, from their version-information magic. */
  family: "at91" | "at32" | null;
}

const FAMILY_LABEL = { at91: "Proxmark3 (AT91SAM7)", at32: "Proxmark5 (AT32)" } as const;

/**
 * Refuse an image pair that doesn't belong on this chip or whose bootrom and
 * OS parts are swapped, before anything is written. Mirrors upstream's
 * `CheckInformationMagicAndChipType` + `check_segs`.
 */
function assertImagesFit(images: FirmwareImages, geometry: FlashGeometry): void {
  for (const [name, image] of [
    ["bootrom", images.bootrom],
    ["fullimage", images.fullimage],
  ] as const) {
    const family = imageFamilyFromMagic(image.magic);
    if (family !== null && family !== geometry.family) {
      throw new Error(
        `The ${name} is built for ${FAMILY_LABEL[family]}, but the reader is ${FAMILY_LABEL[geometry.family]}`,
      );
    }
    // Every PM5 image carries the PM5V magic; one without it is a foreign or very old build.
    if (family === null && geometry.family === "at32") {
      throw new Error(
        `The ${name} has no Proxmark5 version information; rebuild with PLATFORM=PM5`,
      );
    }
  }
  const inFlash = (image: FirmwareImages["bootrom"]) =>
    image.segments.filter(
      (segment) =>
        segment.address + segment.data.length > geometry.flashStart &&
        segment.address < geometry.flashEnd,
    );
  const bootrom = inFlash(images.bootrom);
  const fullimage = inFlash(images.fullimage);
  if (bootrom.length === 0 || fullimage.length === 0) {
    throw new Error("Firmware has nothing to write inside this reader's flash");
  }
  if (bootrom.some((segment) => segment.address + segment.data.length > geometry.bootEnd)) {
    throw new Error("The bootrom file extends past the bootloader area; are the files swapped?");
  }
  if (fullimage.some((segment) => segment.address < geometry.bootEnd)) {
    throw new Error("The fullimage file overlaps the bootloader area; are the files swapped?");
  }
}

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
  const [localFirmware, setLocalFirmwareState] = useState<LocalFirmware | null>(null);
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

  const loadLocalFirmware = useCallback(
    async (bootrom: File, fullimage: File) => {
      setError(null);
      try {
        const images = await readLocalFirmware(bootrom, fullimage);
        const family = imageFamilyFromMagic(images.fullimage.magic);
        setLocalFirmwareState({ label: `${bootrom.name} + ${fullimage.name}`, images, family });
        onLog?.(
          `[Firmware] Loaded local images for ${family ? FAMILY_LABEL[family] : "an unknown chip"}`,
        );
      } catch (caught) {
        setLocalFirmwareState(null);
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    },
    [onLog],
  );
  const clearLocalFirmware = useCallback(() => setLocalFirmwareState(null), []);

  const compatibleFirmware = useMemo(() => {
    if (!manifest || !inspection || !isFlashablePlatform(inspection.platform)) return [];
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
      // The PM3 client cannot talk to a bootloader; reattaching would only
      // hold the port open and block the flash that usually follows.
      if (result.mode !== "bootloader") await reconnectApplication();
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
    if (busy || !inspection || (!selectedFirmware && !localFirmware)) return;
    // Local files take precedence over the manifest selection while loaded.
    const manifestEntry = localFirmware ? null : selectedFirmware;
    let writesStarted = false;
    setBusy(true);
    setError(null);
    try {
      let images: FirmwareImages;
      if (localFirmware) {
        images = localFirmware.images;
      } else if (manifestEntry) {
        report({ phase: "downloading", percent: 0, message: "Downloading firmware files…" });
        images = await downloadFirmware(manifestEntry);
        report({ phase: "downloading", percent: 100, message: "Checksums verified" });
      } else {
        return;
      }

      let connection = await prepareExclusiveSerial();
      const current = await inspectReader(connection);
      setInspection(current);
      if (current.platform === "unknown") {
        throw new Error("Hardware platform could not be verified; flashing is blocked for safety");
      }
      if (!isFlashablePlatform(current.platform)) {
        throw new Error(`${current.platform} cannot be flashed from the browser`);
      }
      if (manifestEntry && current.platform !== manifestEntry.platform) {
        throw new Error(
          `Firmware is for ${manifestEntry.platform}, but the reader reports ${current.platform}`,
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

      const bootromTarget = flashTargetFor(bootloader, images.bootrom.magic);
      assertImagesFit(images, bootromTarget.geometry);
      onLog?.(
        `[Firmware] ${FAMILY_LABEL[bootromTarget.geometry.family]} flash 0x${bootromTarget.geometry.flashStart.toString(16)}–0x${bootromTarget.geometry.flashEnd.toString(16)}, ${bootromTarget.geometry.blockSize}-byte blocks`,
      );

      writesStarted = true;
      report({ phase: "flashing_bootrom", percent: 0, message: "Preparing bootloader flash…" });
      await flashSegments(
        connection,
        images.bootrom.segments,
        "flashing_bootrom",
        report,
        bootromTarget,
      );
      await eraseFirmwareEntryPoint(connection, bootromTarget);
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
      await flashSegments(
        connection,
        images.fullimage.segments,
        "flashing_fullimage",
        report,
        flashTargetFor(newBootloader, images.fullimage.magic),
      );
      report({ phase: "rebooting", percent: 50, message: "Firmware written; restarting reader…" });
      await resetReader(connection);
      await releaseConnection();

      report({ phase: "verifying", percent: 15, message: "Waiting for firmware to start…" });
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      connection = await reconnectFirmwareSerial(10, 1_500);
      connectionRef.current = connection;
      const verified = await inspectReader(connection);
      setInspection(verified);
      const installedVersion = verified.firmware?.version;
      if (!installedVersion) {
        throw new Error("Verification failed: the reader did not report a firmware version");
      }
      if (manifestEntry && !firmwareVersionsMatch(installedVersion, manifestEntry.version)) {
        throw new Error(
          `Verification expected ${manifestEntry.version}, received ${installedVersion}`,
        );
      }
      await releaseConnection();
      report({
        phase: "complete",
        percent: 100,
        message: `Firmware ${installedVersion} verified`,
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
    localFirmware,
    onLog,
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
    localFirmware,
    loadLocalFirmware,
    clearLocalFirmware,
    progress,
    error,
    busy,
    inspect,
    verifyPackage,
    flash,
    reloadManifest: loadManifest,
  };
}
