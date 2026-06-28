import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Color, Matrix3, Matrix4, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { normalizeAnimationAction, readGlbMetadataSync } from "./raw-webgpu-glb-metadata.mjs";
import { createAssetRecord } from "./raw-webgpu-plan-assets.mjs";
import { clampNumber, hashString, roundNumber, roundTuple, slugify } from "./raw-webgpu-plan-utils.mjs";
import { shouldHideRawCompiledGeometryNode } from "./raw-webgpu-render-plan-rules.mjs";

const rawVertexStrideFloats = 10;
let rawBaseColorTextureSize = 512;
const rawBaseColorTextureCookerPromise = import("sharp")
  .then((module) => module.default ?? module)
  .catch(() => null);

const rawBuiltInMaterials = [
  {
    index: 0,
    id: "builtin:default-proxy",
    name: "default_proxy",
    category: "builtin",
    baseColorFactor: [1, 1, 1, 1],
    emissiveFactor: [0, 0, 0],
    emissiveStrength: 0,
    roughnessFactor: 0.72,
    metallicFactor: 0,
    aoStrength: 1,
    materialKind: 0,
    visualRole: "default",
    semanticParams: [0.35, 0.08, 0.18, 0],
    paletteColorFactor: [0, 0, 0, 0],
    alphaMode: "OPAQUE",
    doubleSided: true,
    textures: [],
  },
  {
    index: 1,
    id: "builtin:contact-shadow",
    name: "contact_shadow",
    category: "builtin",
    baseColorFactor: [0.006, 0.012, 0.014, 1],
    emissiveFactor: [0, 0, 0],
    emissiveStrength: 0,
    roughnessFactor: 1,
    metallicFactor: 0,
    aoStrength: 1,
    materialKind: -1,
    visualRole: "structural_dark",
    semanticParams: [1, 0, 0.6, 0],
    paletteColorFactor: [0.03, 0.05, 0.052, 0.48],
    alphaMode: "BLEND",
    doubleSided: true,
    textures: [],
  },
];

export function createGeometryAssetTable({ assetTable, enemyModelAssets, gameRoot }) {
  const geometryAssetTable = new Map(assetTable);
  for (const asset of Object.values(enemyModelAssets)) {
    const record = createAssetRecord(
      {
        modelKey: asset.modelKey,
        category: "enemy",
        url: asset.url,
        sizeMeters: [1, asset.warmupTargetHeight, 1],
      },
      gameRoot,
    );
    geometryAssetTable.set(record.modelKey, record);
  }
  return geometryAssetTable;
}

export async function compileRawGeometryAssets({
  assetTable,
  gameRoot,
  levelId = "",
  outputPath,
  outputFileName,
  textureOutputDir,
  texturePublicBase,
  textureSize,
  rolePaletteTuning,
  materialPipeline,
}) {
  rawBaseColorTextureSize = textureSize;
  installNodeGltfImageStubs();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await fs.rm(textureOutputDir, { recursive: true, force: true });
  await fs.mkdir(textureOutputDir, { recursive: true });

  const chunks = [];
  const geometryAssets = [];
  const materialRegistry = createRawMaterialRegistry({ levelId, rolePaletteTuning, materialPipeline });
  let totalFloats = 0;
  let totalVertices = 0;
  let totalTriangles = 0;

  const sortedAssets = [...assetTable.values()].sort((a, b) => a.modelKey.localeCompare(b.modelKey));
  for (const asset of sortedAssets) {
    const source = resolveRawAssetSource(asset, gameRoot);
    if (!source) {
      geometryAssets.push({
        modelKey: asset.modelKey,
        sourceFile: asset.file,
        rawFile: null,
        vertexOffset: totalVertices,
        vertexCount: 0,
        triangleCount: 0,
        meshCount: 0,
        materialCount: 0,
        status: "missing",
      });
      continue;
    }

    const sourceMetadata = readGlbMetadataSync(source.filePath);
    const materialTextureLookup = await collectGlbMaterialTextureSources({
      filePath: source.filePath,
      gameRoot,
      modelKey: asset.modelKey,
      outputDir: textureOutputDir,
      publicBase: texturePublicBase,
    });
    const flattened = await flattenGlbGeometry({
      filePath: source.filePath,
      loader,
      category: asset.category,
      fallbackColor: fallbackColorForCategory(asset.category),
      materialRegistry,
      materialTextureLookup,
    });
    chunks.push(flattened.vertices);
    geometryAssets.push({
      modelKey: asset.modelKey,
      sourceFile: asset.file,
      rawFile: path.relative(gameRoot, source.filePath),
      rawSource: source.kind,
      vertexOffset: totalVertices,
      vertexCount: flattened.vertexCount,
      triangleCount: flattened.triangleCount,
      meshCount: flattened.meshCount,
      materialCount: flattened.materialCount,
      nodeCount: sourceMetadata.readable ? sourceMetadata.nodes : 0,
      skinCount: sourceMetadata.readable ? sourceMetadata.skins : 0,
      rigidSkin: flattened.rigidSkin,
      animationClips: sourceMetadata.readable ? sourceMetadata.animations : [],
      nodeChunks: flattened.nodeChunks.map((chunk) => ({
        ...chunk,
        vertexOffset: totalVertices + chunk.vertexOffset,
      })),
      bounds: flattened.bounds,
      status: flattened.vertexCount > 0 ? "ready" : "empty",
    });
    totalFloats += flattened.vertices.length;
    totalVertices += flattened.vertexCount;
    totalTriangles += flattened.triangleCount;
  }

  const vertices = new Float32Array(totalFloats);
  let offset = 0;
  for (const chunk of chunks) {
    vertices.set(chunk, offset);
    offset += chunk.length;
  }
  await fs.writeFile(outputPath, Buffer.from(vertices.buffer, vertices.byteOffset, vertices.byteLength));

  return {
    schemaVersion: "hp.raw-webgpu.geometry.v4",
    binaryFile: outputFileName,
    binaryByteLength: vertices.byteLength,
    vertexFormat: "position3_normal3_uv2_materialIndex1_rigidJointIndex1_float32",
    vertexStrideFloats: rawVertexStrideFloats,
    vertexCount: totalVertices,
    triangleCount: totalTriangles,
    assetCount: geometryAssets.length,
    readyAssetCount: geometryAssets.filter((asset) => asset.status === "ready").length,
    materials: materialRegistry.materials,
    baseColorTextureSize: textureSize,
    baseColorTextures: materialRegistry.baseColorTextures,
    materialTextureSize: textureSize,
    materialTextures: materialRegistry.materialTextures,
    baseColorTextureStats: rawBaseColorTextureStats(materialRegistry.materials, materialRegistry.baseColorTextures),
    animationSummary: summarizeRawGeometryAnimations(geometryAssets),
    assets: geometryAssets,
  };
}

function summarizeRawGeometryAnimations(geometryAssets) {
  const animatedAssets = geometryAssets.filter((asset) => (asset.animationClips?.length ?? 0) > 0);
  const clipNames = new Set();
  const actions = new Set();
  let clipCount = 0;
  let animatedChannelCount = 0;
  for (const asset of animatedAssets) {
    for (const clip of asset.animationClips ?? []) {
      clipCount += 1;
      animatedChannelCount += clip.channelCount ?? 0;
      clipNames.add(clip.name);
      actions.add(clip.action ?? normalizeAnimationAction(clip.name));
    }
  }
  return {
    animatedAssetCount: animatedAssets.length,
    clipCount,
    animatedChannelCount,
    uniqueClipNames: [...clipNames].sort(),
    uniqueActions: [...actions].sort(),
    animatedAssets: animatedAssets.map((asset) => ({
      modelKey: asset.modelKey,
      sourceFile: asset.sourceFile,
      nodeCount: asset.nodeCount,
      skinCount: asset.skinCount,
      clipCount: asset.animationClips.length,
      clips: asset.animationClips.map((clip) => ({
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

async function flattenGlbGeometry({ filePath, loader, category, fallbackColor, materialRegistry, materialTextureLookup }) {
  const nodeIndexResolver = category === "enemy" ? await createGlbNodeIndexResolver(filePath) : null;
  const arrayBuffer = await readFileAsArrayBuffer(filePath);
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });
  const vertices = [];
  const position = new Vector3();
  const normal = new Vector3();
  const tangent = new Vector3();
  const faceA = new Vector3();
  const faceB = new Vector3();
  const faceC = new Vector3();
  const faceNormal = new Vector3();
  const normalMatrix = new Matrix3();
  const inverseBindMatrix = new Matrix4();
  const materialNames = new Set();
  const materialIndices = new Set();
  const nodeChunks = [];
  let meshCount = 0;

  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    if (shouldHideRawCompiledGeometryNode({ category, filePath, nodeName: object.name })) return;
    meshCount += 1;
    object.updateMatrixWorld(true);
    normalMatrix.getNormalMatrix(object.matrixWorld);
    const chunkVertexOffset = vertices.length / rawVertexStrideFloats;
    const geometry = object.geometry;
    const nodeIndex = nodeIndexResolver ? nodeIndexResolver.nodeIndexForObject(gltf, object) : null;
    const rigidJointIndex = Number.isInteger(nodeIndex) ? nodeIndex : -1;
    const positionAttr = geometry.getAttribute("position");
    if (!positionAttr) return;
    const normalAttr = geometry.getAttribute("normal");
    const tangentAttr = geometry.getAttribute("tangent");
    const uvAttr = geometry.getAttribute("uv");
    const indexAttr = geometry.index;
    const indexCount = indexAttr?.count ?? positionAttr.count;
    const groups = geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count: indexCount, materialIndex: 0 }];
    const materials = Array.isArray(object.material) ? object.material : [object.material];

    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0] ?? materials[0];
      if (material?.name) materialNames.add(material.name);
      const materialIndex = materialRegistry.indexFor(material, fallbackColor, category, materialTextureLookup);
      materialIndices.add(materialIndex);
      const start = Math.max(0, group.start);
      const end = Math.min(indexCount, start + group.count);
      for (let cursor = start; cursor + 2 < end; cursor += 3) {
        const ia = indexAttr ? indexAttr.getX(cursor) : cursor;
        const ib = indexAttr ? indexAttr.getX(cursor + 1) : cursor + 1;
        const ic = indexAttr ? indexAttr.getX(cursor + 2) : cursor + 2;
        faceA.fromBufferAttribute(positionAttr, ia).applyMatrix4(object.matrixWorld);
        faceB.fromBufferAttribute(positionAttr, ib).applyMatrix4(object.matrixWorld);
        faceC.fromBufferAttribute(positionAttr, ic).applyMatrix4(object.matrixWorld);
        faceNormal.subVectors(faceB, faceA).cross(faceC.clone().sub(faceA)).normalize();
        pushVertex(vertices, position, normal, tangent, positionAttr, normalAttr, tangentAttr, uvAttr, normalMatrix, ia, faceNormal, materialIndex, object.matrixWorld, rigidJointIndex);
        pushVertex(vertices, position, normal, tangent, positionAttr, normalAttr, tangentAttr, uvAttr, normalMatrix, ib, faceNormal, materialIndex, object.matrixWorld, rigidJointIndex);
        pushVertex(vertices, position, normal, tangent, positionAttr, normalAttr, tangentAttr, uvAttr, normalMatrix, ic, faceNormal, materialIndex, object.matrixWorld, rigidJointIndex);
      }
    }
    const chunkVertexCount = vertices.length / rawVertexStrideFloats - chunkVertexOffset;
    if (chunkVertexCount > 0) {
      inverseBindMatrix.copy(object.matrixWorld).invert();
      nodeChunks.push({
        nodeIndex,
        nodeName: object.name || null,
        vertexOffset: chunkVertexOffset,
        vertexCount: chunkVertexCount,
        bindMatrix: roundMatrixElements(object.matrixWorld.elements),
        inverseBindMatrix: roundMatrixElements(inverseBindMatrix.elements),
      });
    }
  });

  const vertexCount = vertices.length / rawVertexStrideFloats;
  const referencedJoints = new Set(nodeChunks.map((chunk) => chunk.nodeIndex).filter((nodeIndex) => Number.isInteger(nodeIndex)));
  return {
    vertices: new Float32Array(vertices),
    vertexCount,
    triangleCount: vertexCount / 3,
    meshCount,
    materialCount: Math.max(materialNames.size, materialIndices.size),
    nodeChunks,
    rigidSkin: nodeIndexResolver && referencedJoints.size > 0
      ? {
          mode: "rigid-node-palette",
          jointCount: Math.max(0, ...nodeChunks.map((chunk) => (Number.isInteger(chunk.nodeIndex) ? chunk.nodeIndex + 1 : 0))),
          referencedJointCount: referencedJoints.size,
          chunkCount: nodeChunks.length,
          vertexAttribute: "rigidJointIndex",
        }
      : null,
    bounds: computeFlatBounds(vertices),
  };
}

