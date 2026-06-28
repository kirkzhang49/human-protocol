import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const enemyRoot = join(root, "src/assets/models/enemies");

function quatFromEuler(x, y, z) {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

function readGlb(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.toString("ascii", 0, 4) !== "glTF") throw new Error(`${filePath} is not a GLB.`);
  const chunks = [];
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    offset += 8;
    chunks.push({ type, data: buffer.subarray(offset, offset + length) });
    offset += length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === "JSON");
  if (!jsonChunk) throw new Error(`${filePath} has no JSON chunk.`);
  return { chunks, json: JSON.parse(jsonChunk.data.toString("utf8").trim()) };
}

function writeGlb(filePath, chunks, json) {
  const jsonText = JSON.stringify(json);
  const jsonPadding = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
  const jsonData = Buffer.from(jsonText + " ".repeat(jsonPadding));
  const outputChunks = chunks.map((chunk) => (chunk.type === "JSON" ? { type: "JSON", data: jsonData } : chunk));
  const totalLength = 12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = Buffer.alloc(totalLength);
  output.write("glTF", 0, "ascii");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  let offset = 12;
  for (const chunk of outputChunks) {
    output.writeUInt32LE(chunk.data.length, offset);
    output.write(chunk.type, offset + 4, 4, "ascii");
    offset += 8;
    chunk.data.copy(output, offset);
    offset += chunk.data.length;
  }
  writeFileSync(filePath, output);
}

function nodesByName(json) {
  const map = new Map();
  json.nodes?.forEach((node, index) => {
    if (!node.name) return;
    if (!map.has(node.name)) map.set(node.name, []);
    map.get(node.name).push({ node, index });
  });
  return map;
}

function editOne(map, name, edit) {
  const entries = map.get(name);
  if (!entries?.length) throw new Error(`Missing GLB node "${name}".`);
  edit(entries[0].node, entries[0].index);
}

function editAll(map, name, edit) {
  const entries = map.get(name);
  if (!entries?.length) throw new Error(`Missing GLB node "${name}".`);
  entries.forEach(({ node, index }) => edit(node, index));
}

function editIfPresent(map, name, edit) {
  const entries = map.get(name);
  if (!entries?.length) return;
  edit(entries[0].node, entries[0].index);
}

function setNode(node, { translation, rotation, scale }) {
  if (translation) node.translation = translation;
  if (rotation) node.rotation = rotation;
  if (scale) node.scale = scale;
}

function removeAnimationChannelsForNode(json, nodeName) {
  const nodeIndex = json.nodes?.findIndex((node) => node.name === nodeName);
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return;
  for (const animation of json.animations ?? []) {
    animation.channels = (animation.channels ?? []).filter((channel) => channel.target?.node !== nodeIndex);
  }
}

function repaletteEscapeRoomRobot(json) {
  const materials = json.materials ?? [];
  const scannerTextureIndex = materials.find((material) => material.name?.includes("scanner_cyan"))?.pbrMetallicRoughness?.baseColorTexture?.index;
  for (const material of materials) {
    if (/mat_core_(red|cyan)_emissive/.test(material.name ?? "")) {
      material.name = "mat_core_cyan_emissive";
      material.emissiveFactor = [0.06, 0.42, 0.48];
      material.pbrMetallicRoughness ??= {};
      if (Number.isInteger(scannerTextureIndex)) {
        material.pbrMetallicRoughness.baseColorTexture = { index: scannerTextureIndex };
      }
      material.pbrMetallicRoughness.metallicFactor = 0.78;
      material.pbrMetallicRoughness.roughnessFactor = 0.3;
    }
    if (material.name === "mat_warning_amber") {
      material.emissiveFactor = [0.2, 0.11, 0.035];
      material.pbrMetallicRoughness ??= {};
      material.pbrMetallicRoughness.metallicFactor = 0.74;
      material.pbrMetallicRoughness.roughnessFactor = 0.34;
    }
    if (material.name === "mat_body_off_white") {
      material.pbrMetallicRoughness ??= {};
      material.pbrMetallicRoughness.metallicFactor = 0.82;
      material.pbrMetallicRoughness.roughnessFactor = 0.38;
    }
  }
}

