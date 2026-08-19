import { createContext, useContext } from "react";
import type { useCaptureImport } from "./useCaptureImport";

export type CaptureImportValue = ReturnType<typeof useCaptureImport>;

/**
 * The app-wide capture importer. Provided by App.tsx so any panel can offer an
 * "import" button that feeds the same review-then-commit flow as a file drop,
 * without threading callbacks through the workspace router.
 */
export const CaptureImportContext = createContext<CaptureImportValue | null>(null);

/** Import controls, or null outside the provider (so panels can degrade). */
export function useCaptureImportControls(): CaptureImportValue | null {
  return useContext(CaptureImportContext);
}
