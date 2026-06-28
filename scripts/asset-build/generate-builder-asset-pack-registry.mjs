#!/usr/bin/env node
// Human Protocol builder asset-pack import bridge.
//
// Validates external asset-pack manifests (hp.builder.assetPack.v1) and emits
// the generated TypeScript fragments that plug pack assets into:
//   - src/assets/registry/environment/generatedBuilderAssetPacks.ts  (3D/runtime GLB registry)
//   - src/build/generatedBuilderAssetCatalog.ts                      (/build furniture catalog)
//   - src/build/generatedBuilderAssetFootprints.ts                   (2D blueprint silhouettes)
//
// Usage:
//   node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest <path> --check [--pending]
//   node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit [--manifest <path>] [--out-dir <dir>]
//
//   --check     structural validation; plus registry/catalog/footprint integration
//               checks unless --pending (use --pending for packs not ingested yet).
//   --emit      regenerate the generated fragments from ingested-packs.json.
//               With --manifest, registers that manifest (ingest: "generated") first.
//               With --out-dir, emits ONLY the given manifest's fragments to that
//               directory (test/preview mode; the index is not touched).
//
// This file is also imported as a library by scripts/qa/builder-headless-check.mjs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const packSchemaVersion = "hp.builder.assetPack.v1";
export const ingestedIndexSchemaVersion = "hp.builder.ingestedPacks.v1";

export const supportedAssetKinds = ["furniture", "roomKit", "robot", "clue", "material"];
export const supportedMounts = ["floor", "wall", "ceiling", "tabletop"];
export const supportedWallPreferred = ["back", "none"];
/** Must mirror BuilderPropGroup in src/build/BuilderAssetCatalog.ts. */
export const supportedGroups = ["密室精选", "故事线索", "维修", "居住", "博物馆", "诊疗", "核心", "赛博", "官卡重制", "自动家具"];
/** Must mirror BuilderPropFamily in src/build/BuilderAssetCatalog.ts. */
export const supportedFamilies = [
  "desk",
  "cabinet",
  "drawer_chest",
  "bookshelf",
  "display_case",
  "safe",
  "chair",
  "sofa_bench",
  "bed_or_exam_table",
  "control_console",
  "storage_crate",
  "wall_panel_or_picture_frame",
];
/** Must mirror FootprintFamily (minus "generic") in src/build/BuilderAssetFootprints.tsx. */
export const supportedFootprintFamilies = [
  "table",
  "chair",
  "sofa",
  "bed",
  "cabinet",
  "wall_panel",
  "crate",
  "books",
  "lamp",
  "display_case",
  "column",
  "barrier",
  "pedestal",
];
export const modelKeyPattern = /^[a-z][a-z0-9_]{2,63}$/;
export const sizeTolerance = 0.005;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..", "..");
export const ingestedIndexPath = path.join(repoRoot, "src/assets/manifests/builder/ingested-packs.json");
export const fragmentTargets = {
  registry: path.join(repoRoot, "src/assets/registry/environment/generatedBuilderAssetPacks.ts"),
  catalog: path.join(repoRoot, "src/build/generatedBuilderAssetCatalog.ts"),
  footprints: path.join(repoRoot, "src/build/generatedBuilderAssetFootprints.ts"),
};

export function loadManifest(manifestPath) {
  const absolute = path.resolve(manifestPath);
  const manifest = JSON.parse(readFileSync(absolute, "utf8"));
  return { manifest, manifestDir: path.dirname(absolute), manifestPath: absolute };
}

export function loadIngestedIndex() {
  const index = JSON.parse(readFileSync(ingestedIndexPath, "utf8"));
  if (index.schemaVersion !== ingestedIndexSchemaVersion) {
    throw new Error(`ingested-packs.json schemaVersion must be ${ingestedIndexSchemaVersion}`);
  }
  return index;
}

