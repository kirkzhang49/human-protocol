#!/usr/bin/env node
// Trial exhibit anchors for Level 03 Human Museum.
//
// These are deliberately small, deterministic GLBs: enough real geometry to
// judge silhouette and placement. The voice/body cases are then overwritten by
// the Blender transparent-cabinet bake below so rerunning this script cannot
// leave old flat backplates in the final GLBs.
// Run from games/human-protocol:
//   node scripts/asset-build/generate-level03-exhibit-trial-assets.mjs

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  AdditiveBlending,
  Box3,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class NodeFileReader {
    result = null;
    onloadend = null;

    async readAsArrayBuffer(blob) {
      this.result = await blob.arrayBuffer();
      this.onloadend?.();
    }
  };
}

const root = process.cwd();
const outRoot = join(root, "src/assets/models-cooked/environment/level03");
mkdirSync(outRoot, { recursive: true });
const image2HeroExhibitsBakeScript = join(root, "scripts/asset-build/blender-bake-level03-hero-exhibits-image2.py");
const realToolVitrineBakeScript = join(root, "scripts/asset-build/blender-bake-level03-real-tool-vitrine.py");
const shouldRebakeToolVitrine = process.env.HP_REBAKE_LEVEL03_TOOL_VITRINE === "1";

const M = {
  black: new MeshStandardMaterial({
    name: "l3_exhibit_smoked_black_metal",
    color: "#101719",
    roughness: 0.46,
    metalness: 0.72,
  }),
  body: new MeshStandardMaterial({
    name: "l3_exhibit_powdercoat_body",
    color: "#152123",
    roughness: 0.62,
    metalness: 0.38,
  }),
  brass: new MeshStandardMaterial({
    name: "l3_exhibit_aged_brass",
    color: "#b29358",
    roughness: 0.34,
    metalness: 0.82,
  }),
  bone: new MeshStandardMaterial({
    name: "l3_exhibit_preserved_bone",
    color: "#d8d0bd",
    roughness: 0.58,
    metalness: 0.04,
  }),
  toolDark: new MeshStandardMaterial({
    name: "l3_exhibit_battleworn_tool_metal",
    color: "#273032",
    roughness: 0.52,
    metalness: 0.84,
  }),
  rubber: new MeshStandardMaterial({
    name: "l3_exhibit_dark_rubber",
    color: "#070a0a",
    roughness: 0.84,
    metalness: 0.02,
  }),
  glass: new MeshStandardMaterial({
    name: "l3_exhibit_thick_cyan_glass",
    color: "#a9eef2",
    roughness: 0.08,
    metalness: 0.02,
    transparent: true,
    opacity: 0.26,
    emissive: "#123d42",
    emissiveIntensity: 0.12,
    side: DoubleSide,
  }),
  darkGlass: new MeshStandardMaterial({
    name: "l3_exhibit_smoked_glass",
    color: "#071113",
    roughness: 0.18,
    metalness: 0.35,
    transparent: true,
    opacity: 0.64,
    emissive: "#09262b",
    emissiveIntensity: 0.16,
    side: DoubleSide,
  }),
  cyan: new MeshBasicMaterial({
    name: "l3_exhibit_cyan_light",
    color: "#7ff2ff",
    transparent: true,
    opacity: 0.78,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
  amber: new MeshBasicMaterial({
    name: "l3_exhibit_amber_light",
    color: "#ffd36d",
    transparent: true,
    opacity: 0.76,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
  red: new MeshBasicMaterial({
    name: "l3_exhibit_red_pin_light",
    color: "#ff675b",
    transparent: true,
    opacity: 0.58,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
  shadow: new MeshBasicMaterial({
    name: "l3_exhibit_contact_shadow",
    color: "#010304",
    transparent: true,
    opacity: 0.34,
    side: DoubleSide,
  }),
};

function sceneRoot(name) {
  const scene = new Scene();
  scene.name = name;
  return scene;
}

function box(scene, name, size, position, material, rotation = [0, 0, 0], castShadow = true) {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function cyl(scene, name, radiusTop, radiusBottom, height, position, material, rotation = [0, 0, 0], segments = 20) {
  const mesh = new Mesh(new CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function sphere(scene, name, radius, position, material, scale = [1, 1, 1]) {
  const mesh = new Mesh(new SphereGeometry(radius, 20, 12), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function torus(scene, name, radius, tube, position, material, rotation = [0, 0, 0], radialSegments = 28) {
  const mesh = new Mesh(new TorusGeometry(radius, tube, 8, radialSegments), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function shadow(scene, w, d) {
  const mesh = new Mesh(new PlaneGeometry(w, d), M.shadow);
  mesh.name = "contact_shadow";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  scene.add(mesh);
}

function vitrineShell(scene, prefix, w, h, d) {
  box(scene, `${prefix}_lower_plinth`, [w, 0.18, d], [0, 0.09, 0], M.black);
  box(scene, `${prefix}_upper_cap`, [w, 0.16, d], [0, h - 0.08, 0], M.black);
  box(scene, `${prefix}_rear_smoked_back`, [w - 0.14, h - 0.32, 0.045], [0, h * 0.5, -d * 0.5 + 0.04], M.darkGlass);
  box(scene, `${prefix}_front_glass`, [w - 0.2, h - 0.36, 0.035], [0, h * 0.5, d * 0.5 - 0.025], M.glass);
  box(scene, `${prefix}_left_glass`, [0.035, h - 0.36, d - 0.18], [-w * 0.5 + 0.025, h * 0.5, 0], M.glass);
  box(scene, `${prefix}_right_glass`, [0.035, h - 0.36, d - 0.18], [w * 0.5 - 0.025, h * 0.5, 0], M.glass);
  for (const x of [-w * 0.5 + 0.045, w * 0.5 - 0.045]) {
    for (const z of [-d * 0.5 + 0.045, d * 0.5 - 0.045]) {
      box(scene, `${prefix}_brass_corner_${x}_${z}`, [0.065, h, 0.065], [x, h * 0.5, z], M.brass);
    }
  }
  box(scene, `${prefix}_cyan_floor_line`, [w - 0.28, 0.025, 0.025], [0, 0.24, d * 0.5 - 0.08], M.cyan);
  box(scene, `${prefix}_amber_label_slot`, [w * 0.36, 0.04, 0.018], [0, 0.34, d * 0.5 - 0.045], M.amber);
}

function museumVoiceArchiveCase() {
  const s = sceneRoot("room_museum_voice_archive_case");
  shadow(s, 1.42, 0.92);
  vitrineShell(s, "voice_case", 1.28, 1.72, 0.72);
  // Reconstructed voice: a horn, two reels, waveform rails, and a mic capsule.
  torus(s, "brass_horn_outer_ring", 0.22, 0.025, [-0.22, 1.02, 0.12], M.brass, [Math.PI / 2, 0, 0], 36);
  torus(s, "cyan_horn_inner_lens", 0.14, 0.018, [-0.22, 1.02, 0.145], M.cyan, [Math.PI / 2, 0, 0], 32);
  cyl(s, "horn_throat", 0.055, 0.11, 0.28, [-0.22, 1.02, -0.02], M.brass, [Math.PI / 2, 0, 0], 24);
  for (const x of [0.18, 0.42]) {
    cyl(s, `reel_${x}`, 0.12, 0.12, 0.04, [x, 1.15, 0.1], M.toolDark, [Math.PI / 2, 0, 0], 28);
    torus(s, `reel_cyan_tick_${x}`, 0.13, 0.008, [x, 1.15, 0.13], M.cyan, [Math.PI / 2, 0, 0], 28);
  }
  box(s, "tape_bridge", [0.34, 0.018, 0.02], [0.3, 1.15, 0.145], M.amber);
  for (let i = 0; i < 7; i += 1) {
    const x = -0.42 + i * 0.14;
    const y = 0.62 + Math.sin(i * 1.7) * 0.075;
    box(s, `waveform_bar_${i}`, [0.045, 0.18 + (i % 3) * 0.06, 0.018], [x, y, 0.19], i % 2 ? M.cyan : M.amber);
  }
  cyl(s, "mic_capsule", 0.08, 0.08, 0.22, [0.08, 0.72, 0.12], M.black, [Math.PI / 2, 0, 0], 24);
  box(s, "mic_slot_glow", [0.11, 0.02, 0.014], [0.08, 0.72, 0.25], M.cyan);
  box(s, "locked_sample_red_pin", [0.042, 0.042, 0.018], [0.48, 0.44, 0.34], M.red);
  return s;
}

function museumSkeletonVitrine() {
  const s = sceneRoot("room_museum_skeleton_vitrine");
  shadow(s, 1.62, 0.9);
  vitrineShell(s, "skeleton_case", 1.42, 2.12, 0.76);
  // A simplified, readable skeleton suspended inside a real cabinet.
  sphere(s, "skull", 0.13, [0, 1.68, 0.08], M.bone, [0.86, 1.05, 0.78]);
  cyl(s, "spine_core", 0.035, 0.035, 0.66, [0, 1.28, 0.06], M.bone, [0, 0, 0], 12);
  for (let i = 0; i < 5; i += 1) {
    const y = 1.48 - i * 0.09;
    box(s, `rib_left_${i}`, [0.3 - i * 0.022, 0.018, 0.025], [-0.14, y, 0.075], M.bone, [0, 0, 0.26]);
    box(s, `rib_right_${i}`, [0.3 - i * 0.022, 0.018, 0.025], [0.14, y, 0.075], M.bone, [0, 0, -0.26]);
  }
  box(s, "pelvis_bar", [0.38, 0.05, 0.08], [0, 0.92, 0.07], M.bone);
  for (const side of [-1, 1]) {
    cyl(s, `upper_arm_${side}`, 0.024, 0.024, 0.42, [side * 0.31, 1.28, 0.06], M.bone, [0.22, 0, side * 0.3], 10);
    cyl(s, `forearm_${side}`, 0.021, 0.021, 0.38, [side * 0.43, 1.02, 0.06], M.bone, [-0.1, 0, side * -0.18], 10);
    cyl(s, `thigh_${side}`, 0.027, 0.027, 0.48, [side * 0.13, 0.66, 0.06], M.bone, [0.05, 0, side * 0.08], 10);
    cyl(s, `shin_${side}`, 0.024, 0.024, 0.48, [side * 0.15, 0.3, 0.06], M.bone, [-0.02, 0, side * -0.05], 10);
  }
  box(s, "cyan_vital_scan_line", [1.0, 0.018, 0.018], [0, 1.46, 0.32], M.cyan);
  box(s, "amber_accession_plate", [0.42, 0.04, 0.018], [0, 0.28, 0.35], M.amber);
  return s;
}

function museumLastHumanToolVitrine() {
  const s = sceneRoot("room_museum_last_human_tool_vitrine");
  shadow(s, 2.1, 0.9);
  vitrineShell(s, "tool_case", 1.92, 1.18, 0.7);
  // Prototype silhouettes. Later pass can replace these with baked viewmodel poses.
  cyl(s, "iron_rod_exhibit", 0.035, 0.035, 1.28, [-0.34, 0.68, 0.08], M.toolDark, [0.08, 0.46, Math.PI / 2], 12);
  box(s, "iron_rod_grip", [0.2, 0.055, 0.055], [-0.82, 0.57, 0.08], M.rubber, [0, 0.46, 0]);
  box(s, "sidearm_slide", [0.42, 0.11, 0.16], [0.42, 0.74, 0.08], M.toolDark, [0, -0.22, 0]);
  box(s, "sidearm_grip", [0.14, 0.26, 0.13], [0.58, 0.52, 0.08], M.rubber, [0, -0.22, -0.22]);
  box(s, "sidearm_trigger_guard", [0.12, 0.08, 0.028], [0.36, 0.58, 0.19], M.brass, [0, -0.22, 0]);
  box(s, "rod_shadow_groove", [1.36, 0.028, 0.02], [-0.34, 0.42, 0.31], M.amber);
  box(s, "sidearm_shadow_groove", [0.58, 0.028, 0.02], [0.48, 0.42, 0.31], M.cyan);
  box(s, "tool_case_status_pin", [0.05, 0.05, 0.018], [0.78, 0.32, 0.34], M.red);
  return s;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function exportGlb(scene, filePath) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      scene,
      (gltf) => {
        writeFileSync(filePath, Buffer.from(gltf));
        resolve();
      },
      reject,
      { binary: true },
    );
  });
}

const assets = [
  ["room_museum_voice_archive_case", museumVoiceArchiveCase],
  ["room_museum_skeleton_vitrine", museumSkeletonVitrine],
];

for (const [modelKey, build] of assets) {
  const scene = build();
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  await exportGlb(scene, join(outRoot, `hp_${modelKey}.glb`));
  console.log(`built ${modelKey} [${round3(size.x)} x ${round3(size.y)} x ${round3(size.z)}]`);
}

bakeTransparentHeroExhibits();
if (shouldRebakeToolVitrine) {
  bakeRealToolVitrine();
} else {
  console.log("skipped room_museum_last_human_tool_vitrine; set HP_REBAKE_LEVEL03_TOOL_VITRINE=1 to rebake frozen weapon/tool cabinet");
}

function bakeTransparentHeroExhibits() {
  const blender = findBlender();
  const result = spawnSync(blender, ["--background", "--python", image2HeroExhibitsBakeScript], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`transparent hero exhibit Blender bake failed with status ${result.status ?? "signal"}`);
  }
}

function bakeRealToolVitrine() {
  const blender = findBlender();
  const result = spawnSync(blender, ["--background", "--python", realToolVitrineBakeScript], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`real tool vitrine Blender bake failed with status ${result.status ?? "signal"}`);
  }
}

function findBlender() {
  const blender = [
    process.env.BLENDER,
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "blender",
  ].filter(Boolean).find((candidate) => candidate === "blender" || existsSync(candidate));
  if (!blender) {
    throw new Error("Blender is required to bake the Level 3 hero exhibit GLBs.");
  }
  return blender;
}