async function createGlbNodeIndexResolver(filePath) {
  const container = await readGlbContainer(filePath);
  const nodes = container?.json?.nodes ?? [];
  const nodesByMesh = createGlbNodeWorldIndex(container?.json);
  const indexesByName = new Map();
  for (const [nodeIndex, node] of nodes.entries()) {
    const name = String(node.name ?? "").trim();
    if (!name) continue;
    for (const alias of glbNodeNameAliases(name)) {
      const indexes = indexesByName.get(alias) ?? [];
      indexes.push(nodeIndex);
      indexesByName.set(alias, indexes);
    }
  }
  const consumedByName = new Map();
  return {
    nodeIndexForObject(gltf, object) {
      const association = gltf?.parser?.associations?.get?.(object);
      const matrixMatchedNodeIndex = nodeIndexForMeshWorldMatrix(nodesByMesh, association?.meshes, object?.matrixWorld);
      if (Number.isInteger(matrixMatchedNodeIndex)) return matrixMatchedNodeIndex;
      if (Number.isInteger(association?.nodes)) return association.nodes;
      return this.nodeIndexFor(object?.name);
    },
    nodeIndexFor(name) {
      const key = String(name ?? "").trim();
      if (!key) return null;
      const indexes = glbNodeNameAliases(key)
        .map((alias) => indexesByName.get(alias))
        .find((candidate) => candidate && candidate.length > 0);
      if (!indexes || indexes.length <= 0) return null;
      const consumed = consumedByName.get(key) ?? 0;
      consumedByName.set(key, consumed + 1);
      return indexes[Math.min(consumed, indexes.length - 1)] ?? null;
    },
  };
}

function createGlbNodeWorldIndex(json) {
  const nodes = json?.nodes ?? [];
  const localMatrices = nodes.map((node) => glbNodeLocalMatrix(node));
  const worldMatrices = nodes.map(() => new Matrix4());
  const visited = new Uint8Array(nodes.length);
  const visiting = new Uint8Array(nodes.length);
  const parents = new Map();
  for (const [parentIndex, node] of nodes.entries()) {
    for (const childIndex of node.children ?? []) {
      if (Number.isInteger(childIndex)) parents.set(childIndex, parentIndex);
    }
  }

  const composeWorld = (nodeIndex) => {
    if (visited[nodeIndex]) return;
    if (visiting[nodeIndex]) return;
    visiting[nodeIndex] = 1;
    const parentIndex = parents.get(nodeIndex);
    if (Number.isInteger(parentIndex) && parentIndex >= 0 && parentIndex < nodes.length) {
      composeWorld(parentIndex);
      worldMatrices[nodeIndex].multiplyMatrices(worldMatrices[parentIndex], localMatrices[nodeIndex]);
    } else {
      worldMatrices[nodeIndex].copy(localMatrices[nodeIndex]);
    }
    visiting[nodeIndex] = 0;
    visited[nodeIndex] = 1;
  };

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) composeWorld(nodeIndex);

  const nodesByMesh = new Map();
  for (const [nodeIndex, node] of nodes.entries()) {
    if (!Number.isInteger(node.mesh)) continue;
    const entries = nodesByMesh.get(node.mesh) ?? [];
    entries.push({ nodeIndex, matrix: worldMatrices[nodeIndex] });
    nodesByMesh.set(node.mesh, entries);
  }
  return nodesByMesh;
}

function glbNodeLocalMatrix(node) {
  const matrix = new Matrix4();
  if (node?.matrix?.length === 16) {
    matrix.fromArray(node.matrix);
    return matrix;
  }
  const translation = new Vector3(...(node?.translation ?? [0, 0, 0]));
  const rotation = new Quaternion(...(node?.rotation ?? [0, 0, 0, 1])).normalize();
  const scale = new Vector3(...(node?.scale ?? [1, 1, 1]));
  matrix.compose(translation, rotation, scale);
  return matrix;
}

function nodeIndexForMeshWorldMatrix(nodesByMesh, meshIndex, matrixWorld) {
  if (!Number.isInteger(meshIndex) || !matrixWorld) return null;
  const candidates = nodesByMesh.get(meshIndex);
  if (!candidates?.length) return null;
  if (candidates.length === 1) return candidates[0].nodeIndex;

  let best = null;
  for (const candidate of candidates) {
    const score = matrixMaxAbsDifference(candidate.matrix.elements, matrixWorld.elements);
    if (!best || score < best.score) best = { nodeIndex: candidate.nodeIndex, score };
  }
  return best && best.score <= 0.0001 ? best.nodeIndex : null;
}

function matrixMaxAbsDifference(a, b) {
  let max = 0;
  for (let index = 0; index < 16; index += 1) {
    max = Math.max(max, Math.abs((a[index] ?? 0) - (b[index] ?? 0)));
  }
  return max;
}

function glbNodeNameAliases(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return [];
  return [
    trimmed,
    trimmed.replace(/\./g, ""),
    trimmed.replace(/[^\w]/g, ""),
    trimmed.replace(/[^\w]/g, "_"),
  ].filter((alias, index, aliases) => alias && aliases.indexOf(alias) === index);
}

function roundMatrixElements(elements) {
  return Array.from(elements, (value) => roundNumber(value));
}

