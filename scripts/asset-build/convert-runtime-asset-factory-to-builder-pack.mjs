#!/usr/bin/env node
// Converts a Human Protocol runtime asset-factory manifest into a standard
// hp.builder.assetPack.v1 manifest that can be ingested by /build and the
// builder Raw WebGPU resource pack.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.output) {
  console.error(
    [
      "usage: node scripts/asset-build/convert-runtime-asset-factory-to-builder-pack.mjs",
      "  --input src/assets/manifests/runtime/<factory>.json",
      "  --output src/assets/manifests/builder/<pack>.json",
      "  [--pack-id <id>] [--label <label>] [--group <builder group>] [--source <source id>]",
    ].join(" \\\n"),
  );
  process.exit(2);
}

const inputPath = path.resolve(repoRoot, args.input);
const outputPath = path.resolve(repoRoot, args.output);
const factory = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(factory.assets) || factory.assets.length === 0) {
  throw new Error(`input manifest has no assets: ${args.input}`);
}

const blenderReport = loadOptionalJson(factory.report);
const reportByKey = new Map((blenderReport?.assets ?? []).map((asset) => [asset.modelKey, asset]));
const packId = args.packId ?? slugPackId(factory.id ?? path.basename(args.output, ".json"));
const source = args.source ?? factory.id ?? packId;

const pack = {
  schemaVersion: "hp.builder.assetPack.v1",
  packId,
  label: args.label ?? factory.id ?? packId,
  sourceTool: source,
  generatedAt: factory.generatedAt ?? new Date().toISOString().slice(0, 10),
  sourceManifest: path.relative(repoRoot, inputPath).split(path.sep).join("/"),
  sourceBlend: factory.sourceBlend,
  textureSources: factory.textureSources,
  assets: factory.assets.map((asset) => convertAsset(asset, reportByKey.get(asset.modelKey), { outputPath, source, group: args.group ?? "居住" })),
};

writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log(`wrote ${path.relative(repoRoot, outputPath)} (${pack.assets.length} assets)`);

function convertAsset(asset, reportAsset, context) {
  const cookedGlb = asset.pathPlan?.cookedGlb ?? asset.cookedGlb ?? reportAsset?.cookedGlb ?? inferCookedGlb(asset);
  if (!cookedGlb) throw new Error(`${asset.modelKey}: missing cooked GLB path`);
  const cookedAbs = path.resolve(repoRoot, cookedGlb);
  if (!existsSync(cookedAbs)) throw new Error(`${asset.modelKey}: cooked GLB not found: ${cookedGlb}`);

  const family = builderFamily(asset.assetFamily);
  const footprintFamily = builderFootprint(asset.assetFamily, family);
  const sizeMeters = asset.sizeMeters ?? reportAsset?.sizeMeters;
  if (!Array.isArray(sizeMeters) || sizeMeters.length !== 3) {
    throw new Error(`${asset.modelKey}: missing sizeMeters in runtime manifest and Blender report`);
  }

  return {
    modelKey: asset.modelKey,
    label: asset.label ?? asset.modelKey,
    assetKind: "furniture",
    family,
    group: context.group,
    source: context.source,
    sourceAssetId: `${asset.modelKey}_from_asset_factory`,
    themeId: "hp_residential_reference_image2",
    glbFile: relativeFromManifest(context.outputPath, cookedAbs),
    sizeMeters: sizeMeters.map((value) => Number(value.toFixed(3))),
    solid: true,
    mount: "floor",
    wallPreferred: wallPreferred(asset),
    canHoldSmallProps: canHoldSmallProps(asset.assetFamily),
    clueCapacity: clueCapacity(asset.assetFamily),
    footprintFamily,
    tags: [
      "style:residential-reference",
      "style:image2",
      "pipeline:runtime-asset-factory",
      `family:${asset.assetFamily ?? family}`,
    ],
  };
}

function builderFamily(assetFamily = "") {
  if (assetFamily.includes("coffee_table")) return "desk";
  if (assetFamily.includes("sideboard")) return "cabinet";
  if (assetFamily.includes("entry_bench")) return "sofa_bench";
  if (assetFamily.includes("room_divider_shelf")) return "bookshelf";
  if (assetFamily.includes("cleaner_closet")) return "cabinet";
  return "cabinet";
}

function builderFootprint(assetFamily = "", family) {
  if (assetFamily.includes("coffee_table")) return "table";
  if (assetFamily.includes("entry_bench")) return "sofa";
  if (assetFamily.includes("room_divider_shelf")) return "books";
  if (family === "cabinet") return "cabinet";
  return "table";
}

function wallPreferred(asset) {
  const family = asset.assetFamily ?? "";
  return family.includes("sideboard") || family.includes("entry_bench") || family.includes("cleaner_closet") ? "back" : "none";
}

function canHoldSmallProps(assetFamily = "") {
  return assetFamily.includes("coffee_table") || assetFamily.includes("sideboard") || assetFamily.includes("room_divider_shelf");
}

function clueCapacity(assetFamily = "") {
  if (assetFamily.includes("room_divider_shelf")) return 2;
  if (assetFamily.includes("sideboard") || assetFamily.includes("cleaner_closet")) return 1;
  return 0;
}

function inferCookedGlb(asset) {
  return asset.modelKey ? `src/assets/models-cooked/environment/props/${asset.modelKey}.glb` : null;
}

function relativeFromManifest(outputPath, targetAbs) {
  let rel = path.relative(path.dirname(outputPath), targetAbs).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function slugPackId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function loadOptionalJson(value) {
  if (!value) return null;
  const absolute = path.resolve(repoRoot, value);
  if (!existsSync(absolute)) return null;
  return JSON.parse(readFileSync(absolute, "utf8"));
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") parsed.input = argv[++index];
    else if (arg === "--output") parsed.output = argv[++index];
    else if (arg === "--pack-id") parsed.packId = argv[++index];
    else if (arg === "--label") parsed.label = argv[++index];
    else if (arg === "--group") parsed.group = argv[++index];
    else if (arg === "--source") parsed.source = argv[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}
