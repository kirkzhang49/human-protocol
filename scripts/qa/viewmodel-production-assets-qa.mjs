import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const ASSETS = [
  {
    id: "iron_rod",
    file: "src/assets/models/viewmodel/prototypes/hp_viewmodel_iron_rod_production.glb",
    maxBytes: 2_000_000,
    minMeshNodes: 8,
    minMaterials: 5,
    maxTriangles: 70_000,
    requiredNodes: [
      "iron_rod_right_hand_grip_socket",
      "iron_rod_hit_tip_socket",
      "iron_rod_hit_base_socket",
      "iron_rod_trail_start_socket",
      "iron_rod_trail_mid_socket",
      "iron_rod_trail_end_socket",
      "iron_rod_emissive_core_socket",
    ],
    requiredMaterialPatterns: [/grip|wrap|rubber/i, /shaft|dark|core/i, /steel|edge|hero|scraped/i, /cyan|energy|glass/i, /bronze|amber|inlay/i],
  },
  {
    id: "sidearm",
    file: "src/assets/models/viewmodel/prototypes/hp_viewmodel_sidearm_production.glb",
    maxBytes: 2_500_000,
    minMeshNodes: 10,
    minMaterials: 6,
    maxTriangles: 80_000,
    requiredNodes: [
      "sidearm_muzzle_socket",
      "sidearm_right_hand_grip_socket",
      "sidearm_trigger_contact_socket",
      "sidearm_grip_front_contact_socket",
      "sidearm_grip_back_contact_socket",
      "sidearm_heat_core_socket",
    ],
    requiredMaterialPatterns: [/grip|rubber/i, /slide|panel|steel|titanium/i, /receiver|frame|dark/i, /cyan|energy|sight|muzzle/i, /bronze|amber|rail|trigger/i, /hero|scraped|edge/i],
  },
];

const failures = [];
const reports = ASSETS.map((asset) => inspectAsset(asset, failures));

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures, reports }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, reports }, null, 2));

function inspectAsset(asset, failures) {
  const absolute = path.join(repoRoot, asset.file);
  if (!existsSync(absolute)) {
    failures.push(`${asset.id}: missing ${asset.file}`);
    return { id: asset.id, file: asset.file, missing: true };
  }

  const buffer = readFileSync(absolute);
  const json = readGlbJson(buffer);
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const materials = json.materials ?? [];
  let triangles = 0;
  let vertices = 0;
  let meshNodeCount = 0;

  for (const node of nodes) {
    if (node.mesh !== undefined) meshNodeCount += 1;
  }

  for (const mesh of meshes) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.indices !== undefined) {
        triangles += Math.floor((json.accessors?.[primitive.indices]?.count ?? 0) / 3);
      }
      const positionAccessor = primitive.attributes?.POSITION;
      if (positionAccessor !== undefined) {
        vertices += json.accessors?.[positionAccessor]?.count ?? 0;
      }
    }
  }

  const nodeNames = new Set(nodes.map((node) => node.name).filter(Boolean));
  const materialNames = materials.map((material) => material.name ?? "");
  const texturedMaterials = materials.filter((material) => material.pbrMetallicRoughness?.baseColorTexture).length;
  const images = json.images?.length ?? 0;

  if (buffer.byteLength > asset.maxBytes) failures.push(`${asset.id}: ${buffer.byteLength} bytes exceeds ${asset.maxBytes}`);
  if (meshNodeCount < asset.minMeshNodes) failures.push(`${asset.id}: ${meshNodeCount} mesh nodes below ${asset.minMeshNodes}`);
  if (materials.length < asset.minMaterials) failures.push(`${asset.id}: ${materials.length} materials below ${asset.minMaterials}`);
  if (triangles > asset.maxTriangles) failures.push(`${asset.id}: ${triangles} triangles exceeds ${asset.maxTriangles}`);
  if (images < 1) failures.push(`${asset.id}: expected at least one embedded texture image`);
  if (texturedMaterials < 2) failures.push(`${asset.id}: expected at least two materials using baseColorTexture`);

  for (const name of asset.requiredNodes) {
    if (!nodeNames.has(name)) failures.push(`${asset.id}: missing node ${name}`);
  }

  for (const pattern of asset.requiredMaterialPatterns) {
    if (!materialNames.some((name) => pattern.test(name))) {
      failures.push(`${asset.id}: missing material matching ${pattern}`);
    }
  }

  return {
    id: asset.id,
    file: asset.file,
    bytes: buffer.byteLength,
    meshNodeCount,
    meshes: meshes.length,
    materials: materials.length,
    materialNames,
    vertices,
    triangles,
    images,
    texturedMaterials,
    requiredNodesPresent: asset.requiredNodes.filter((name) => nodeNames.has(name)).length,
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