function computeFlatBounds(vertices) {
  if (vertices.length === 0) {
    return { min: [0, 0, 0], center: [0, 0, 0], size: [0, 0, 0] };
  }
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < vertices.length; index += rawVertexStrideFloats) {
    const x = vertices[index];
    const y = vertices[index + 1];
    const z = vertices[index + 2];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  return {
    min: roundTuple([minX, minY, minZ]),
    center: roundTuple([(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5]),
    size: roundTuple([maxX - minX, maxY - minY, maxZ - minZ]),
  };
}

function pushVertex(vertices, position, normal, tangent, positionAttr, normalAttr, tangentAttr, uvAttr, normalMatrix, index, faceNormal, materialIndex, matrixWorld, rigidJointIndex = -1) {
  position.fromBufferAttribute(positionAttr, index).applyMatrix4(matrixWorld);
  if (normalAttr) {
    normal.fromBufferAttribute(normalAttr, index).applyMatrix3(normalMatrix).normalize();
  } else {
    normal.copy(faceNormal);
  }
  let tangentW = 1;
  if (tangentAttr) {
    tangent.fromBufferAttribute(tangentAttr, index).applyMatrix3(normalMatrix).normalize();
    tangentW = tangentAttr.itemSize > 3 ? Math.sign(tangentAttr.getW(index) || 1) : 1;
  } else {
    fallbackTangentForNormal(tangent, normal);
  }
  const uvX = uvAttr ? uvAttr.getX(index) : 0;
  const uvY = uvAttr ? uvAttr.getY(index) : 0;
  vertices.push(
    position.x,
    position.y,
    position.z,
    normal.x,
    normal.y,
    normal.z,
    uvX,
    uvY,
    materialIndex,
    rigidJointIndex,
  );
}

function fallbackTangentForNormal(tangent, normal) {
  if (Math.abs(normal.y) < 0.92) {
    tangent.set(0, 1, 0);
  } else {
    tangent.set(1, 0, 0);
  }
  tangent.cross(normal).normalize();
  if (tangent.lengthSq() < 0.000001) {
    tangent.set(1, 0, 0);
  }
}

async function collectGlbMaterialTextureSources({ filePath, gameRoot, modelKey, outputDir, publicBase }) {
  const container = await readGlbContainer(filePath);
  const lookup = new Map();
  if (!container?.json) return lookup;

  const json = container.json;
  const usedImageIndices = new Set();
  for (const material of json.materials ?? []) {
    for (const textureIndex of glbMaterialTextureIndices(material)) {
      const texture = Number.isInteger(textureIndex) ? json.textures?.[textureIndex] : null;
      const imageIndex = textureSourceImageIndex(texture, textureIndex, json);
      if (Number.isInteger(imageIndex)) usedImageIndices.add(imageIndex);
    }
  }

  for (const imageIndex of usedImageIndices) {
    const image = json.images?.[imageIndex];
    if (!image) continue;
    const exported = await exportGlbImageTexture({
      container,
      filePath,
      gameRoot,
      image,
      imageIndex,
      modelKey,
      outputDir,
      publicBase,
    });
    if (!exported) continue;

    const aliases = new Set([
      image.name,
      `image:${imageIndex}`,
      `${modelKey}:${imageIndex}`,
      ...textureAliasesForImage(json, imageIndex),
    ]);
    for (const alias of aliases) {
      const key = String(alias ?? "").trim();
      if (key) lookup.set(key, exported);
    }
  }

  for (let materialIndex = 0; materialIndex < (json.materials?.length ?? 0); materialIndex += 1) {
    const material = json.materials[materialIndex];
    const materialName = String(material?.name ?? `material_${materialIndex}`).trim();
    if (!materialName) continue;
    for (const [semantic, textureIndex] of glbMaterialTextureSemanticEntries(material)) {
      const texture = Number.isInteger(textureIndex) ? json.textures?.[textureIndex] : null;
      const imageIndex = textureSourceImageIndex(texture, textureIndex, json);
      const exported = Number.isInteger(imageIndex) ? lookup.get(`${modelKey}:${imageIndex}`) ?? lookup.get(`image:${imageIndex}`) : null;
      if (!exported) continue;
      for (const alias of materialTextureFallbackAliases(materialName, semantic, materialIndex)) {
        if (!lookup.has(alias)) lookup.set(alias, exported);
      }
    }
  }

  return lookup;
}

function glbMaterialTextureIndices(material) {
  return glbMaterialTextureSemanticEntries(material).map(([, textureIndex]) => textureIndex).filter(Number.isInteger);
}

function glbMaterialTextureSemanticEntries(material) {
  return [
    ["baseColor", material?.pbrMetallicRoughness?.baseColorTexture?.index],
    ["normal", material?.normalTexture?.index],
    ["metallicRoughness", material?.pbrMetallicRoughness?.metallicRoughnessTexture?.index],
    ["ao", material?.occlusionTexture?.index],
    ["emissive", material?.emissiveTexture?.index],
  ].filter(([, textureIndex]) => Number.isInteger(textureIndex));
}

function materialTextureFallbackAliases(materialName, semantic, materialIndex) {
  const exact = String(materialName ?? "").trim();
  const lower = exact.toLowerCase();
  const aliases = [
    `material:${exact}:${semantic}`,
    `material:${lower}:${semantic}`,
  ];
  if (Number.isInteger(materialIndex)) aliases.push(`material:${materialIndex}:${semantic}`);
  return aliases;
}

async function readGlbContainer(filePath) {
  const buffer = await fs.readFile(filePath);
  if (buffer.readUInt32LE(0) !== 0x46546c67) return null;
  let offset = 12;
  let json = null;
  let binChunk = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    if (type === 0x4e4f534a) {
      json = JSON.parse(chunk.toString("utf8"));
    } else if (type === 0x004e4942) {
      binChunk = chunk;
    }
    offset += length;
  }
  return json ? { json, binChunk } : null;
}

function textureSourceImageIndex(texture, textureIndex, json) {
  if (Number.isInteger(texture?.source)) return texture.source;
  const webpSource = texture?.extensions?.EXT_texture_webp?.source;
  if (Number.isInteger(webpSource)) return webpSource;
  const basisSource = texture?.extensions?.KHR_texture_basisu?.source;
  if (Number.isInteger(basisSource)) return basisSource;
  return Number.isInteger(textureIndex) && json.images?.[textureIndex] ? textureIndex : null;
}

function textureAliasesForImage(json, imageIndex) {
  const aliases = [];
  for (let textureIndex = 0; textureIndex < (json.textures?.length ?? 0); textureIndex += 1) {
    const texture = json.textures[textureIndex];
    if (textureSourceImageIndex(texture, textureIndex, json) !== imageIndex) continue;
    aliases.push(texture.name, `texture:${textureIndex}`);
  }
  return aliases;
}

async function exportGlbImageTexture({ container, filePath, gameRoot, image, imageIndex, modelKey, outputDir, publicBase }) {
  const imageBytes = await glbImageBytes({ container, filePath, image });
  if (!imageBytes || imageBytes.length <= 0) return null;
  const mimeType = image.mimeType || mimeTypeForImageUri(image.uri) || "application/octet-stream";
  const cooked = await cookRawBaseColorTexture(imageBytes, mimeType, image.uri);
  const imageName = String(image.name ?? `raw_material_${imageIndex}`).trim() || `raw_material_${imageIndex}`;
  // Content-addressed filename: identical baked bytes -> identical name -> deduped to a
  // single texture-array layer across ALL props/models. This is what keeps a shared
  // material library (reused by 100+ props) from exploding the 256-layer GPU limit.
  const signature = hashString(`${cooked.mimeType}:${rawBaseColorTextureSize}:${cooked.bytes.length}:${cooked.bytes.toString("base64")}`);
  const fileName = `tex-${signature}.${cooked.extension}`;
  const outputPath = path.join(outputDir, fileName);
  await fs.writeFile(outputPath, cooked.bytes);
  return {
    url: `${publicBase}/${fileName}`,
    name: imageName,
    sourceFile: path.relative(gameRoot, outputPath),
    mimeType: cooked.mimeType,
    stats: cooked.stats ?? rawTextureStatsFallback(),
  };
}

async function cookRawBaseColorTexture(imageBytes, mimeType, uri) {
  const sharp = await rawBaseColorTextureCookerPromise;
  if (sharp) {
    try {
      const source = sharp(imageBytes, { animated: false });
      const [bytes, stats] = await Promise.all([
        source.clone().resize(rawBaseColorTextureSize, rawBaseColorTextureSize, { fit: "fill" }).webp({ quality: 82, effort: 4 }).toBuffer(),
        textureStatsForSharpImage(source.clone()),
      ]);
      return { bytes, extension: "webp", mimeType: "image/webp", stats };
    } catch {
      // Fall through to the source bytes; unsupported embedded formats should not block plan compilation.
    }
  }
  return {
    bytes: imageBytes,
    extension: imageExtensionForMimeType(mimeType, uri),
    mimeType,
    stats: rawTextureStatsFallback(),
  };
}

async function textureStatsForSharpImage(image) {
  try {
    const { data, info } = await image.resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return rawTextureStatsFromPixels(data, info.width, info.height, info.channels);
  } catch {
    return rawTextureStatsFallback();
  }
}

function rawTextureStatsFromPixels(data, width, height, channels) {
  const pixelCount = width * height;
  if (pixelCount <= 0 || channels <= 0) return rawTextureStatsFallback();

  const lumaValues = new Float32Array(pixelCount);
  let lumaSum = 0;
  let lumaSqSum = 0;
  let chromaSum = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * channels;
    const r = (data[offset] ?? 0) / 255;
    const g = (data[offset + Math.min(1, channels - 1)] ?? data[offset] ?? 0) / 255;
    const b = (data[offset + Math.min(2, channels - 1)] ?? data[offset] ?? 0) / 255;
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    lumaValues[index] = luma;
    lumaSum += luma;
    lumaSqSum += luma * luma;
    chromaSum += Math.max(r, g, b) - Math.min(r, g, b);
  }

  let detailSum = 0;
  let detailSamples = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width) {
        detailSum += Math.abs(lumaValues[index] - lumaValues[index + 1]);
        detailSamples += 1;
      }
      if (y + 1 < height) {
        detailSum += Math.abs(lumaValues[index] - lumaValues[index + width]);
        detailSamples += 1;
      }
    }
  }

  const mean = lumaSum / pixelCount;
  const variance = Math.max(0, lumaSqSum / pixelCount - mean * mean);
  const contrast = Math.sqrt(variance);
  const chroma = chromaSum / pixelCount;
  const detail = detailSamples > 0 ? detailSum / detailSamples : 0;
  return {
    lumaMean: roundNumber(clampNumber(mean, 0, 1)),
    contrast: roundNumber(clampNumber(contrast * 1.65, 0, 1)),
    chroma: roundNumber(clampNumber(chroma * 1.55, 0, 1)),
    detail: roundNumber(clampNumber(detail * 3.4, 0, 1)),
  };
}

function rawTextureStatsFallback() {
  return { lumaMean: 0.55, contrast: 0, chroma: 0, detail: 0 };
}

async function glbImageBytes({ container, filePath, image }) {
  if (typeof image.uri === "string" && image.uri.startsWith("data:")) {
    const match = image.uri.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (!match) return null;
    return Buffer.from(decodeURIComponent(match[2]), match[0].includes(";base64,") ? "base64" : "utf8");
  }
  if (typeof image.uri === "string" && image.uri.length > 0) {
    return fs.readFile(path.resolve(path.dirname(filePath), image.uri));
  }
  if (!Number.isInteger(image.bufferView) || !container.binChunk) return null;
  const bufferView = container.json.bufferViews?.[image.bufferView];
  if (!bufferView) return null;
  const start = bufferView.byteOffset ?? 0;
  const end = start + (bufferView.byteLength ?? 0);
  return Buffer.from(container.binChunk.subarray(start, end));
}

