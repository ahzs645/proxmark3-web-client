import {
  Activity,
  Book,
  Copy,
  Cpu,
  CreditCard,
  Download,
  Edit3,
  FileCode2,
  Key,
  Layers,
  ListChecks,
  Play,
  Radio,
  Search,
  Settings,
  Shield,
  Square,
  Target,
  Upload,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface RibbonAction {
  icon: string;
  label: string;
  command: string;
  variant?: "default" | "outline";
}

export interface RibbonCardType {
  value: string;
  label: string;
}

export interface RibbonTabDefinition {
  value: string;
  label: string;
  icon?: string;
  /** Named cluster this tab belongs to in the ribbon nav. */
  group: string;
}

const ICONS: Record<string, LucideIcon> = {
  target: Target,
  wand2: Wand2,
  activity: Activity,
  radio: Radio,
  cpu: Cpu,
  layers: Layers,
  fileCode2: FileCode2,
  book: Book,
  settings: Settings,
  creditCard: CreditCard,
  copy: Copy,
  play: Play,
  download: Download,
  upload: Upload,
  search: Search,
  key: Key,
  shield: Shield,
  square: Square,
  edit: Edit3,
  listchecks: ListChecks,
  zap: Zap,
};

export function getIcon(iconName: string, className = "h-3 w-3") {
  const Icon = ICONS[iconName];
  return Icon ? <Icon className={className} /> : <Radio className={className} />;
}

// Tabs are ordered by task domain and clustered into named groups. Two kinds of
// tab live here: command launchers that keep you on the workbench (Connect, HF,
// LF, Data, Tools, Shortcuts) and workspace destinations that open a panel
// (Attacks, Magic, Memory, Library, …). Grouping by domain keeps related ones
// adjacent instead of one flat undifferentiated row.
export const RIBBON_TABS: RibbonTabDefinition[] = [
  { value: "connect", label: "Connect", group: "Session" },

  { value: "hf", label: "HF", group: "High Frequency" },
  { value: "attacks", label: "Attacks", icon: "target", group: "High Frequency" },
  { value: "magic", label: "Magic", icon: "wand2", group: "High Frequency" },
  { value: "traffic", label: "Traffic", icon: "activity", group: "High Frequency" },

  { value: "lf", label: "LF", group: "Low Frequency" },
  { value: "lfops", label: "LF Ops", icon: "radio", group: "Low Frequency" },
  { value: "t55xx", label: "T55xx", icon: "cpu", group: "Low Frequency" },

  { value: "memory", label: "Memory", icon: "layers", group: "Analyze" },
  { value: "hex", label: "Hex", icon: "fileCode2", group: "Analyze" },
  { value: "library", label: "Library", icon: "book", group: "Analyze" },

  { value: "data", label: "Data", group: "Tools" },
  { value: "tools", label: "Tools", group: "Tools" },
  { value: "actions", label: "Shortcuts", group: "Tools" },
  { value: "utilities", label: "Utilities", icon: "cpu", group: "Tools" },

  { value: "settings", label: "Settings", icon: "settings", group: "System" },
];

/** Group consecutive {@link RIBBON_TABS} that share a group, preserving order. */
export function groupRibbonTabs(tabs: RibbonTabDefinition[] = RIBBON_TABS) {
  const groups: { name: string; tabs: RibbonTabDefinition[] }[] = [];
  for (const tab of tabs) {
    const last = groups[groups.length - 1];
    if (last && last.name === tab.group) last.tabs.push(tab);
    else groups.push({ name: tab.group, tabs: [tab] });
  }
  return groups;
}

export const LF_CARD_TYPES: RibbonCardType[] = [
  { value: "em4x", label: "EM4x" },
  { value: "hid", label: "HID" },
  { value: "t55xx", label: "T55xx" },
  { value: "indala", label: "Indala" },
  { value: "wiegand", label: "Wiegand" },
];

export const HF_CARD_TYPES: RibbonCardType[] = [
  { value: "mfclassic", label: "MIFARE Classic" },
  { value: "mfultralight", label: "MIFARE Ultralight" },
  { value: "iclass", label: "iClass" },
  { value: "desfire", label: "DESFire" },
  { value: "attacks", label: "Attacks" },
];

export const LF_CARD_OPERATIONS: Record<string, RibbonAction[]> = {
  em4x: [
    { icon: "radio", label: "Read", command: "lf em 410x reader" },
    { icon: "copy", label: "Clone", command: "lf em 410x clone" },
    { icon: "play", label: "Sim", command: "lf em 410x sim" },
  ],
  hid: [
    { icon: "creditCard", label: "Read", command: "lf hid read" },
    { icon: "copy", label: "Clone", command: "lf hid clone" },
    { icon: "play", label: "Sim", command: "lf hid sim" },
    { icon: "zap", label: "Brute", command: "lf hid brute -w H10301 -f 101" },
  ],
  t55xx: [
    { icon: "search", label: "Detect", command: "lf t55xx detect" },
    { icon: "download", label: "Dump", command: "lf t55xx dump" },
    { icon: "edit", label: "Write", command: "lf t55xx write" },
    { icon: "square", label: "Wipe", command: "lf t55xx wipe" },
  ],
  indala: [
    { icon: "radio", label: "Read", command: "lf indala read" },
    { icon: "copy", label: "Clone", command: "lf indala clone" },
    { icon: "play", label: "Sim", command: "lf indala sim" },
  ],
  wiegand: [
    { icon: "book", label: "List", command: "wiegand list" },
    { icon: "download", label: "Encode", command: "wiegand encode --fc 101 --cn 1337" },
    { icon: "upload", label: "Decode", command: "wiegand decode --raw 2006f623ae" },
  ],
};

export const HF_CARD_OPERATIONS: Record<string, RibbonAction[]> = {
  mfclassic: [
    { icon: "creditCard", label: "Info", command: "hf mf info" },
    { icon: "key", label: "Autopwn", command: "hf mf autopwn", variant: "default" },
    { icon: "download", label: "Dump", command: "hf mf dump" },
    { icon: "upload", label: "Restore", command: "hf mf restore" },
    { icon: "play", label: "Sim", command: "hf mf sim" },
  ],
  mfultralight: [
    { icon: "creditCard", label: "Info", command: "hf mfu info" },
    { icon: "download", label: "Dump", command: "hf mfu dump" },
    { icon: "play", label: "Sim", command: "hf mfu sim -t 7" },
  ],
  iclass: [
    { icon: "shield", label: "Info", command: "hf iclass info" },
    { icon: "download", label: "Dump", command: "hf iclass dump" },
    { icon: "key", label: "Keys", command: "hf iclass managekeys -p" },
    { icon: "play", label: "Sim", command: "hf iclass sim -t 3" },
  ],
  desfire: [
    { icon: "creditCard", label: "Info", command: "hf mfdes info" },
    { icon: "book", label: "List Apps", command: "hf mfdes lsapp" },
    { icon: "key", label: "Auth", command: "hf mfdes auth" },
  ],
  attacks: [
    {
      icon: "zap",
      label: "Hardnested",
      command: "hf mf hardnested --blk 0 -a -k FFFFFFFFFFFF --tblk 4 --ta -w",
    },
    { icon: "key", label: "Nested", command: "hf mf nested 1 0 a FFFFFFFFFFFF" },
    { icon: "shield", label: "Darkside", command: "hf mf darkside" },
    { icon: "listchecks", label: "Chk Keys", command: "hf mf chk --1k -f mfc_default_keys" },
  ],
};