function refineRepairDrone(json) {
  const map = nodesByName(json);
  editOne(map, "torso_control", (node) => setNode(node, { translation: [0, 1.36, 0], scale: [0.78, 0.58, 0.72] }));
  editOne(map, "chestPivot", (node) => setNode(node, { rotation: quatFromEuler(-0.08, 0, 0) }));
  editOne(map, "part_head", (node) => setNode(node, { translation: [0, 1.7, -0.02], scale: [0.48, 0.42, 0.5] }));
  editOne(map, "part_backpack", (node) => setNode(node, { translation: [0, 1.28, -0.52], scale: [0.72, 0.5, 0.62] }));

  editOne(map, "leftShoulderPivot", (node) =>
    setNode(node, { translation: [-0.68, 1.44, 0.08], rotation: quatFromEuler(0, 0, -Math.PI / 2) }),
  );
  editOne(map, "rightShoulderPivot", (node) =>
    setNode(node, { translation: [0.68, 1.44, 0.08], rotation: quatFromEuler(0, 0, Math.PI / 2) }),
  );
  editOne(map, "part_arm_l", (node) => setNode(node, { scale: [0.3, 0.34, 0.36] }));
  editOne(map, "part_arm_r", (node) => setNode(node, { scale: [0.3, 0.34, 0.36] }));
  editOne(map, "part_forearm_l", (node) => setNode(node, { translation: [0, -0.46, 0.08], scale: [0.3, 0.38, 0.4] }));
  editOne(map, "part_forearm_r", (node) => setNode(node, { translation: [0, -0.46, 0.08], scale: [0.3, 0.38, 0.4] }));
  editOne(map, "part_hand_l", (node) => setNode(node, { scale: [0.34, 0.34, 0.36] }));
  editOne(map, "part_hand_r", (node) => setNode(node, { scale: [0.34, 0.34, 0.36] }));
  editOne(map, "leftForearmTwist", (node) => setNode(node, { rotation: quatFromEuler(0, 0.08, -0.18) }));
  editOne(map, "rightForearmTwist", (node) => setNode(node, { rotation: quatFromEuler(0, -0.08, 0.18) }));
  editOne(map, "drone_red_core_ring", (node) => setNode(node, { scale: [0.46, 0.46, 0.46] }));

  editOne(map, "pelvisPivot", (node) => setNode(node, { translation: [0, 1.04, -0.22], scale: [0.015, 0.015, 0.015] }));
  editOne(map, "leftHipPivot", (node) => setNode(node, { translation: [-0.12, 0, -0.04] }));
  editOne(map, "rightHipPivot", (node) => setNode(node, { translation: [0.12, 0, -0.04] }));
  editOne(map, "stun-probe", (node) =>
    setNode(node, { translation: [0, 0.94, 0.52], rotation: quatFromEuler(Math.PI / 2, 0, 0), scale: [0.26, 0.22, 0.28] }),
  );
}