function mimeTypeForImageUri(uri) {
  if (!uri) return null;
  const extension = path.extname(String(uri).split("?")[0]).toLowerCase();
  if (extension === ".webp") return "image/webp";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return null;
}

function imageExtensionForMimeType(mimeType, uri) {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  const uriExtension = path.extname(String(uri ?? "")).replace(/^\./, "").toLowerCase();
  return uriExtension || "bin";
}

function rawBaseColorTextureStats(materials, baseColorTextures) {
  const materialCount = materials.filter((material) => material.category !== "builtin").length;
  const texturedMaterialCount = materials.filter((material) => material.textures?.some((texture) => texture.semantic === "baseColor" && Number.isFinite(texture.layer))).length;
  const textureStats = baseColorTextures.map((texture) => texture.stats).filter(Boolean);
  return {
    layerCount: baseColorTextures.length,
    materialCount,
    texturedMaterialCount,
    texturedMaterialRatio: materialCount > 0 ? roundNumber(texturedMaterialCount / materialCount) : 0,
    averageLuma: averageRawTextureStat(textureStats, "lumaMean"),
    averageContrast: averageRawTextureStat(textureStats, "contrast"),
    averageChroma: averageRawTextureStat(textureStats, "chroma"),
    averageDetail: averageRawTextureStat(textureStats, "detail"),
  };
}

function averageRawTextureStat(textureStats, key) {
  if (textureStats.length <= 0) return 0;
  return roundNumber(textureStats.reduce((sum, stats) => sum + (Number(stats?.[key]) || 0), 0) / textureStats.length);
}

function createRawMaterialRegistry({ levelId, rolePaletteTuning, materialPipeline } = {}) {
  const materials = rawBuiltInMaterials.map((material) => ({ ...material, textures: [...material.textures] }));
  const signatureToIndex = new Map(materials.map((material) => [rawMaterialSignature(material), material.index]));
  const baseColorTextures = [];
  const baseColorLayerByUrl = new Map();
  const materialTextures = [];
  const materialLayerByKey = new Map();

  return {
    materials,
    materialTextures,
    baseColorTextures,
    indexFor(material, fallbackColor, category, materialTextureLookup) {
      const record = createRawMaterialRecord(
        material,
        fallbackColor,
        category,
        materialTextureLookup,
        rolePaletteTuning,
        materialPipeline,
        levelId,
      );
      assignMaterialTextureLayers(record, { baseColorTextures, baseColorLayerByUrl, materialTextures, materialLayerByKey });
      const signature = rawMaterialSignature(record);
      const existing = signatureToIndex.get(signature);
      if (Number.isFinite(existing)) return existing;
      record.index = materials.length;
      record.id = `${record.id}:${hashString(signature)}`;
      materials.push(record);
      signatureToIndex.set(signature, record.index);
      return record.index;
    },
  };
}

function createRawMaterialRecord(material, fallbackColor, category, materialTextureLookup, rolePaletteTuning, materialPipeline, levelId = "") {
  const style = materialStyle(material, fallbackColor, category);
  const materialName = String(material?.name ?? `${category}_material`).trim() || `${category}_material`;
  const routeConsoleOverride = routeConsolePartsMaterialOverride(materialName, category);
  const genericEnemyPaletteOverride = genericEnemyPaletteMaterialOverride(materialName, category);
  const pipelineMaterial = rawMaterialPipelineMaterialFor(materialPipeline, materialName, category);
  const emissiveFactor = Array.isArray(style.emissiveFactor)
    ? [
        roundNumber(clampNumber(Number(style.emissiveFactor[0] ?? 0), 0, 1)),
        roundNumber(clampNumber(Number(style.emissiveFactor[1] ?? 0), 0, 1)),
        roundNumber(clampNumber(Number(style.emissiveFactor[2] ?? 0), 0, 1)),
      ]
    : material?.emissive?.isColor
    ? [roundNumber(material.emissive.r), roundNumber(material.emissive.g), roundNumber(material.emissive.b)]
    : [0, 0, 0];
  const opacity = rawMaterialOpacity(material, style, category);
  const originalTextures = materialTextureSlots(material, materialTextureLookup, pipelineMaterial, category);
  const applyGenericEnemyPaletteOverride = Boolean(genericEnemyPaletteOverride);
  const textures = applyGenericEnemyPaletteOverride
    ? originalTextures.filter((texture) => texture.semantic !== "baseColor")
    : originalTextures;
  const visualRole = routeConsoleOverride?.visualRole ?? genericEnemyPaletteOverride?.visualRole ?? rawMaterialVisualRole(materialName, category, style, textures);
  const hasBaseColorTexture = textures.some((texture) => texture.semantic === "baseColor" && texture.url);
  const preserveLevel05RoomTextureColor = levelId === "level_05_reclamation_core" && category === "room" && hasBaseColorTexture;
  const preserveAuthoredTextureColor =
    hasBaseColorTexture &&
    (preserveLevel05RoomTextureColor ||
      category === "enemy" ||
      /image2|atlas|wall_art|gallery_door|wrap|decal|paint|poster|art/i.test(materialName));
  const preserveAuthoredRoleColor = rawMaterialPreservesAuthoredRoleColor({
    levelId,
    visualRole,
    category,
    materialName,
    hasBaseColorTexture,
  });
  const preserveTextureColor = shouldPreserveAuthoredTextureColor({
    levelId,
    visualRole,
    category,
    materialName,
    preserveAuthoredTextureColor: routeConsoleOverride ? false : preserveAuthoredTextureColor,
  });
  const semanticParams = rawMaterialSemanticParams(visualRole, style, textures);
  const alphaMode = materialAlphaMode(material, opacity);
  const transparency = rawMaterialTransparency(material, opacity, alphaMode);

  return {
    index: -1,
    id: `mat:${category}:${slugify(materialName)}`,
    name: materialName,
    category,
    visualRole,
    semanticParams: preserveTextureColor ? [semanticParams[0], 0, 0, 0] : semanticParams,
    paletteColorFactor:
      applyGenericEnemyPaletteOverride || preserveTextureColor || preserveAuthoredRoleColor
        ? [0, 0, 0, 0]
        : rawMaterialPaletteColorFactor({
            levelId,
            visualRole,
            style,
            textures,
            rolePaletteTuning,
            category,
            materialName,
          }),
    baseColorFactor: routeConsoleOverride
      ? [...routeConsoleOverride.baseColorFactor, roundNumber(opacity)]
      : applyGenericEnemyPaletteOverride
        ? [...genericEnemyPaletteOverride.baseColorFactor, roundNumber(opacity)]
      : preserveTextureColor
        ? [1, 1, 1, roundNumber(opacity)]
        : [style.color[0], style.color[1], style.color[2], roundNumber(opacity)],
    emissiveFactor:
      routeConsoleOverride?.emissiveFactor ??
      (applyGenericEnemyPaletteOverride ? genericEnemyPaletteOverride?.emissiveFactor : null) ??
      emissiveFactor,
    emissiveStrength:
      routeConsoleOverride?.emissiveStrength ??
      (applyGenericEnemyPaletteOverride ? genericEnemyPaletteOverride?.emissiveStrength : null) ??
      style.emissive,
    roughnessFactor: style.roughness,
    metallicFactor: materialMetallic(material, style.materialKind),
    aoStrength: materialAoStrength(material),
    materialKind: style.materialKind,
    alphaMode,
    transparency,
    doubleSided: material?.side === 2,
    textures,
  };
}

function routeConsolePartsMaterialOverride(materialName, category) {
  if (category !== "interaction") return null;
  const key = String(materialName ?? "").trim().toLowerCase();
  if (key === "route_parts_lit") {
    return {
      visualRole: "switch_active",
      baseColorFactor: [0.18, 0.82, 0.78],
      emissiveFactor: [0.36, 0.96, 1.0],
      emissiveStrength: 0.72,
    };
  }
  if (key === "route_parts_flat") {
    return {
      visualRole: "switch_active",
      baseColorFactor: [0.18, 0.62, 0.5],
      emissiveFactor: [0.04, 0.18, 0.14],
      emissiveStrength: 0.12,
    };
  }
  return null;
}

function genericEnemyPaletteMaterialOverride(materialName, category) {
  if (category !== "enemy") return null;
  const key = String(materialName ?? "").trim();
  if (/^PaletteMaterial001(?:\.|$)/iu.test(key)) {
    return {
      visualRole: "robot_body",
      baseColorFactor: [0.18, 0.46, 0.42],
      emissiveFactor: [0.0, 0.055, 0.048],
      emissiveStrength: 0.08,
    };
  }
  if (/^PaletteMaterial002(?:\.|$)/iu.test(key)) {
    return {
      visualRole: "cyan_emissive",
      baseColorFactor: [0.28, 0.82, 0.76],
      emissiveFactor: [0.06, 0.46, 0.42],
      emissiveStrength: 0.8,
    };
  }
  if (/^PaletteMaterial003(?:\.|$)/iu.test(key)) {
    return {
      visualRole: "pickup_energy",
      baseColorFactor: [0.62, 0.32, 0.06],
      emissiveFactor: [0.55, 0.22, 0.02],
      emissiveStrength: 0.9,
    };
  }
  return null;
}

function assignMaterialTextureLayers(material, registry) {
  for (const slot of material.textures ?? []) {
    if (!slot.url) continue;
    if (slot.semantic === "baseColor") {
      assignBaseColorTextureLayer(slot, registry.baseColorTextures, registry.baseColorLayerByUrl);
      continue;
    }
    assignNonBaseMaterialTextureLayer(slot, registry.materialTextures, registry.materialLayerByKey);
  }
}

