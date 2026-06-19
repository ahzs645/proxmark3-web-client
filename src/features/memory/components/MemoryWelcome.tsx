import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CachedDump, PM3DumpJson } from "@/features/memory/types";
import { PRIMARY_SAMPLE_DUMP } from "@/features/memory/demo/sampleDumps";
import { CreditCard, FileJson, FolderOpen, HardDrive, Sparkles } from "lucide-react";

interface MemoryWelcomeProps {
  cachedDumps: CachedDump[];
  onDumpLoad?: (dump: PM3DumpJson, name: string) => void;
  onJsonUpload: (files: FileList | null) => void;
}

export function MemoryWelcome({ cachedDumps, onDumpLoad, onJsonUpload }: MemoryWelcomeProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-8 w-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Import Card Dump</h3>
          <p className="text-sm text-muted-foreground">
            Load a Proxmark3 card dump to view and edit the memory contents, sector keys, and access
            conditions.
          </p>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={() => onDumpLoad?.(PRIMARY_SAMPLE_DUMP.data, PRIMARY_SAMPLE_DUMP.name)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Load sample dump
          </Button>
          <p className="text-xs text-muted-foreground">
            No reader handy? Load real card data captured from hardware to explore the Memory Map.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="cursor-pointer">
            <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <FileJson className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">PM3 JSON Dump</div>
                <div className="text-xs text-muted-foreground">
                  hf-mf-*-dump.json files with UID, keys & blocks
                </div>
              </div>
              <Badge variant="default" className="shrink-0">
                Recommended
              </Badge>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={(e) => onJsonUpload(e.target.files)}
              className="hidden"
            />
          </label>

          <label className="cursor-pointer">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Import Folder</div>
                <div className="text-xs text-muted-foreground">
                  Upload entire "Card Export" folder
                </div>
              </div>
            </div>
            <input
              type="file"
              // @ts-expect-error webkitdirectory is not standard
              webkitdirectory=""
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  for (const file of Array.from(files)) {
                    if (file.name.endsWith(".json") && file.name.includes("dump")) {
                      onJsonUpload(files);
                      break;
                    }
                  }
                }
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>

          <label className="cursor-pointer">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <HardDrive className="h-4 w-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Binary Dump</div>
                <div className="text-xs text-muted-foreground">
                  .bin, .dump, .eml files (no keys)
                </div>
              </div>
            </div>
            <input
              type="file"
              accept=".bin,.dump,.eml"
              onChange={(e) => onJsonUpload(e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {cachedDumps.length > 0 ? (
          <div className="border-t pt-4">
            <div className="mb-2 text-xs text-muted-foreground">Recently loaded:</div>
            <div className="flex flex-wrap justify-center gap-2">
              {cachedDumps.slice(0, 5).map((dump) => (
                <Button
                  key={dump.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onDumpLoad?.(dump.data, dump.name)}
                  className="h-7 text-xs"
                >
                  <CreditCard className="mr-1 h-3 w-3" />
                  {dump.data.Card?.UID?.slice(0, 8) || dump.name.slice(0, 12)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-[10px] text-muted-foreground">
          Tip: Use <code className="rounded bg-secondary px-1 py-0.5">hf mf dump --json</code> to
          create a JSON dump from your Proxmark3
        </p>
      </div>
    </div>
  );
}
