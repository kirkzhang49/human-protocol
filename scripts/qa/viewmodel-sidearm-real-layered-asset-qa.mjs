import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const asset = {
  id: "sidearm_real_layered",
  file: "src/assets/models/viewmodel/prototypes/hp_viewmodel_sidearm_scripted_derived_v2.glb",
  maxBytes: 1_800_000,
  minTriangles: 55_000,
  maxTriangles: 100_000,
  minMaterials: 6,
  requiredMaterialNames: [
    "sidearm_layer_slide_opaque",
    "sidearm_layer_frame_opaque",
    "sidearm_layer_grip_opaque",
    "sidearm_layer_barrel_opaque",
    "sidearm_layer_trim_opaque",
    "sidearm_layer_emissive_opaque",
  ],
  requiredNodes: [
    "sidearm_layered_visual_body",
    "sidearm_muzzle_socket",
    "sidearm_right_hand_grip_socket",
    "sidearm_trigger_contact_socket",
    "sidearm_grip_front_contact_socket",
    "sidearm_grip_back_contact_socket",
    "sidearm_heat_core_socket",
    "sidearm_slide_node",
    "sidearm_barrel_node",
    "sidearm_grip_node",
    "sidearm_frame_node",
  ],
};

const failures = [];
const report = inspectAsset(asset, failures);

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures, report }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, report }, null, 2));

function inspectAsset(config, failures) {
  const absolute = path.join(repoRoot, config.file);
  if (!existsSync(absolute)) {
    failures.push(`${config.id}: missing ${config.file}`);
    return { id: config.id, file: config.file, missing: true };
  }

  const buffer = readFileSync(absolute);
  const json = readGlbJson(buffer);
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const materials = json.materials ?? [];
  let triangles = 0;
  let vertices = 0;
  let meshNodeCount = 0;
  const primitiveMaterialIndices = new Set();

  for (const node of nodes) {
    if (node.mesh !== undefined) meshNodeCount += 1;
  }

  for (const mesh of meshes) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.material !== undefined) primitiveMaterialIndices.add(primitive.material);
      if (primitive.indices !== undefined) {
        triangles += Math.floor((json.accessors?.[primitive.indices]?.count ?? 0) / 3);
      }
      const positionAccessor = primitive.attributes?.POSITION;
      if (positionAccessor !== undefined) {
        vertices += json.accessors?.[positionAccessor]?.count ?? 0;
      }
    }
  }

  const materialNames = materials.map((material) => material.name ?? "");
  const nodeNames = new Set(nodes.map((node) => node.name).filter(Boolean));
  const transparentMaterials = materialNames.filter((_, index) => {
    const material = materials[index];
    return material.alphaMode !== undefined && material.alphaMode !== "OPAQUE";
  });
  const missingTextureNames = materialNames.filter((_, index) => !materials[index]?.pbrMetallicRoughness?.baseColorTexture);
  const extensionsUsed = json.extensionsUsed ?? [];

  if (buffer.byteLength > config.maxBytes) failures.push(`${config.id}: ${buffer.byteLength} bytes exceeds ${config.maxBytes}`);
  if (meshNodeCount < 4) failures.push(`${config.id}: expected real mesh-part nodes, got ${meshNodeCount}`);
  if (materials.length < config.minMaterials) failures.push(`${config.id}: expected at least ${config.minMaterials} real material slots, got ${materials.length}`);
  if (primitiveMaterialIndices.size < config.minMaterials) failures.push(`${config.id}: expected primitives using at least ${config.minMaterials} material slots, got ${primitiveMaterialIndices.size}`);
  if (triangles < config.minTriangles) failures.push(`${config.id}: ${triangles} triangles below visual-fidelity floor ${config.minTriangles}`);
  if (triangles > config.maxTriangles) failures.push(`${config.id}: ${triangles} triangles exceeds playable preview budget ${config.maxTriangles}`);
  if (transparentMaterials.length > 0) failures.push(`${config.id}: transparent materials are forbidden: ${transparentMaterials.join(", ")}`);
  if (missingTextureNames.length > 0) failures.push(`${config.id}: every material must keep a baseColorTexture; missing ${missingTextureNames.join(", ")}`);
  if (!extensionsUsed.includes("EXT_meshopt_compression")) failures.push(`${config.id}: missing EXT_meshopt_compression after optimization`);
  if (!extensionsUsed.includes("EXT_texture_webp")) failures.push(`${config.id}: missing EXT_texture_webp after optimization`);

  for (const name of config.requiredMaterialNames) {
    if (!materialNames.includes(name)) failures.push(`${config.id}: missing material ${name}`);
  }

  for (const name of config.requiredNodes) {
    if (!nodeNames.has(name)) failures.push(`${config.id}: missing node ${name}`);
  }

  return {
    id: config.id,
    file: config.file,
    bytes: buffer.byteLength,
    meshNodeCount,
    meshes: meshes.length,
    materials: materials.length,
    materialNames,
    primitiveMaterialSlots: primitiveMaterialIndices.size,
    vertices,
    triangles,
    transparentMaterials,
    textures: json.textures?.length ?? 0,
    images: json.images?.length ?? 0,
    extensionsUsed,
    requiredNodesPresent: config.requiredNodes.filter((name) => nodeNames.has(name)).length,
  };
}

function readGlbJson(buffer) {
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error("Input is not a GLB file");
  }

  const jsonLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString("utf8", 16, 20);
  if (chunkType !== "JSON") {
    throw new Error("First GLB chunk is not JSON");
  }
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trimEnd());
}