function assignBaseColorTextureLayer(slot, baseColorTextures, baseColorLayerByUrl) {
  const existingLayer = baseColorLayerByUrl.get(slot.url);
  if (Number.isFinite(existingLayer)) {
    slot.layer = existingLayer;
    return;
  }
  const layer = baseColorTextures.length + 1;
  baseColorLayerByUrl.set(slot.url, layer);
  slot.layer = layer;
  baseColorTextures.push({
    layer,
    semantic: "baseColor",
    colorSpace: slot.colorSpace ?? "srgb",
    url: slot.url,
    name: slot.name ?? null,
    sourceFile: slot.sourceFile ?? null,
    mimeType: slot.mimeType ?? null,
    stats: slot.stats ?? rawTextureStatsFallback(),
  });
}

function assignNonBaseMaterialTextureLayer(slot, materialTextures, materialLayerByKey) {
  const semantic = slot.semantic ?? "material";
  const key = `${semantic}:${slot.colorSpace ?? "linear"}:${slot.url}`;
  const existingLayer = materialLayerByKey.get(key);
  if (Number.isFinite(existingLayer)) {
    slot.layer = existingLayer;
    return;
  }
  const layer = materialTextures.length + 1;
  materialLayerByKey.set(key, layer);
  slot.layer = layer;
  materialTextures.push({
    layer,
    semantic,
    colorSpace: slot.colorSpace ?? "linear",
    url: slot.url,
    name: slot.name ?? null,
    sourceFile: slot.sourceFile ?? null,
    mimeType: slot.mimeType ?? null,
    stats: slot.stats ?? rawTextureStatsFallback(),
  });
}

function rawMaterialSignature(material) {
  return JSON.stringify({
    name: material.name,
    category: material.category,
    visualRole: material.visualRole,
    semanticParams: material.semanticParams,
    paletteColorFactor: material.paletteColorFactor,
    baseColorFactor: material.baseColorFactor,
    emissiveFactor: material.emissiveFactor,
    emissiveStrength: material.emissiveStrength,
    roughnessFactor: material.roughnessFactor,
    metallicFactor: material.metallicFactor,
    aoStrength: material.aoStrength,
    materialKind: material.materialKind,
    alphaMode: material.alphaMode,
    transparency: material.transparency,
    doubleSided: material.doubleSided,
    textures: material.textures,
  });
}

function rawMaterialVisualRole(materialName, category, style, textures) {
  const name = `${category}:${materialName}`.toLowerCase();
  const materialKey = String(materialName ?? "").toLowerCase();
  const serviceElevatorRole = serviceElevatorMaterialVisualRole(materialKey);
  if (serviceElevatorRole) return serviceElevatorRole;
  if (isRouteTransparentGlassMaterial(materialKey, category)) return "glass_shell";
  const hasBaseTexture = textures.some((texture) => texture.semantic === "baseColor" && texture.url);
  if (hasBaseTexture && /glass|\bpane\b|window|acrylic|transparent/.test(materialKey)) return "glass_shell";
  if (hasBaseTexture && /image2|atlas|wall_art|gallery_door|wrap|decal|paint|poster|art/.test(materialKey)) return "neutral_surface";
  if (hasBaseTexture && /image2.*gallery_door|museum_gallery_door/.test(materialKey)) return "neutral_surface";
  const puzzleOrbRole = rawPuzzleOrbMaterialVisualRole(materialKey);
  if (puzzleOrbRole) return puzzleOrbRole;

  if (category === "enemy") {
    if (/body_warm_museum_panel/.test(materialKey)) return "structural_dark";
    if (/brushed_warm_museum_trim/.test(materialKey)) return "structural_dark";
    if (/warning|amber|orange|yellow/.test(materialKey) || style.materialKind === 5) return "pickup_energy";
    if (/scanner|core|cyan|beam|emissive|shield/.test(materialKey) || style.materialKind === 4) return "cyan_emissive";
    if (/dark|armor|gunmetal|rubber|joint|black/.test(materialKey) || style.materialKind === 2 || style.materialKind === 3) return "structural_dark";
    return "robot_body";
  }
  if (category === "door" && /warning_black|black_warning/.test(materialKey)) return "structural_dark";
  if (category === "door" && /fault|hazard|lock|locked|lockdown|denied|amber|orange|warning|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialKey)) {
    return "door_locked_red";
  }
  if (category === "door" && /access|open|unlock|cyan|blue|reader|scanner|scan|emissive|glow|read_light|medical_emissive/.test(materialKey)) {
    return "door_access_cyan";
  }
  if ((category === "pickup" || category === "key-item") && /med|medical|health|repair|first.?aid|white|cross|accent_medical|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialKey)) {
    return "pickup_health";
  }
  if ((category === "pickup" || category === "key-item") && /glass|shell|transparent/.test(materialKey)) {
    return "glass_shell";
  }
  if ((category === "pickup" || category === "key-item") && /cyan|teal|blue|emissive|glow/.test(materialKey)) {
    return "cyan_emissive";
  }
  if ((category === "pickup" || category === "key-item") && /energy|core|cell|battery|power|amber|orange|warning|cyan|teal|emissive|glow/.test(materialKey)) {
    return "pickup_energy";
  }
  if ((category === "pickup" || category === "key-item") && /ammo|magazine|round|clip|memory|chip|data/.test(materialKey)) return "pickup_ammo";
  if ((category === "pickup" || category === "key-item") && /key|gold|brass|yellow|protocol/.test(materialKey)) return "pickup_key";
  if (category === "interaction" && /fault|hazard|inactive|(^|[_\-\s])off($|[_\-\s])|locked|orange|warning|denied|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialKey)) {
    return "switch_inactive";
  }
  if (category === "interaction" && /active|ready|cyan|teal|green|reader|scan|terminal|screen|emissive|glow|(^|[_\-\s])on($|[_\-\s])/.test(materialKey)) {
    return "switch_active";
  }
  if (/(^|[_\-\s:])red($|[_\-\s])|danger|fault|hazard|locked|lockdown/.test(name)) return "danger_red";
  if (/route|path|gold|brass|amber|yellow|protocol|inlay|track_white/.test(name)) return "route_gold";
  if (/screen|label|waveform|terminal|display|reader|monitor/.test(name)) return "screen_label";
  if (/glass|\bpane\b|window|acrylic|transparent/.test(name) || style.materialKind === 6) return "glass_shell";
  if (/warm_white|gallery_white|emissive_gallery_white|warm.*light|gallery.*light/.test(name)) return "exhibit_warm";
  if (/trim_light|soft_white_glint|panel_white/.test(name)) return "neutral_surface";
  if (/exhibit|warm|pin|archive|body_reference|voice|museum_.*case|tool/.test(name)) return "exhibit_warm";
  if (/black|dark|recess|underplate|shadow|smoked|gunmetal|titanium|beam|trim|metal|steel|rail|hinge|frame/.test(name)) {
    return "structural_dark";
  }
  if (/cyan|emissive|light|glow|scanner|strip|blade/.test(name) || style.materialKind === 4) return "cyan_emissive";
  if (/floor|tile/.test(name)) return "floor_surface";
  if (/ceiling/.test(name)) return "ceiling_surface";
  if (hasBaseTexture && category === "room") return "neutral_surface";
  if (category === "room" || category === "door") return "neutral_surface";
  if (category === "pickup" || category === "key-item") return "exhibit_warm";
  if (category === "interaction") return "screen_label";
  // builder / 自动设计 / remaster 资产（家具、控制台等 family/console 网格）匹配不到任何关键词时，
  // 别落到无着色的 "default"（role 0，shader 无 anchor → 死灰/近黑）。有底色贴图 → neutral_surface
  // （保留贴图色）；否则 → structural_dark（有着色，暗而不死）。下次重烤即生效，根治灰黑。
  if (hasBaseTexture) return "neutral_surface";
  return "structural_dark";
}

function rawPuzzleOrbMaterialVisualRole(materialKey) {
  if (!/puzzle_orb/.test(materialKey)) return null;
  if (/stem|socket|pin/.test(materialKey)) return "structural_dark";
  if (/glint|white/.test(materialKey)) return "exhibit_warm";
  if (/holder|gold|brass/.test(materialKey)) return "route_gold";
  if (/red/.test(materialKey)) return "switch_inactive";
  if (/yellow/.test(materialKey)) return "route_gold";
  if (/blue|glass|core/.test(materialKey)) return "glass_shell";
  return "neutral_surface";
}

const museumPaletteControlledVisualRoles = new Set([
  "route_gold",
  "danger_red",
  "exhibit_warm",
  "pickup_health",
  "pickup_energy",
  "pickup_key",
  "switch_active",
  "switch_inactive",
  "cyan_emissive",
  "screen_label",
]);

function rawMaterialPreservesAuthoredRoleColor({ levelId, visualRole, category, materialName, hasBaseColorTexture }) {
  if (isServiceElevatorMaterialName(materialName)) return true;
  if (visualRole === "default") return false;
  if (levelId === "level_03_human_museum") {
    if (visualRole === "glass_shell" && category === "room" && hasBaseColorTexture) return false;
    if (!hasBaseColorTexture && museumPaletteControlledVisualRoles.has(visualRole)) return false;
    if (
      visualRole === "neutral_surface" &&
      !hasBaseColorTexture &&
      (category === "room" || category === "door") &&
      /room_trim_light|room_panel_white|room_material|room_edge_wear_bright|museum_wall_subtle_champagne_edge/i.test(materialName)
    ) {
      return false;
    }
  }
  return true;
}

function shouldPreserveAuthoredTextureColor({ levelId, visualRole, category, materialName, preserveAuthoredTextureColor }) {
  if (!preserveAuthoredTextureColor) return false;
  if (levelId === "level_03_human_museum" && visualRole === "glass_shell" && category === "room" && /glass/i.test(materialName)) {
    return false;
  }
  return true;
}

