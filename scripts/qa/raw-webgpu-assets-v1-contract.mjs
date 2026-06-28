import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, "public/assets/human-protocol/raw-webgpu/assets-v1/index.json");
const generatedDir = path.join(repoRoot, "src/assets/manifests/generated/raw-webgpu");
const officialLevelIds = ["level_01_maintenance_bay", "level_02_residential_simulation", "level_03_human_museum"];
const fullAssetsV1OfficialLevelIds = new Set(["level_01_maintenance_bay", "level_02_residential_simulation"]);
const legacySourceIds = ["level_01_maintenance_bay", "level_02_residential_simulation", "level_03_human_museum", "builder_runtime_resources"];
const rawVertexStrideFloats = 10;
const materialIndexComponent = 8;

const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : null;
const indexAssets = index?.assets ?? {};
const server = await createServer({ root: repoRoot, appType: "custom", logLevel: "error", server: { middlewareMode: true } });

try {
  const { getBuiltInLevelConfig } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { builderProjectFromBuiltInLevel } = await server.ssrLoadModule("/src/build/BuilderLevelImport.ts");
  const { modelKeyForPuzzleOrbTarget } = await server.ssrLoadModule("/src/assets/environmentModelAssets.ts");
  const { compileBuilderProjectToLevel } = await server.ssrLoadModule("/src/build/compileBuilderProjectToLevel.ts");
  const { builderRuntimeAssetIndexForProject } = await server.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts");
  const { builderPuzzleColors, builderRobotCatalog } = await server.ssrLoadModule("/src/build/BuilderAssetCatalog.ts");

  const rows = [];
  for (const levelId of officialLevelIds) {
    const project = builderProjectFromBuiltInLevel(levelId);
    const level = getBuiltInLevelConfig(levelId);
    if (!project || !level) {
      rows.push({ levelId, modelKey: "(builder-source)", kind: "unknown", status: "missing_builder_project", fallback: [] });
      continue;
    }
    for (const entry of builderRuntimeAssetIndexForProject(level, project)) {
      if (!entry.nativeRawEligible) continue;
      if (!requiresAssetsV1Bundle(levelId, entry)) continue;
      const bundle = indexAssets[entry.modelKey];
      rows.push({
        levelId,
        modelKey: entry.modelKey,
        kind: entry.kind,
        roles: entry.roles,
        status: bundle?.status === "ready" ? "assets-v1" : "missing-assets-v1-bundle",
        bundle: bundle?.bundleId ?? null,
      });
    }
  }

  const missing = rows.filter((row) => row.status !== "assets-v1");
  if (missing.length > 0) {
    console.error("FAIL raw WebGPU assets-v1 contract");
    for (const row of missing) {
      console.error(`  - ${row.levelId} ${row.modelKey} [${row.kind}] ${row.status}`);
    }
    process.exit(1);
  }
  const enemyPaletteFailures = enemyPaletteContractFailures(index);
  if (enemyPaletteFailures.length > 0) {
    console.error("FAIL raw WebGPU assets-v1 enemy palette contract");
    for (const failure of enemyPaletteFailures) {
      console.error(`  - ${failure.modelKey}: ${failure.reason}`);
    }
    process.exit(1);
  }
  const builderRobotFailures = builderRobotAssetContractFailures({ builderRobotCatalog, index });
  if (builderRobotFailures.length > 0) {
    console.error("FAIL raw WebGPU assets-v1 builder robot catalog contract");
    for (const failure of builderRobotFailures) {
      console.error(`  - ${failure.id}: ${failure.reason}`);
    }
    process.exit(1);
  }
  const colorOrbFailures = colorPuzzleOrbContractFailures({
    builderPuzzleColors,
    builderProjectFromBuiltInLevel,
    compileBuilderProjectToLevel,
    index,
    modelKeyForPuzzleOrbTarget,
  });
  if (colorOrbFailures.length > 0) {
    console.error("FAIL raw WebGPU assets-v1 color puzzle orb contract");
    for (const failure of colorOrbFailures) {
      console.error(`  - ${failure.levelId}: ${failure.reason}`);
    }
    process.exit(1);
  }
  const migrated = rows.filter((row) => row.status === "assets-v1");
  console.log(
    `PASS raw WebGPU assets-v1 contract: checked=${rows.length}, assets-v1=${migrated.length}, fallback=0, enemyPalettes=${enemyBundleCount(index)}, builderRobots=ok, colorPuzzleOrbs=ok`,
  );
} finally {
  await server.close();
}

function requiresAssetsV1Bundle(levelId, entry) {
  if (fullAssetsV1OfficialLevelIds.has(levelId)) return true;
  return entry.kind === "enemy" || String(entry.modelKey ?? "").startsWith("hp_enemy_");
}