/** Structural validation: schema, naming, files on disk, sane metadata. Returns error strings. */
export function validateManifestStructure(manifest, manifestDir) {
  const errors = [];
  const issue = (message) => errors.push(message);

  if (!manifest || typeof manifest !== "object") return ["manifest is not an object"];
  if (manifest.schemaVersion !== packSchemaVersion) issue(`schemaVersion must be "${packSchemaVersion}"`);
  if (typeof manifest.packId !== "string" || !modelKeyPattern.test(manifest.packId)) {
    issue(`packId must match ${modelKeyPattern}`);
  }
  if (!manifest.label) issue("label is required");
  if (!manifest.sourceTool) issue("sourceTool is required");
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    issue("assets must be a non-empty array");
    return errors;
  }

  const seenKeys = new Set();
  for (const entry of manifest.assets) {
    const where = `asset "${entry?.modelKey ?? "?"}"`;
    if (typeof entry?.modelKey !== "string" || !modelKeyPattern.test(entry.modelKey)) {
      issue(`${where}: modelKey must match ${modelKeyPattern}`);
      continue;
    }
    if (seenKeys.has(entry.modelKey)) issue(`${where}: duplicate modelKey in pack`);
    seenKeys.add(entry.modelKey);

    if (!entry.label) issue(`${where}: label is required`);
    if (!supportedAssetKinds.includes(entry.assetKind)) issue(`${where}: unsupported assetKind "${entry.assetKind}"`);
    if (!entry.family) issue(`${where}: family is required`);
    if (entry.assetKind === "furniture" && !supportedFamilies.includes(entry.family)) {
      issue(`${where}: furniture family "${entry.family}" not in BuilderPropFamily (${supportedFamilies.join("|")})`);
    }
    if (entry.group !== undefined && !supportedGroups.includes(entry.group)) {
      issue(`${where}: group "${entry.group}" not in BuilderPropGroup (${supportedGroups.join("|")})`);
    }
    if (!entry.source) issue(`${where}: source is required`);
    if (!entry.sourceAssetId) issue(`${where}: sourceAssetId is required`);

    if (typeof entry.glbFile !== "string" || !entry.glbFile.endsWith(".glb")) {
      issue(`${where}: glbFile must be a .glb path relative to the manifest`);
    } else if (!existsSync(path.resolve(manifestDir, entry.glbFile))) {
      issue(`${where}: glbFile not found: ${entry.glbFile}`);
    }
    if (entry.previewFile && !existsSync(path.resolve(manifestDir, entry.previewFile))) {
      issue(`${where}: previewFile not found: ${entry.previewFile}`);
    }

    const size = entry.sizeMeters;
    if (!Array.isArray(size) || size.length !== 3 || size.some((value) => !Number.isFinite(value) || value <= 0.05)) {
      issue(`${where}: sizeMeters must be 3 finite numbers > 0.05`);
    }

    if (entry.mount !== undefined && !supportedMounts.includes(entry.mount)) {
      issue(`${where}: unsupported mount "${entry.mount}"`);
    }
    if (entry.wallPreferred !== undefined && !supportedWallPreferred.includes(entry.wallPreferred)) {
      issue(`${where}: unsupported wallPreferred "${entry.wallPreferred}"`);
    }
    if (entry.supportSurfaces !== undefined) {
      if (!Array.isArray(entry.supportSurfaces)) {
        issue(`${where}: supportSurfaces must be an array`);
      } else {
        const seenSurfaceIds = new Set();
        for (const surface of entry.supportSurfaces) {
          if (!surface || typeof surface !== "object") {
            issue(`${where}: supportSurface must be an object`);
            continue;
          }
          if (typeof surface.id !== "string" || !modelKeyPattern.test(surface.id)) issue(`${where}: supportSurface id must match ${modelKeyPattern}`);
          else if (seenSurfaceIds.has(surface.id)) issue(`${where}: duplicate supportSurface id "${surface.id}"`);
          else seenSurfaceIds.add(surface.id);
          if (!["tabletop", "shelf", "smallPropTop"].includes(surface.kind)) issue(`${where}: unsupported supportSurface kind "${surface.kind}"`);
          if (!Array.isArray(surface.localCenter) || surface.localCenter.length !== 3 || surface.localCenter.some((value) => !Number.isFinite(value))) {
            issue(`${where}: supportSurface localCenter must be 3 finite numbers`);
          }
          if (!Array.isArray(surface.size) || surface.size.length !== 2 || surface.size.some((value) => !Number.isFinite(value) || value <= 0.05)) {
            issue(`${where}: supportSurface size must be 2 finite numbers > 0.05`);
          }
          if (surface.maxChildHeight !== undefined && (!Number.isFinite(surface.maxChildHeight) || surface.maxChildHeight <= 0.05)) {
            issue(`${where}: supportSurface maxChildHeight must be > 0.05`);
          }
        }
      }
    }
    if (entry.stacking !== undefined) {
      if (!entry.stacking || typeof entry.stacking !== "object") issue(`${where}: stacking must be an object`);
      if (entry.stacking?.canRestOn !== undefined) {
        const allowed = ["floor", "tabletop", "shelf", "smallPropTop"];
        if (!Array.isArray(entry.stacking.canRestOn) || entry.stacking.canRestOn.some((kind) => !allowed.includes(kind))) {
          issue(`${where}: stacking.canRestOn must contain only ${allowed.join("|")}`);
        }
      }
      if (entry.stacking?.maxStackLayers !== undefined && (!Number.isInteger(entry.stacking.maxStackLayers) || entry.stacking.maxStackLayers < 0)) {
        issue(`${where}: stacking.maxStackLayers must be a non-negative integer`);
      }
      if (entry.stacking?.footprint !== undefined) {
        const footprint = entry.stacking.footprint;
        if (!Array.isArray(footprint) || footprint.length !== 2 || footprint.some((value) => !Number.isFinite(value) || value <= 0.05)) {
          issue(`${where}: stacking.footprint must be 2 finite numbers > 0.05`);
        }
      }
      if (entry.stacking?.height !== undefined && (!Number.isFinite(entry.stacking.height) || entry.stacking.height <= 0.05)) {
        issue(`${where}: stacking.height must be > 0.05`);
      }
    }
    if (entry.clueCapacity !== undefined && (!Number.isInteger(entry.clueCapacity) || entry.clueCapacity < 0)) {
      issue(`${where}: clueCapacity must be a non-negative integer`);
    }
    if (entry.assetKind === "furniture") {
      if (!entry.footprintFamily) issue(`${where}: furniture requires footprintFamily`);
      else if (!supportedFootprintFamilies.includes(entry.footprintFamily)) {
        issue(`${where}: unsupported footprintFamily "${entry.footprintFamily}"`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Fragment emission (pure + deterministic: sorted keys, no timestamps)
// ---------------------------------------------------------------------------

function relImport(fromFileAbs, toFileAbs, keepExtension = false) {
  const target = keepExtension ? toFileAbs : toFileAbs.replace(/\.(ts|tsx)$/, "");
  let rel = path.relative(path.dirname(fromFileAbs), target).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function banner(packs) {
  const sources = packs.length > 0 ? packs.map((pack) => pack.manifest.packId).sort().join(", ") : "(none)";
  return [
    "// AUTO-GENERATED by scripts/asset-build/generate-builder-asset-pack-registry.mjs — DO NOT EDIT.",
    "// Regenerate: node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit",
    `// Source packs: ${sources}`,
  ].join("\n");
}

function sortedAssets(packs, filter) {
  const rows = [];
  for (const pack of packs) {
    for (const entry of pack.manifest.assets) {
      if (filter(entry)) rows.push({ entry, manifestDir: pack.manifestDir });
    }
  }
  rows.sort((a, b) => a.entry.modelKey.localeCompare(b.entry.modelKey));
  return rows;
}

const quote = (value) => JSON.stringify(value);
const vec3 = (size) => `[${size[0]}, ${size[1]}, ${size[2]}]`;

/**
 * Builds the three TypeScript fragments for the given generated packs.
 * `targets` are absolute output paths (used to compute relative imports).
 */
export function emitFragments(packs, targets = fragmentTargets) {
  const typesPath = path.join(repoRoot, "src/assets/registry/environment/types.ts");
  const catalogPath = path.join(repoRoot, "src/build/BuilderAssetCatalog.ts");
  const footprintsPath = path.join(repoRoot, "src/build/BuilderAssetFootprints.tsx");

  // Registry: every asset that ships a GLB becomes an environment model.
  const registryRows = sortedAssets(packs, (entry) => Boolean(entry.glbFile));
  const registryImports = registryRows.map(({ entry, manifestDir }, index) => {
    const glbAbs = path.resolve(manifestDir, entry.glbFile);
    return `import glbUrl${index} from ${quote(relImport(targets.registry, glbAbs, true) + "?url")};`;
  });
  const registryEntries = registryRows.map(
    ({ entry }, index) =>
      `  ${entry.modelKey}: {\n` +
      `    modelKey: ${quote(entry.modelKey)},\n` +
      `    url: glbUrl${index},\n` +
      `    category: "room",\n` +
      `    sizeMeters: ${vec3(entry.sizeMeters)},\n` +
      `  },`,
  );
  const registry = [
    banner(packs),
    `import type { EnvironmentModelRegistry } from ${quote(relImport(targets.registry, typesPath))};`,
    ...(registryImports.length > 0 ? ["", ...registryImports] : []),
    "",
    "export const generatedBuilderPackEnvironmentModelAssets = {",
    ...registryEntries,
    "} as const satisfies EnvironmentModelRegistry;",
    "",
  ].join("\n");

  // Catalog + footprints: furniture only (room kits etc. are future extensions).
  const furnitureRows = sortedAssets(packs, (entry) => entry.assetKind === "furniture");
  const catalogEntries = furnitureRows.map(({ entry }) => {
    const fields = [
      `modelKey: ${quote(entry.modelKey)}`,
      `label: ${quote(entry.label)}`,
      `group: ${quote(entry.group ?? "自动家具")}`,
      `source: ${quote(entry.source)}`,
      `sourceAssetId: ${quote(entry.sourceAssetId)}`,
      `family: ${quote(entry.family)}`,
      entry.presetId !== undefined ? `presetId: ${quote(entry.presetId)}` : null,
      entry.themeId !== undefined ? `themeId: ${quote(entry.themeId)}` : null,
      `mount: ${quote(entry.mount ?? "floor")}`,
      entry.wallPreferred !== undefined ? `wallPreferred: ${quote(entry.wallPreferred)}` : null,
      entry.canHoldSmallProps !== undefined ? `canHoldSmallProps: ${entry.canHoldSmallProps}` : null,
      entry.supportSurfaces !== undefined ? `supportSurfaces: ${JSON.stringify(entry.supportSurfaces)}` : null,
      entry.stacking !== undefined ? `stacking: ${JSON.stringify(entry.stacking)}` : null,
      entry.clueCapacity !== undefined ? `clueCapacity: ${entry.clueCapacity}` : null,
      `sizeMeters: ${vec3(entry.sizeMeters)}`,
      `solid: ${entry.solid === true}`,
    ].filter(Boolean);
    return `  {\n    ${fields.join(",\n    ")},\n  },`;
  });
  const catalog = [
    banner(packs),
    `import type { BuilderPropEntry } from ${quote(relImport(targets.catalog, catalogPath))};`,
    "",
    "export const generatedBuilderPackPropEntries: readonly BuilderPropEntry[] = [",
    ...catalogEntries,
    "];",
    "",
  ].join("\n");

  const footprintEntries = furnitureRows.map(({ entry }) => `  ${entry.modelKey}: ${quote(entry.footprintFamily)},`);
  const footprints = [
    banner(packs),
    `import type { FootprintFamily } from ${quote(relImport(targets.footprints, footprintsPath))};`,
    "",
    "export const generatedBuilderPackFootprints: Record<string, FootprintFamily> = {",
    ...footprintEntries,
    "};",
    "",
  ].join("\n");

  return [
    { path: targets.registry, content: registry },
    { path: targets.catalog, content: catalog },
    { path: targets.footprints, content: footprints },
  ];
}

export function writeFragments(fragments) {
  for (const fragment of fragments) {
    mkdirSync(path.dirname(fragment.path), { recursive: true });
    writeFileSync(fragment.path, fragment.content);
  }
}

/** Cross-pack duplicate-key check; manual packs reserve their keys. */
export function findDuplicateModelKeys(packs) {
  const owners = new Map();
  const duplicates = [];
  for (const pack of packs) {
    for (const entry of pack.manifest.assets) {
      const owner = owners.get(entry.modelKey);
      if (owner && owner !== pack.manifest.packId) {
        duplicates.push(`modelKey "${entry.modelKey}" claimed by both "${owner}" and "${pack.manifest.packId}"`);
      } else {
        owners.set(entry.modelKey, pack.manifest.packId);
      }
    }
  }
  return duplicates;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function integrationCheck(manifest) {
  const { createServer } = await import("vite");
  const server = await createServer({ root: repoRoot, appType: "custom", logLevel: "error", server: { middlewareMode: true } });
  const errors = [];
  try {
    const { environmentModelAssets } = await server.ssrLoadModule("/src/assets/environmentModelAssets.ts");
    const { builderPropCatalog } = await server.ssrLoadModule("/src/build/BuilderAssetCatalog.ts");
    const { footprintFamily } = await server.ssrLoadModule("/src/build/BuilderAssetFootprints.tsx");
    for (const entry of manifest.assets) {
      const registry = environmentModelAssets[entry.modelKey];
      if (!registry) {
        errors.push(`"${entry.modelKey}" missing from environmentModelAssets (run --emit or register manually)`);
        continue;
      }
      if (registry.sizeMeters.some((value, axis) => Math.abs(value - entry.sizeMeters[axis]) > sizeTolerance)) {
        errors.push(`"${entry.modelKey}" registry sizeMeters drifted from manifest`);
      }
      if (entry.assetKind !== "furniture") continue;
      const catalogEntry = builderPropCatalog.find((candidate) => candidate.modelKey === entry.modelKey);
      if (!catalogEntry) {
        errors.push(`"${entry.modelKey}" missing from builderPropCatalog`);
        continue;
      }
      if (catalogEntry.sizeMeters.some((value, axis) => Math.abs(value - entry.sizeMeters[axis]) > sizeTolerance)) {
        errors.push(`"${entry.modelKey}" catalog sizeMeters drifted from manifest`);
      }
      const family = footprintFamily(entry.modelKey);
      if (family === "generic") errors.push(`"${entry.modelKey}" footprintFamily resolves to generic`);
      else if (family !== entry.footprintFamily) {
        errors.push(`"${entry.modelKey}" footprintFamily mismatch: manifest=${entry.footprintFamily} resolved=${family}`);
      }
    }
  } finally {
    await server.close();
  }
  return errors;
}

function parseArgs(argv) {
  const args = { check: false, emit: false, pending: false, manifest: null, outDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--emit") args.emit = true;
    else if (arg === "--pending") args.pending = true;
    else if (arg === "--manifest") args.manifest = argv[++index];
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.check && !args.emit) {
    console.error("usage: --manifest <path> --check [--pending] | --emit [--manifest <path>] [--out-dir <dir>]");
    process.exit(2);
  }

  if (args.check) {
    if (!args.manifest) throw new Error("--check requires --manifest");
    const { manifest, manifestDir } = loadManifest(args.manifest);
    const structural = validateManifestStructure(manifest, manifestDir);
    if (structural.length > 0) {
      console.error(`FAIL structural validation (${structural.length}):`);
      for (const error of structural) console.error("  - " + error);
      process.exit(1);
    }
    console.log(`PASS structural: ${manifest.packId} (${manifest.assets.length} assets, GLBs on disk, metadata sane)`);
    if (args.pending) {
      console.log("SKIP integration checks (--pending: pack not ingested yet)");
      return;
    }
    const integration = await integrationCheck(manifest);
    if (integration.length > 0) {
      console.error(`FAIL integration (${integration.length}):`);
      for (const error of integration) console.error("  - " + error);
      process.exit(1);
    }
    console.log("PASS integration: registry + catalog + footprints + dimensions all match");
    return;
  }

  // --emit
  if (args.outDir) {
    if (!args.manifest) throw new Error("--emit --out-dir requires --manifest (preview mode)");
    const pack = loadManifest(args.manifest);
    const structural = validateManifestStructure(pack.manifest, pack.manifestDir);
    if (structural.length > 0) throw new Error("manifest invalid:\n  - " + structural.join("\n  - "));
    const outDir = path.resolve(args.outDir);
    const fragments = emitFragments([pack], {
      registry: path.join(outDir, "generatedBuilderAssetPacks.ts"),
      catalog: path.join(outDir, "generatedBuilderAssetCatalog.ts"),
      footprints: path.join(outDir, "generatedBuilderAssetFootprints.ts"),
    });
    writeFragments(fragments);
    for (const fragment of fragments) console.log("wrote " + path.relative(repoRoot, fragment.path));
    return;
  }

  const index = loadIngestedIndex();
  if (args.manifest) {
    const manifestRel = path.relative(repoRoot, path.resolve(args.manifest)).split(path.sep).join("/");
    if (manifestRel.startsWith("..")) throw new Error("manifest must live inside the game root before ingestion (copy the pack under src/assets/asset-packs/<packId>/)");
    if (!index.packs.some((pack) => pack.manifest === manifestRel)) {
      index.packs.push({ manifest: manifestRel, ingest: "generated" });
      index.packs.sort((a, b) => a.manifest.localeCompare(b.manifest));
      writeFileSync(ingestedIndexPath, JSON.stringify(index, null, 2) + "\n");
      console.log(`registered ${manifestRel} in ingested-packs.json (ingest: generated)`);
    }
  }

  const allPacks = index.packs.map((row) => ({ ...loadManifest(path.join(repoRoot, row.manifest)), ingest: row.ingest }));
  for (const pack of allPacks) {
    const structural = validateManifestStructure(pack.manifest, pack.manifestDir);
    if (structural.length > 0) throw new Error(`manifest ${pack.manifest.packId} invalid:\n  - ` + structural.join("\n  - "));
  }
  const duplicates = findDuplicateModelKeys(allPacks);
  if (duplicates.length > 0) throw new Error("duplicate modelKeys across packs:\n  - " + duplicates.join("\n  - "));

  const generatedPacks = allPacks.filter((pack) => pack.ingest === "generated");
  const fragments = emitFragments(generatedPacks);
  writeFragments(fragments);
  console.log(`emitted ${generatedPacks.length} generated pack(s) (${allPacks.length - generatedPacks.length} manual reference pack(s) reserve keys only):`);
  for (const fragment of fragments) console.log("  wrote " + path.relative(repoRoot, fragment.path));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(String(error?.stack ?? error));
    process.exit(1);
  });
}
