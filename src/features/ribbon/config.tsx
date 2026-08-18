import {
  Activity,
  Book,
  Copy,
  Cpu,
  CreditCard,
  Download,
  Edit3,
  FileCode2,
  FolderOpen,
  Key,
  Layers,
  ListChecks,
  Play,
  Plug,
  Radio,
  Search,
  Settings,
  Shield,
  Square,
  Target,
  Upload,
  Wand2,
  Wrench,
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

/**
 * A ribbon strip is a band of command buttons. Strips are *tools*, not places —
 * showing one never changes what you are looking at.
 */
export type RibbonStripId =
  | "connect"
  | "hf"
  | "lf"
  | "attacks"
  | "magic"
  | "traffic"
  | "lfops"
  | "t55xx"
  | "memory"
  | "hex"
  | "library"
  | "utilities"
  | "data"
  | "tools"
  | "shortcuts"
  | "settings";

export const RIBBON_STRIP_LABELS: Record<RibbonStripId, string> = {
  connect: "Connect",
  hf: "HF",
  lf: "LF",
  attacks: "Attacks",
  magic: "Magic",
  traffic: "Traffic",
  lfops: "LF Ops",
  t55xx: "T55xx",
  memory: "Memory",
  hex: "Hex",
  library: "Library",
  utilities: "Utilities",
  data: "Data",
  tools: "Tools",
  shortcuts: "Shortcuts",
  settings: "Settings",
};

/**
 * A workspace is a *place*: picking one always swaps the main panel, and never
 * anything else. This is the split the old ribbon lacked — six of its sixteen
 * tabs quietly threw away whatever workspace you had open, because they were
 * command strips masquerading as destinations.
 */
export interface WorkspaceDefinition {
  value: string;
  label: string;
  icon: string;
  /** Named cluster in the workspace switcher. */
  group: string;
  /** One-line description, shown as the tab's tooltip. */
  hint: string;
  /** Command strips offered here; the first is the default. */
  strips: RibbonStripId[];
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
  plug: Plug,
  folderOpen: FolderOpen,
  wrench: Wrench,
};

export function getIcon(iconName: string, className = "h-3 w-3") {
  const Icon = ICONS[iconName];
  return Icon ? <Icon className={className} /> : <Radio className={className} />;
}

export const WORKSPACES: WorkspaceDefinition[] = [
  {
    value: "connect",
    label: "Session",
    icon: "plug",
    group: "Session",
    hint: "Reader connection, terminal and quick commands",
    strips: ["connect", "hf", "lf", "data", "tools", "shortcuts"],
  },
  {
    value: "guided",
    label: "Guided Clone",
    icon: "wand2",
    group: "Session",
    hint: "Step-by-step source scan, target validation, write and read-back verification",
    strips: ["lf", "t55xx"],
  },

  {
    value: "attacks",
    label: "Attacks",
    icon: "target",
    group: "High Frequency",
    hint: "MIFARE key recovery: autopwn, nested, darkside, dictionaries",
    strips: ["attacks", "hf"],
  },
  {
    value: "magic",
    label: "Magic",
    icon: "wand2",
    group: "High Frequency",
    hint: "Write block 0 and clone onto magic / gen1a cards",
    strips: ["magic", "hf"],
  },
  {
    value: "type2",
    label: "Type 2 / NDEF",
    icon: "fileCode2",
    group: "High Frequency",
    hint: "Read, compose, safely write and verify NFC Type 2 NDEF content",
    strips: ["hf", "memory"],
  },
  {
    value: "traffic",
    label: "Traffic",
    icon: "activity",
    group: "High Frequency",
    hint: "Sniff and replay reader / card traffic",
    strips: ["traffic", "hf"],
  },

  {
    value: "lfops",
    label: "LF Ops",
    icon: "radio",
    group: "Low Frequency",
    hint: "125 kHz read, clone and simulate",
    strips: ["lfops", "lf"],
  },
  {
    value: "t55xx",
    label: "T55xx",
    icon: "cpu",
    group: "Low Frequency",
    hint: "T55xx configuration blocks and writes",
    strips: ["t55xx", "lf"],
  },

  {
    value: "memory",
    label: "Memory",
    icon: "layers",
    group: "Analyze",
    hint: "Block and sector map of the active dump",
    strips: ["memory", "data"],
  },
  {
    value: "hex",
    label: "Hex",
    icon: "fileCode2",
    group: "Analyze",
    hint: "Hex / ASCII view of dumps and cached files",
    strips: ["hex", "data"],
  },
  {
    value: "library",
    label: "Library",
    icon: "book",
    group: "Analyze",
    hint: "Saved cards, keys and dumps in the browser vault",
    strips: ["library", "shortcuts"],
  },
  {
    value: "utilities",
    label: "Utilities",
    icon: "wrench",
    group: "Analyze",
    hint: "Offline APDU, PN532, UID and checksum helpers",
    strips: ["utilities", "tools"],
  },

  {
    value: "device",
    label: "Device",
    icon: "cpu",
    group: "System",
    hint: "Observed hardware, firmware compatibility and command capabilities",
    strips: ["connect", "settings"],
  },
  {
    value: "settings",
    label: "Settings",
    icon: "settings",
    group: "System",
    hint: "Theme and cached-file management",
    strips: ["settings"],
  },
];

const WORKSPACE_BY_VALUE = new Map(WORKSPACES.map((workspace) => [workspace.value, workspace]));

export const DEFAULT_WORKSPACE = "connect";

export function getWorkspace(value: string): WorkspaceDefinition {
  return WORKSPACE_BY_VALUE.get(value) ?? WORKSPACES[0];
}

/**
 * Workspace ids that no longer exist, mapped onto the workspace and strip that
 * took over their content. Keeps saved tabs — and in-app links such as the old
 * "Shortcuts" entry point — landing somewhere sensible.
 */
const RETIRED_WORKSPACES: Record<string, { workspace: string; strip: RibbonStripId }> = {
  hf: { workspace: "connect", strip: "hf" },
  lf: { workspace: "connect", strip: "lf" },
  data: { workspace: "connect", strip: "data" },
  tools: { workspace: "connect", strip: "tools" },
  actions: { workspace: "connect", strip: "shortcuts" },
};

/** Resolve any historical or current tab id to a live workspace + strip. */
export function resolveWorkspace(value: string | null | undefined): {
  workspace: string;
  strip?: RibbonStripId;
} {
  if (!value) return { workspace: DEFAULT_WORKSPACE };
  const retired = RETIRED_WORKSPACES[value];
  if (retired) return retired;
  if (WORKSPACE_BY_VALUE.has(value)) return { workspace: value };
  return { workspace: DEFAULT_WORKSPACE };
}

/** Group consecutive {@link WORKSPACES} that share a group, preserving order. */
export function groupWorkspaces(workspaces: WorkspaceDefinition[] = WORKSPACES) {
  const groups: { name: string; workspaces: WorkspaceDefinition[] }[] = [];
  for (const workspace of workspaces) {
    const last = groups[groups.length - 1];
    if (last && last.name === workspace.group) last.workspaces.push(workspace);
    else groups.push({ name: workspace.group, workspaces: [workspace] });
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
    { icon: "creditCard", label: "Read", command: "lf hid reader" },
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
