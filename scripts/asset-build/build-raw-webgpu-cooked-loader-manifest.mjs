import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Box3, Vector3 } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readArg } from "../lib/cli.mjs";
import { gameRootFromScript, rawWebGpuGeneratedManifestDir, relativeToRoot } from "../lib/paths.mjs";
import { rawWebGpuGeneratedManifestPath } from "../lib/raw-webgpu-manifests.mjs";

const gameRoot = gameRootFromScript(import.meta.url);
const levelId = readArg("--level") ?? "level_03_human_museum";
const manifestDir = rawWebGpuGeneratedManifestDir(gameRoot);
const bridgePath = rawWebGpuGeneratedManifestPath(gameRoot, "threeResourceBridge", levelId);
const renderPlanPath = rawWebGpuGeneratedManifestPath(gameRoot, "renderPlan", levelId);
const outputPath = rawWebGpuGeneratedManifestPath(gameRoot, "cookedGltfLoaderManifest", levelId);

installNodeGltfImageStubs();

const bridge = await readJson(bridgePath);
const renderPlan = await readJson(renderPlanPath);
const rawAssetsByKey = new Map((renderPlan.geometry?.assets ?? []).map((asset) => [asset.modelKey, asset]));
const rawMaterialsByName = new Map();
for (const material of renderPlan.geometry?.materials ?? []) {
  const key = `${material.category ?? "unknown"}:${String(material.name ?? "").trim().toLowerCase()}`;
  if (!rawMaterialsByName.has(key)) rawMaterialsByName.set(key, material);
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const modelResources = bridge.resources
  .filter((resource) => resource.kind === "model" && resource.extension === ".glb")
  .sort((left, right) => String(left.key).localeCompare(String(right.key)));

const models = [];
for (const resource of modelResources) {
  models.push(await inspectModelResource(resource));
}

const summary = summarizeManifest(models);
const manifest = {
  schemaVersion: "hp.raw-webgpu.cooked-gltf-loader-manifest.v1",
  generatedAt: new Date().toISOString(),
  levelId,
  generator: {
    script: "scripts/asset-build/build-raw-webgpu-cooked-loader-manifest.mjs",
    parser: "three/examples/jsm/loaders/GLTFLoader.js",
    meshoptDecoder: "three/examples/jsm/libs/meshopt_decoder.module.js",
    outputPolicy:
      "Cooked GLB is parsed by a proven loader, then summarized into raw engine semantics. The raw renderer still owns GPU upload, batching, shading, and animation sampling.",
  },
  inputs: {
    bridge: relativeToRoot(gameRoot, bridgePath),
    renderPlan: relativeToRoot(gameRoot, renderPlanPath),
    modelResourceCount: modelResources.length,
  },
  summary,
  models,
};

await fs.mkdir(manifestDir, { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[HumanProtocol] Cooked GLB loader manifest wrote ${relativeToRoot(gameRoot, outputPath)}`);
console.log(
  `[HumanProtocol] Parsed ${summary.modelCount} GLBs, ${summary.meshCount} meshes, ${summary.materialCount} materials, ` +
    `${summary.animationClipCount} clips. Preservation gaps=${summary.preservationGaps.length}.`,
);
for (const gap of summary.preservationGaps.slice(0, 12)) {
  console.log(`  - ${gap.kind}: ${gap.count} (${gap.examples.join(", ")})`);
}

async function inspectModelResource(resource) {
  const filePath = path.join(gameRoot, resource.file);
  const glb = readGlbContainerSync(filePath);
  const arrayBuffer = await readFileAsArrayBuffer(filePath);
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, path.dirname(filePath), resolve, reject);
  });
  gltf.scene.updateMatrixWorld(true);

  const meshes = [];
  const materialSet = new Set();
  const textureSet = new Set();
  const nodeGraph = [];
  const bounds = new Box3().setFromObject(gltf.scene);

  gltf.scene.traverse((object) => {
    nodeGraph.push({
      name: object.name || null,
      type: object.type,
      parent: object.parent?.name || null,
      children: object.children.length,
      visible: object.visible,
    });
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
    for (const material of materials) {
      materialSet.add(material);
      for (const texture of materialTextures(material)) textureSet.add(texture);
    }
    meshes.push({
      name: object.name || null,
      materialNames: materials.map((material) => material.name || null),
      geometry: summarizeGeometry(object.geometry),
      bounds: boundsForObject(object),
      castShadow: Boolean(object.castShadow),
      receiveShadow: Boolean(object.receiveShadow),
      userDataKeys: Object.keys(object.userData ?? {}).sort(),
    });
  });

  const materials = [...materialSet].map((material) => summarizeThreeMaterial(material, resource));
  const textures = [...textureSet].map((texture) => summarizeThreeTexture(texture));
  const rawAsset = rawAssetsByKey.get(resource.key) ?? null;
  const jsonMaterials = glb.json?.materials ?? [];
  const jsonTextures = glb.json?.textures ?? [];
  const jsonImages = glb.json?.images ?? [];

  return {
    key: resource.key,
    role: resource.role,
    roles: resource.roles ?? [],
    usage: resource.usages?.map((usage) => usage.usage).sort() ?? [],
    file: resource.file,
    byteLength: resource.byteLength,
    sha256: resource.sha256,
    parseStatus: "ready",
    rawPlan: rawAsset
      ? {
          status: rawAsset.status,
          vertexCount: rawAsset.vertexCount,
          triangleCount: rawAsset.triangleCount,
          meshCount: rawAsset.meshCount,
          materialCount: rawAsset.materialCount,
          nodeChunkCount: rawAsset.nodeChunks?.length ?? 0,
          animationClipCount: rawAsset.animationClips?.length ?? 0,
        }
      : null,
    gltf: {
      sceneCount: glb.json?.scenes?.length ?? 0,
      nodeCount: glb.json?.nodes?.length ?? nodeGraph.length,
      meshCount: glb.json?.meshes?.length ?? meshes.length,
      primitiveCount: primitiveCount(glb.json),
      materialCount: jsonMaterials.length,
      textureCount: jsonTextures.length,
      imageCount: jsonImages.length,
      animationCount: glb.json?.animations?.length ?? 0,
      skinCount: glb.json?.skins?.length ?? 0,
      extensionsUsed: glb.json?.extensionsUsed ?? [],
      extensionsRequired: glb.json?.extensionsRequired ?? [],
    },
    bounds: boxToRecord(bounds),
    sceneGraph: {
      nodeCount: nodeGraph.length,
      namedNodeCount: nodeGraph.filter((node) => node.name).length,
      roots: gltf.scene.children.map((child) => child.name || child.type),
      nodes: nodeGraph.slice(0, 160),
      truncated: nodeGraph.length > 160,
    },
    meshes,
    materials,
    textures,
    animations: summarizeAnimations(gltf.animations, glb.json),
    jsonMaterialSlots: jsonMaterials.map((material, index) => summarizeJsonMaterial(material, index, glb.json)),
    preservation: preservationReport({ resource, rawAsset, materials, textures, animations: gltf.animations, glb }),
  };
}

function summarizeManifest(models) {
  const gaps = new Map();
  let meshCount = 0;
  let materialCount = 0;
  let textureCount = 0;
  let animationClipCount = 0;
  let transparentMaterialCount = 0;
  let emissiveMaterialCount = 0;

  for (const model of models) {
    meshCount += model.meshes.length;
    materialCount += model.materials.length;
    textureCount += model.textures.length;
    animationClipCount += model.animations.length;
    transparentMaterialCount += model.materials.filter((material) => material.transparent).length;
    emissiveMaterialCount += model.materials.filter((material) => material.emissive).length;
    for (const gap of model.preservation.gaps) {
      const current = gaps.get(gap.kind) ?? { kind: gap.kind, count: 0, examples: [] };
      current.count += 1;
      if (current.examples.length < 5) current.examples.push(model.key);
      gaps.set(gap.kind, current);
    }
  }

  return {
    modelCount: models.length,
    meshCount,
    materialCount,
    textureCount,
    animationClipCount,
    transparentMaterialCount,
    emissiveMaterialCount,
    preservationGaps: [...gaps.values()].sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind)),
  };
}

function preservationReport({ resource, rawAsset, materials, textures, animations, glb }) {
  const gaps = [];
  if (!rawAsset) gaps.push({ kind: "not-in-raw-render-plan" });
  if ((animations?.length ?? 0) > 0 && (rawAsset?.animationClips?.length ?? 0) <= 0) gaps.push({ kind: "animation-clips-not-in-raw-geometry" });
  if (materials.some((material) => material.transparent) && !rawAssetHasTransparentRawMaterial(resource)) {
    gaps.push({ kind: "transparent-material-needs-raw-role" });
  }
  if (materials.some((material) => material.emissive) && !rawAssetHasEmissiveRawMaterial(resource)) {
    gaps.push({ kind: "emissive-material-needs-light-extraction" });
  }
  if (textures.length > 0 && (rawAsset?.materialCount ?? 0) > 0 && !glb.json?.images?.length) {
    gaps.push({ kind: "runtime-texture-object-without-json-image" });
  }
  if ((glb.json?.skins?.length ?? 0) > 0) gaps.push({ kind: "skinning-needs-raw-clip-sampler" });
  if ((glb.json?.extensionsUsed ?? []).length > 0) gaps.push({ kind: "gltf-extensions-need-preservation" });
  return { score: Math.max(0, 1 - gaps.length * 0.12), gaps };
}

function rawAssetHasTransparentRawMaterial(resource) {
  return [...rawMaterialsByName.values()].some((material) => material.modelKey === resource.key && material.visualRole === "glass_shell");
}

function rawAssetHasEmissiveRawMaterial(resource) {
  return [...rawMaterialsByName.values()].some((material) => material.modelKey === resource.key && material.emissiveFactor?.some?.((value) => value > 0));
}

function summarizeThreeMaterial(material, resource) {
  const color = material.color ? [material.color.r, material.color.g, material.color.b].map(round) : null;
  const emissiveColor = material.emissive ? [material.emissive.r, material.emissive.g, material.emissive.b].map(round) : null;
  const emissiveStrength = Math.max(...(emissiveColor ?? [0]));
  return {
    name: material.name || null,
    type: material.type,
    category: resource.role,
    transparent: Boolean(material.transparent || material.opacity < 0.999 || material.alphaTest > 0),
    opacity: round(material.opacity ?? 1),
    alphaTest: round(material.alphaTest ?? 0),
    side: material.side,
    color,
    emissive: emissiveStrength > 0.001 || Boolean(material.emissiveMap),
    emissiveColor,
    emissiveIntensity: round(material.emissiveIntensity ?? 1),
    roughness: round(material.roughness ?? 0),
    metalness: round(material.metalness ?? 0),
    textureSlots: materialTextures(material).map((texture) => texture.name || texture.uuid),
    userDataKeys: Object.keys(material.userData ?? {}).sort(),
  };
}

function summarizeThreeTexture(texture) {
  return {
    name: texture.name || null,
    uuid: texture.uuid,
    sourceUuid: texture.source?.uuid ?? null,
    imageWidth: texture.image?.width ?? null,
    imageHeight: texture.image?.height ?? null,
    colorSpace: texture.colorSpace ?? null,
    flipY: texture.flipY,
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
    magFilter: texture.magFilter,
    minFilter: texture.minFilter,
  };
}

function summarizeJsonMaterial(material, index, json) {
  const pbr = material.pbrMetallicRoughness ?? {};
  return {
    index,
    name: material.name ?? null,
    alphaMode: material.alphaMode ?? "OPAQUE",
    alphaCutoff: material.alphaCutoff ?? null,
    doubleSided: Boolean(material.doubleSided),
    baseColorFactor: pbr.baseColorFactor ?? null,
    metallicFactor: pbr.metallicFactor ?? null,
    roughnessFactor: pbr.roughnessFactor ?? null,
    emissiveFactor: material.emissiveFactor ?? null,
    textures: {
      baseColor: textureRef(pbr.baseColorTexture, json),
      metallicRoughness: textureRef(pbr.metallicRoughnessTexture, json),
      normal: textureRef(material.normalTexture, json),
      occlusion: textureRef(material.occlusionTexture, json),
      emissive: textureRef(material.emissiveTexture, json),
    },
    extensions: Object.keys(material.extensions ?? {}).sort(),
    extrasKeys: Object.keys(material.extras ?? {}).sort(),
  };
}

function textureRef(textureInfo, json) {
  if (!Number.isInteger(textureInfo?.index)) return null;
  const texture = json.textures?.[textureInfo.index];
  const source = Number.isInteger(texture?.source) ? texture.source : null;
  return {
    index: textureInfo.index,
    texCoord: textureInfo.texCoord ?? 0,
    name: texture?.name ?? null,
    source,
    imageName: source !== null ? (json.images?.[source]?.name ?? null) : null,
    imageUri: source !== null ? (json.images?.[source]?.uri ?? null) : null,
  };
}

function summarizeGeometry(geometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  return {
    vertexCount: position?.count ?? 0,
    indexCount: index?.count ?? null,
    triangleCount: index?.count ? Math.floor(index.count / 3) : Math.floor((position?.count ?? 0) / 3),
    attributes: Object.keys(geometry.attributes ?? {}).sort(),
    hasMorphTargets: Object.keys(geometry.morphAttributes ?? {}).length > 0,
    groupCount: geometry.groups?.length ?? 0,
  };
}

function summarizeAnimations(animations, json) {
  return (animations ?? []).map((clip, index) => ({
    index,
    name: clip.name || `clip_${index}`,
    durationSeconds: round(clip.duration),
    trackCount: clip.tracks.length,
    targetHints: clip.tracks.slice(0, 32).map((track) => track.name),
    targetPaths: [...new Set(clip.tracks.map((track) => track.name.split(".").at(-1) ?? "unknown"))].sort(),
    jsonChannelCount: json?.animations?.[index]?.channels?.length ?? null,
    jsonSamplerCount: json?.animations?.[index]?.samplers?.length ?? null,
  }));
}

function materialTextures(material) {
  return [
    material.map,
    material.normalMap,
    material.roughnessMap,
    material.metalnessMap,
    material.aoMap,
    material.emissiveMap,
    material.alphaMap,
    material.specularMap,
  ].filter(Boolean);
}

function boundsForObject(object) {
  return boxToRecord(new Box3().setFromObject(object));
}

function boxToRecord(box) {
  if (box.isEmpty()) return null;
  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  return {
    min: [box.min.x, box.min.y, box.min.z].map(round),
    max: [box.max.x, box.max.y, box.max.z].map(round),
    center: [center.x, center.y, center.z].map(round),
    size: [size.x, size.y, size.z].map(round),
  };
}

function primitiveCount(json) {
  return (json?.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives?.length ?? 0), 0);
}

function readGlbContainerSync(filePath) {
  const buffer = fsSync.readFileSync(filePath);
  let offset = 12;
  let json = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) json = JSON.parse(buffer.subarray(offset, offset + length).toString("utf8"));
    offset += length;
  }
  return { json };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readFileAsArrayBuffer(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function installNodeGltfImageStubs() {
  if (!globalThis.self) globalThis.self = globalThis;
  if (!globalThis.ProgressEvent) {
    globalThis.ProgressEvent = class {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
    };
  }
  if (!globalThis.Image) {
    globalThis.Image = class {
      width = 1;
      height = 1;
      set src(_value) {
        queueMicrotask(() => this.onload?.());
      }
    };
  }
  if (!globalThis.createImageBitmap) {
    globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
  }
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(5)) : 0;
}