function rawMaterialSemanticParams(visualRole, style, textures) {
  const hasReadableBaseTexture = textures.some((texture) => {
    const stats = texture.stats;
    return texture.semantic === "baseColor" && texture.url && ((stats?.contrast ?? 0) > 0.08 || (stats?.detail ?? 0) > 0.035);
  });
  const textureIdentityBoost = hasReadableBaseTexture ? -0.08 : 0.04;
  const emissiveBoost = clampNumber((style.emissive ?? 0) * 0.08, 0, 0.16);
  const roleIds = {
    default: 0,
    neutral_surface: 1,
    floor_surface: 2,
    ceiling_surface: 3,
    structural_dark: 4,
    glass_shell: 5,
    exhibit_warm: 6,
    cyan_emissive: 7,
    route_gold: 8,
    danger_red: 9,
    screen_label: 10,
    robot_body: 11,
    door_locked_red: 12,
    door_access_cyan: 13,
    pickup_health: 14,
    pickup_energy: 15,
    pickup_ammo: 16,
    pickup_key: 17,
    switch_active: 18,
    switch_inactive: 19,
  };
  const presets = {
    default: [0.35, 0.08, 0.18],
    neutral_surface: [0.56, 0.05, 0.34],
    floor_surface: [0.70, 0.10, 0.30],
    ceiling_surface: [0.62, 0.08, 0.34],
    structural_dark: [0.82, 0.03, 0.48],
    glass_shell: [0.78, 0.18, 0.12],
    exhibit_warm: [0.76, 0.34, 0.18],
    cyan_emissive: [0.64, 0.30, 0.10],
    route_gold: [0.86, 0.42, 0.06],
    danger_red: [0.82, 0.26, 0.10],
    screen_label: [0.74, 0.36, 0.08],
    robot_body: [0.50, 0.18, 0.18],
    door_locked_red: [0.86, 0.36, 0.08],
    door_access_cyan: [0.82, 0.34, 0.08],
    pickup_health: [0.88, 0.30, 0.10],
    pickup_energy: [0.86, 0.38, 0.08],
    pickup_ammo: [0.72, 0.12, 0.20],
    pickup_key: [0.88, 0.40, 0.06],
    switch_active: [0.80, 0.34, 0.08],
    switch_inactive: [0.82, 0.30, 0.10],
  };
  const base = presets[visualRole] ?? presets.default;
  const roleId = roleIds[visualRole] ?? roleIds.default;
  return [
    roleId,
    roundNumber(clampNumber(base[0] + textureIdentityBoost, 0.18, 1)),
    roundNumber(clampNumber(base[1] + emissiveBoost, 0, 1.2)),
    roundNumber(clampNumber(base[2], 0, 1.2)),
  ];
}

function rawMaterialPaletteColorFactor({ levelId, visualRole, style, textures, rolePaletteTuning, category, materialName }) {
  void style;
  const roleTuning = rolePaletteTuning?.roles?.[visualRole];
  const fallbackTuning = museumRolePaletteFallback({ levelId, visualRole, category, materialName, textures }) ?? gameplayRolePaletteFallback(visualRole);
  const roleMix = clampNumber(Number(roleTuning?.mix ?? 0) || 0, 0, 1);
  const fallbackMix = clampNumber(Number(fallbackTuning?.mix ?? 0) || 0, 0, 1);
  const useRoleTuning = Array.isArray(roleTuning?.targetColor) && roleTuning.targetColor.length >= 3 && roleMix > 0.001;
  const targetColor = useRoleTuning ? roleTuning?.targetColor : fallbackTuning?.targetColor;
  if (!Array.isArray(targetColor) || targetColor.length < 3) return [0, 0, 0, 0];
  const baseMix = useRoleTuning ? roleMix : fallbackMix;
  if (baseMix <= 0.001) return [0, 0, 0, 0];
  const readableTexture = textures.find((texture) => texture.semantic === "baseColor" && texture.url && texture.stats);
  const readability = readableTexture ? clampNumber((readableTexture.stats.contrast ?? 0) * 0.72 + (readableTexture.stats.detail ?? 0) * 1.35, 0, 1) : 0;
  const textureGuard = readableTexture ? clampNumber(0.86 - readability * 0.18, 0.66, 0.86) : 1;
  return [
    roundNumber(clampNumber(Number(targetColor[0]) || 0, 0, 1.5)),
    roundNumber(clampNumber(Number(targetColor[1]) || 0, 0, 1.5)),
    roundNumber(clampNumber(Number(targetColor[2]) || 0, 0, 1.5)),
    roundNumber(baseMix * textureGuard),
  ];
}

function gameplayRolePaletteFallback(visualRole) {
  const fallbacks = {
    door_locked_red: { targetColor: [0.82, 0.12, 0.08], mix: 0.72 },
    door_access_cyan: { targetColor: [0.10, 0.64, 0.78], mix: 0.58 },
    pickup_health: { targetColor: [0.94, 0.90, 0.82], mix: 0.64 },
    pickup_energy: { targetColor: [1.00, 0.62, 0.14], mix: 0.76 },
    pickup_ammo: { targetColor: [0.50, 0.56, 0.46], mix: 0.48 },
    pickup_key: { targetColor: [1.00, 0.76, 0.20], mix: 0.78 },
    switch_active: { targetColor: [0.12, 0.78, 0.88], mix: 0.60 },
    switch_inactive: { targetColor: [0.92, 0.18, 0.10], mix: 0.62 },
  };
  return fallbacks[visualRole] ?? null;
}

function museumRolePaletteFallback({ levelId, visualRole, category, materialName, textures }) {
  if (levelId !== "level_03_human_museum") return null;
  const hasBaseColorTexture = textures.some((texture) => texture.semantic === "baseColor" && texture.url);
  if (visualRole === "glass_shell" && category === "room" && hasBaseColorTexture) {
    return { targetColor: [0.16, 0.22, 0.24], mix: 0.22 };
  }
  if (
    visualRole === "neutral_surface" &&
    !hasBaseColorTexture &&
    (category === "room" || category === "door") &&
    /room_trim_light|room_panel_white|room_material|room_edge_wear_bright|museum_wall_subtle_champagne_edge/i.test(materialName)
  ) {
    return { targetColor: [0.32, 0.34, 0.33], mix: 0.18 };
  }
  const accentFallbacks = {
    route_gold: { targetColor: [0.88, 0.62, 0.16], mix: 0.24 },
    danger_red: { targetColor: [0.72, 0.08, 0.05], mix: 0.22 },
    exhibit_warm: { targetColor: [0.78, 0.58, 0.32], mix: 0.18 },
    pickup_health: { targetColor: [0.94, 0.88, 0.78], mix: 0.24 },
    pickup_energy: { targetColor: [0.98, 0.58, 0.14], mix: 0.28 },
    pickup_key: { targetColor: [1.00, 0.72, 0.18], mix: 0.30 },
    switch_active: { targetColor: [0.10, 0.70, 0.80], mix: 0.24 },
    switch_inactive: { targetColor: [0.86, 0.16, 0.10], mix: 0.24 },
    cyan_emissive: { targetColor: [0.08, 0.56, 0.66], mix: 0.18 },
    screen_label: { targetColor: [0.68, 0.76, 0.74], mix: 0.16 },
  };
  if (!hasBaseColorTexture) return accentFallbacks[visualRole] ?? null;
  return null;
}

function materialMetallic(material, materialKind) {
  if (Number.isFinite(material?.metalness)) {
    return roundNumber(clampNumber(material.metalness, 0, 1));
  }
  if (materialKind === 2) return 0.72;
  if (materialKind === 5) return 0.36;
  if (materialKind === 4) return 0.18;
  if (materialKind === 6) return 0.22;
  if (materialKind === 3) return 0.04;
  if (materialKind === 1) return 0.03;
  return 0;
}

function materialAoStrength(material) {
  if (material?.aoMap) return 0.82;
  return 1;
}

function rawMaterialOpacity(material, style, category) {
  const materialName = String(material?.name ?? "").toLowerCase();
  const authoredOpacity = Number.isFinite(material?.opacity) ? clampNumber(material.opacity, 0, 1) : 1;
  const routeGlassOpacity = routeTransparentGlassOpacity(materialName, category, authoredOpacity);
  if (routeGlassOpacity !== null) return routeGlassOpacity;
  if ((category === "pickup" || category === "key-item") && style?.materialKind === 6 && /energy|cell|battery|core|shell|glass/.test(materialName)) {
    return Math.min(authoredOpacity, 0.34);
  }
  return authoredOpacity;
}

function materialAlphaMode(material, opacity = Number.isFinite(material?.opacity) ? clampNumber(material.opacity, 0, 1) : 1) {
  if (opacity < 0.98) return "BLEND";
  if (material?.transparent) return "BLEND";
  if (Number.isFinite(material?.alphaTest) && material.alphaTest > 0) return "MASK";
  return "OPAQUE";
}

function rawMaterialTransparency(material, opacity, alphaMode) {
  if (alphaMode === "BLEND") {
    const sources = [];
    if (material?.transparent) sources.push("gltf-material.transparent");
    if (opacity < 0.98) sources.push("gltf-material.opacity");
    if (sources.length === 0) sources.push("gltf-alphaMode-blend");
    return { mode: "blend", alpha: roundNumber(opacity), source: sources.join("+") };
  }
  if (alphaMode === "MASK") {
    return { mode: "mask", alpha: roundNumber(opacity), source: "gltf-alphaTest" };
  }
  return { mode: "opaque", alpha: 1, source: "opaque-default" };
}


