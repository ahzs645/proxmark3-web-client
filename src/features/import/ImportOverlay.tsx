import { FolderDown } from "lucide-react";

/** Full-window hint shown while a drag carrying files is over the app. */
export function ImportDragOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary px-12 py-10 text-center">
        <FolderDown className="h-10 w-10 text-primary" />
        <p className="text-lg font-semibold">Drop to import</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A whole capture folder works — dumps, key files, LF reads and console logs are sorted out
          for you. Nothing is saved until you confirm.
        </p>
      </div>
    </div>
  );
}
