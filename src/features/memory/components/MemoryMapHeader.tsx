import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CachedDump, CardType } from "@/features/memory/types";
import {
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Key,
  KeyRound,
  Search,
} from "lucide-react";

interface MemoryMapHeaderProps {
  cardType: CardType;
  showKeys: boolean;
  disabled: boolean;
  activeDump: CachedDump | null | undefined;
  searchFilter: string;
  showCachePanel: boolean;
  cachedDumpCount: number;
  onJsonUpload: (files: FileList | null) => void;
  onSearchFilterChange: (value: string) => void;
  onToggleCachePanel: () => void;
  onToggleShowKeys: () => void;
  onExportDump: () => void;
  onDump: () => void;
  onAutopwn: () => void;
  /** Dump the card seeding autopwn with keys saved in the library. */
  onDumpWithSavedKeys?: () => void;
}

const CARD_TYPE_LABELS: Record<CardType, string> = {
  "classic-1k": "MIFARE Classic 1K",
  "classic-4k": "MIFARE Classic 4K",
  ultralight: "MIFARE Ultralight",
};

export function MemoryMapHeader({
  cardType,
  showKeys,
  disabled,
  activeDump,
  searchFilter,
  showCachePanel,
  cachedDumpCount,
  onJsonUpload,
  onSearchFilterChange,
  onToggleCachePanel,
  onToggleShowKeys,
  onExportDump,
  onDump,
  onAutopwn,
  onDumpWithSavedKeys,
}: MemoryMapHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4 text-primary" />
          Memory Map
          <Badge variant="outline" className="ml-2">
            {CARD_TYPE_LABELS[cardType]}
          </Badge>
        </CardTitle>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
              <span>
                <FileJson className="mr-1 h-3 w-3" />
                Load JSON
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={(e) => onJsonUpload(e.target.files)}
              className="hidden"
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={onExportDump}
            disabled={!activeDump}
            className="h-7 text-xs"
          >
            <Download className="mr-1 h-3 w-3" />
            Export JSON
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggleShowKeys} className="h-7 text-xs">
            {showKeys ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
            Keys
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDump}
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Download className="mr-1 h-3 w-3" />
            Read Card
          </Button>
          <Button size="sm" onClick={onAutopwn} disabled={disabled} className="h-7 text-xs">
            <Key className="mr-1 h-3 w-3" />
            Autopwn
          </Button>
          {onDumpWithSavedKeys ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={onDumpWithSavedKeys}
              disabled={disabled}
              className="h-7 text-xs"
              title="Dump using keys saved in the library (seeds autopwn with them)"
            >
              <KeyRound className="mr-1 h-3 w-3" />
              Dump · saved keys
            </Button>
          ) : null}
        </div>
      </div>

      {activeDump?.data?.Card ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gradient-to-r from-primary/10 to-transparent p-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">UID:</span>
            <code className="text-sm font-mono font-semibold text-primary">
              {activeDump.data.Card.UID}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void navigator.clipboard.writeText(activeDump.data.Card?.UID || "")}
              className="h-5 w-5 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          {activeDump.data.Card.ATQA ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">ATQA:</span>
              <code className="font-mono">{activeDump.data.Card.ATQA}</code>
            </div>
          ) : null}
          {activeDump.data.Card.SAK ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">SAK:</span>
              <code className="font-mono">{activeDump.data.Card.SAK}</code>
            </div>
          ) : null}
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {activeDump.name}
          </Badge>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => onSearchFilterChange(e.target.value)}
            placeholder="Search blocks..."
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant={showCachePanel ? "default" : "outline"}
          onClick={onToggleCachePanel}
          className="h-7 gap-1 text-xs"
        >
          <Database className="h-3 w-3" />
          Cached Cards
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
            {cachedDumpCount}
          </Badge>
        </Button>
      </div>
    </>
  );
}
