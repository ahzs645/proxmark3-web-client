import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BookOpen } from "lucide-react";

type CheatEntry = {
  command: string;
  summary: string;
};

interface CheatSection {
  title: string;
  entries: CheatEntry[];
  badge?: BadgeProps["variant"];
}

interface CheatSheetPanelProps {
  onRun: (command: string) => void;
  disabled?: boolean;
}

const cheatData: CheatSection[] = [
  {
    title: "Generic",
    badge: "outline",
    entries: [
      { command: "hw version", summary: "Firmware/bootloader information" },
      { command: "hw status", summary: "Overall PM3 health + battery" },
      { command: "hw tune", summary: "LF/HF antenna tuning voltages" },
    ],
  },
  {
    title: "HF / Attack",
    badge: "success",
    entries: [
      { command: "hf mf autopwn --1k", summary: "Full MIFARE Classic attack, keys + dump" },
      { command: "hf mf hardnested --blk 0 -a -k FFFFFFFFFFFF --tblk 4 --ta -w", summary: "Hardnested key recovery using collected nonces" },
      { command: "hf iclass loclass -f iclass_mac_attack.bin", summary: "LOCLASS attack to extract custom iCLASS keys" },
    ],
  },
  {
    title: "HF / Ops",
    badge: "default",
    entries: [
      { command: "hf mf dump", summary: "Dump Classic tag to binary file" },
      { command: "hf mfu dump -k FFFFFFFF", summary: "Dump Ultralight EV1 with default key" },
      { command: "hf iclass dump --ki 0", summary: "Dump iCLASS card using key slot 0" },
    ],
  },
  {
    title: "LF / HID + Indala",
    badge: "warning",
    entries: [
      { command: "lf hid read", summary: "Read/demodulate HID Prox credential" },
      { command: "lf hid clone -w H10301 --fc 10 --cn 1337", summary: "Clone HID Prox to T5577" },
      { command: "lf indala read", summary: "Read/identify Indala card" },
    ],
  },
  {
    title: "Data + Lua",
    badge: "secondary",
    entries: [
      { command: "data samples -n 40000", summary: "Capture raw samples for analysis" },
      { command: "data save -f hf-capture.bin", summary: "Persist buffer to file" },
      { command: "script list", summary: "List Lua helpers (uid bruteforce, format, etc)" },
    ],
  },
];

export function CheatSheetPanel({ onRun, disabled }: CheatSheetPanelProps) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Command Cheat Sheet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-auto pr-1">
        {cheatData.map((section, idx) => (
          <div key={section.title} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={section.badge}>{section.title}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              {section.entries.map((entry) => (
                <div
                  key={entry.command}
                  className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="flex-1">
                    <code className="text-xs bg-secondary px-2 py-1 rounded break-all">
                      {entry.command}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">{entry.summary}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => onRun(entry.command)}
                    disabled={disabled}
                  >
                    Run
                  </Button>
                </div>
              ))}
            </div>
            {idx !== cheatData.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default CheatSheetPanel;