function refineClampRepair(json) {
  const map = nodesByName(json);
  editOne(map, "torso_control", (node) => setNode(node, { translation: [0, 1.72, 0], scale: [1.82, 0.74, 1.54] }));
  editOne(map, "chestPivot", (node) => setNode(node, { rotation: quatFromEuler(-0.04, 0, 0) }));
  editOne(map, "part_head", (node) => setNode(node, { translation: [0, 2.2, 0.08], scale: [1.12, 0.64, 1.02] }));
  editOne(map, "part_backpack", (node) => setNode(node, { translation: [0, -0.08, 0], scale: [1.62, 0.88, 1.42] }));

  editOne(map, "leftShoulderPivot", (node) => setNode(node, { translation: [-1.64, 1.72, 0.05] }));
  editOne(map, "rightShoulderPivot", (node) => setNode(node, { translation: [1.64, 1.72, 0.05] }));
  editOne(map, "part_arm_l", (node) => setNode(node, { scale: [1.34, 0.86, 1.16] }));
  editOne(map, "part_arm_r", (node) => setNode(node, { scale: [1.34, 0.86, 1.16] }));
  editOne(map, "part_forearm_l", (node) => setNode(node, { translation: [0, -0.7, 0.08], scale: [1.46, 0.96, 1.26] }));
  editOne(map, "part_forearm_r", (node) => setNode(node, { translation: [0, -0.7, 0.08], scale: [1.46, 0.96, 1.26] }));
  editOne(map, "left-utility-hand", (node) => setNode(node, { translation: [0, -0.58, 0.16], scale: [1.44, 1.08, 1.34] }));
  editOne(map, "right-utility-hand", (node) => setNode(node, { translation: [0, -0.58, 0.16], scale: [1.44, 1.08, 1.34] }));

  editOne(map, "pelvisPivot", (node) => setNode(node, { translation: [0, 0.78, 0], scale: [1.66, 0.92, 1.38] }));
  editOne(map, "leftHipPivot", (node) => setNode(node, { translation: [-0.82, 0, 0.02] }));
  editOne(map, "rightHipPivot", (node) => setNode(node, { translation: [0.82, 0, 0.02] }));
  editOne(map, "part_leg_l", (node) => setNode(node, { scale: [1.34, 0.68, 1.2] }));
  editOne(map, "part_leg_r", (node) => setNode(node, { scale: [1.34, 0.68, 1.2] }));
  editOne(map, "leftKneePivot", (node) => setNode(node, { translation: [0, -0.82, 0.02] }));
  editOne(map, "rightKneePivot", (node) => setNode(node, { translation: [0, -0.82, 0.02] }));
  editOne(map, "leftAnklePivot", (node) => setNode(node, { translation: [0, -0.62, 0.34] }));
  editOne(map, "rightAnklePivot", (node) => setNode(node, { translation: [0, -0.62, 0.34] }));
  editOne(map, "service-cutter", (node) => setNode(node, { translation: [0, 0.1, 0.12], scale: [1.28, 0.88, 1.16] }));
}

function refineHeavyCustodian(json) {
  const map = nodesByName(json);
  editIfPresent(map, "torso_control", (node) => setNode(node, { scale: [1.22, 1.02, 1.18] }));
  editIfPresent(map, "part_leg_l", (node) => setNode(node, { scale: [1.2, 1.06, 1.08] }));
  editIfPresent(map, "part_leg_r", (node) => setNode(node, { scale: [1.2, 1.06, 1.08] }));
  editIfPresent(map, "leftAnklePivot", (node) => setNode(node, { translation: [0, -1.02, 0.28] }));
  editIfPresent(map, "rightAnklePivot", (node) => setNode(node, { translation: [0, -1.02, 0.28] }));
  editIfPresent(map, "part_foot_l", (node) => setNode(node, { scale: [0.68, 0.72, 0.62] }));
  editIfPresent(map, "part_foot_r", (node) => setNode(node, { scale: [0.68, 0.72, 0.62] }));
  editIfPresent(map, "utility-wrench", (node) =>
    setNode(node, {
      translation: [0.88, 0.82, -0.46],
      rotation: quatFromEuler(0.22, 0.06, -0.34),
      scale: [0.76, 0.74, 0.76],
    }),
  );
  editIfPresent(map, "utility-wrench-handle", (node) => setNode(node, { scale: [0.82, 0.92, 0.82] }));
  removeAnimationChannelsForNode(json, "utility-wrench");
  editIfPresent(map, "left-utility-hand", (node) => setNode(node, { scale: [1.18, 1.08, 1.18] }));
  editIfPresent(map, "right-utility-hand", (node) => setNode(node, { scale: [1.18, 1.08, 1.18] }));
}

const refinements = [
  ["hp_enemy_repair_drone_horror.glb", refineRepairDrone],
  ["hp_enemy_clamp_repair_horror.glb", refineClampRepair],
  ["hp_enemy_shield_technician_horror.glb", null],
  ["hp_enemy_custodian_foreman_horror.glb", refineHeavyCustodian],
  ["hp_enemy_reclamation_mother_final_horror.glb", refineHeavyCustodian],
];

for (const [fileName, refine] of refinements) {
  const filePath = join(enemyRoot, fileName);
  const { chunks, json } = readGlb(filePath);
  repaletteEscapeRoomRobot(json);
  refine?.(json);
  writeGlb(filePath, chunks, json);
  console.log(`refined ${fileName}`);
}
