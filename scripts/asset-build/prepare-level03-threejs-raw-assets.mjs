import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  brotliCompress,
  constants as zlibConstants,
  gzip,
} from "node:zlib";
import { createServer } from "vite";

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const scriptPath = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const defaultLevelId = "level_03_human_museum";
const levelId = readArg("--level") ?? defaultLevelId;
const isMuseumLevel = levelId === defaultLevelId;
const manifestDir = path.join(gameRoot, "src/assets/manifests/generated/raw-webgpu");
const manifestPath = path.join(manifestDir, `raw_threejs_resource_bridge_${levelId}.json`);
const robotAnimationBridgePath = path.join(manifestDir, `raw_robot_animation_bridge_${levelId}.json`);
const renderPlanPath = path.join(manifestDir, `render_plan_${levelId}.json`);
const publicRoot = path.join(gameRoot, "public/assets/human-protocol/raw-webgpu", levelId, "threejs-lossless");
const publicAssetRoot = path.join(publicRoot, "assets");
const writeOutputs = !hasArg("--audit-only");
const includeSourceArt = hasArg("--include-source-art");
const writeOriginalCopies = hasArg("--copy-originals");
const writeBrotli = !hasArg("--no-brotli");
const writeGzip = hasArg("--gzip");

const sharedThreeTextureFiles = [
  "src/assets/environment/environment-trim-sheet-01.jpg",
  "src/assets/environment/floor-wall-surface-atlas-01.jpg",
  "src/assets/environment/props-decal-atlas-01.jpg",
  "src/assets/environment/room-backdrops-01.jpg",
  "src/assets/environment/door_terminal_atlas.jpg",
  "src/assets/environment/props_pickups_atlas.jpg",
  "src/assets/environment/archive_panel_atlas.jpg",
  "src/assets/environment/switch_panel_atlas.jpg",
  "src/assets/environment/first90-floor-wall-surface-atlas-01.jpg",
  "src/assets/environment/first90-props-decal-atlas-01.jpg",
  "src/assets/environment/first90-room-backdrops-01.jpg",
  "src/assets/viewmodel/weapon-viewmodel-atlas.jpg",
];
if (isMuseumLevel) {
  sharedThreeTextureFiles.push(
    "src/assets/textures/environment/builder-surfaces/white_marble_color.webp",
    "src/assets/textures/environment/builder-surfaces/hp_wall_museum_limestone_panel_color.webp",
    "src/assets/textures/environment/builder-surfaces/hp_ceiling_museum_coffered_limestone_color.webp",
  );
}

const resourceScanDirectories = [
  "src/assets/textures/enemies",
  "src/assets/enemy-atlas",
];
if (isMuseumLevel) {
  resourceScanDirectories.push("src/assets/models-cooked/environment/level03");
  resourceScanDirectories.push("src/assets/textures/environment/level03");
}
if (includeSourceArt) {
  if (isMuseumLevel) {
    resourceScanDirectories.push("src/assets/models/environment/level03");
    resourceScanDirectories.push("src/assets/textures/environment/hero-floors");
  }
}

const resourceExtensions = new Set([".glb", ".gltf", ".bin", ".png", ".jpg", ".jpeg", ".webp"]);