function colorPuzzleOrbContractFailures({ builderPuzzleColors, builderProjectFromBuiltInLevel, compileBuilderProjectToLevel, index, modelKeyForPuzzleOrbTarget }) {
  const failures = [];
  const publicRoot = path.join(repoRoot, "public", String(index?.publicBase ?? "").replace(/^\//, ""));
  for (const color of builderPuzzleColors ?? []) {
    const modelKey = freePuzzleOrbModelKey(color.colorKey);
    const bundle = indexAssets[modelKey];
    if (bundle?.status !== "ready") {
      failures.push({ levelId: "assets-v1", reason: `${modelKey} must have a ready reusable color-orb bundle` });
      continue;
    }
    if (bundle.family !== "puzzle-orb") {
      failures.push({ levelId: "assets-v1", reason: `${modelKey} must live in family puzzle-orb, got ${bundle.family}` });
    }
    for (const field of ["manifest", "material", "geometry"]) {
      if (!bundle[field] || !existsSync(path.join(publicRoot, bundle[field]))) {
        failures.push({ levelId: "assets-v1", reason: `${modelKey} is missing ${field} file ${bundle[field] ?? "(unset)"}` });
      }
    }
  }
  for (const levelId of officialLevelIds) {
    const project = builderProjectFromBuiltInLevel(levelId);
    if (!project) continue;
    const result = compileBuilderProjectToLevel(project);
    const level = result.level;
    if (!level) {
      failures.push({ levelId, reason: `builder compile failed: ${result.issues?.map((issue) => issue.message).join("; ") || "unknown issue"}` });
      continue;
    }
    for (const puzzle of level.puzzles ?? []) {
      if (puzzle.type !== "hit_sequence") continue;
      const colors = new Set();
      for (const target of puzzle.targets ?? []) {
        if (!target.colorKey) continue;
        colors.add(target.colorKey);
        const modelKey = modelKeyForPuzzleOrbTarget(target);
        if (!target.anchorPropId) {
          const expectedModelKey = freePuzzleOrbModelKey(target.colorKey);
          if (modelKey !== expectedModelKey) {
            failures.push({
              levelId,
              reason: `${puzzle.id}/${target.id} expected free-standing orb modelKey "${expectedModelKey}", got "${modelKey ?? "null"}"`,
            });
          }
          const bundle = indexAssets[expectedModelKey];
          if (bundle?.status !== "ready") {
            failures.push({
              levelId,
              reason: `${puzzle.id}/${target.id} resolved "${expectedModelKey}" but assets-v1 has no ready bundle`,
            });
          }
        } else {
          const propIds = new Set(level.map?.props?.map((prop) => prop.id) ?? []);
          if (!propIds.has(target.anchorPropId)) {
            failures.push({
              levelId,
              reason: `${puzzle.id}/${target.id} is anchored to missing prop "${target.anchorPropId}"`,
            });
          }
        }
      }
      if (puzzle.id === "level_02_light_sequence" && colors.size < 3) {
        failures.push({ levelId, reason: `${puzzle.id} must keep at least three distinct target colors` });
      }
    }
  }
  return failures;
}

function builderRobotAssetContractFailures({ builderRobotCatalog, index }) {
  const failures = [];
  const publicRoot = path.join(repoRoot, "public", String(index?.publicBase ?? "").replace(/^\//, ""));
  for (const entry of builderRobotCatalog ?? []) {
    const id = entry.id ?? entry.archetype ?? "(unknown)";
    const modelKey = entry.modelKey;
    if (!modelKey) {
      failures.push({ id, reason: "catalog entry is missing modelKey" });
      continue;
    }
    const bundle = indexAssets[modelKey];
    if (bundle?.status !== "ready") {
      failures.push({ id, reason: `${modelKey} is missing a ready assets-v1 enemy bundle` });
      continue;
    }
    if (!isEnemyBundleEntry(bundle)) {
      failures.push({ id, reason: `${modelKey} must live in the enemies bundle family, got ${bundle.family ?? "(unset)"}` });
    }
    for (const field of ["manifest", "material", "geometry"]) {
      if (!bundle[field] || !existsSync(path.join(publicRoot, bundle[field]))) {
        failures.push({ id, reason: `${modelKey} is missing ${field} file ${bundle[field] ?? "(unset)"}` });
      }
    }
  }
  return failures;
}

function freePuzzleOrbModelKey(colorKey) {
  return `puzzle_orb_free_${colorKey}`;
}

function enemyBundleCount(index) {
  return Object.values(index?.assets ?? {}).filter(isEnemyBundleEntry).length;
}

function enemyPaletteContractFailures(index) {
  const publicRoot = path.join(repoRoot, "public", String(index?.publicBase ?? "").replace(/^\//, ""));
  const failures = [];
  for (const [modelKey, entry] of Object.entries(index?.assets ?? {})) {
    if (!isEnemyBundleEntry(entry)) continue;
    const materialPath = path.join(publicRoot, entry.material ?? "");
    if (!entry.material || !existsSync(materialPath)) {
      failures.push({ modelKey, reason: "missing material.json for enemy bundle" });
      continue;
    }
    const material = JSON.parse(readFileSync(materialPath, "utf8"));
    const rawSource = String(entry.source?.rawSource ?? "");
    const rawFile = String(entry.source?.rawFile ?? "");
    if (rawSource === "raw-models" || rawFile.includes("src/assets/models/enemies/")) {
      failures.push({ modelKey, reason: `enemy bundle uses raw model geometry instead of stable cooked geometry (${rawFile || rawSource})` });
      continue;
    }
    const paletteCheck = enemyBundlePaletteCheck(publicRoot, entry, material);
    if (paletteCheck.ok) continue;
    const materialCount = material?.materials?.length ?? 0;
    const baseTextureCount = material?.baseColorTextures?.length ?? 0;
    failures.push({
      modelKey,
      reason: `${paletteCheck.reason} (materials=${materialCount}, baseColorTextures=${baseTextureCount})`,
    });
  }
  return failures;
}

function isEnemyBundleEntry(entry) {
  return entry?.family === "enemies" || String(entry?.modelKey ?? "").startsWith("hp_enemy_");
}

function enemyBundlePaletteCheck(publicRoot, entry, material) {
  const materials = new Map((material?.materials ?? []).map((item) => [Number(item.index), item]));
  const geometryPath = path.join(publicRoot, entry.geometry ?? "");
  if (entry.geometry && existsSync(geometryPath)) {
    const used = usedMaterialVertexCounts(geometryPath);
    const usedGeneric = [...used.entries()]
      .map(([index, count]) => ({ material: materials.get(index), count }))
      .filter((item) => /^PaletteMaterial\d+/u.test(String(item.material?.name ?? "")));
    if (usedGeneric.length > 0) {
      const missingBaseColor = usedGeneric.filter((item) => !materialHasTexture(item.material, "baseColor"));
      if (missingBaseColor.length > 0) {
        return {
          ok: false,
          reason: `generic enemy palette slots are missing baseColor textures: ${missingBaseColor
            .map((item) => item.material?.name ?? "unknown")
            .join(", ")}`,
        };
      }
      const missingPbr = usedGeneric.filter((item) => !materialHasAnyTexture(item.material, ["normal", "metallicRoughness", "ao"]));
      if (missingPbr.length > 0) {
        return {
          ok: false,
          reason: `generic enemy palette slots are missing PBR/detail textures: ${missingPbr
            .map((item) => item.material?.name ?? "unknown")
            .join(", ")}`,
        };
      }
      const missingFiles = usedGeneric
        .flatMap((item) => item.material?.textures ?? [])
        .filter((slot) => slot.present && typeof slot.url === "string" && !textureUrlExists(slot.url));
      if (missingFiles.length > 0) {
        return {
          ok: false,
          reason: `generic enemy texture files are missing: ${[...new Set(missingFiles.map((slot) => slot.url))].join(", ")}`,
        };
      }
      return { ok: true, reason: "generic palette textures are self-contained" };
    }
  }

  if ((material?.baseColorTextures ?? []).some((texture) => Number(texture?.stats?.chroma ?? 0) >= 0.08 && textureUrlExists(texture.url))) {
    return { ok: true, reason: "baseColor texture chroma is visible" };
  }
  if ((material?.materials ?? []).some(materialHasVisibleAccent)) return { ok: true, reason: "authored material colors are visible" };
  return { ok: false, reason: "no visible authored accent or chromatic baseColor texture" };
}

function materialHasTexture(material, semantic) {
  return (material?.textures ?? []).some(
    (slot) => slot.semantic === semantic && slot.present && Number.isFinite(slot.layer) && typeof slot.url === "string" && slot.url,
  );
}

function materialHasAnyTexture(material, semantics) {
  return semantics.some((semantic) => materialHasTexture(material, semantic));
}

function textureUrlExists(url) {
  if (typeof url !== "string" || !url || /^https?:\/\//iu.test(url)) return false;
  return existsSync(path.join(repoRoot, "public", url.replace(/^\//, "")));
}

function usedMaterialVertexCounts(geometryPath) {
  const bytes = readFileSync(geometryPath);
  const floats = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
  const counts = new Map();
  for (let offset = materialIndexComponent; offset < floats.length; offset += rawVertexStrideFloats) {
    const index = Math.max(0, Math.round(floats[offset] ?? 0));
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  return counts;
}

function materialHasVisibleAccent(material) {
  return hasVisibleAccent(material?.baseColorFactor) || hasVisibleAccent(material?.emissiveFactor);
}

function hasVisibleAccent(color) {
  if (!Array.isArray(color) || color.length < 3) return false;
  const rgb = color.slice(0, 3).map((value) => Number(value) || 0);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const chroma = max - min;
  return max >= 0.18 && chroma >= 0.08;
}
