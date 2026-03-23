import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Key, Shield } from "lucide-react";

interface MifareEditorHeaderProps {
  onCommand: (cmd: string) => void;
  disabled?: boolean;
}

export function MifareEditorHeader({ onCommand, disabled }: MifareEditorHeaderProps) {
  return (
    <CardHeader className="border-b pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-primary" />
          MIFARE Classic Editor
          <Badge variant="outline" className="ml-1">
            1K/4K
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCommand("hf mf dump")}
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Download className="mr-1 h-3 w-3" />
            Dump
          </Button>
          <Button
            size="sm"
            onClick={() => onCommand("hf mf autopwn --1k")}
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Key className="mr-1 h-3 w-3" />
            Autopwn
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}