const server = await createServer({
  root: gameRoot,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const [{ environmentModelAssets }, { enemyModelAssets }] = await Promise.all([
    server.ssrLoadModule("/src/assets/environmentModelAssets.ts"),
    server.ssrLoadModule("/src/assets/enemyModelAssets.ts"),
  ]);

  const renderPlan = await readJsonIfExists(renderPlanPath);
  const planAssets = renderPlan?.geometry?.assets ?? renderPlan?.assets ?? [];
  const planModelKeys = new Set(planAssets.map((asset) => asset.modelKey).filter(Boolean));
  const resources = new Map();

  for (const asset of Object.values(environmentModelAssets)) {
    const filePath = viteUrlToFilePath(asset.url, gameRoot);
    if (!filePath || !fsSync.existsSync(filePath)) continue;
    const url = normalizeViteUrl(asset.url);
    const include =
      planModelKeys.has(asset.modelKey) ||
      (isMuseumLevel && (asset.modelKey.includes("museum") || url.includes("/level03/") || url.includes("level03")));
    if (!include) continue;
    addResource(resources, {
      kind: "model",
      role: "environment",
      key: asset.modelKey,
      sourceUrl: url,
      filePath,
      usage: planModelKeys.has(asset.modelKey) ? "render-plan-instance" : "museum-threejs-registry",
      metadata: {
        category: asset.category ?? null,
        sizeMeters: asset.sizeMeters ?? null,
      },
    });
  }

  for (const asset of Object.values(enemyModelAssets)) {
    const filePath = viteUrlToFilePath(asset.url, gameRoot);
    if (!filePath || !fsSync.existsSync(filePath)) continue;
    addResource(resources, {
      kind: "model",
      role: "enemy",
      key: asset.modelKey,
      sourceUrl: normalizeViteUrl(asset.url),
      filePath,
      usage: "robot-action-source",
      metadata: {
        runtimePreload: Boolean(asset.runtimePreload),
        warmupTargetHeight: asset.warmupTargetHeight ?? null,
      },
    });
  }

  for (const asset of planAssets) {
    const filePath = planAssetToFilePath(asset);
    if (!filePath || !fsSync.existsSync(filePath)) continue;
    const extension = path.extname(filePath).toLowerCase();
    if (!resourceExtensions.has(extension)) continue;
    addResource(resources, {
      kind: extension === ".glb" || extension === ".gltf" ? "model" : "texture",
      role: asset.category ?? "render-plan",
      key: asset.modelKey ?? path.basename(filePath, extension),
      sourceUrl: planAssetSourceUrl(asset, filePath),
      filePath,
      usage: "render-plan-geometry-asset",
      metadata: {
        category: asset.category ?? null,
        sizeMeters: asset.sizeMeters ?? asset.bounds?.size ?? null,
        source: "render-plan.geometry.assets",
      },
    });
  }

  for (const relPath of sharedThreeTextureFiles) {
    const filePath = path.join(gameRoot, relPath);
    if (!fsSync.existsSync(filePath)) continue;
    addResource(resources, {
      kind: "texture",
      role: "shared-threejs-atlas",
      key: path.basename(relPath, path.extname(relPath)),
      sourceUrl: `/${relPath}`,
      filePath,
      usage: "threejs-runtime-shared-atlas",
    });
  }

  for (const relDir of resourceScanDirectories) {
    const dirPath = path.join(gameRoot, relDir);
    const files = await findResourceFiles(dirPath);
    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase();
      const kind = ext === ".glb" || ext === ".gltf" || ext === ".bin" ? "model" : "texture";
      addResource(resources, {
        kind,
        role: inferScannedRole(filePath),
        key: path.basename(filePath, ext),
        sourceUrl: `/${path.relative(gameRoot, filePath).replaceAll(path.sep, "/")}`,
        filePath,
        usage: "source-directory-scan",
      });
    }
  }

  const resourceList = [...resources.values()].sort((a, b) => a.file.localeCompare(b.file));
  for (const resource of resourceList) {
    if (resource.kind === "model" && path.extname(resource.filePath).toLowerCase() === ".glb") {
      resource.glb = readGlbMetadata(resource.filePath);
      for (const externalTexture of collectExternalGlbTextures(resource.filePath, resource.glb?.images ?? [])) {
        addResource(resources, {
          kind: "texture",
          role: "glb-external-texture",
          key: path.basename(externalTexture.filePath, path.extname(externalTexture.filePath)),
          sourceUrl: externalTexture.uri,
          filePath: externalTexture.filePath,
          usage: `external-texture-for:${resource.key}`,
        });
      }
    } else if (resource.kind === "texture") {
      resource.image = readImageMetadata(resource.filePath);
    }
  }

  const finalResources = [...resources.values()]
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((resource) => withoutFilePath(resource));
  const compression = writeOutputs
    ? await writeLosslessBundle([...resources.values()].sort((a, b) => a.file.localeCompare(b.file)))
    : createEmptyCompressionSummary();

  const animationSummary = summarizeAnimations(finalResources);
  const robotAnimationBridge = createRobotAnimationBridge([...resources.values()].sort((a, b) => a.file.localeCompare(b.file)));
  const manifest = {
    schemaVersion: "hp.raw-webgpu.threejs-resource-bridge.v1",
    generatedAt: new Date().toISOString(),
    generator: {
      script: "scripts/asset-build/prepare-level03-threejs-raw-assets.mjs",
      gitBranch: git("branch --show-current"),
      gitCommit: git("rev-parse --short HEAD"),
      workingTreeDirty: git("status --short").length > 0,
      options: {
        level: levelId,
        writeOutputs,
        includeSourceArt,
        writeOriginalCopies,
        writeBrotli,
        writeGzip,
      },
    },
    levelId,
    intent: {
      sourceRenderer: "threejs",
      targetRenderer: "raw-webgpu",
      losslessPolicy: "byte-exact Brotli/Gzip sidecars and optional original copies; no mesh quantization, no image transcoding, no resizing",
      notes: [
        "This bridge keeps the original Three.js museum runtime assets addressable for the raw engine.",
        "Default mode prepares runtime assets only; pass --include-source-art for source GLBs and non-runtime art references.",
        "Robot GLB clips are preserved as metadata so a later raw animation palette can bind authored actions instead of static triangles.",
        "The existing raw base-color cooker may still emit fixed-size runtime textures; this bridge is the non-destructive source manifest.",
      ],
    },
    renderPlan: {
      path: path.relative(gameRoot, renderPlanPath).replaceAll(path.sep, "/"),
      found: Boolean(renderPlan),
      modelKeyCount: planModelKeys.size,
    },
    coverage: summarizeCoverage(finalResources),
    animationSummary,
    robotAnimationBridge: {
      path: path.relative(gameRoot, robotAnimationBridgePath).replaceAll(path.sep, "/"),
      schemaVersion: robotAnimationBridge.schemaVersion,
      animatedAssetCount: robotAnimationBridge.animatedAssetCount,
      clipCount: robotAnimationBridge.clipCount,
      channelCount: robotAnimationBridge.channelCount,
      keyframeCount: robotAnimationBridge.keyframeCount,
      uniqueActions: robotAnimationBridge.uniqueActions,
    },
    compression,
    resources: finalResources,
  };

  await fs.mkdir(manifestDir, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(robotAnimationBridgePath, `${JSON.stringify(robotAnimationBridge, null, 2)}\n`);

  console.log(`[HumanProtocol] Prepared ${finalResources.length} Three.js resources for ${levelId}.`);
  console.log(`[HumanProtocol] Manifest: ${path.relative(gameRoot, manifestPath)}`);
  if (writeOutputs) {
    console.log(
      `[HumanProtocol] Lossless bundle: ${path.relative(gameRoot, publicRoot)} ` +
        `(${formatBytes(compression.originalBytes)} original -> ${formatBytes(compression.bestSidecarBytes)} best sidecars)`,
    );
  }
  if (animationSummary.clipCount > 0) {
    console.log(
      `[HumanProtocol] Robot animation clips preserved: ${animationSummary.clipCount} clips across ${animationSummary.animatedAssetCount} GLBs ` +
        `(${robotAnimationBridge.channelCount} channels, ${robotAnimationBridge.keyframeCount} keyframes).`,
    );
  }
} finally {
  await server.close();
}

function addResource(resources, input) {
  const filePath = path.resolve(input.filePath);
  const existing = resources.get(filePath);
  const usage = {
    role: input.role,
    usage: input.usage,
    key: input.key,
  };
  if (existing) {
    existing.usages.push(usage);
    if (!existing.keys.includes(input.key)) existing.keys.push(input.key);
    if (!existing.roles.includes(input.role)) existing.roles.push(input.role);
    existing.metadata = { ...existing.metadata, ...(input.metadata ?? {}) };
    return existing;
  }
  const stats = fsSync.statSync(filePath);
  const resource = {
    kind: input.kind,
    role: input.role,
    roles: [input.role],
    key: input.key,
    keys: [input.key],
    sourceUrl: input.sourceUrl,
    file: path.relative(gameRoot, filePath).replaceAll(path.sep, "/"),
    filePath,
    extension: path.extname(filePath).toLowerCase(),
    mimeType: mimeTypeFor(filePath),
    byteLength: stats.size,
    sha256: sha256FileSync(filePath),
    usages: [usage],
    metadata: input.metadata ?? {},
  };
  resources.set(filePath, resource);
  return resource;
}

async function writeLosslessBundle(resources) {
  await fs.rm(publicRoot, { recursive: true, force: true });
  await fs.mkdir(publicAssetRoot, { recursive: true });

  const entries = [];
  let originalBytes = 0;
  let copiedOriginalBytes = 0;
  let brotliBytes = 0;
  let gzipBytes = 0;
  let bestSidecarBytes = 0;
  let brotliWrittenCount = 0;
  let gzipWrittenCount = 0;

  for (const resource of resources) {
    const bytes = await fs.readFile(resource.filePath);
    originalBytes += bytes.length;
    const rel = resource.file;
    const outPath = path.join(publicAssetRoot, rel);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    if (writeOriginalCopies) {
      await fs.writeFile(outPath, bytes);
      copiedOriginalBytes += bytes.length;
    }

    const sidecars = [];
    if (writeBrotli) {
      const compressed = await brotliCompressAsync(bytes, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
          [zlibConstants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
        },
      });
      if (compressed.length < bytes.length) {
        await fs.writeFile(`${outPath}.br`, compressed);
        brotliBytes += compressed.length;
        brotliWrittenCount += 1;
        sidecars.push({
          encoding: "br",
          byteLength: compressed.length,
          ratio: roundNumber(compressed.length / bytes.length),
          publicUrl: publicUrlForPath(`${outPath}.br`),
        });
      }
    }
    if (writeGzip) {
      const compressed = await gzipAsync(bytes, { level: 9 });
      if (compressed.length < bytes.length) {
        await fs.writeFile(`${outPath}.gz`, compressed);
        gzipBytes += compressed.length;
        gzipWrittenCount += 1;
        sidecars.push({
          encoding: "gzip",
          byteLength: compressed.length,
          ratio: roundNumber(compressed.length / bytes.length),
          publicUrl: publicUrlForPath(`${outPath}.gz`),
        });
      }
    }
    const best = sidecars.reduce((bestSidecar, sidecar) => {
      if (!bestSidecar) return sidecar;
      return sidecar.byteLength < bestSidecar.byteLength ? sidecar : bestSidecar;
    }, null);
    bestSidecarBytes += best?.byteLength ?? bytes.length;
    entries.push({
      file: rel,
      originalByteLength: bytes.length,
      originalPublicUrl: writeOriginalCopies ? publicUrlForPath(outPath) : null,
      sha256: resource.sha256,
      sidecars,
      bestEncoding: best?.encoding ?? "identity",
      bestByteLength: best?.byteLength ?? bytes.length,
    });
  }

  return {
    outputDir: path.relative(gameRoot, publicRoot).replaceAll(path.sep, "/"),
    originalBytes,
    copiedOriginalBytes,
    brotliBytes,
    gzipBytes,
    bestSidecarBytes,
    bestRatio: originalBytes > 0 ? roundNumber(bestSidecarBytes / originalBytes) : 1,
    resourceCount: entries.length,
    brotliWrittenCount,
    gzipWrittenCount,
    entries,
  };
}

