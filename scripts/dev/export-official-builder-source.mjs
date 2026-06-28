#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PKG_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const levelId = args.level ?? "level_03_human_museum";
const outputByLevelId = {
  level_01_maintenance_bay: "src/game/config/levels/level01-maintenance-bay/level.official.builder.json",
  level_02_residential_simulation: "src/game/config/levels/level02-residential-simulation/level.official.builder.json",
  level_03_human_museum: "src/game/config/levels/level03-human-museum/level.official.builder.json",
  level_04_memory_clinic: "src/game/config/levels/level04-memory-clinic/level.official.builder.json",
  level_05_reclamation_core: "src/game/config/levels/level05-reclamation-core/level.official.builder.json",
};
const outPath = resolve(PKG_ROOT, args.out ?? outputByLevelId[levelId] ?? `src/game/config/levels/${levelId}/level.official.builder.json`);

const server = await createServer({
  root: PKG_ROOT,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { officialBuilderDocumentFromBuiltInLevel } = await server.ssrLoadModule("/src/build/official-builder/officialBuilderDocuments.ts");
  const document = officialBuilderDocumentFromBuiltInLevel(levelId, { preferCanonical: false });
  if (!document) throw new Error(`No official builder document can be generated for ${levelId}.`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Wrote ${relativePath(outPath)} from ${levelId}`);
} finally {
  await server.close();
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (value.startsWith("--level=")) parsed.level = value.slice("--level=".length);
    else if (value.startsWith("--out=")) parsed.out = value.slice("--out=".length);
  }
  return parsed;
}

function relativePath(filePath) {
  const absolute = resolve(filePath);
  return absolute.startsWith(PKG_ROOT) ? absolute.slice(PKG_ROOT.length + 1) : absolute;
}
