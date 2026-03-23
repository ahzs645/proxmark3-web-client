export const ACCESS_PRESETS = {
  transport: {
    label: "Transport",
    description: "Factory default - all blocks readable/writable with Key A or B",
    c0: 0,
    c1: 0,
    c2: 0,
    c3: 1,
    hex: "FF0780",
  },
  keyBProtected: {
    label: "Key B Protected",
    description: "Key B can't be read, used for higher security",
    c0: 0,
    c1: 0,
    c2: 0,
    c3: 3,
    hex: "7F0788",
  },
  readOnly: {
    label: "Read Only",
    description: "Data blocks can only be read, not written",
    c0: 2,
    c1: 2,
    c2: 2,
    c3: 1,
    hex: "078F00",
  },
  valueBlock: {
    label: "Value Block",
    description: "Optimized for value operations (increment/decrement)",
    c0: 6,
    c1: 6,
    c2: 6,
    c3: 3,
    hex: "08778F",
  },
  locked: {
    label: "Locked",
    description: "No operations possible - IRREVERSIBLE!",
    c0: 7,
    c1: 7,
    c2: 7,
    c3: 7,
    hex: "000000",
  },
} as const;

export type AccessPresetKey = keyof typeof ACCESS_PRESETS;
