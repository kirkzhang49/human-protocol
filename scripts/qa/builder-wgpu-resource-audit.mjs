import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const repoRoot = process.cwd();
const KNOWN_PROCEDURAL_MODEL_KEYS = new Set([
  "decal_human_body_reference",
  "decal_human_hand_reference",
  "decal_human_spine_reference",
  "decal_human_reference_triptych",
  "puzzle_orb_pedestal",
]);
const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });

try {
  const { builderPropCatalog } = await server.ssrLoadModule("/src/build/BuilderAssetCatalog.ts");
  const { environmentModelAssets } = await server.ssrLoadModule("/src/assets/environmentModelAssets.ts");
  const { rawViewmodelCookAssets } = await server.ssrLoadModule("/src/assets/rawViewmodelCookAssets.ts");
  const { humanProtocolBasePack } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { pickupVisualIntents } = await server.ssrLoadModule("/src/game/visual/PickupVisualIntent.ts");
  const { RAW_VIEWMODEL_HAND_MODEL_KEYS, RAW_VIEWMODEL_MODEL_KEYS, RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS } = await server.ssrLoadModule(
    "/src/render/raw-webgpu/RawViewmodelMode.ts",
  );
  const {
    BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
    BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS,
    BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
    BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS,
    builderWgpuResourceIndexForLevels,
    isBuilderRuntimeProceduralMapped,
  } = await server.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts");

  const campaignLevels = humanProtocolBasePack.levels.filter((level) => humanProtocolBasePack.campaignLevelIds.includes(level.id));
  const sourceIndex = builderWgpuResourceIndexForLevels(campaignLevels);
  const sourceIndexByKey = new Map(sourceIndex.map((entry) => [entry.modelKey, entry]));
  const catalogByKey = new Map(builderPropCatalog.map((entry) => [entry.modelKey, entry]));
  const { readyByKey, officialReadyKeys, supplementalReadyKeys } = readReadyWgpuSources({
    BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
    BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS,
    BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
  });

  const directRows = [];
  for (const entry of builderPropCatalog) {
    directRows.push(resourceRow("builderPropCatalog", "furniture", entry.modelKey, entry));
  }
  for (const intent of Object.values(pickupVisualIntents)) {
    directRows.push(resourceRow("pickupVisualIntents", "pickup", intent.modelKey, intent));
  }
  for (const modelKey of Object.values(RAW_VIEWMODEL_MODEL_KEYS)) {
    directRows.push(resourceRow("RAW_VIEWMODEL_MODEL_KEYS", "viewmodel", modelKey));
  }
  for (const modelKey of Object.values(RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS)) {
    directRows.push(resourceRow("RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS", "viewmodel", modelKey));
  }
  for (const modelKey of Object.values(RAW_VIEWMODEL_HAND_MODEL_KEYS)) {
    directRows.push(resourceRow("RAW_VIEWMODEL_HAND_MODEL_KEYS", "hand", modelKey));
  }

  const packRows = readBuilderManifestRows();
  const directProblems = directRows.filter((row) => row.problem.length > 0);
  const packProblems = packRows.filter((row) => row.problem.length > 0);
  const sourceIndexProblems = sourceIndex
    .filter((entry) => !readyByKey.has(entry.modelKey) && !isBuilderRuntimeProceduralMapped(entry) && !explicitFallbackForResource(entry.kind, entry.modelKey, entry))
    .map((entry) => ({
      surface: "BuilderRuntimeAssetIndex",
      kind: entry.kind,
      modelKey: entry.modelKey,
      problem: ["not_ready_in_wgpu_imports"],
      readySources: [],
    }));
  const runtimeOwnedModelKeys = new Set(
    sourceIndex
      .filter((entry) => entry.roles?.some(isRuntimeOwnedKind) || isRuntimeOwnedKind(entry.kind))
      .map((entry) => entry.modelKey),
  );
  const isBuilderOwnedRuntimeDuplicate = (modelKey) =>
    runtimeOwnedModelKeys.has(modelKey) || /^hp_enemy_/.test(modelKey) || BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS.has(modelKey);
  const duplicateSupplementalKeys = [...supplementalReadyKeys].filter((modelKey) => officialReadyKeys.has(modelKey) && !isBuilderOwnedRuntimeDuplicate(modelKey));
  const allowedSupplementalRuntimeDuplicates = [...supplementalReadyKeys].filter((modelKey) => officialReadyKeys.has(modelKey) && isBuilderOwnedRuntimeDuplicate(modelKey));

  if (directProblems.length || packProblems.length || sourceIndexProblems.length || duplicateSupplementalKeys.length) {
    console.error("FAIL builder WGPU resource audit");
    printProblemGroup("direct /build rows", directProblems);
    printProblemGroup("builder manifest rows", packProblems);
    printProblemGroup("source index rows", sourceIndexProblems);
    if (duplicateSupplementalKeys.length) {
      console.error("  supplemental duplicates official Raw keys:");
      for (const modelKey of duplicateSupplementalKeys) console.error(`    - ${modelKey}`);
    }
    process.exit(1);
  }

  const directGeneratedRows = directRows.filter((row) => row.source === "auto-rig-3d" || row.group === "自动家具" || row.group === "赛博" || row.group === "官卡重制" || row.group === "密室精选");
  console.log(
    `PASS builder WGPU resource audit: direct=${directRows.length}/${directRows.length}, generatedDirect=${directGeneratedRows.length}/${directGeneratedRows.length}, manifests=${packRows.length}/${packRows.length}`,
  );
  console.log(
    `PASS builder WGPU source map: sourceIndex=${sourceIndex.length}, readyKeys=${readyByKey.size}, supplemental=${supplementalReadyKeys.size}, duplicateSupplemental=0, builderOwnedRuntimeDuplicates=${allowedSupplementalRuntimeDuplicates.length}`,
  );

  function resourceRow(surface, kind, modelKey, meta = {}) {
    const registryAsset = kind === "hand" ? rawViewmodelCookAssets[modelKey] : environmentModelAssets[modelKey];
    const proceduralMapped = isBuilderRuntimeProceduralMapped({ modelKey });
    const problem = [];
    if (!registryAsset?.url && !proceduralMapped) problem.push("missing_registry_url");
    if (!sourceIndexByKey.has(modelKey)) problem.push("missing_source_index");
    if (!readyByKey.has(modelKey) && !proceduralMapped && !explicitFallbackForResource(kind, modelKey, registryAsset)) problem.push("not_ready_in_wgpu_imports");
    if (isRuntimeOwnedKind(kind) && !supplementalReadyKeys.has(modelKey)) problem.push("missing_builder_runtime_resource_pack");
    return {
      surface,
      kind,
      modelKey,
      label: meta.label ?? "",
      group: meta.group ?? "",
      source: meta.source ?? "",
      problem,
      readySources: readyByKey.get(modelKey) ?? [],
    };
  }

  function readBuilderManifestRows() {
    const ingestPath = path.join(repoRoot, "src/assets/manifests/builder/ingested-packs.json");
    if (!existsSync(ingestPath)) return [];
    const ingest = JSON.parse(readFileSync(ingestPath, "utf8"));
    const rows = [];
    for (const pack of ingest.packs ?? []) {
      const manifestPath = path.join(repoRoot, pack.manifest);
      if (!existsSync(manifestPath)) {
        rows.push({ surface: "builderManifest", kind: "unknown", modelKey: pack.manifest, problem: ["missing_manifest_file"], readySources: [] });
        continue;
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      for (const asset of manifest.assets ?? []) {
        const problem = [];
        const glbPath = asset.glbFile ? path.resolve(path.dirname(manifestPath), asset.glbFile) : null;
        if (!glbPath || !existsSync(glbPath)) problem.push("missing_glb_file");
        if (!environmentModelAssets[asset.modelKey]?.url) problem.push("missing_environment_registry");
        if (asset.assetKind === "furniture" && !catalogByKey.has(asset.modelKey)) problem.push("missing_builder_catalog");
        if (!sourceIndexByKey.has(asset.modelKey)) problem.push("missing_source_index");
        if (!readyByKey.has(asset.modelKey)) problem.push("not_ready_in_wgpu_imports");
        rows.push({
          surface: path.basename(manifestPath),
          kind: asset.assetKind ?? "unknown",
          modelKey: asset.modelKey,
          label: asset.label ?? "",
          group: asset.group ?? "",
          source: asset.source ?? "",
          ingest: pack.ingest,
          problem,
          readySources: readyByKey.get(asset.modelKey) ?? [],
        });
      }
    }
    return rows;
  }
} finally {
  await server.close();
}

function readReadyWgpuSources({
  BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
  BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS,
  BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
}) {
  const officialSourceIds = new Set(BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS);
  const readyByKey = new Map();
  const officialReadyKeys = new Set();
  const supplementalReadyKeys = new Set();
  for (const sourceId of BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS) {
    const planPath = path.join(repoRoot, `src/assets/manifests/generated/raw-webgpu/render_plan_${sourceId}.json`);
    if (!existsSync(planPath)) continue;
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    const categoryByKey = new Map((plan.assets ?? []).map((entry) => [entry.modelKey, entry.category]));
    for (const asset of plan.geometry?.assets ?? []) {
      if (asset.status !== "ready" || (asset.vertexCount ?? 0) <= 0) continue;
      if (officialSourceIds.has(sourceId) && categoryByKey.get(asset.modelKey) === "builder-resource") continue;
      if (!readyByKey.has(asset.modelKey)) readyByKey.set(asset.modelKey, []);
      readyByKey.get(asset.modelKey).push(sourceId);
      if (sourceId === BUILDER_NATIVE_RAW_RESOURCE_PACK_ID) supplementalReadyKeys.add(asset.modelKey);
      else officialReadyKeys.add(asset.modelKey);
    }
  }
  const assetsV1Path = path.join(repoRoot, "public/assets/human-protocol/raw-webgpu/assets-v1/index.json");
  if (existsSync(assetsV1Path)) {
    const index = JSON.parse(readFileSync(assetsV1Path, "utf8"));
    for (const [modelKey, entry] of Object.entries(index.assets ?? {})) {
      if (entry?.status !== "ready") continue;
      if (!readyByKey.has(modelKey)) readyByKey.set(modelKey, []);
      readyByKey.get(modelKey).push("assets-v1");
    }
  }
  return { readyByKey, officialReadyKeys, supplementalReadyKeys };
}

function printProblemGroup(label, rows) {
  if (!rows.length) return;
  console.error(`  ${label}:`);
  for (const row of rows) {
    console.error(`    - ${row.modelKey} [${row.kind}] ${row.problem.join(", ")} sources=${row.readySources.join(",") || "none"}`);
  }
}

function isRuntimeOwnedKind(kind) {
  return kind === "enemy" || kind === "viewmodel" || kind === "hand";
}

function explicitFallbackForResource(kind, modelKey, meta = {}) {
  if (KNOWN_PROCEDURAL_MODEL_KEYS.has(modelKey)) return true;
  if (kind === "door" || kind === "surface") return true;
  return kind === "furniture" && Boolean(meta.glbUrl ?? meta.url);
}