function materialTextureSlots(material, materialTextureLookup, pipelineMaterial = null, category = "") {
  const materialName = String(material?.name ?? "").trim();
  const slots = [
    textureSlot("baseColor", material?.map, "srgb", materialTextureLookup, pipelineMaterial?.slots?.baseColor, materialName),
    textureSlot("normal", material?.normalMap, "linear", materialTextureLookup, pipelineMaterial?.slots?.normal, materialName),
    textureSlot(
      "metallicRoughness",
      material?.metalnessMap ?? material?.roughnessMap,
      "linear",
      materialTextureLookup,
      pipelineMaterial?.slots?.metallicRoughness,
      materialName,
    ),
    textureSlot("ao", material?.aoMap, "linear", materialTextureLookup, pipelineMaterial?.slots?.ao, materialName),
    textureSlot("emissive", material?.emissiveMap, "srgb", materialTextureLookup, pipelineMaterial?.slots?.emissive, materialName),
  ].filter((slot) => slot.present);
  if (category === "builder-resource") {
    // Additive: builder-resource props are normally baseColor-only, but shared-pbr
    // GLBs (scripts/asset-build/blender-build-prop.py) embed real normal + ORM
    // (metallicRoughness) textures. Pass through ONLY genuinely-embedded channels
    // (resolved URL, not generated/256px placeholders) so those props get real PBR;
    // props without embedded PBR are unaffected (still baseColor-only). AO is left
    // out to conserve material-texture layer budget — ORM's R-channel AO already
    // rides along the metallicRoughness slot.
    return slots.filter(
      (slot) =>
        slot.semantic === "baseColor" ||
        ((slot.semantic === "normal" || slot.semantic === "metallicRoughness") &&
          Boolean(slot.url) &&
          !slot.generated),
    );
  }
  return slots;
}

function textureSlot(semantic, texture, colorSpace, textureLookup = null, supplementalSlot = null, materialName = "") {
  const aliases = [
    texture?.name,
    texture?.source?.data?.name,
    texture?.image?.name,
    texture?.uuid,
    ...materialTextureFallbackAliases(materialName, semantic, null),
  ].filter((value) => String(value ?? "").trim());
  const name = aliases[0] ?? null;
  const exportedTexture = textureLookup ? aliases.map((alias) => textureLookup.get(alias)).find(Boolean) ?? null : null;
  const supplementalTexture = supplementalSlot?.present && supplementalSlot?.url ? supplementalSlot : null;
  const resolvedTexture = exportedTexture ?? supplementalTexture;
  return {
    semantic,
    present: Boolean(texture) || Boolean(resolvedTexture),
    colorSpace: texture || resolvedTexture ? (resolvedTexture?.colorSpace ?? colorSpace) : "none",
    name: name ?? resolvedTexture?.name ?? `${semantic}_supplement`,
    url: resolvedTexture?.url ?? null,
    sourceFile: resolvedTexture?.sourceFile ?? null,
    mimeType: resolvedTexture?.mimeType ?? null,
    stats: resolvedTexture?.stats ?? null,
    generated: Boolean(!exportedTexture && supplementalTexture?.generated),
  };
}

function rawMaterialPipelineMaterialFor(materialPipeline, materialName, category) {
  if (!materialPipeline) return null;
  const materialId = `mat:${category}:${slugify(materialName)}`;
  return (
    materialPipeline.materialsById?.get(materialId) ??
    materialPipeline.materialsByName?.get(`${category}:${String(materialName ?? "").trim().toLowerCase()}`) ??
    null
  );
}

function materialStyle(material, fallbackColor, category) {
  const namedStyle = category === "enemy" ? enemyMaterialStyle(material?.name) : null;
  if (namedStyle) return namedStyle;
  const roomStyle = roomMaterialStyle(material?.name, category);
  if (roomStyle) return roomStyle;
  const gameplayStyle = gameplayMaterialStyle(material?.name, category);
  if (gameplayStyle) return gameplayStyle;

  const color = new Color();
  const rawEmissive = materialEmissiveStrength(material);
  const materialKind = materialKindFor(material?.name, category, rawEmissive);
  const emissive = materialKind === 6 ? roundNumber(Math.min(rawEmissive, 0.07)) : rawEmissive;
  const roughness = materialRoughness(material, materialKind);
  if (material?.color?.isColor) {
    color.copy(material.color);
    if (!material.map || color.r < 0.92 || color.g < 0.92 || color.b < 0.92) {
      return {
        color: [roundNumber(color.r), roundNumber(color.g), roundNumber(color.b)],
        emissive,
        materialKind,
        roughness,
      };
    }
  }
  if (materialKind !== 6 && material?.emissive?.isColor) {
    color.copy(material.emissive);
    if (color.r + color.g + color.b > 0.05) {
      return {
        color: [
          roundNumber(Math.min(1, color.r + fallbackColor[0] * 0.45)),
          roundNumber(Math.min(1, color.g + fallbackColor[1] * 0.45)),
          roundNumber(Math.min(1, color.b + fallbackColor[2] * 0.45)),
        ],
        emissive,
        materialKind: 4,
        roughness: Math.min(roughness, 0.34),
      };
    }
  }
  return { color: fallbackColor, emissive: 0, materialKind, roughness };
}

function roomMaterialStyle(name, category) {
  const materialName = String(name ?? "").toLowerCase();
  if (category !== "room" || !materialName) return null;
  if (isServiceElevatorMaterialName(materialName)) return null;
  if (/room_glass_reflect|smoked_glass|glass_volume|listening_panel_glass|body_reference_glass/.test(materialName)) {
    return {
      color: [0.54, 0.60, 0.58],
      emissiveFactor: [0.34, 0.40, 0.38],
      emissive: 0.018,
      materialKind: 6,
      roughness: 0.54,
    };
  }
  return null;
}

function routeTransparentGlassMaterialStyle(materialName, category) {
  if (isRouteConsoleSmokedGlassMaterial(materialName, category)) {
    return {
      color: [0.49, 0.85, 0.90],
      emissiveFactor: [0.11, 0.38, 0.42],
      emissive: 0.18,
      materialKind: 6,
      roughness: 0.18,
    };
  }
  if (isRouteConsoleCyanGlassMaterial(materialName, category)) {
    return {
      color: [0.55, 0.96, 1.0],
      emissiveFactor: [0.20, 0.86, 1.0],
      emissive: 0.34,
      materialKind: 6,
      roughness: 0.12,
    };
  }
  if (isRouteOutputOrbOuterGlassMaterial(materialName)) {
    return {
      color: [0.68, 0.94, 1.0],
      emissiveFactor: [0.14, 0.42, 0.46],
      emissive: 0.08,
      materialKind: 6,
      roughness: 0.12,
    };
  }
  return null;
}

function isRouteTransparentGlassMaterial(materialName, category) {
  return (
    isRouteConsoleSmokedGlassMaterial(materialName, category) ||
    isRouteConsoleCyanGlassMaterial(materialName, category) ||
    isRouteOutputOrbOuterGlassMaterial(materialName)
  );
}

function isRouteConsoleSmokedGlassMaterial(materialName, category) {
  return category === "interaction" && String(materialName ?? "").toLowerCase() === "route_console_smoked_glass";
}

function isRouteConsoleCyanGlassMaterial(materialName, category) {
  return category === "interaction" && String(materialName ?? "").toLowerCase() === "route_console_cyan_glass";
}

function isRouteOutputOrbOuterGlassMaterial(materialName) {
  return /^route_orb_[1-4]_(?:clear|transparent)_outer_shell$/i.test(String(materialName ?? "").trim());
}

function routeTransparentGlassOpacity(materialName, category, authoredOpacity) {
  if (isRouteConsoleSmokedGlassMaterial(materialName, category)) return Math.min(authoredOpacity, 0.28);
  if (isRouteConsoleCyanGlassMaterial(materialName, category)) return Math.min(authoredOpacity, 0.38);
  if (isRouteOutputOrbOuterGlassMaterial(materialName)) return roundNumber(clampNumber(Math.max(authoredOpacity, 0.18), 0.18, 0.34));
  return null;
}

function gameplayMaterialStyle(name, category) {
  const materialName = String(name ?? "").toLowerCase();
  if (!materialName) return null;
  if (isServiceElevatorMaterialName(materialName)) return null;
  if (/puzzle_orb/.test(materialName)) return null;
  const routeGlassStyle = routeTransparentGlassMaterialStyle(materialName, category);
  if (routeGlassStyle) return routeGlassStyle;

  if (category === "door") {
    if (/warning_black|black_warning/.test(materialName)) return null;
    if (/fault|hazard|lock|locked|lockdown|denied|amber|orange|warning|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) {
      return { color: [0.84, 0.14, 0.08], emissive: /emissive|light|fault|glow/.test(materialName) ? 0.28 : 0.10, materialKind: 5, roughness: 0.34 };
    }
    if (/access|open|unlock|cyan|blue|reader|scanner|scan|emissive|glow|read_light|medical_emissive/.test(materialName)) {
      return { color: [0.10, 0.58, 0.74], emissive: /emissive|light|glow|reader|scan/.test(materialName) ? 0.30 : 0.10, materialKind: 4, roughness: 0.28 };
    }
  }

  if (category === "pickup" || category === "key-item") {
    if (/(^|[_\-\s])red($|[_\-\s])|cross|medical_red|accent_medical|emissive_red/.test(materialName)) {
      return { color: [0.88, 0.11, 0.09], emissive: /emissive|glow/.test(materialName) ? 0.22 : 0.08, materialKind: 5, roughness: 0.40 };
    }
    if (/med|medical|health|repair|first.?aid|white|panel_white/.test(materialName)) {
      return { color: [0.88, 0.90, 0.84], emissive: 0.02, materialKind: 1, roughness: 0.58 };
    }
    if (/glass|shell|transparent/.test(materialName)) {
      return { color: [0.50, 0.88, 1.00], emissive: 0.12, materialKind: 6, roughness: 0.40 };
    }
    if (/cyan|teal|blue|emissive|glow/.test(materialName)) {
      return { color: [0.20, 0.78, 0.90], emissive: 0.34, materialKind: 4, roughness: 0.24 };
    }
    if (/energy|core|cell|battery|power|amber|orange|warning/.test(materialName)) {
      return { color: [1.00, 0.62, 0.14], emissive: /emissive|core|cell|energy|glow/.test(materialName) ? 0.30 : 0.16, materialKind: 5, roughness: 0.34 };
    }
    if (/key|gold|brass|yellow|protocol/.test(materialName)) {
      return { color: [1.00, 0.74, 0.18], emissive: 0.14, materialKind: 5, roughness: 0.32 };
    }
    if (/ammo|magazine|round|clip|memory|chip|data/.test(materialName)) {
      return { color: [0.48, 0.54, 0.45], emissive: /data|chip|memory/.test(materialName) ? 0.12 : 0.02, materialKind: 2, roughness: 0.48 };
    }
  }

  if (category === "interaction") {
    if (/fault|hazard|inactive|(^|[_\-\s])off($|[_\-\s])|locked|orange|warning|denied|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) {
      return { color: [0.88, 0.16, 0.10], emissive: /emissive|light|glow|warning/.test(materialName) ? 0.22 : 0.08, materialKind: 5, roughness: 0.36 };
    }
    if (/active|ready|cyan|teal|green|reader|scan|terminal|screen|emissive|glow|(^|[_\-\s])on($|[_\-\s])/.test(materialName)) {
      return { color: [0.12, 0.72, 0.84], emissive: /emissive|light|glow|screen|reader|scan/.test(materialName) ? 0.30 : 0.10, materialKind: 4, roughness: 0.28 };
    }
  }

  return null;
}

