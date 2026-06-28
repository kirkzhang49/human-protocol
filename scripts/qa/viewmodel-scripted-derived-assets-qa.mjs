import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const ASSETS = [
  {
    id: "iron_rod",
    file: "src/assets/models/viewmodel/prototypes/hp_viewmodel_iron_rod_scripted_derived.glb",
    maxBytes: 1_200_000,
    minTriangles: 55_000,
    maxTriangles: 90_000,
    requiredNodes: [
      "iron_rod_right_hand_grip_socket",
      "iron_rod_hit_tip_socket",
      "iron_rod_hit_base_socket",
      "iron_rod_trail_start_socket",
      "iron_rod_trail_mid_socket",
      "iron_rod_trail_end_socket",
      "iron_rod_emissive_core_socket",
    ],
  },
  {
    id: "sidearm",
    file: "src/assets/models/viewmodel/prototypes/hp_viewmodel_sidearm_scripted_derived.glb",
    maxBytes: 1_300_000,
    minTriangles: 55_000,
    maxTriangles: 90_000,
    requiredNodes: [
      "sidearm_muzzle_socket",
      "sidearm_right_hand_grip_socket",
      "sidearm_trigger_contact_socket",
      "sidearm_grip_front_contact_socket",
      "sidearm_grip_back_contact_socket",
      "sidearm_heat_core_socket",
    ],
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
  const material = materials[0];
  const texturedMaterial = Boolean(material?.pbrMetallicRoughness?.baseColorTexture);
  const normalTexture = Boolean(material?.normalTexture);
  const metallicRoughnessTexture = Boolean(material?.pbrMetallicRoughness?.metallicRoughnessTexture);
  const images = json.images?.length ?? 0;
  const textures = json.textures?.length ?? 0;
  const extensionsUsed = json.extensionsUsed ?? [];

  if (buffer.byteLength > asset.maxBytes) failures.push(`${asset.id}: ${buffer.byteLength} bytes exceeds ${asset.maxBytes}`);
  if (meshNodeCount !== 1) failures.push(`${asset.id}: expected one scripted-derived visual mesh node, got ${meshNodeCount}`);
  if (materials.length !== 1) failures.push(`${asset.id}: expected original reference single-material visual body, got ${materials.length}`);
  if (triangles < asset.minTriangles) failures.push(`${asset.id}: ${triangles} triangles below visual-fidelity floor ${asset.minTriangles}`);
  if (triangles > asset.maxTriangles) failures.push(`${asset.id}: ${triangles} triangles exceeds playable preview budget ${asset.maxTriangles}`);
  if (images < 3) failures.push(`${asset.id}: expected reference base/normal/metallic roughness images`);
  if (textures < 3) failures.push(`${asset.id}: expected reference base/normal/metallic roughness texture slots`);
  if (!texturedMaterial) failures.push(`${asset.id}: material missing baseColorTexture`);
  if (!normalTexture) failures.push(`${asset.id}: material missing normalTexture`);
  if (!metallicRoughnessTexture) failures.push(`${asset.id}: material missing metallicRoughnessTexture`);
  if (!extensionsUsed.includes("EXT_meshopt_compression")) failures.push(`${asset.id}: missing EXT_meshopt_compression after optimization`);
  if (!extensionsUsed.includes("EXT_texture_webp")) failures.push(`${asset.id}: missing EXT_texture_webp after optimization`);

  for (const name of asset.requiredNodes) {
    if (!nodeNames.has(name)) failures.push(`${asset.id}: missing node ${name}`);
  }

  return {
    id: asset.id,
    file: asset.file,
    bytes: buffer.byteLength,
    meshNodeCount,
    meshes: meshes.length,
    materials: materials.length,
    materialName: material?.name ?? null,
    vertices,
    triangles,
    images,
    textures,
    texturedMaterial,
    normalTexture,
    metallicRoughnessTexture,
    extensionsUsed,
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
