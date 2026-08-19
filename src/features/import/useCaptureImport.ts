import { useCallback, useEffect, useRef, useState } from "react";
import { filesFromDataTransfer, filesFromInput } from "@/features/vault/ingest/files";
import { planIngest } from "@/features/vault/ingest/plan";
import { applyIngest, type IngestOutcome } from "@/features/vault/ingest/apply";
import { planItemCount, type IngestPlan } from "@/features/vault/ingest/types";

export type ImportStage = "idle" | "reading" | "review" | "saving" | "done" | "error";

export interface CaptureImportState {
  stage: ImportStage;
  /** True while a drag carrying files is over the window. */
  dragging: boolean;
  plan: IngestPlan | null;
  outcome: IngestOutcome | null;
  error: string;
}

/**
 * Drives capture-folder import: window-level drag tracking, reading the drop
 * into memory, planning it, and committing once the user confirms. Nothing
 * touches the vault until {@link commit} is called, so a drop can be reviewed
 * and cancelled.
 */
export function useCaptureImport() {
  const [state, setState] = useState<CaptureImportState>({
    stage: "idle",
    dragging: false,
    plan: null,
    outcome: null,
    error: "",
  });

  // Drag events fire for every child element; a counter keeps the overlay
  // stable instead of flickering as the pointer crosses the layout.
  const dragDepth = useRef(0);

  const ingest = useCallback(
    async (read: () => Promise<Awaited<ReturnType<typeof filesFromInput>>>) => {
      setState((prev) => ({ ...prev, stage: "reading", dragging: false, error: "" }));
      try {
        const files = await read();
        if (!files.length) {
          setState((prev) => ({ ...prev, stage: "error", error: "That drop contained no files." }));
          return;
        }

        const plan = await planIngest(files);
        if (planItemCount(plan) === 0) {
          setState((prev) => ({
            ...prev,
            stage: "error",
            error: "Nothing in those files could be read as a dump, credential or key.",
          }));
          return;
        }

        setState((prev) => ({ ...prev, stage: "review", plan }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          stage: "error",
          error: error instanceof Error ? error.message : "Could not read those files.",
        }));
      }
    },
    [],
  );

  const openFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      void ingest(() => filesFromInput(list));
    },
    [ingest],
  );

  const commit = useCallback(
    async (virtualCardName: string | null) => {
      setState((prev) => (prev.plan ? { ...prev, stage: "saving" } : prev));
      const plan = state.plan;
      if (!plan) return;

      try {
        const outcome = await applyIngest(plan, {
          virtualCardName: virtualCardName ?? undefined,
        });
        setState((prev) => ({ ...prev, stage: "done", outcome }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          stage: "error",
          error: error instanceof Error ? error.message : "Import failed.",
        }));
      }
    },
    [state.plan],
  );

  const dismiss = useCallback(() => {
    setState({ stage: "idle", dragging: false, plan: null, outcome: null, error: "" });
  }, []);

  useEffect(() => {
    const carriesFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      dragDepth.current += 1;
      setState((prev) => (prev.stage === "idle" ? { ...prev, dragging: true } : prev));
    };

    const onDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      // Without this the browser navigates to the dropped file instead.
      event.preventDefault();
    };

    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setState((prev) => ({ ...prev, dragging: false }));
    };

    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      const transfer = event.dataTransfer;
      if (transfer) void ingest(() => filesFromDataTransfer(transfer));
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [ingest]);

  return { ...state, openFiles, commit, dismiss };
}
