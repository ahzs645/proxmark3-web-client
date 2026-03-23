import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Trash2, Search, Download, RefreshCw } from "lucide-react";
import { DEFAULT_PASSWORDS } from "../commands";
import { SectionLabel } from "../shared";

interface T55xxOperationsSectionProps {
  password: string;
  usePassword: boolean;
  onPasswordChange: (value: string) => void;
  onUsePasswordChange: (value: boolean) => void;
  onDetect: () => void;
  onDump: () => void;
  onWipe: () => void;
  onInfo: () => void;
  onTryPasswords: () => void;
  disabled?: boolean;
}

export function T55xxOperationsSection({
  password,
  usePassword,
  onPasswordChange,
  onUsePasswordChange,
  onDetect,
  onDump,
  onWipe,
  onInfo,
  onTryPasswords,
  disabled = false,
}: T55xxOperationsSectionProps) {
  return (
    <div className="p-3 space-y-3">
      <SectionLabel icon={<Key className="h-3 w-3" />}>T55xx Operations</SectionLabel>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={usePassword}
            onChange={(e) => onUsePasswordChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Use Password</span>
        </label>
        {usePassword && (
          <Input
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Password (8 hex)"
            className="font-mono text-xs w-28"
            maxLength={8}
          />
        )}
      </div>

      {usePassword && (
        <div className="flex flex-wrap gap-1">
          {DEFAULT_PASSWORDS.slice(0, 4).map((pwd) => (
            <Button
              key={pwd}
              size="sm"
              variant="ghost"
              onClick={() => onPasswordChange(pwd)}
              className="h-5 px-1.5 text-[9px] font-mono"
            >
              {pwd}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={onTryPasswords}
            disabled={disabled}
            className="h-5 px-1.5 text-[9px]"
          >
            <Key className="mr-1 h-2.5 w-2.5" />
            Try All
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onDetect}
          disabled={disabled}
          className="gap-1"
        >
          <Search className="h-3 w-3" />
          Detect
        </Button>
        <Button size="sm" variant="outline" onClick={onDump} disabled={disabled} className="gap-1">
          <Download className="h-3 w-3" />
          Dump
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onWipe}
          disabled={disabled}
          className="gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Wipe
        </Button>
        <Button size="sm" variant="outline" onClick={onInfo} disabled={disabled} className="gap-1">
          <RefreshCw className="h-3 w-3" />
          Info
        </Button>
      </div>
    </div>
  );
}
