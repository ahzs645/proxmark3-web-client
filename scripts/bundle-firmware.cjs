#!/usr/bin/env node
/**
 * Copy locally built device firmware into public/firmware/ and write the
 * manifest the in-app flasher reads, so the app ships firmware that matches
 * its own WASM client (same capabilities version) instead of relying on a
 * remote server.
 *
 * Usage:
 *   node scripts/bundle-firmware.cjs <build-dir> [--date YYYY-MM-DD]
 *
 * <build-dir> holds one folder per platform, each with bootrom.elf and
 * fullimage.elf: pm3generic/, pm3rdv4/, pm5/ (any subset). The version is
 * read from the fullimage's embedded "Iceman/.../v4.NNNNN-..." string.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PLATFORMS = {
  pm3generic: {
    platform: "PM3GENERIC",
    label: "PM3 Easy / Generic",
    description: "RRG/Iceman firmware for PM3 Easy (PM3GENERIC) with LED support",
  },
  pm3rdv4: {
    platform: "PM3RDV4",
    label: "Proxmark3 RDV4",
    description: "RRG/Iceman firmware for the Proxmark3 RDV4 with smartcard, flash and BT support",
  },
  pm5: {
    platform: "PM5",
    label: "Proxmark5",
    description: "RRG/Iceman firmware for the Proxmark5 with the BLE/Wi-Fi module (BWM)",
  },
};

const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.join(repoRoot, "public", "firmware");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function embeddedVersion(file) {
  const match = fs
    .readFileSync(file)
    .toString("latin1")
    .match(/Iceman\/[^/\s]+\/v(\d+\.\d+)(-\d+-g[0-9a-f]+)?/);
  if (!match) throw new Error(`No Iceman version string in ${file}`);
  return { version: match[1], build: `v${match[1]}${match[2] ?? ""}` };
}

function main() {
  const args = process.argv.slice(2);
  const buildDir = args.find((arg) => !arg.startsWith("--"));
  const dateIndex = args.indexOf("--date");
  const buildDate = dateIndex >= 0 ? args[dateIndex + 1] : new Date().toISOString().slice(0, 10);
  if (!buildDir) {
    console.error("Usage: node scripts/bundle-firmware.cjs <build-dir> [--date YYYY-MM-DD]");
    process.exit(1);
  }

  const firmwares = [];
  fs.rmSync(outRoot, { recursive: true, force: true });

  for (const [folder, meta] of Object.entries(PLATFORMS)) {
    const source = path.join(buildDir, folder);
    const bootrom = path.join(source, "bootrom.elf");
    const fullimage = path.join(source, "fullimage.elf");
    if (!fs.existsSync(bootrom) || !fs.existsSync(fullimage)) continue;

    const { version, build } = embeddedVersion(fullimage);
    const id = `bundled-${folder}-${build}`;
    const target = path.join(outRoot, id);
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(bootrom, path.join(target, "bootrom.elf"));
    fs.copyFileSync(fullimage, path.join(target, "fullimage.elf"));

    firmwares.push({
      id,
      display_name: `RRG/Iceman ${build} (${meta.label})`,
      version,
      description: `${meta.description}. Built to match this app's client.`,
      platform: meta.platform,
      recommended: true,
      build_date: buildDate,
      files: { bootloader: `${id}/bootrom.elf`, fullimage: `${id}/fullimage.elf` },
      checksums: {
        bootloader_sha256: sha256(bootrom),
        fullimage_sha256: sha256(fullimage),
      },
    });
    console.log(`bundled ${id}`);
  }

  if (firmwares.length === 0) {
    console.error(`No <platform>/bootrom.elf + fullimage.elf found under ${buildDir}`);
    process.exit(1);
  }
  fs.writeFileSync(
    path.join(outRoot, "manifest.json"),
    `${JSON.stringify({ manifest_version: 1, firmwares }, null, 2)}\n`,
  );
}

main();