function createEmptyCompressionSummary() {
  return {
    outputDir: path.relative(gameRoot, publicRoot).replaceAll(path.sep, "/"),
    originalBytes: 0,
    copiedOriginalBytes: 0,
    brotliBytes: 0,
    gzipBytes: 0,
    bestSidecarBytes: 0,
    bestRatio: 1,
    resourceCount: 0,
    brotliWrittenCount: 0,
    gzipWrittenCount: 0,
    entries: [],
  };
}

function readGlbMetadata(filePath) {
  try {
    const { json } = readGlbContainer(filePath);
    const materialTextureSlots = collectMaterialTextureSlots(json);
    return {
      readable: true,
      byteLength: fsSync.statSync(filePath).size,
      scenes: json.scenes?.length ?? 0,
      nodes: json.nodes?.length ?? 0,
      meshes: json.meshes?.length ?? 0,
      skins: json.skins?.length ?? 0,
      materials: json.materials?.length ?? 0,
      textures: json.textures?.length ?? 0,
      images: (json.images ?? []).map((image, index) => ({
        index,
        name: image.name ?? null,
        uri: image.uri ?? null,
        mimeType: image.mimeType ?? null,
        embedded: Number.isInteger(image.bufferView),
      })),
      accessors: json.accessors?.length ?? 0,
      bufferViews: json.bufferViews?.length ?? 0,
      extensionsUsed: json.extensionsUsed ?? [],
      extensionsRequired: json.extensionsRequired ?? [],
      materialTextureSlots,
      animations: summarizeGlbAnimations(json),
    };
  } catch (error) {
    return {
      readable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readGlbContainer(filePath) {
  const buffer = fsSync.readFileSync(filePath);
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB file");
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) {
      json = JSON.parse(buffer.subarray(offset, offset + length).toString("utf8"));
    } else if (type === 0x004e4942) {
      bin = buffer.subarray(offset, offset + length);
    }
    offset += length;
  }
  if (!json) throw new Error("missing JSON chunk");
  return { json, bin, buffer };
}

function summarizeGlbAnimations(json) {
  return (json.animations ?? []).map((animation, animationIndex) => {
    const name = animation.name ?? `clip_${animationIndex}`;
    const targetNodeIndexes = new Set();
    const targetPaths = new Set();
    const targetNodes = [];
    for (const channel of animation.channels ?? []) {
      const nodeIndex = Number.isInteger(channel.target?.node) ? channel.target.node : null;
      const targetPath = channel.target?.path ?? "unknown";
      targetPaths.add(targetPath);
      if (nodeIndex !== null) {
        targetNodeIndexes.add(nodeIndex);
        if (targetNodes.length < 48) {
          targetNodes.push({
            node: nodeIndex,
            name: json.nodes?.[nodeIndex]?.name ?? null,
            path: targetPath,
          });
        }
      }
    }
    let durationSeconds = 0;
    for (const sampler of animation.samplers ?? []) {
      const inputAccessor = Number.isInteger(sampler.input) ? json.accessors?.[sampler.input] : null;
      const maxTime = Array.isArray(inputAccessor?.max) ? Number(inputAccessor.max[0]) : 0;
      if (Number.isFinite(maxTime)) durationSeconds = Math.max(durationSeconds, maxTime);
    }
    return {
      index: animationIndex,
      name,
      action: normalizeAnimationAction(name),
      durationSeconds: roundNumber(durationSeconds),
      samplerCount: animation.samplers?.length ?? 0,
      channelCount: animation.channels?.length ?? 0,
      targetNodeCount: targetNodeIndexes.size,
      targetPaths: [...targetPaths].sort(),
      targetNodes,
    };
  });
}

function normalizeAnimationAction(name) {
  return String(name)
    .replace(/\.\d+$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "clip";
}

function collectMaterialTextureSlots(json) {
  const slots = [];
  for (const [materialIndex, material] of (json.materials ?? []).entries()) {
    const pushSlot = (semantic, slot) => {
      if (!slot || !Number.isInteger(slot.index)) return;
      const texture = json.textures?.[slot.index] ?? null;
      const image = Number.isInteger(texture?.source) ? json.images?.[texture.source] : null;
      slots.push({
        materialIndex,
        materialName: material.name ?? null,
        semantic,
        textureIndex: slot.index,
        imageIndex: Number.isInteger(texture?.source) ? texture.source : null,
        imageName: image?.name ?? null,
        imageUri: image?.uri ?? null,
        imageMimeType: image?.mimeType ?? null,
        texCoord: slot.texCoord ?? 0,
        alphaMode: material.alphaMode ?? "OPAQUE",
        doubleSided: Boolean(material.doubleSided),
      });
    };
    pushSlot("baseColor", material.pbrMetallicRoughness?.baseColorTexture);
    pushSlot("metallicRoughness", material.pbrMetallicRoughness?.metallicRoughnessTexture);
    pushSlot("normal", material.normalTexture);
    pushSlot("occlusion", material.occlusionTexture);
    pushSlot("emissive", material.emissiveTexture);
  }
  return slots;
}

function collectExternalGlbTextures(glbPath, images) {
  const textures = [];
  for (const image of images) {
    const uri = image.uri;
    if (!uri || uri.startsWith("data:")) continue;
    const filePath = path.resolve(path.dirname(glbPath), decodeURIComponent(uri));
    if (!fsSync.existsSync(filePath)) continue;
    textures.push({ uri, filePath });
  }
  return textures;
}

function readImageMetadata(filePath) {
  const buffer = fsSync.readFileSync(filePath);
  const mimeType = mimeTypeFor(filePath);
  const metadata = {
    readable: true,
    mimeType,
    byteLength: buffer.length,
  };
  const pngSize = readPngSize(buffer);
  if (pngSize) return { ...metadata, ...pngSize };
  const jpegSize = readJpegSize(buffer);
  if (jpegSize) return { ...metadata, ...jpegSize };
  return metadata;
}

function readPngSize(buffer) {
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function summarizeAnimations(resources) {
  const animatedAssets = resources.filter((resource) => (resource.glb?.animations?.length ?? 0) > 0);
  const uniqueClipNames = new Set();
  const uniqueActions = new Set();
  let clipCount = 0;
  let animatedChannelCount = 0;
  for (const resource of animatedAssets) {
    for (const clip of resource.glb.animations) {
      clipCount += 1;
      animatedChannelCount += clip.channelCount ?? 0;
      uniqueClipNames.add(clip.name);
      uniqueActions.add(clip.action ?? normalizeAnimationAction(clip.name));
    }
  }
  return {
    animatedAssetCount: animatedAssets.length,
    clipCount,
    animatedChannelCount,
    uniqueClipNames: [...uniqueClipNames].sort(),
    uniqueActions: [...uniqueActions].sort(),
    assets: animatedAssets.map((resource) => ({
      key: resource.key,
      file: resource.file,
      nodeCount: resource.glb.nodes,
      skinCount: resource.glb.skins,
      clipCount: resource.glb.animations.length,
      clips: resource.glb.animations.map((clip) => ({
        name: clip.name,
        action: clip.action ?? normalizeAnimationAction(clip.name),
        durationSeconds: clip.durationSeconds,
        channelCount: clip.channelCount,
        targetNodeCount: clip.targetNodeCount,
        targetPaths: clip.targetPaths,
      })),
    })),
  };
}

function createRobotAnimationBridge(resources) {
  const animatedResources = resources.filter((resource) => resource.role === "enemy" && (resource.glb?.animations?.length ?? 0) > 0);
  const assets = animatedResources.map((resource) => readGlbAnimationData(resolveRobotAnimationSource(resource)));
  const uniqueActions = new Set();
  let clipCount = 0;
  let channelCount = 0;
  let keyframeCount = 0;
  for (const asset of assets) {
    for (const clip of asset.clips) {
      clipCount += 1;
      uniqueActions.add(clip.action);
      channelCount += clip.channels.length;
      keyframeCount += clip.channels.reduce((sum, channel) => sum + channel.keyframeCount, 0);
    }
  }
  return {
    schemaVersion: "hp.raw-webgpu.robot-animation-bridge.v1",
    generatedAt: new Date().toISOString(),
    levelId,
    coordinateSpace: "gltf-node-local",
    interpolationPolicy: "STEP, LINEAR, and CUBICSPLINE are preserved from GLB samplers; runtime may initially downshift to LINEAR per action.",
    animatedAssetCount: assets.length,
    clipCount,
    channelCount,
    keyframeCount,
    uniqueActions: [...uniqueActions].sort(),
    assets,
  };
}

function resolveRobotAnimationSource(resource) {
  if (resource.role === "enemy") {
    return {
      ...resource,
      animationSourceKind: "registered",
      runtimeFile: resource.file,
    };
  }
  const rawFilePath = path.join(
    gameRoot,
    resource.file
      .replace(/^src\/assets\/models-cooked\//, "src/assets/models/")
      .replace(/^src\/assets\/models-runtime\//, "src/assets/models/"),
  );
  if (rawFilePath !== resource.filePath && fsSync.existsSync(rawFilePath)) {
    return {
      ...resource,
      filePath: rawFilePath,
      file: path.relative(gameRoot, rawFilePath).replaceAll(path.sep, "/"),
      sourceUrl: `/${path.relative(gameRoot, rawFilePath).replaceAll(path.sep, "/")}`,
      byteLength: fsSync.statSync(rawFilePath).size,
      sha256: sha256FileSync(rawFilePath),
      animationSourceKind: "raw-models",
      runtimeFile: resource.file,
    };
  }
  return {
    ...resource,
    animationSourceKind: "registered",
    runtimeFile: resource.file,
  };
}

function readGlbAnimationData(resource) {
  const { json, bin } = readGlbContainer(resource.filePath);
  const parentByNode = new Map();
  for (const [nodeIndex, node] of (json.nodes ?? []).entries()) {
    for (const childIndex of node.children ?? []) {
      parentByNode.set(childIndex, nodeIndex);
    }
  }
  const rawNodes = (json.nodes ?? []).map((node, index) => ({
    index,
    name: node.name ?? null,
    parent: parentByNode.get(index) ?? null,
    children: node.children ?? [],
    mesh: Number.isInteger(node.mesh) ? node.mesh : null,
    skin: Number.isInteger(node.skin) ? node.skin : null,
    translation: node.translation ? roundArray(node.translation) : [0, 0, 0],
    rotation: node.rotation ? roundArray(node.rotation) : [0, 0, 0, 1],
    scale: node.scale ? roundArray(node.scale) : [1, 1, 1],
    matrix: node.matrix ? roundArray(node.matrix) : null,
  }));
  const appendageOverride = rawReadableAppendageOverrideFor(resource.key);
  const { nodes, applications: rawReadableAppendageApplications } = appendageOverride
    ? applyRawReadableAppendageOverrides(rawNodes, appendageOverride)
    : { nodes: rawNodes, applications: [] };
  const clips = (json.animations ?? []).map((animation, animationIndex) => {
    const name = animation.name ?? `clip_${animationIndex}`;
    const channels = (animation.channels ?? []).map((channel, channelIndex) => {
      const sampler = Number.isInteger(channel.sampler) ? animation.samplers?.[channel.sampler] : null;
      const targetNode = Number.isInteger(channel.target?.node) ? channel.target.node : null;
      const targetPath = channel.target?.path ?? "unknown";
      const times = sampler ? readAccessorNumberArray(json, bin, sampler.input) : [];
      const values = sampler ? readAccessorNumberArray(json, bin, sampler.output) : [];
      return {
        index: channelIndex,
        sampler: Number.isInteger(channel.sampler) ? channel.sampler : null,
        targetNode,
        targetName: targetNode !== null ? json.nodes?.[targetNode]?.name ?? null : null,
        path: targetPath,
        interpolation: sampler?.interpolation ?? "LINEAR",
        timeAccessor: sampler?.input ?? null,
        valueAccessor: sampler?.output ?? null,
        valueType: sampler && Number.isInteger(sampler.output) ? json.accessors?.[sampler.output]?.type ?? null : null,
        keyframeCount: times.length,
        times,
        values,
      };
    });
    const durationSeconds = channels.reduce((duration, channel) => Math.max(duration, channel.times[channel.times.length - 1] ?? 0), 0);
    return {
      index: animationIndex,
      name,
      action: normalizeAnimationAction(name),
      durationSeconds: roundNumber(durationSeconds),
      channels,
    };
  });
  return {
    key: resource.key,
    file: resource.file,
    runtimeFile: resource.runtimeFile ?? resource.file,
    animationSourceKind: resource.animationSourceKind ?? "registered",
    sourceUrl: resource.sourceUrl,
    sha256: resource.sha256,
    rawReadableAppendageOverrides: appendageOverride
      ? {
          policy: "baked-node-scale-ceilings-and-floors",
          reason: "Raw WebGPU consumes this bridge directly; appendage readability must be visible in the manifest, not hidden in runtime code.",
          families: appendageOverride,
          applications: rawReadableAppendageApplications,
        }
      : null,
    nodeCount: nodes.length,
    meshNodeCount: nodes.filter((node) => node.mesh !== null).length,
    skinCount: json.skins?.length ?? 0,
    clips,
    nodes,
  };
}

function rawReadableAppendageOverrideFor(key) {
  if (key === "hp_enemy_repair_drone_horror") {
    return {
      hand: { floor: [0.32, 0.3, 0.32] },
      arm: { floor: [0.24, 0.23, 0.28] },
      forearm: { floor: [0.25, 0.25, 0.38] },
      tool: { ceiling: [0.22, 0.18, 0.22] },
      exact: {
        mesh52: { ceiling: [0.08, 0.05, 0.08], role: "flying-hand-block-hidden" },
        mesh53: { floor: [1.55, 1.35, 1.55], role: "flying-hand-finger" },
        mesh54: { floor: [2.1, 1.75, 2.1], role: "flying-hand-cyan-tip" },
        mesh66: { ceiling: [0.08, 0.05, 0.08], role: "flying-hand-block-hidden" },
        mesh67: { floor: [1.35, 1.35, 1.35], role: "flying-hand-cyan-tip" },
      },
    };
  }
  if (key === "hp_enemy_clamp_repair_horror") {
    return {
      hand: { ceiling: [0.86, 0.78, 0.7] },
      arm: { ceiling: [1.14, 1.04, 0.82] },
      forearm: { ceiling: [1.12, 1.02, 0.82] },
      tool: { ceiling: [0.82, 0.72, 0.62] },
      exact: {
        leftclamplower: { ceiling: [0.055, 0.16, 0.055], role: "hand-block-trim" },
        mesh97: { ceiling: [0.075, 0.055, 0.075], role: "hand-block-trim" },
        mesh98: { ceiling: [0.075, 0.055, 0.075], role: "hand-block-trim" },
        mesh100: { ceiling: [0.055, 0.16, 0.055], role: "hand-block-trim" },
        mesh122: { ceiling: [0.075, 0.055, 0.075], role: "hand-block-trim" },
        mesh123: { ceiling: [0.075, 0.055, 0.075], role: "hand-block-trim" },
        mesh124: { ceiling: [0.055, 0.16, 0.055], role: "hand-block-trim" },
        mesh126: { ceiling: [0.055, 0.16, 0.055], role: "hand-block-trim" },
        mesh54001: { ceiling: [0.075, 0.055, 0.075], role: "hand-block-trim" },
      },
    };
  }
  // Shield and boss rigs use their authored GLBs in Raw WebGPU. Re-scaling
  // bridge nodes here would desync the animation bridge from the baked geometry.
  return null;
}

function applyRawReadableAppendageOverrides(nodes, overrides) {
  const applications = [];
  const nextNodes = nodes.map((node) => {
    const family = rawReadableAppendageFamily(node.name);
    const override = rawReadableExactNodeOverride(node.name, overrides) ?? (family ? overrides[family] : null);
    if (!override) return node;
    const before = node.scale ?? [1, 1, 1];
    const after = clampRawReadableScale(before, override);
    if (scaleTupleEqual(before, after)) return node;
    applications.push({
      nodeIndex: node.index,
      nodeName: node.name,
      family: family ?? "exact",
      role: override.role ?? null,
      before,
      after,
      floor: override.floor ?? null,
      ceiling: override.ceiling ?? null,
    });
    return { ...node, scale: after };
  });
  return { nodes: nextNodes, applications };
}

function rawReadableExactNodeOverride(name, overrides) {
  const normalized = normalizeRawReadableNodeName(name);
  if (!normalized) return null;
  return overrides.exact?.[normalized] ?? null;
}

function rawReadableAppendageFamily(name) {
  const normalized = normalizeRawReadableNodeName(name);
  if (!normalized) return null;
  if (/utilityhand|parthand|lefthand|righthand/.test(normalized)) return "hand";
  if (/partforearm/.test(normalized)) return "forearm";
  if (/partarm|upperarm/.test(normalized)) return "arm";
  if (/servicecutter|rescuebaton|utilitywrench|stunprobe|cutter|wrench|baton|probe/.test(normalized)) return "tool";
  return null;
}

function normalizeRawReadableNodeName(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function clampRawReadableScale(scale, override) {
  const next = [...scale];
  if (override.floor) {
    for (let index = 0; index < 3; index += 1) next[index] = Math.max(Number(next[index] ?? 1), override.floor[index]);
  }
  if (override.ceiling) {
    for (let index = 0; index < 3; index += 1) next[index] = Math.min(Number(next[index] ?? 1), override.ceiling[index]);
  }
  return roundArray(next);
}

function scaleTupleEqual(left, right) {
  return left.length === right.length && left.every((value, index) => Math.abs(Number(value) - Number(right[index])) < 0.000001);
}

function readAccessorNumberArray(json, bin, accessorIndex) {
  const accessor = Number.isInteger(accessorIndex) ? json.accessors?.[accessorIndex] : null;
  if (!accessor) return [];
  if (accessor.sparse) {
    throw new Error(`Sparse animation accessors are not supported yet (accessor ${accessorIndex}).`);
  }
  const bufferView = Number.isInteger(accessor.bufferView) ? json.bufferViews?.[accessor.bufferView] : null;
  if (!bufferView) return [];
  if (!bin) throw new Error(`Animation accessor ${accessorIndex} references a missing BIN chunk.`);
  const componentCount = accessorComponentCount(accessor.type);
  const componentByteLength = accessorComponentByteLength(accessor.componentType);
  const packedStride = componentCount * componentByteLength;
  const byteStride = bufferView.byteStride ?? packedStride;
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const dataView = new DataView(bin.buffer, bin.byteOffset + byteOffset, Math.max(0, bufferView.byteLength - (accessor.byteOffset ?? 0)));
  const values = [];
  for (let elementIndex = 0; elementIndex < (accessor.count ?? 0); elementIndex += 1) {
    const elementOffset = elementIndex * byteStride;
    for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
      const componentOffset = elementOffset + componentIndex * componentByteLength;
      values.push(roundNumber(readAccessorComponent(dataView, componentOffset, accessor.componentType, Boolean(accessor.normalized))));
    }
  }
  return values;
}

function accessorComponentCount(type) {
  if (type === "SCALAR") return 1;
  if (type === "VEC2") return 2;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  if (type === "MAT2") return 4;
  if (type === "MAT3") return 9;
  if (type === "MAT4") return 16;
  return 1;
}

function accessorComponentByteLength(componentType) {
  if (componentType === 5120 || componentType === 5121) return 1;
  if (componentType === 5122 || componentType === 5123) return 2;
  if (componentType === 5125 || componentType === 5126) return 4;
  throw new Error(`Unsupported accessor component type ${componentType}.`);
}

function readAccessorComponent(dataView, byteOffset, componentType, normalized) {
  switch (componentType) {
    case 5120: {
      const value = dataView.getInt8(byteOffset);
      return normalized ? Math.max(value / 127, -1) : value;
    }
    case 5121: {
      const value = dataView.getUint8(byteOffset);
      return normalized ? value / 255 : value;
    }
    case 5122: {
      const value = dataView.getInt16(byteOffset, true);
      return normalized ? Math.max(value / 32767, -1) : value;
    }
    case 5123: {
      const value = dataView.getUint16(byteOffset, true);
      return normalized ? value / 65535 : value;
    }
    case 5125:
      return dataView.getUint32(byteOffset, true);
    case 5126:
      return dataView.getFloat32(byteOffset, true);
    default:
      throw new Error(`Unsupported accessor component type ${componentType}.`);
  }
}

function roundArray(values) {
  return values.map((value) => roundNumber(value));
}

function summarizeCoverage(resources) {
  const byKind = countBy(resources, (resource) => resource.kind);
  const byRole = countBy(resources, (resource) => resource.role);
  const embeddedTextureCount = resources.reduce((count, resource) => {
    return count + (resource.glb?.images ?? []).filter((image) => image.embedded).length;
  }, 0);
  const transparentMaterialSlots = resources.reduce((count, resource) => {
    return count + (resource.glb?.materialTextureSlots ?? []).filter((slot) => slot.alphaMode === "BLEND" || slot.alphaMode === "MASK").length;
  }, 0);
  const emissiveMaterialSlots = resources.reduce((count, resource) => {
    return count + (resource.glb?.materialTextureSlots ?? []).filter((slot) => slot.semantic === "emissive").length;
  }, 0);
  return {
    resourceCount: resources.length,
    byKind,
    byRole,
    embeddedTextureCount,
    transparentMaterialSlots,
    emissiveMaterialSlots,
  };
}

function withoutFilePath(resource) {
  const { filePath, ...serializable } = resource;
  return serializable;
}

async function findResourceFiles(dirPath) {
  if (!fsSync.existsSync(dirPath)) return [];
  const result = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await findResourceFiles(entryPath)));
    } else if (resourceExtensions.has(path.extname(entry.name).toLowerCase())) {
      result.push(entryPath);
    }
  }
  return result;
}

function inferScannedRole(filePath) {
  const normalized = filePath.replaceAll(path.sep, "/");
  if (normalized.includes("/models-cooked/enemies/")) return "enemy";
  if (normalized.includes("/textures/enemies/") || normalized.includes("/enemy-atlas/")) return "enemy-texture";
  if (normalized.includes("/hero-floors/")) return "museum-hero-floor";
  if (normalized.includes("/textures/environment/level03/")) return "museum-texture";
  if (normalized.includes("/models/environment/level03/")) return "museum-source-model";
  if (normalized.includes("/models-cooked/environment/level03/")) return "museum-cooked-model";
  return "threejs-resource";
}

function planAssetToFilePath(asset) {
  const candidates = [asset.sourceFile, asset.rawFile, asset.file, asset.url].filter(Boolean);
  for (const candidate of candidates) {
    const filePath = viteUrlToFilePath(candidate, gameRoot);
    if (filePath && fsSync.existsSync(filePath)) return filePath;
  }
  return null;
}

function planAssetSourceUrl(asset, filePath) {
  if (asset.url && !String(asset.url).startsWith("/assets/")) return normalizeViteUrl(asset.url);
  return `/${path.relative(gameRoot, filePath).replaceAll(path.sep, "/")}`;
}

function viteUrlToFilePath(url, root) {
  const normalized = normalizeViteUrl(url);
  const noQuery = normalized.split("?")[0];
  if (noQuery.startsWith("/src/")) return path.join(root, noQuery.slice(1));
  if (noQuery.startsWith("src/")) return path.join(root, noQuery);
  if (noQuery.startsWith("/assets/")) return null;
  if (noQuery.startsWith("data:")) return null;
  return path.isAbsolute(noQuery) ? noQuery : path.join(root, noQuery);
}

function normalizeViteUrl(url) {
  return String(url).replaceAll("\\\\", "/");
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function countBy(items, keyFor) {
  const counts = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sha256FileSync(filePath) {
  return crypto.createHash("sha256").update(fsSync.readFileSync(filePath)).digest("hex");
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".glb") return "model/gltf-binary";
  if (ext === ".gltf") return "model/gltf+json";
  if (ext === ".bin") return "application/octet-stream";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function publicUrlForPath(filePath) {
  return `/${path.relative(path.join(gameRoot, "public"), filePath).replaceAll(path.sep, "/")}`;
}

function roundNumber(value) {
  return Math.round(Number(value) * 1000000) / 1000000;
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function readArg(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: gameRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
