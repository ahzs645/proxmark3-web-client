import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bolt, Cable, Database, Radio, ShieldHalf, Wifi } from "lucide-react";

type CommandItem = {
  label: string;
  command: string;
  description: string;
};

interface CommandDeckProps {
  onRun: (command: string) => void;
  disabled?: boolean;
}

const sections: Record<string, CommandItem[]> = {
  "HF Recon": [
    { label: "HF Search", command: "hf search", description: "Identify high-frequency tags in range" },
    { label: "14A Info", command: "hf 14a info", description: "Read ATQA/SAK/UID for ISO14443A cards" },
    { label: "MIFARE Info", command: "hf mf info", description: "Quick MIFARE capabilities snapshot" },
    { label: "Antenna Tune", command: "hw tune", description: "Measure LF/HF coil voltage and resonance" },
  ],
  "MIFARE Ops": [
    { label: "Autopwn (1K)", command: "hf mf autopwn --1k", description: "Extract keys + full dump automatically" },
    { label: "Hardnested", command: "hf mf hardnested --blk 0 -a -k FFFFFFFFFFFF --tblk 4 --ta -w", description: "Run nested attack with nonce capture" },
    { label: "Dump", command: "hf mf dump", description: "Dump all blocks to default filename" },
    { label: "Simulate", command: "hf mf sim -u 353c2aa6", description: "Emulate a card using emulator memory" },
  ],
  "iCLASS & Ultralight": [
    { label: "iCLASS Dump", command: "hf iclass dump --ki 0", description: "Dump iCLASS content using key slot 0" },
    { label: "iCLASS Sim", command: "hf iclass sim -t 3", description: "Emulate iCLASS from loaded dump" },
    { label: "Ultralight Info", command: "hf mfu info", description: "Read Ultralight/NTAG device info" },
    { label: "Ultralight Dump", command: "hf mfu dump -k FFFFFFFF", description: "Backup Ultralight EV1 with default key" },
  ],
  "LF & Wiegand": [
    { label: "LF Search", command: "lf search", description: "Identify low-frequency modulation and tag type" },
    { label: "HID Read", command: "lf hid read", description: "Decode HID Prox credential on the reader" },
    { label: "HID Clone", command: "lf hid clone -w H10301 --fc 101 --cn 1337", description: "Program T55x7 with facility/card values" },
    { label: "Wiegand Encode", command: "wiegand encode --fc 101 --cn 1337", description: "Create raw hex from site + card numbers" },
  ],
  "Data & Scripts": [
    { label: "Grab Samples", command: "data samples -n 40000", description: "Capture up to 40k samples from the antenna" },
    { label: "Save Buffer", command: "data save -f trace.bin", description: "Persist captured data to file" },
    { label: "List Scripts", command: "script list", description: "Enumerate bundled Lua helper scripts" },
    { label: "UID Bruteforce", command: "script run hf_mf_uidbruteforce -h", description: "Bruteforce UID ranges (help output)" },
  ],
};

const sectionIcons: Record<string, React.ReactNode> = {
  "HF Recon": <Radio className="h-4 w-4" />,
  "MIFARE Ops": <Bolt className="h-4 w-4" />,
  "iCLASS & Ultralight": <ShieldHalf className="h-4 w-4" />,
  "LF & Wiegand": <Wifi className="h-4 w-4" />,
  "Data & Scripts": <Database className="h-4 w-4" />,
};

const accentBadges: Record<string, BadgeProps["variant"]> = {
  "HF Recon": "outline",
  "MIFARE Ops": "success",
  "iCLASS & Ultralight": "default",
  "LF & Wiegand": "warning",
  "Data & Scripts": "secondary",
};

export function CommandDeck({ onRun, disabled }: CommandDeckProps) {
  const sectionKeys = Object.keys(sections);

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cable className="h-4 w-4" />
            Ready-Made Actions
          </span>
          <Badge variant="outline">Runs in terminal</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue={sectionKeys[0]}>
          <TabsList className="mb-2 h-10">
            {sectionKeys.map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {key}
              </TabsTrigger>
            ))}
          </TabsList>
          {sectionKeys.map((key) => (
            <TabsContent key={key} value={key} className="m-0">
              <div className="grid grid-cols-1 gap-2">
                {sections[key].map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    size="lg"
                    className="justify-start h-auto py-3 text-left"
                    onClick={() => onRun(item.command)}
                    disabled={disabled}
                  >
                    <div className="flex flex-col items-start gap-1 w-full">
                      <div className="flex items-center gap-2">
                        <Badge variant={accentBadges[key]}>
                          {sectionIcons[key]}
                        </Badge>
                        <span className="font-semibold text-sm">{item.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{item.description}</p>
                      <code className="text-[11px] bg-secondary px-2 py-1 rounded w-full truncate">
                        {item.command}
                      </code>
                    </div>
                  </Button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default CommandDeck;
