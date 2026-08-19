import { useRef } from "react";
import { FileUp, FolderUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCaptureImportControls } from "./context";

/**
 * "Import folder / files" buttons. Folder selection needs the non-standard
 * `webkitdirectory` attribute, which React will not render from JSX, so it is
 * set on the element directly.
 */
export function ImportSourceButtons() {
  const importer = useCaptureImportControls();
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!importer) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (!folderInput.current) return;
          folderInput.current.setAttribute("webkitdirectory", "");
          folderInput.current.click();
        }}
      >
        <FolderUp className="h-3 w-3 mr-1" />
        Import Folder
      </Button>
      <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
        <FileUp className="h-3 w-3 mr-1" />
        Import Files
      </Button>

      <input
        ref={folderInput}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          importer.openFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          importer.openFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </>
  );
}