function enemyMaterialStyle(name) {
  const materialName = String(name ?? "").toLowerCase();
  if (!materialName) return null;
  const palette = {
    body: [0.13, 0.115, 0.086],
    armor: [0.055, 0.055, 0.05],
    dark: [0.035, 0.036, 0.032],
    core: [0.42, 0.7, 0.66],
    warning: [0.72, 0.52, 0.22],
  };

  if (/^palettematerial00[13](?:\.|$)/.test(materialName)) {
    return { color: materialName.includes("003") ? palette.body : palette.armor, emissive: 0, materialKind: 2, roughness: 0.56 };
  }
  if (/body_warm_museum_panel/.test(materialName)) {
    return { color: [0.18, 0.15, 0.105], emissive: 0, materialKind: 2, roughness: 0.54 };
  }
  if (/brushed_warm_museum_trim/.test(materialName)) {
    return { color: [0.34, 0.24, 0.1], emissive: 0.005, materialKind: 2, roughness: 0.38 };
  }
  if (/warning|amber|orange|yellow/.test(materialName)) {
    return { color: [0.86, 0.46, 0.12], emissive: 0.18, materialKind: 5, roughness: 0.34 };
  }
  if (
    materialName.includes("core") ||
    materialName.includes("scanner") ||
    materialName.includes("cyan") ||
    materialName.includes("beam") ||
    materialName.includes("emissive")
  ) {
    return { color: palette.core, emissive: 0.26, materialKind: 4, roughness: 0.28 };
  }
  if (materialName.includes("rubber") || materialName.includes("black") || materialName.includes("joint")) {
    return { color: palette.dark, emissive: 0, materialKind: 3, roughness: 0.88 };
  }
  if (materialName.includes("dark") || materialName.includes("gunmetal") || materialName.includes("smoked") || materialName.includes("armor") || materialName.includes("hammer")) {
    return { color: palette.armor, emissive: 0, materialKind: 2, roughness: 0.44 };
  }
  if (materialName.includes("body") || materialName.includes("off_white") || materialName.includes("panel") || materialName.includes("service")) {
    return { color: palette.body, emissive: 0, materialKind: 1, roughness: 0.62 };
  }
  return null;
}

function materialKindFor(name, category, emissive) {
  const materialName = String(name ?? "").toLowerCase();
  const serviceElevatorKind = serviceElevatorMaterialKind(materialName);
  if (serviceElevatorKind !== null) return serviceElevatorKind;
  if (isRouteTransparentGlassMaterial(materialName, category)) return 6;
  if (category === "door" && /warning_black|black_warning/.test(materialName)) return 3;
  if (category === "door" && /fault|hazard|lock|locked|lockdown|denied|amber|orange|warning|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) return 5;
  if (category === "door" && /access|open|unlock|cyan|blue|reader|scanner|scan|emissive|glow|read_light|medical_emissive/.test(materialName)) return 4;
  if ((category === "pickup" || category === "key-item") && /med|medical|health|repair|first.?aid|white|cross|accent_medical|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) return 1;
  if ((category === "pickup" || category === "key-item") && /energy|core|cell|battery|power|amber|orange|warning/.test(materialName)) return 5;
  if ((category === "pickup" || category === "key-item") && /cyan|teal|emissive|glow/.test(materialName)) return 4;
  if ((category === "pickup" || category === "key-item") && /ammo|magazine|round|clip|memory|chip|data/.test(materialName)) return 2;
  if ((category === "pickup" || category === "key-item") && /key|gold|brass|yellow|protocol/.test(materialName)) return 5;
  if (category === "interaction" && /fault|hazard|inactive|(^|[_\-\s])off($|[_\-\s])|locked|orange|warning|denied|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) return 5;
  if (category === "interaction" && /active|ready|cyan|teal|green|reader|scan|terminal|screen|emissive|glow|(^|[_\-\s])on($|[_\-\s])/.test(materialName)) return 4;
  if (/glass|\bpane\b|window|acrylic|transparent/.test(materialName)) return 6;
  if (emissive > 0.08 || /core|scanner|cyan|beam|emissive|screen|light|glow/.test(materialName)) return 4;
  if (/warning|amber|locked|lock|orange|hazard|emissive_red|(^|[_\-\s])red($|[_\-\s])/.test(materialName)) return 5;
  if (/rubber|black|joint|tire|gasket/.test(materialName)) return 3;
  if (/metal|steel|gunmetal|armor|dark|smoked|rail|hinge|frame/.test(materialName)) return 2;
  if (/body|off_white|white|panel|service|plastic|ceramic/.test(materialName)) return 1;
  if (category === "pickup" || category === "key-item") return 1;
  if (category === "interaction") return 4;
  if (category === "door") return 2;
  if (category === "enemy") return 1;
  return 0;
}

function isServiceElevatorMaterialName(materialName) {
  return /^hp_elevator_/.test(String(materialName ?? "").toLowerCase());
}

function serviceElevatorMaterialVisualRole(materialName) {
  if (!isServiceElevatorMaterialName(materialName)) return null;
  if (/floor_/.test(materialName)) return "floor_surface";
  if (/cyan|cold_edge_light|soft_cyan|motion_tube/.test(materialName)) return "cyan_emissive";
  if (/amber|champagne|burnished/.test(materialName)) return "route_gold";
  if (/button_(?:convex|cyan_glass_ring)|shaft_smoked_depth_glass/.test(materialName)) return "glass_shell";
  if (/spring|brushed|graphite|polished|highlight/.test(materialName)) return "neutral_surface";
  if (/opaque_smoked_glass|black|smoked|titanium|steel|socket|gasket|face|anodized/.test(materialName)) return "structural_dark";
  return "neutral_surface";
}

function serviceElevatorMaterialKind(materialName) {
  if (!isServiceElevatorMaterialName(materialName)) return null;
  if (/cyan|cold_edge_light|soft_cyan|motion_tube/.test(materialName)) return 4;
  if (/amber/.test(materialName)) return 5;
  if (/button_(?:convex|cyan_glass_ring)|shaft_smoked_depth_glass/.test(materialName)) return 6;
  if (/gasket|rubber/.test(materialName)) return 3;
  return 2;
}

function materialRoughness(material, materialKind) {
  if (Number.isFinite(material?.roughness)) {
    return roundNumber(Math.max(0.08, Math.min(0.96, material.roughness)));
  }
  if (materialKind === 4) return 0.24;
  if (materialKind === 5) return 0.38;
  if (materialKind === 3) return 0.88;
  if (materialKind === 2) return 0.42;
  if (materialKind === 1) return 0.62;
  if (materialKind === 6) return 0.45;
  return 0.74;
}

function materialEmissiveStrength(material) {
  if (!material?.emissive?.isColor) return 0;
  const strength = (material.emissive.r + material.emissive.g + material.emissive.b) / 3;
  const extensionStrength = material.userData?.gltfExtensions?.KHR_materials_emissive_strength?.emissiveStrength;
  const intensity = Number.isFinite(material.emissiveIntensity)
    ? material.emissiveIntensity
    : Number.isFinite(extensionStrength)
      ? extensionStrength
      : 1;
  return roundNumber(Math.max(0, Math.min(4, strength * intensity * 1.8)));
}

function fallbackColorForCategory(category) {
  if (category === "enemy") return [0.72, 0.69, 0.62];
  if (category === "door") return [0.18, 0.58, 0.78];
  if (category === "pickup") return [0.96, 0.78, 0.24];
  if (category === "interaction") return [0.26, 0.86, 0.74];
  return [0.54, 0.66, 0.66];
}

function resolveRawAssetSource(asset, gameRoot) {
  if (!asset.file) return null;
  const registered = {
    kind: "registered",
    filePath: path.join(gameRoot, asset.file),
  };
  const rawModels = {
    kind: "raw-models",
    filePath: path.join(
      gameRoot,
      asset.file
        .replace(/^src\/assets\/models-cooked\//, "src/assets/models/")
        .replace(/^src\/assets\/models-runtime\//, "src/assets/models/"),
    ),
  };
  const prefersRegistered = asset.rawSourcePreference === "registered";
  const prefersRawModels = asset.rawSourcePreference === "raw-models";
  const candidates = prefersRawModels
    ? [rawModels, registered]
    : prefersRegistered || asset.category === "enemy"
      ? [registered, rawModels]
      : [rawModels, registered];
  return candidates.find((candidate) => fsSync.existsSync(candidate.filePath)) ?? null;
}

function readFileAsArrayBuffer(filePath) {
  return fs.readFile(filePath).then((buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function installNodeGltfImageStubs() {
  if (!globalThis.self) globalThis.self = globalThis;
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

export const __rawWebGpuPlanGeometryTestInternals = {
  createRawMaterialRecord,
};
