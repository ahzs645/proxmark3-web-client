import type { KeyType, MagicCardType } from "./types";

interface SetUidCommandInput {
  cardType: MagicCardType;
  uid: string;
  atqa: string;
  sak: string;
  gen4Password: string;
}

interface WriteBlock0CommandInput {
  cardType: MagicCardType;
  block0Preview: string;
  authKeyType: KeyType;
  authKey: string;
  gen4Password: string;
}

export function buildDetectCommand(): string {
  return "hf mf info";
}

export function buildSetUidCommand({
  cardType,
  uid,
  atqa,
  sak,
  gen4Password,
}: SetUidCommandInput): string | null {
  switch (cardType) {
    case "gen1a":
      return `hf mf csetuid -u ${uid}`;
    case "gen2":
      return `hf mf csetuid -u ${uid} --atqa ${atqa} --sak ${sak}`;
    case "gen3":
      return `hf mf gen3uid -u ${uid}`;
    case "gen4":
      return `hf mf gdmsetuid -u ${uid} -p ${gen4Password}`;
    default:
      return null;
  }
}

export function buildWriteBlock0Command({
  cardType,
  block0Preview,
  authKeyType,
  authKey,
  gen4Password,
}: WriteBlock0CommandInput): string | null {
  switch (cardType) {
    case "gen1a":
      return `hf mf csetblk --blk 0 -d ${block0Preview}`;
    case "gen2":
      return `hf mf wrbl 0 ${authKeyType.toLowerCase()} ${authKey} ${block0Preview}`;
    case "gen4":
      return `hf mf gdmsetblk --blk 0 -d ${block0Preview} -p ${gen4Password}`;
    default:
      return `hf mf csetblk --blk 0 -d ${block0Preview}`;
  }
}

export function buildUnlockCommands(cardType: MagicCardType, gen4Password: string): string[] {
  switch (cardType) {
    case "gen1a":
      return ["hf 14a raw -a -k -b 7 40", "hf 14a raw -a -k 43"];
    case "gen4":
      return [`hf mf gdmcfg -p ${gen4Password}`];
    default:
      return [];
  }
}

export function buildWipeCommand(cardType: MagicCardType, gen4Password: string): string | null {
  switch (cardType) {
    case "gen1a":
      return "hf mf cwipe";
    case "gen2":
      return "hf mf cwipe --gen2";
    case "gen4":
      return `hf mf gdmwipe -p ${gen4Password}`;
    default:
      return "hf mf cwipe";
  }
}

export function buildViewCardCommand(): string {
  return "hf mf cview";
}

export function buildLoadDumpCommand(): string {
  return "hf mf cload";
}
