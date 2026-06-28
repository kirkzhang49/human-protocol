import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { compileRawGeometryAssets } from "../../tools/raw-webgpu-compiler/raw-webgpu-plan-geometry.mjs";
import { createAssetRecord } from "../../tools/raw-webgpu-compiler/raw-webgpu-plan-assets.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(scriptPath), "../..");
const generatedDir = path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu");
const publicBase = "/assets/human-protocol/raw-webgpu/assets-v1";
const outputRoot = path.join(gameRoot, "public", publicBase.replace(/^\//, ""));
const officialLevelIds = ["level_01_maintenance_bay", "level_02_residential_simulation"];
const legacySourcePackIds = ["builder_runtime_resources", "level_01_maintenance_bay", "level_02_residential_simulation", "level_03_human_museum"];
const glbBridgePackId = "assets_v1_glb_bridge";
const freePuzzleOrbPackId = "assets_v1_free_puzzle_orbs";
const rawVertexStrideFloats = 10;
const materialIndexComponent = 8;
const freePuzzleOrbPalette = [
  { colorKey: "red", hex: "#ff5b4c", label: "red" },
  { colorKey: "blue", hex: "#4f8cff", label: "blue" },
  { colorKey: "green", hex: "#5fd47a", label: "green" },
  { colorKey: "yellow", hex: "#ffd24f", label: "yellow" },
  { colorKey: "purple", hex: "#b47aff", label: "purple" },
  { colorKey: "white", hex: "#e8ecf4", label: "white" },
  { colorKey: "cyan", hex: "#5ff3ff", label: "cyan" },
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");

const sourcePacks = (await Promise.all(legacySourcePackIds.map(loadSourcePack))).filter(Boolean);
sourcePacks.push(createFreePuzzleOrbSourcePack());

const server = await createServer({
  root: gameRoot,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { getBuiltInLevelConfig } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { builderProjectFromBuiltInLevel } = await server.ssrLoadModule("/src/build/BuilderLevelImport.ts");
  const { builderRuntimeAssetIndexForProject } = await server.ssrLoadModule("/src/build/runtime-pack/BuilderRuntimeAssetIndex.ts");

  const requested = new Map();
  for (const levelId of officialLevelIds) {
    const project = builderProjectFromBuiltInLevel(levelId);
    if (!project) continue;
    const level = getBuiltInLevelConfig(levelId);
    for (const entry of builderRuntimeAssetIndexForProject(level, project)) {
      if (!entry.nativeRawEligible) continue;
      const source = findSourceAsset(entry.modelKey, entry.kind);
      const current = requested.get(entry.modelKey);
      requested.set(entry.modelKey, {
        modelKey: entry.modelKey,
        kind: entry.kind,
        roles: [...entry.roles],
        glbUrl: entry.glbUrl ?? current?.glbUrl ?? null,
        sourceLevels: [...new Set([...(current?.sourceLevels ?? []), levelId])].sort(),
        source: source ?? current?.source ?? null,
      });
    }
  }
  ensureFreePuzzleOrbRequests(requested);

  const textureFiles = new Map();
  const glbBridgeRequests = [...requested.values()].filter(
    (request) => request.glbUrl && (!request.source || shouldPreferGlbBridgeSource(request)),
  );
  const glbBridge = await compileGlbBridgeSourcePack(glbBridgeRequests);
  if (glbBridge) {
    sourcePacks.push(glbBridge.pack);
    for (const [filePath, content] of glbBridge.textureFiles) textureFiles.set(filePath, content);
    for (const request of requested.values()) {
      if (request.source && !shouldPreferGlbBridgeSource(request)) continue;
      const asset = glbBridge.pack.assetsByKey.get(request.modelKey);
      if (asset?.status === "ready" && asset.vertexCount > 0) request.source = { pack: glbBridge.pack, asset };
    }
  }

  const unresolved = [...requested.values()].filter((request) => !request.source);
  if (unresolved.length > 0) {
    console.error("FAIL raw WebGPU assets-v1 could not resolve geometry sources");
    for (const request of unresolved) {
      console.error(`  - ${request.modelKey}: no ready raw source${request.glbUrl ? " and GLB bridge failed" : " and no glbUrl"}`);
    }
    process.exit(1);
  }

  const bundles = [...requested.values()].sort((left, right) => left.modelKey.localeCompare(right.modelKey)).map(createBundleRecord);
  const index = createIndex(bundles);
  const nextFiles = new Map();
  nextFiles.set(path.join(outputRoot, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  for (const [filePath, content] of textureFiles) nextFiles.set(filePath, content);
  for (const bundle of bundles) {
    for (const [filePath, content] of bundle.textureFiles) nextFiles.set(filePath, content);
    nextFiles.set(path.join(outputRoot, bundle.entry.manifest), `${JSON.stringify(bundle.manifest, null, 2)}\n`);
    nextFiles.set(path.join(outputRoot, bundle.entry.material), `${JSON.stringify(bundle.material, null, 2)}\n`);
    nextFiles.set(path.join(outputRoot, bundle.entry.geometry), bundle.geometryBytes);
  }

  if (checkOnly) {
    const missing = [];
    const changed = [];
    for (const [filePath, content] of nextFiles) {
      if (!fsSync.existsSync(filePath)) {
        missing.push(path.relative(gameRoot, filePath));
        continue;
      }
      const current = fsSync.readFileSync(filePath);
      const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
      if (!current.equals(next)) changed.push(path.relative(gameRoot, filePath));
    }
    if (missing.length || changed.length) {
      console.error("FAIL raw WebGPU assets-v1 is out of date");
      if (missing.length) console.error(`  missing:\n${missing.map((file) => `    - ${file}`).join("\n")}`);
      if (changed.length) console.error(`  changed:\n${changed.map((file) => `    - ${file}`).join("\n")}`);
      process.exit(1);
    }
    console.log(`PASS raw WebGPU assets-v1 index: assets=${bundles.length}`);
    process.exit(0);
  }

  await fs.rm(outputRoot, { recursive: true, force: true });
  for (const [filePath, content] of nextFiles) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }
  const totalGeometryBytes = bundles.reduce((sum, bundle) => sum + bundle.geometryBytes.byteLength, 0);
  console.log(`PASS raw WebGPU assets-v1 generated: assets=${bundles.length}`);
  console.log(`  index=${path.relative(gameRoot, path.join(outputRoot, "index.json"))}`);
  console.log(`  geometry=${Math.round(totalGeometryBytes / 1024)}KB split across ${bundles.length} files`);
} finally {
  await server.close();
}

function createBundleRecord(request) {
  const { pack, asset: sourceAsset } = request.source;
  const vertexStart = sourceAsset.vertexOffset * rawVertexStrideFloats;
  const vertexEnd = vertexStart + sourceAsset.vertexCount * rawVertexStrideFloats;
  const localFloats = pack.floats.slice(vertexStart, vertexEnd);
  const usedMaterialIndexes = new Set();
  for (let offset = materialIndexComponent; offset < localFloats.length; offset += rawVertexStrideFloats) {
    const index = Math.max(0, Math.round(localFloats[offset] ?? 0));
    usedMaterialIndexes.add(index);
  }
  const materials = [...usedMaterialIndexes]
    .sort((left, right) => left - right)
    .map((index) => pack.materialsByIndex.get(index))
    .filter(Boolean)
    .map((material) => structuredClone(material));
  const baseTextureLayers = new Set();
  const materialTextureLayers = new Set();
  for (const material of materials) {
    for (const slot of material.textures ?? []) {
      if (!slot.present || typeof slot.layer !== "number" || slot.layer <= 0) continue;
      if (slot.semantic === "baseColor") baseTextureLayers.add(slot.layer);
      else materialTextureLayers.add(slot.layer);
    }
  }
  const baseColorTextures = [...baseTextureLayers]
    .sort((left, right) => left - right)
    .map((layer) => pack.baseTexturesByLayer.get(layer))
    .filter(Boolean)
    .map((texture) => structuredClone(texture));
  const materialTextures = [...materialTextureLayers]
    .sort((left, right) => left - right)
    .map((layer) => pack.materialTexturesByLayer.get(layer))
    .filter(Boolean)
    .map((texture) => structuredClone(texture));
  const asset = {
    ...structuredClone(sourceAsset),
    vertexOffset: 0,
    nodeChunks: sourceAsset.nodeChunks?.map((chunk) => ({
      ...chunk,
      vertexOffset: chunk.vertexOffset - sourceAsset.vertexOffset,
    })),
  };
  const geometryBytes = Buffer.from(localFloats.buffer, localFloats.byteOffset, localFloats.byteLength);
  const family = familyForModelKey(request.modelKey);
  const bundleId = `${family}/${request.modelKey}`;
  const bundleDir = `families/${family}/${request.modelKey}`;
  const textureFiles = localizeBundleTextures({
    pack,
    bundleDir,
    materials,
    baseColorTextures,
    materialTextures,
  });
  const geometryHash = hashBytes(geometryBytes);
  const materialHash = hashJson({ materials, baseColorTextures, materialTextures });
  const manifest = {
    schemaVersion: "hp.raw-webgpu.asset-bundle-manifest.v1",
    modelKey: request.modelKey,
    family,
    bundleId,
    version: 1,
    status: "ready",
    source: {
      sourcePackId: pack.id,
      sourcePlan: pack.sourcePlan ?? `src/assets/manifests/generated/raw-webgpu/render_plan_${pack.id}.json`,
      sourceGeometry: pack.sourceGeometry ?? `src/assets/manifests/generated/raw-webgpu/render_plan_${pack.id}_geometry.bin`,
      rawFile: sourceAsset.rawFile ?? null,
      rawSource: sourceAsset.rawSource ?? null,
      sourceLevels: request.sourceLevels,
      refactor: "phase-1-split-from-legacy-raw-source-pack",
    },
    quality: qualityProfileForModelKey(request.modelKey),
    geometry: {
      file: "geometry.raw.bin",
      format: "raw-float32",
      futureFormat: "meshopt",
      vertexFormat: pack.plan.geometry.vertexFormat,
      vertexStrideFloats: pack.plan.geometry.vertexStrideFloats,
      vertexCount: sourceAsset.vertexCount,
      triangleCount: sourceAsset.triangleCount,
      byteLength: geometryBytes.byteLength,
      hash: geometryHash,
      asset,
    },
    material: {
      file: "material.json",
      hash: materialHash,
      materials,
      baseColorTextureSize: pack.plan.geometry.baseColorTextureSize,
      baseColorTextures,
      materialTextureSize: pack.plan.geometry.materialTextureSize,
      materialTextures,
    },
  };
  const entry = {
    modelKey: request.modelKey,
    family,
    bundleId,
    version: 1,
    status: "ready",
    kind: request.kind,
    roles: request.roles,
    sourceLevels: request.sourceLevels,
    manifest: `${bundleDir}/manifest.json`,
    material: `${bundleDir}/material.json`,
    geometry: `${bundleDir}/geometry.raw.bin`,
    geometryFormat: "raw-float32",
    futureGeometryFormat: "meshopt",
    geometryBytes: geometryBytes.byteLength,
    vertexCount: sourceAsset.vertexCount,
    triangleCount: sourceAsset.triangleCount,
    hash: {
      geometry: geometryHash,
      material: materialHash,
    },
    quality: qualityProfileForModelKey(request.modelKey),
    source: manifest.source,
    fallback: {
      legacySourcePackId: pack.id,
      policy: "Use this bundle first; if it is absent or invalid, fall back to legacy Raw source plans.",
    },
  };
  return {
    entry,
    manifest,
    material: manifest.material,
    geometryBytes,
    textureFiles,
  };
}

function localizeBundleTextures({ pack, bundleDir, materials, baseColorTextures, materialTextures }) {
  const files = new Map();
  if (pack.id === glbBridgePackId) return files;

  const localizedBySlot = new Map();
  for (const texture of [...baseColorTextures, ...materialTextures]) {
    const sourcePath = localTextureSourcePath(texture);
    if (!sourcePath) {
      throw new Error(`Cannot localize assets-v1 texture ${texture.url ?? texture.sourceFile ?? texture.name ?? "(unnamed)"}`);
    }
    const textureFile = bundleTextureFileName(texture, sourcePath);
    const publicUrl = `${publicBase}/${bundleDir}/${textureFile}`;
    const outputPath = path.join(outputRoot, bundleDir, textureFile);
    const sourceFile = `public/${publicUrl.replace(/^\//, "")}`;
    files.set(outputPath, fsSync.readFileSync(sourcePath));
    localizedBySlot.set(`${texture.semantic}:${texture.layer}`, {
      url: publicUrl,
      sourceFile,
      mimeType: texture.mimeType ?? mimeTypeForExtension(path.extname(sourcePath)),
    });
    texture.url = publicUrl;
    texture.sourceFile = sourceFile;
    texture.mimeType ??= mimeTypeForExtension(path.extname(sourcePath));
  }

  for (const material of materials) {
    material.textures = material.textures?.map((slot) => {
      const localized = localizedBySlot.get(`${slot.semantic}:${slot.layer}`);
      return localized ? { ...slot, ...localized } : slot;
    }) ?? [];
  }
  return files;
}

function localTextureSourcePath(texture) {
  const candidates = [];
  if (typeof texture.sourceFile === "string" && texture.sourceFile) {
    candidates.push(path.isAbsolute(texture.sourceFile) ? texture.sourceFile : path.join(gameRoot, texture.sourceFile));
  }
  if (typeof texture.url === "string" && texture.url && !/^https?:\/\//iu.test(texture.url)) {
    candidates.push(texture.url.startsWith("/") ? path.join(gameRoot, "public", texture.url.slice(1)) : path.join(gameRoot, texture.url));
  }
  return candidates.find((candidate) => fsSync.existsSync(candidate)) ?? null;
}

function bundleTextureFileName(texture, sourcePath) {
  const semantic = slugForPathSegment(texture.semantic ?? "texture");
  const layer = String(texture.layer ?? 0).padStart(2, "0");
  const name = slugForPathSegment(texture.name ?? path.basename(sourcePath, path.extname(sourcePath)) ?? "texture");
  const ext = path.extname(sourcePath) || extensionForMimeType(texture.mimeType) || ".png";
  return `textures/${semantic}-${layer}-${name}${ext}`;
}

function slugForPathSegment(value) {
  return String(value ?? "asset")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";
}

function extensionForMimeType(mimeType) {
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/avif") return ".avif";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return "";
}

function mimeTypeForExtension(ext) {
  const key = String(ext ?? "").toLowerCase();
  if (key === ".webp") return "image/webp";
  if (key === ".avif") return "image/avif";
  if (key === ".jpg" || key === ".jpeg") return "image/jpeg";
  if (key === ".png") return "image/png";
  return undefined;
}

function createIndex(bundles) {
  const assets = Object.fromEntries(bundles.map((bundle) => [bundle.entry.modelKey, bundle.entry]));
  const sourcePackIds = sourcePacks.map((pack) => pack.id);
  return {
    schemaVersion: "hp.raw-webgpu.asset-index.v1",
    generatedAt: latestSourceGeneratedAt(),
    sourceGeneratedAt: Object.fromEntries(sourcePacks.map((pack) => [pack.id, pack.plan.generatedAt ?? null])),
    publicBase,
    phase: "phase-1-l1-l2-official-critical-runtime-assets",
    sourcePackIds,
    assetCount: bundles.length,
    geometryBytes: bundles.reduce((sum, bundle) => sum + bundle.geometryBytes.byteLength, 0),
    defaults: {
      geometryFormat: "raw-float32",
      targetGeometryFormat: "meshopt",
      ordinaryTextureTarget: "512px WebP/AVIF",
      heroTextureTarget: "1024px WebP/AVIF",
      materialTexturePolicy: "Keep normal/ORM/emissive compressed and shared by URL when possible; duplicate only when an asset needs independent quality.",
      runtimePolicy: "assets-v1 first, legacy official/builder_runtime_resources fallback.",
    },
    compressionRoadmap: [
      "Phase 1 keeps raw float32 geometry for byte-identical rendering while splitting the 100MB supplemental pack into cacheable per-asset files.",
      "Phase 2 encodes geometry.raw.bin as geometry.meshopt.bin with bounds/material metadata unchanged.",
      "Phase 3 moves repeated base-color/normal/ORM/emissive images into family atlases and converts ordinary furniture to 512px WebP/AVIF, hero decals/puzzle art to 1024px.",
    ],
    assets,
  };
}

function latestSourceGeneratedAt() {
  return sourcePacks
    .map((pack) => pack.plan.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? "derived-from-source-packs";
}

async function loadSourcePack(id) {
  const planPath = path.join(generatedDir, `render_plan_${id}.json`);
  const geometryPath = path.join(generatedDir, `render_plan_${id}_geometry.bin`);
  if (!fsSync.existsSync(planPath) || !fsSync.existsSync(geometryPath)) return null;
  const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
  const geometry = await fs.readFile(geometryPath);
  return {
    id,
    plan,
    sourcePlan: `src/assets/manifests/generated/raw-webgpu/render_plan_${id}.json`,
    sourceGeometry: `src/assets/manifests/generated/raw-webgpu/render_plan_${id}_geometry.bin`,
    floats: new Float32Array(geometry.buffer, geometry.byteOffset, geometry.byteLength / Float32Array.BYTES_PER_ELEMENT),
    assetsByKey: new Map((plan.geometry?.assets ?? []).map((asset) => [asset.modelKey, asset])),
    materialsByIndex: new Map((plan.geometry?.materials ?? []).map((material) => [material.index, material])),
    baseTexturesByLayer: new Map((plan.geometry?.baseColorTextures ?? []).map((texture) => [texture.layer, texture])),
    materialTexturesByLayer: new Map((plan.geometry?.materialTextures ?? []).map((texture) => [texture.layer, texture])),
  };
}

function ensureFreePuzzleOrbRequests(requested) {
  for (const palette of freePuzzleOrbPalette) {
    const modelKey = freePuzzleOrbModelKey(palette.colorKey);
    const current = requested.get(modelKey);
    const roles = [...new Set([...(current?.roles ?? []), "furniture"])];
    const sourceLevels = [...new Set([...(current?.sourceLevels ?? []), "shared_free_puzzle_orb_family_v1"])].sort();
    requested.set(modelKey, {
      modelKey,
      kind: "furniture",
      roles,
      glbUrl: current?.glbUrl ?? null,
      sourceLevels,
      source: current?.source ?? findSourceAsset(modelKey, "furniture"),
    });
  }
}

function createFreePuzzleOrbSourcePack() {
  const floats = [];
  const assets = [];
  const materials = [];
  let nextMaterialIndex = 2;

  for (const palette of freePuzzleOrbPalette) {
    const modelKey = freePuzzleOrbModelKey(palette.colorKey);
    const baseMaterial = nextMaterialIndex++;
    const trimMaterial = nextMaterialIndex++;
    const glassMaterial = nextMaterialIndex++;
    const coreMaterial = nextMaterialIndex++;
    materials.push(
      rawProceduralMaterial({
        index: baseMaterial,
        name: `${modelKey}:smoked_titanium_base`,
        visualRole: "structural_dark",
        color: "#0c1215",
        roughness: 0.72,
        metallic: 0.38,
        materialKind: 2,
      }),
      rawProceduralMaterial({
        index: trimMaterial,
        name: `${modelKey}:aged_brass_trim`,
        visualRole: "route_gold",
        color: "#b68538",
        roughness: 0.42,
        metallic: 0.58,
        materialKind: 5,
      }),
      rawProceduralMaterial({
        index: glassMaterial,
        name: `${modelKey}:colored_glass_shell`,
        visualRole: "glass_shell",
        color: mixHex(palette.hex, "#baf7ff", palette.colorKey === "white" ? 0.62 : 0.32),
        emissive: palette.hex,
        emissiveStrength: 0.22,
        roughness: 0.18,
        metallic: 0.04,
        materialKind: 6,
        doubleSided: true,
      }),
      rawProceduralMaterial({
        index: coreMaterial,
        name: `${modelKey}:sequence_core_${palette.label}`,
        visualRole: visualRoleForOrbColor(palette.colorKey),
        color: palette.hex,
        emissive: palette.hex,
        emissiveStrength: palette.colorKey === "white" ? 0.45 : 0.82,
        roughness: 0.22,
        metallic: 0.08,
        materialKind: 4,
      }),
    );

    const vertexOffset = floats.length / rawVertexStrideFloats;
    const bounds = createBoundsTracker();
    pushCylinder(floats, bounds, 0, 0.035, 0, 0.34, 0.07, 28, baseMaterial);
    pushCylinder(floats, bounds, 0, 0.09, 0, 0.28, 0.035, 28, trimMaterial);
    pushCylinder(floats, bounds, 0, 0.52, 0, 0.038, 0.84, 20, baseMaterial);
    pushCylinder(floats, bounds, 0, 0.72, 0, 0.056, 0.055, 20, glassMaterial);
    pushTorus(floats, bounds, 0, 0.94, 0, 0.24, 0.026, 32, 8, trimMaterial);
    pushSphere(floats, bounds, 0, 1.18, 0, 0.285, 0.285, 0.285, 28, 14, glassMaterial);
    pushSphere(floats, bounds, 0, 1.18, 0, 0.145, 0.145, 0.145, 24, 12, coreMaterial);
    pushTorus(floats, bounds, 0, 1.18, 0, 0.303, 0.017, 36, 8, trimMaterial);
    pushCylinder(floats, bounds, 0, 1.49, 0, 0.075, 0.05, 20, trimMaterial);

    const vertexCount = floats.length / rawVertexStrideFloats - vertexOffset;
    assets.push({
      modelKey,
      sourceFile: null,
      rawFile: null,
      rawSource: "procedural-free-puzzle-orb-v1",
      status: "ready",
      category: "interaction",
      vertexOffset,
      vertexCount,
      triangleCount: vertexCount / 3,
      meshCount: 9,
      materialCount: 4,
      nodeCount: 0,
      skinCount: 0,
      rigidSkin: null,
      animationClips: [],
      nodeChunks: [],
      bounds: finalizeBounds(bounds),
    });
  }

  const plan = {
    schemaVersion: "hp.raw-webgpu.assets-v1-free-puzzle-orbs.v1",
    generatedAt: "derived-from-procedural-free-puzzle-orb-v1",
    geometry: {
      vertexFormat: "position3_normal3_uv2_materialIndex1_rigidJointIndex1_float32",
      vertexStrideFloats: rawVertexStrideFloats,
      baseColorTextureSize: 512,
      baseColorTextures: [],
      materialTextureSize: 512,
      materialTextures: [],
      materials,
      assets,
    },
  };
  const packedFloats = new Float32Array(floats);
  return {
    id: freePuzzleOrbPackId,
    plan,
    sourcePlan: "scripts/asset-build/generate-raw-webgpu-assets-v1.mjs#procedural-free-puzzle-orbs",
    sourceGeometry: "procedural:free-puzzle-orb-v1",
    floats: packedFloats,
    assetsByKey: new Map(assets.map((asset) => [asset.modelKey, asset])),
    materialsByIndex: new Map(materials.map((material) => [material.index, material])),
    baseTexturesByLayer: new Map(),
    materialTexturesByLayer: new Map(),
  };
}

function freePuzzleOrbModelKey(colorKey) {
  return `puzzle_orb_free_${colorKey}`;
}

function rawProceduralMaterial({
  index,
  name,
  visualRole,
  color,
  emissive = "#000000",
  emissiveStrength = 0,
  roughness,
  metallic,
  materialKind,
  doubleSided = false,
}) {
  return {
    index,
    id: `mat:procedural-free-orb:${index}:${slugForPathSegment(name)}`,
    name,
    category: "interaction",
    visualRole,
    semanticParams: semanticParamsForVisualRole(visualRole, emissiveStrength),
    paletteColorFactor: [0, 0, 0, 0],
    baseColorFactor: [...hexToLinear(color), 1],
    emissiveFactor: hexToLinear(emissive),
    emissiveStrength,
    roughnessFactor: roughness,
    metallicFactor: metallic,
    aoStrength: 1,
    materialKind,
    alphaMode: "OPAQUE",
    transparency: {
      mode: "opaque",
      alpha: 1,
      source: "procedural-free-puzzle-orb-v1",
    },
    doubleSided,
    textures: [],
  };
}

function visualRoleForOrbColor(colorKey) {
  if (colorKey === "red") return "danger_red";
  if (colorKey === "green") return "switch_active";
  if (colorKey === "yellow") return "route_gold";
  if (colorKey === "purple" || colorKey === "white") return "screen_label";
  return "cyan_emissive";
}

function semanticParamsForVisualRole(visualRole, emissiveStrength) {
  const roleIds = {
    structural_dark: 4,
    glass_shell: 5,
    cyan_emissive: 7,
    route_gold: 8,
    danger_red: 9,
    screen_label: 10,
    switch_active: 18,
  };
  const presets = {
    structural_dark: [0.82, 0.03, 0.48],
    glass_shell: [0.78, 0.18, 0.12],
    cyan_emissive: [0.64, 0.30, 0.10],
    route_gold: [0.86, 0.42, 0.06],
    danger_red: [0.82, 0.26, 0.10],
    screen_label: [0.74, 0.36, 0.08],
    switch_active: [0.80, 0.34, 0.08],
  };
  const base = presets[visualRole] ?? [0.35, 0.08, 0.18];
  return [
    roleIds[visualRole] ?? 0,
    roundNumber(base[0]),
    roundNumber(Math.min(1.2, base[1] + emissiveStrength * 0.08)),
    roundNumber(base[2]),
  ];
}

function createBoundsTracker() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

function trackBounds(bounds, x, y, z) {
  bounds.min[0] = Math.min(bounds.min[0], x);
  bounds.min[1] = Math.min(bounds.min[1], y);
  bounds.min[2] = Math.min(bounds.min[2], z);
  bounds.max[0] = Math.max(bounds.max[0], x);
  bounds.max[1] = Math.max(bounds.max[1], y);
  bounds.max[2] = Math.max(bounds.max[2], z);
}

function finalizeBounds(bounds) {
  const min = bounds.min.map((value) => roundNumber(value));
  const max = bounds.max.map((value) => roundNumber(value));
  const size = max.map((value, index) => roundNumber(value - min[index]));
  const center = max.map((value, index) => roundNumber((value + min[index]) / 2));
  return { min, max, center, size };
}

function pushVertex(floats, bounds, position, normal, uv, materialIndex) {
  const n = normalize3(normal);
  floats.push(position[0], position[1], position[2], n[0], n[1], n[2], uv[0], uv[1], materialIndex, -1);
  trackBounds(bounds, position[0], position[1], position[2]);
}

function pushTriangle(floats, bounds, a, b, c, materialIndex, normals = null, uvs = null) {
  const normal = faceNormal(a, b, c);
  pushVertex(floats, bounds, a, normals?.[0] ?? normal, uvs?.[0] ?? [0, 0], materialIndex);
  pushVertex(floats, bounds, b, normals?.[1] ?? normal, uvs?.[1] ?? [1, 0], materialIndex);
  pushVertex(floats, bounds, c, normals?.[2] ?? normal, uvs?.[2] ?? [0, 1], materialIndex);
}

function pushCylinder(floats, bounds, cx, cy, cz, radius, height, segments, materialIndex) {
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2;
    const a1 = ((index + 1) / segments) * Math.PI * 2;
    const n0 = [Math.cos(a0), 0, Math.sin(a0)];
    const n1 = [Math.cos(a1), 0, Math.sin(a1)];
    const p00 = [cx + n0[0] * radius, y0, cz + n0[2] * radius];
    const p01 = [cx + n1[0] * radius, y0, cz + n1[2] * radius];
    const p10 = [cx + n0[0] * radius, y1, cz + n0[2] * radius];
    const p11 = [cx + n1[0] * radius, y1, cz + n1[2] * radius];
    const u0 = index / segments;
    const u1 = (index + 1) / segments;
    pushTriangle(floats, bounds, p00, p01, p11, materialIndex, [n0, n1, n1], [[u0, 1], [u1, 1], [u1, 0]]);
    pushTriangle(floats, bounds, p00, p11, p10, materialIndex, [n0, n1, n0], [[u0, 1], [u1, 0], [u0, 0]]);
    pushTriangle(floats, bounds, [cx, y1, cz], p10, p11, materialIndex, [[0, 1, 0], [0, 1, 0], [0, 1, 0]], [[0.5, 0.5], [0, 0], [1, 0]]);
    pushTriangle(floats, bounds, [cx, y0, cz], p01, p00, materialIndex, [[0, -1, 0], [0, -1, 0], [0, -1, 0]], [[0.5, 0.5], [1, 1], [0, 1]]);
  }
}

function pushSphere(floats, bounds, cx, cy, cz, rx, ry, rz, segments, rings, materialIndex) {
  const point = (theta, phi) => {
    const sinTheta = Math.sin(theta);
    const nx = sinTheta * Math.cos(phi);
    const ny = Math.cos(theta);
    const nz = sinTheta * Math.sin(phi);
    return {
      position: [cx + nx * rx, cy + ny * ry, cz + nz * rz],
      normal: normalize3([nx / Math.max(rx, 0.001), ny / Math.max(ry, 0.001), nz / Math.max(rz, 0.001)]),
    };
  };
  for (let ring = 0; ring < rings; ring += 1) {
    const theta0 = (ring / rings) * Math.PI;
    const theta1 = ((ring + 1) / rings) * Math.PI;
    for (let segment = 0; segment < segments; segment += 1) {
      const phi0 = (segment / segments) * Math.PI * 2;
      const phi1 = ((segment + 1) / segments) * Math.PI * 2;
      const p00 = point(theta0, phi0);
      const p01 = point(theta0, phi1);
      const p10 = point(theta1, phi0);
      const p11 = point(theta1, phi1);
      const u0 = segment / segments;
      const u1 = (segment + 1) / segments;
      const v0 = ring / rings;
      const v1 = (ring + 1) / rings;
      if (ring === 0) {
        pushTriangle(floats, bounds, p10.position, p11.position, p00.position, materialIndex, [p10.normal, p11.normal, p00.normal], [[u0, v1], [u1, v1], [u0, v0]]);
      } else if (ring === rings - 1) {
        pushTriangle(floats, bounds, p00.position, p10.position, p01.position, materialIndex, [p00.normal, p10.normal, p01.normal], [[u0, v0], [u0, v1], [u1, v0]]);
      } else {
        pushTriangle(floats, bounds, p00.position, p10.position, p11.position, materialIndex, [p00.normal, p10.normal, p11.normal], [[u0, v0], [u0, v1], [u1, v1]]);
        pushTriangle(floats, bounds, p00.position, p11.position, p01.position, materialIndex, [p00.normal, p11.normal, p01.normal], [[u0, v0], [u1, v1], [u1, v0]]);
      }
    }
  }
}

function pushTorus(floats, bounds, cx, cy, cz, majorRadius, tubeRadius, segments, tubeSegments, materialIndex) {
  const point = (u, v) => {
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const cosV = Math.cos(v);
    const sinV = Math.sin(v);
    const radius = majorRadius + tubeRadius * cosV;
    return {
      position: [cx + radius * cosU, cy + tubeRadius * sinV, cz + radius * sinU],
      normal: normalize3([cosU * cosV, sinV, sinU * cosV]),
    };
  };
  for (let segment = 0; segment < segments; segment += 1) {
    const u0 = (segment / segments) * Math.PI * 2;
    const u1 = ((segment + 1) / segments) * Math.PI * 2;
    for (let tube = 0; tube < tubeSegments; tube += 1) {
      const v0 = (tube / tubeSegments) * Math.PI * 2;
      const v1 = ((tube + 1) / tubeSegments) * Math.PI * 2;
      const p00 = point(u0, v0);
      const p01 = point(u0, v1);
      const p10 = point(u1, v0);
      const p11 = point(u1, v1);
      pushTriangle(floats, bounds, p00.position, p10.position, p11.position, materialIndex, [p00.normal, p10.normal, p11.normal]);
      pushTriangle(floats, bounds, p00.position, p11.position, p01.position, materialIndex, [p00.normal, p11.normal, p01.normal]);
    }
  }
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return normalize3([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
}

function normalize3(value) {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function hexToLinear(hex) {
  const value = String(hex ?? "#000000").replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16) || 0;
  const g = Number.parseInt(value.slice(2, 4), 16) || 0;
  const b = Number.parseInt(value.slice(4, 6), 16) || 0;
  return [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)].map(roundNumber);
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function mixHex(left, right, amount) {
  const a = hexToSrgb(left);
  const b = hexToSrgb(right);
  const mix = a.map((value, index) => Math.round(value * (1 - amount) + b[index] * amount));
  return `#${mix.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function hexToSrgb(hex) {
  const value = String(hex ?? "#000000").replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16) || 0,
    Number.parseInt(value.slice(2, 4), 16) || 0,
    Number.parseInt(value.slice(4, 6), 16) || 0,
  ];
}

function roundNumber(value) {
  return Math.round(value * 1000000) / 1000000;
}

async function compileGlbBridgeSourcePack(requests) {
  if (requests.length === 0) return null;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hp-raw-webgpu-assets-v1-"));
  try {
    const geometryPath = path.join(tempRoot, "geometry.raw.bin");
    const textureOutputDir = path.join(tempRoot, "textures");
    const texturePublicBase = `${publicBase}/glb-bridge-textures`;
    const assetTable = new Map(
      requests.map((request) => {
        const record = createAssetRecord(
          {
            modelKey: request.modelKey,
            category: rawAssetCategoryForKind(request.kind),
            url: request.glbUrl,
            sizeMeters: [1, 1, 1],
          },
          gameRoot,
        );
        return [
          request.modelKey,
          {
            ...record,
            rawSourcePreference: rawSourcePreferenceForRequest(request),
          },
        ];
      }),
    );
    const geometryPlan = await compileRawGeometryAssets({
      assetTable,
      gameRoot,
      levelId: glbBridgePackId,
      outputPath: geometryPath,
      outputFileName: "geometry.raw.bin",
      textureOutputDir,
      texturePublicBase,
      textureSize: 1024,
    });
    normalizeGlbBridgeGeometryPlan(geometryPlan);
    const geometry = await fs.readFile(geometryPath);
    const textureFiles = new Map();
    const textureNames = await fs.readdir(textureOutputDir).catch(() => []);
    for (const textureName of textureNames) {
      textureFiles.set(
        path.join(outputRoot, "glb-bridge-textures", textureName),
        await fs.readFile(path.join(textureOutputDir, textureName)),
      );
    }
    const plan = {
      schemaVersion: "hp.raw-webgpu.asset-v1-glb-bridge.v1",
      generatedAt: "derived-from-glb-bridge-v1",
      geometry: geometryPlan,
    };
    const pack = {
      id: glbBridgePackId,
      plan,
      sourcePlan: "scripts/asset-build/generate-raw-webgpu-assets-v1.mjs#glb-bridge",
      sourceGeometry: "public/assets/human-protocol/raw-webgpu/assets-v1/**/geometry.raw.bin",
      floats: new Float32Array(geometry.buffer, geometry.byteOffset, geometry.byteLength / Float32Array.BYTES_PER_ELEMENT),
      assetsByKey: new Map((geometryPlan.assets ?? []).map((asset) => [asset.modelKey, asset])),
      materialsByIndex: new Map((geometryPlan.materials ?? []).map((material) => [material.index, material])),
      baseTexturesByLayer: new Map((geometryPlan.baseColorTextures ?? []).map((texture) => [texture.layer, texture])),
      materialTexturesByLayer: new Map((geometryPlan.materialTextures ?? []).map((texture) => [texture.layer, texture])),
    };
    return { pack, textureFiles };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function rawAssetCategoryForKind(kind) {
  if (kind === "door") return "door";
  if (kind === "enemy") return "enemy";
  if (kind === "pickup" || kind === "key-item") return "pickup";
  if (kind === "interaction") return "interaction";
  return "room";
}

function shouldPreferGlbBridgeSource(request) {
  if (request.kind === "enemy" || String(request.modelKey ?? "").startsWith("hp_enemy_")) return false;
  return false;
}

function rawSourcePreferenceForRequest(request) {
  void request;
  return "registered";
}

function normalizeGlbBridgeGeometryPlan(geometryPlan) {
  for (const texture of geometryPlan.baseColorTextures ?? []) normalizeGlbBridgeTextureRecord(texture);
  for (const texture of geometryPlan.materialTextures ?? []) normalizeGlbBridgeTextureRecord(texture);
  for (const material of geometryPlan.materials ?? []) {
    material.textures = material.textures?.map((slot) => normalizeGlbBridgeMaterialTextureSlot(slot, material)) ?? [];
  }
  for (const material of geometryPlan.materials ?? []) {
    if (material.category === "builtin") continue;
    material.id = stableGlbBridgeMaterialId(material);
  }
}

function normalizeGlbBridgeTextureRecord(texture) {
  if (typeof texture.url === "string" && texture.url.startsWith(publicBase)) {
    texture.sourceFile = texture.url.replace(/^\//, "public/");
  }
}

function normalizeGlbBridgeMaterialTextureSlot(slot, material) {
  if (typeof slot.url === "string" && slot.url.startsWith(publicBase)) {
    return {
      ...slot,
      sourceFile: slot.url.replace(/^\//, "public/"),
    };
  }
  if (!slot.url && !slot.sourceFile && !slot.mimeType) {
    return {
      ...slot,
      present: false,
      name: `${material.name}:${slot.semantic}:untextured`,
      stats: null,
      generated: false,
    };
  }
  return slot;
}

function stableGlbBridgeMaterialId(material) {
  const name = String(material.name ?? "material")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "material";
  const category = String(material.category ?? "asset")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";
  return `mat:${category}:${name}:${hashJson({ ...material, id: null }).slice(0, 7)}`;
}

function findSourceAsset(modelKey, kind) {
  for (const pack of sourcePackSearchOrder(modelKey, kind)) {
    const asset = pack.assetsByKey.get(modelKey);
    if (asset?.status === "ready" && asset.vertexCount > 0) return { pack, asset };
  }
  return null;
}

function sourcePackSearchOrder(modelKey, kind) {
  if (String(modelKey ?? "").startsWith("puzzle_orb_free_")) {
    return sourcePacks.filter((pack) => pack.id === freePuzzleOrbPackId);
  }
  const isEnemy = kind === "enemy" || String(modelKey ?? "").startsWith("hp_enemy_");
  const ids = isEnemy
    ? ["level_01_maintenance_bay", "level_02_residential_simulation", "level_03_human_museum", "builder_runtime_resources"]
    : legacySourcePackIds;
  const byId = new Map(sourcePacks.map((pack) => [pack.id, pack]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function familyForModelKey(modelKey) {
  if (modelKey.startsWith("puzzle_orb_free_")) return "puzzle-orb";
  if (modelKey.startsWith("service_elevator") || modelKey.startsWith("door_threshold_service")) return "service-elevator";
  if (modelKey.startsWith("hero_maintenance") || modelKey.includes("_maintenance_") || modelKey.startsWith("light_wall_medical")) return "level01-maintenance";
  if (modelKey.startsWith("hp_l2_cc0") || modelKey.startsWith("hp_furniture_residential")) return "level02-false-home";
  if (modelKey.startsWith("room_l2_img2")) return "level02-image2";
  if (modelKey.startsWith("room_l09") || modelKey.startsWith("puzzle_") || modelKey.includes("orb")) return "puzzle";
  if (modelKey.startsWith("hp_enemy_")) return "enemies";
  if (modelKey.startsWith("viewmodel_hand_")) return "viewmodel-hands";
  if (modelKey.includes("_viewmodel_") || modelKey.startsWith("ability_")) return "viewmodels";
  if (modelKey.startsWith("pickup_")) return "pickups";
  return "shared";
}

function qualityProfileForModelKey(modelKey) {
  const hero = modelKey.startsWith("hero_") || modelKey.includes("decal") || modelKey.includes("puzzle") || modelKey.includes("orb");
  return {
    tier: hero ? "hero-or-puzzle" : "ordinary-furniture",
    baseColorTarget: hero ? 1024 : 512,
    normalTarget: hero ? 1024 : 512,
    ormTarget: 512,
    emissiveTarget: hero ? 1024 : 512,
    preferredMimeTypes: ["image/avif", "image/webp"],
  };
}

function hashBytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
