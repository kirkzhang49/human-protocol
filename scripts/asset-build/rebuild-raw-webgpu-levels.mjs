import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { hasArg, readArg, readCsvArg } from "../lib/cli.mjs";
import { gameRootFromScript, relativeToRoot } from "../lib/paths.mjs";
import { RAW_WEBGPU_CAMPAIGN_LEVEL_IDS, rawWebGpuGeneratedManifestPath } from "../lib/raw-webgpu-manifests.mjs";

const gameRoot = gameRootFromScript(import.meta.url);

const args = process.argv.slice(2);
const dryRun = hasArg("--dry-run");
const includeBuild = hasArg("--build");
const includeLevel3Lighting = hasArg("--level3-lighting") || hasArg("--lighting");
const includeGeneratedSupportAssets = !hasArg("--no-generated-support-assets");
const includeThreeBridge = !hasArg("--no-threejs-bridge");
const writeThreeBridge = hasArg("--write-threejs-bridge");
const includeMaterialPipeline = !hasArg("--no-material");
const includeQa = !hasArg("--no-qa");
const includeBuilderResourcePack = !hasArg("--no-builder-resource-pack");
const failFast = !hasArg("--no-fail-fast");
const levels = resolveLevels();
const failures = [];

console.log(
  `[HumanProtocol] Raw WebGPU rebuild levels=${levels.join(", ")} material=${includeMaterialPipeline ? "on" : "off"} ` +
    `generatedSupport=${includeGeneratedSupportAssets ? "on" : "off"} threeBridge=${includeThreeBridge ? (writeThreeBridge ? "write" : "audit") : "off"} qa=${includeQa ? "on" : "off"} ` +
    `builderResourcePack=${includeBuilderResourcePack ? "on" : "off"} level3Lighting=${includeLevel3Lighting ? "on" : "off"} build=${includeBuild ? "on" : "off"}`,
);

for (const levelId of levels) {
  runLevel(levelId);
}

if (includeBuilderResourcePack) {
  runStep("builder-runtime-resource-pack", [
    process.execPath,
    "tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs",
  ]);
}

if (includeBuild) {
  runStep("build", ["npm", "run", "build"]);
}

if (failures.length > 0) {
  console.error("\n[HumanProtocol] Raw WebGPU rebuild finished with failures:");
  for (const failure of failures) {
    console.error(`  - ${failure.label}: ${failure.status}`);
  }
  process.exit(1);
}

console.log("\n[HumanProtocol] Raw WebGPU rebuild complete.");

function runLevel(levelId) {
  console.log(`\n[HumanProtocol] Raw WebGPU rebuild ${levelId}`);

  if (includeLevel3Lighting && levelId === "level_03_human_museum") {
    runStep(`${levelId}:age-lighting`, [
      process.execPath,
      "scripts/optimizer/run-level03-age-museum-lighting-solver.mjs",
    ]);
  }

  if (includeGeneratedSupportAssets) {
    runGeneratedSupportAssets(levelId);
  }

  if (includeMaterialPipeline) {
    runStep(`${levelId}:compile-pre-material`, [
      process.execPath,
      "tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs",
      `--level=${levelId}`,
      "--no-raw-material-pipeline",
    ]);
    runStep(`${levelId}:material-pipeline`, [
      process.execPath,
      "scripts/asset-build/build-raw-webgpu-material-pipeline.mjs",
      `--level=${levelId}`,
    ]);
  }

  runStep(`${levelId}:compile`, [
    process.execPath,
    "tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs",
    `--level=${levelId}`,
  ]);

  if (includeThreeBridge) {
    const bridgeCommand = [
      process.execPath,
      "scripts/asset-build/prepare-level03-threejs-raw-assets.mjs",
      `--level=${levelId}`,
    ];
    if (!writeThreeBridge) bridgeCommand.push("--audit-only");
    runStep(`${levelId}:threejs-bridge`, bridgeCommand);
  }

  const bridgePath = rawWebGpuGeneratedManifestPath(gameRoot, "threeResourceBridge", levelId);
  if (fs.existsSync(bridgePath)) {
    runStep(`${levelId}:cooked-loader-manifest`, [
      process.execPath,
      "scripts/asset-build/build-raw-webgpu-cooked-loader-manifest.mjs",
      `--level=${levelId}`,
    ]);
  } else {
    console.log(`  skip cooked-loader-manifest: missing ${relativeToRoot(gameRoot, bridgePath)}`);
  }

  if (includeQa) {
    runStep(`${levelId}:color-audit`, [
      process.execPath,
      "scripts/qa/raw-webgpu-color-quality-audit.mjs",
      `--level=${levelId}`,
    ]);
    if (levelId === "level_03_human_museum") {
      runStep(`${levelId}:museum-lighting-qa`, [
        process.execPath,
        "scripts/qa/museum-lighting-qa.mjs",
        `--level=${levelId}`,
      ]);
    }
  }
}

function runGeneratedSupportAssets(levelId) {
  if (levelId !== "level_01_maintenance_bay") return;
  runStep(`${levelId}:reference-decals`, [
    "python3",
    "scripts/asset-build/generate-level01-reference-decals.py",
  ]);
}

function runStep(label, command) {
  console.log(`  ${dryRun ? "dry-run" : "run"} ${label}: ${command.join(" ")}`);
  if (dryRun) return;

  const result = spawnSync(command[0], command.slice(1), {
    cwd: gameRoot,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  if (result.status === 0) return;

  const failure = { label, status: result.status ?? "signal" };
  failures.push(failure);
  if (failFast) {
    console.error(`[HumanProtocol] Raw WebGPU rebuild failed at ${label}.`);
    process.exit(result.status ?? 1);
  }
}

function resolveLevels() {
  const explicitLevels = readCsvArg("--levels", args);
  if (explicitLevels) {
    return explicitLevels;
  }
  const explicitLevel = readArg("--level");
  if (explicitLevel && explicitLevel !== "all") return [explicitLevel];
  return RAW_WEBGPU_CAMPAIGN_LEVEL_IDS;
}
