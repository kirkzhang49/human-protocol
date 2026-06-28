// Human Protocol official remaster batch-01 — hand-directed prop pack for the
// remastered official campaign 1-5.
//
// Five themes, eight playable props each (no auto-rig sampling): maintenance
// horror, false residential, human museum, memory clinic, reclamation core.
// Silhouette and material contrast over poly count; every prop has a readable
// in-level purpose. Output: GLBs under
// src/assets/models-cooked/environment/hp-official-remaster-batch01/ plus an
// hp.builder.assetPack.v1 manifest for the existing ingest pipeline.
//
// Run: node scripts/asset-build/generate-hp-official-remaster-batch01.mjs
import { mkdirSync, writeFileSync } from "node:fs";
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
const cookedModelRoot = join(root, "src/assets/models-cooked/environment/hp-official-remaster-batch01");
const manifestPath = join(root, "src/assets/manifests/builder/hp_official_remaster_batch01_v1.json");
mkdirSync(cookedModelRoot, { recursive: true });

const M = {
  // shared
  steel: new MeshStandardMaterial({ name: "rm_joint_steel", color: "#69777b", roughness: 0.42, metalness: 0.74 }),
  darkSteel: new MeshStandardMaterial({ name: "rm_dark_steel", color: "#1a2023", roughness: 0.5, metalness: 0.7 }),
  wetBase: new MeshStandardMaterial({ name: "rm_wet_floor_base", color: "#1b2125", roughness: 0.28, metalness: 0.38 }),
  copper: new MeshStandardMaterial({ name: "rm_cable_copper", color: "#b87b4a", roughness: 0.4, metalness: 0.7 }),
  rust: new MeshStandardMaterial({ name: "rm_rust_patina", color: "#6e4a32", roughness: 0.82, metalness: 0.2 }),
  glass: new MeshStandardMaterial({ name: "rm_case_glass", color: "#9adfe6", roughness: 0.14, metalness: 0.02, transparent: true, opacity: 0.28, emissive: "#16555c", emissiveIntensity: 0.12 }),
  blackGlass: new MeshStandardMaterial({ name: "rm_black_screen_glass", color: "#05080b", roughness: 0.22, metalness: 0.45, emissive: "#0b2025", emissiveIntensity: 0.12 }),
  cyan: new MeshBasicMaterial({ name: "rm_cyan_light", color: "#7ff2ff", transparent: true, opacity: 0.84, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  amber: new MeshBasicMaterial({ name: "rm_amber_light", color: "#ffd36d", transparent: true, opacity: 0.74, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  red: new MeshBasicMaterial({ name: "rm_red_danger", color: "#ff5b4c", transparent: true, opacity: 0.66, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  green: new MeshBasicMaterial({ name: "rm_vitals_green", color: "#7dffb8", transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  shadow: new MeshBasicMaterial({ name: "rm_contact_shadow", color: "#020305", transparent: true, opacity: 0.3, side: DoubleSide }),
  // maintenance
  hazardPaint: new MeshStandardMaterial({ name: "rm_hazard_yellow_paint", color: "#c9a13b", roughness: 0.58, metalness: 0.26 }),
  // residential
  warmWood: new MeshStandardMaterial({ name: "rm_warm_wood", color: "#7a5a3e", roughness: 0.62, metalness: 0.06 }),
  fabric: new MeshStandardMaterial({ name: "rm_beige_fabric", color: "#c9b89a", roughness: 0.84, metalness: 0.02 }),
  showWhite: new MeshStandardMaterial({ name: "rm_showroom_white", color: "#e8e2d6", roughness: 0.6, metalness: 0.05 }),
  // museum
  darkWood: new MeshStandardMaterial({ name: "rm_museum_dark_wood", color: "#4a3527", roughness: 0.58, metalness: 0.08 }),
  brass: new MeshStandardMaterial({ name: "rm_museum_brass", color: "#a8864e", roughness: 0.34, metalness: 0.8 }),
  marble: new MeshStandardMaterial({ name: "rm_museum_stone", color: "#b8b2a6", roughness: 0.5, metalness: 0.06 }),
  // clinic
  shell: new MeshStandardMaterial({ name: "rm_clinic_shell", color: "#d8e3e2", roughness: 0.56, metalness: 0.18 }),
  blueFabric: new MeshStandardMaterial({ name: "rm_clinic_blue_fabric", color: "#5b7d8c", roughness: 0.78, metalness: 0.04 }),
  curtain: new MeshStandardMaterial({ name: "rm_clinic_curtain_cloth", color: "#aebfb9", roughness: 0.88, metalness: 0.0, side: DoubleSide }),
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

function cyl(scene, name, radiusTop, radiusBottom, height, position, material, rotation = [0, 0, 0], segments = 16, castShadow = true) {
  const mesh = new Mesh(new CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addShadow(scene, width, depth) {
  const mesh = new Mesh(new PlaneGeometry(width, depth), M.shadow);
  mesh.name = "contact_shadow";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  scene.add(mesh);
}

function strip(scene, name, size, position, material, rotation = [0, 0, 0]) {
  return box(scene, name, size, position, material, rotation, false);
}

// ---------------------------------------------------------------------------
// 重制维修 — maintenance horror
// ---------------------------------------------------------------------------

/** Broken repair cradle: one leg collapsed, straps torn, spine cables spilling. */
function maintBrokenCradle() {
  const s = sceneRoot("room_rm_maint_broken_cradle");
  addShadow(s, 2.4, 1.5);
  box(s, "cradle_bed", [0.96, 0.16, 2.1], [0, 0.66, 0], M.darkSteel, [0, 0, -0.16]);
  box(s, "leg_intact", [0.14, 0.62, 0.14], [0.42, 0.31, -0.84], M.steel);
  box(s, "leg_intact_b", [0.14, 0.62, 0.14], [0.42, 0.31, 0.84], M.steel);
  box(s, "leg_collapsed", [0.14, 0.34, 0.14], [-0.46, 0.17, 0.8], M.rust, [0, 0, 0.5]);
  box(s, "headrest_plate", [0.5, 0.06, 0.34], [0.06, 0.82, -0.86], M.hazardPaint, [0, 0, -0.16]);
  for (const [z, lean] of [[-0.4, 0.4], [0.1, -0.6], [0.6, 0.3]]) {
    box(s, `strap_stub_${z}`, [0.08, 0.22, 0.05], [0.5, 0.74 + lean * 0.05, z], M.rust, [lean, 0, 0.3]);
  }
  cyl(s, "spill_cable_a", 0.035, 0.035, 1.1, [-0.62, 0.18, -0.3], M.copper, [0.3, 0.5, Math.PI / 2.4], 8);
  cyl(s, "spill_cable_b", 0.03, 0.03, 0.9, [-0.7, 0.12, 0.4], M.copper, [-0.2, -0.4, Math.PI / 2.2], 8);
  strip(s, "vitals_dead_line", [0.4, 0.03, 0.02], [0.06, 0.86, -0.84], M.red, [0, 0, -0.16]);
  return s;
}

/** Cable spine: vertebra-ribbed floor conduit — the room's anatomy joke is intentional. */
function maintCableSpine() {
  const s = sceneRoot("room_rm_maint_cable_spine");
  addShadow(s, 2.6, 0.7);
  cyl(s, "spine_core", 0.1, 0.1, 2.4, [0, 0.14, 0], M.darkSteel, [0, 0, Math.PI / 2], 12);
  for (let i = 0; i < 6; i += 1) {
    box(s, `vertebra_${i}`, [0.1, 0.3, 0.4], [-1.0 + i * 0.4, 0.15, 0], M.steel);
  }
  cyl(s, "branch_cable", 0.035, 0.035, 0.8, [0.9, 0.06, 0.34], M.copper, [0, 0.7, Math.PI / 2], 8);
  strip(s, "pulse_line", [2.3, 0.02, 0.04], [0, 0.26, 0], M.cyan);
  strip(s, "tag_amber", [0.12, 0.06, 0.02], [-1.1, 0.3, 0.1], M.amber);
  return s;
}

/** Weapon cradle: angled rack with two empty molded slots — a rod and a sidearm. */
function maintWeaponCradle() {
  const s = sceneRoot("room_rm_maint_weapon_cradle");
  addShadow(s, 1.3, 0.9);
  box(s, "base_plinth", [1.1, 0.18, 0.7], [0, 0.09, 0], M.wetBase);
  box(s, "rack_slope", [1.04, 0.08, 0.62], [0, 0.62, 0], M.darkSteel, [-0.5, 0, 0]);
  box(s, "rack_legs", [0.9, 0.42, 0.1], [0, 0.32, -0.2], M.steel);
  // molded silhouettes: long rod groove + pistol pocket
  box(s, "rod_mold", [0.74, 0.03, 0.1], [-0.06, 0.69, 0.06], M.hazardPaint, [-0.5, 0, 0]);
  box(s, "pistol_mold_grip", [0.1, 0.03, 0.16], [0.34, 0.66, 0.12], M.hazardPaint, [-0.5, 0, 0]);
  box(s, "pistol_mold_slide", [0.2, 0.03, 0.08], [0.32, 0.7, 0.0], M.hazardPaint, [-0.5, 0, 0]);
  strip(s, "claim_lamp", [0.06, 0.06, 0.02], [0.46, 0.84, -0.12], M.amber);
  strip(s, "label_strip", [0.5, 0.05, 0.01], [-0.18, 0.5, 0.32], M.cyan, [-0.5, 0, 0]);
  return s;
}

/** Battery rack: charging wall of cells, one slot conspicuously empty. */
function maintBatteryRack() {
  const s = sceneRoot("room_rm_maint_battery_rack");
  addShadow(s, 1.1, 0.7);
  box(s, "rack_frame", [0.92, 1.56, 0.5], [0, 0.78, 0], M.darkSteel);
  box(s, "rack_back", [0.92, 1.56, 0.05], [0, 0.78, -0.24], M.hazardPaint);
  const slots = [
    [-0.26, 0.5, true],
    [0.26, 0.5, true],
    [-0.26, 1.06, true],
    [0.26, 1.06, false], // the missing one
  ];
  for (const [x, y, filled] of slots) {
    box(s, `slot_${x}_${y}`, [0.34, 0.4, 0.3], [x, y, 0.04], M.steel);
    if (filled) {
      cyl(s, `cell_${x}_${y}`, 0.1, 0.1, 0.3, [x, y, 0.12], M.darkSteel, [Math.PI / 2, 0, 0], 12);
      strip(s, `cell_glow_${x}_${y}`, [0.05, 0.05, 0.02], [x, y + 0.14, 0.24], M.cyan);
    } else {
      strip(s, "empty_slot_red", [0.05, 0.05, 0.02], [x, y + 0.14, 0.24], M.red);
    }
  }
  strip(s, "rack_header", [0.8, 0.05, 0.02], [0, 1.48, 0.26], M.amber);
  return s;
}

/** Pressure door console: lever, bolt wheel, big state lamp — the exit's voice. */
function maintDoorConsole() {
  const s = sceneRoot("room_rm_maint_door_console");
  addShadow(s, 1.2, 0.9);
  box(s, "console_body", [0.96, 0.98, 0.6], [0, 0.49, 0], M.darkSteel);
  box(s, "console_slope", [0.96, 0.07, 0.5], [0, 1.02, 0.06], M.hazardPaint, [-0.36, 0, 0]);
  cyl(s, "bolt_wheel", 0.18, 0.18, 0.06, [-0.24, 1.1, 0.18], M.steel, [Math.PI / 2 - 0.36, 0, 0], 16);
  cyl(s, "wheel_hub", 0.05, 0.05, 0.1, [-0.24, 1.11, 0.2], M.rust, [Math.PI / 2 - 0.36, 0, 0], 10);
  box(s, "lever_base", [0.16, 0.06, 0.12], [0.26, 1.06, 0.16], M.steel, [-0.36, 0, 0]);
  box(s, "lever_arm", [0.05, 0.3, 0.05], [0.28, 1.2, 0.1], M.hazardPaint, [-0.7, 0, 0.1]);
  cyl(s, "state_lamp", 0.07, 0.07, 0.05, [0, 1.3, -0.12], M.steel, [Math.PI / 2, 0, 0], 12);
  strip(s, "state_lamp_red", [0.09, 0.09, 0.02], [0, 1.3, -0.08], M.red);
  strip(s, "load_meter", [0.4, 0.04, 0.02], [0, 0.74, 0.31], M.cyan);
  return s;
}

/** Tool peg wall: painted silhouettes, half the tools gone — someone armed themselves first. */
function maintToolWall() {
  const s = sceneRoot("room_rm_maint_tool_wall");
  box(s, "peg_board", [1.8, 1.2, 0.06], [0, 0.6, 0], M.darkSteel);
  box(s, "board_frame", [1.88, 0.05, 0.09], [0, 1.22, 0], M.hazardPaint);
  // painted silhouettes (always there)
  strip(s, "silhouette_wrench", [0.1, 0.5, 0.015], [-0.62, 0.66, 0.035], M.amber, [0, 0, 0.2]);
  strip(s, "silhouette_cutter", [0.34, 0.1, 0.015], [-0.1, 0.86, 0.035], M.amber, [0, 0, -0.1]);
  strip(s, "silhouette_rod", [0.08, 0.62, 0.015], [0.36, 0.6, 0.035], M.amber, [0, 0, 0.12]);
  strip(s, "silhouette_saw", [0.4, 0.12, 0.015], [0.62, 0.36, 0.035], M.amber, [0, 0, 0.3]);
  // only some real tools remain
  box(s, "real_cutter", [0.32, 0.09, 0.05], [-0.1, 0.86, 0.06], M.steel, [0, 0, -0.1]);
  box(s, "real_saw_blade", [0.36, 0.1, 0.03], [0.62, 0.36, 0.055], M.rust, [0, 0, 0.3]);
  strip(s, "missing_tag_a", [0.05, 0.05, 0.015], [-0.62, 0.94, 0.04], M.red);
  strip(s, "missing_tag_b", [0.05, 0.05, 0.015], [0.36, 0.96, 0.04], M.red);
  return s;
}

/** Coolant drum cluster: three strapped drums, one bleeding a glow line into the floor. */
function maintCoolantDrums() {
  const s = sceneRoot("room_rm_maint_coolant_drums");
  addShadow(s, 1.5, 1.2);
  cyl(s, "drum_a", 0.3, 0.3, 0.92, [-0.36, 0.46, 0.1], M.hazardPaint, [0, 0, 0], 16);
  cyl(s, "drum_b", 0.3, 0.3, 0.92, [0.34, 0.46, -0.2], M.darkSteel, [0, 0, 0], 16);
  cyl(s, "drum_leaning", 0.3, 0.3, 0.92, [0.28, 0.42, 0.5], M.rust, [0.18, 0, -0.22], 16);
  box(s, "strap_band", [1.16, 0.07, 0.04], [0, 0.62, 0.16], M.steel, [0, 0.18, 0]);
  strip(s, "drum_a_band", [0.04, 0.05, 0.61], [-0.36, 0.66, 0.1], M.cyan);
  strip(s, "leak_glow", [0.5, 0.015, 0.1], [0.6, 0.02, 0.72], M.green, [0, 0.5, 0]);
  return s;
}

/** Gantry hoist: short A-frame with chain hook — what carried the bodies in. */
function maintGantryHoist() {
  const s = sceneRoot("room_rm_maint_gantry_hoist");
  addShadow(s, 1.7, 1.1);
  box(s, "a_leg_left", [0.12, 2.0, 0.12], [-0.7, 1.0, 0], M.steel, [0, 0, 0.12]);
  box(s, "a_leg_right", [0.12, 2.0, 0.12], [0.7, 1.0, 0], M.steel, [0, 0, -0.12]);
  box(s, "cross_beam", [1.7, 0.14, 0.14], [0, 1.98, 0], M.hazardPaint);
  box(s, "trolley", [0.26, 0.12, 0.2], [-0.12, 1.86, 0], M.darkSteel);
  cyl(s, "chain_fall", 0.025, 0.025, 0.9, [-0.12, 1.36, 0], M.steel, [0, 0, 0], 8);
  box(s, "hook", [0.07, 0.18, 0.05], [-0.12, 0.84, 0.02], M.rust, [0, 0, 0.5]);
  strip(s, "load_tag", [0.18, 0.07, 0.02], [0.5, 1.9, 0.09], M.amber);
  return s;
}

// ---------------------------------------------------------------------------
// 重制居住 — false residential
// ---------------------------------------------------------------------------

/** Fake family table: set for four, plates empty, one chair pulled out forever. */
function homeFamilyTable() {
  const s = sceneRoot("room_rm_home_family_table");
  addShadow(s, 2.2, 1.7);
  box(s, "table_top", [1.6, 0.07, 1.0], [0, 0.74, 0], M.warmWood);
  for (const [x, z] of [[-0.68, -0.4], [0.68, -0.4], [-0.68, 0.4], [0.68, 0.4]]) {
    box(s, `table_leg_${x}_${z}`, [0.08, 0.72, 0.08], [x, 0.36, z], M.warmWood);
  }
  for (const [x, z] of [[-0.4, -0.22], [0.4, -0.22], [-0.4, 0.26], [0.4, 0.26]]) {
    cyl(s, `plate_${x}_${z}`, 0.13, 0.13, 0.02, [x, 0.79, z], M.showWhite, [0, 0, 0], 16, false);
  }
  // chairs: three tucked, one pulled and angled
  for (const [x, z, yaw, pulled] of [[-0.62, -0.86, 0, false], [0.62, -0.86, 0, false], [-0.62, 0.86, Math.PI, false], [0.95, 1.05, Math.PI + 0.6, true]]) {
    box(s, `chair_seat_${x}_${z}`, [0.42, 0.06, 0.42], [x, 0.45, z], pulled ? M.fabric : M.warmWood, [0, yaw, 0]);
    box(s, `chair_back_${x}_${z}`, [0.42, 0.5, 0.05], [x - Math.sin(yaw) * 0.2, 0.72, z - Math.cos(yaw) * 0.2], M.warmWood, [0, yaw, 0]);
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
      box(s, `chair_leg_${x}_${z}_${lx}_${lz}`, [0.05, 0.44, 0.05], [x + lx, 0.22, z + lz], M.warmWood, [0, yaw, 0]);
    }
  }
  strip(s, "centerpiece_glow", [0.16, 0.04, 0.16], [0, 0.8, 0], M.amber);
  return s;
}

/** Observation sofa: a comfy couch with a sensor bar where the antimacassar should be. */
function homeObservationSofa() {
  const s = sceneRoot("room_rm_home_observation_sofa");
  addShadow(s, 2.3, 1.2);
  box(s, "sofa_base", [1.9, 0.42, 0.86], [0, 0.21, 0], M.warmWood);
  box(s, "sofa_cushion_l", [0.86, 0.18, 0.74], [-0.46, 0.5, 0.02], M.fabric);
  box(s, "sofa_cushion_r", [0.86, 0.18, 0.74], [0.46, 0.5, 0.02], M.fabric);
  box(s, "sofa_back", [1.9, 0.6, 0.2], [0, 0.74, -0.36], M.fabric);
  box(s, "arm_left", [0.2, 0.4, 0.86], [-0.95, 0.62, 0], M.warmWood);
  box(s, "arm_right", [0.2, 0.4, 0.86], [0.95, 0.62, 0], M.warmWood);
  box(s, "sensor_bar", [1.5, 0.07, 0.08], [0, 1.06, -0.38], M.darkSteel);
  for (let i = 0; i < 4; i += 1) {
    strip(s, `sensor_eye_${i}`, [0.04, 0.04, 0.02], [-0.54 + i * 0.36, 1.06, -0.33], i === 2 ? M.red : M.cyan);
  }
  return s;
}

/** Broken TV shrine: cracked dark screen with one stubborn bright scanline. */
function homeTvBrokenShrine() {
  const s = sceneRoot("room_rm_home_tv_shrine_broken");
  addShadow(s, 1.9, 0.9);
  box(s, "wood_console", [1.6, 0.5, 0.52], [0, 0.25, 0], M.warmWood);
  box(s, "console_doors", [1.5, 0.34, 0.04], [0, 0.26, 0.27], M.warmWood);
  box(s, "tv_body", [1.16, 0.74, 0.16], [0, 0.94, -0.06], M.darkSteel);
  box(s, "tv_screen", [1.0, 0.6, 0.03], [0, 0.94, 0.04], M.blackGlass);
  // crack: two thin slabs at angles
  strip(s, "crack_a", [0.5, 0.015, 0.01], [-0.12, 1.02, 0.06], M.cyan, [0, 0, 0.7]);
  strip(s, "crack_b", [0.34, 0.012, 0.01], [0.1, 0.84, 0.06], M.cyan, [0, 0, -0.5]);
  strip(s, "stubborn_scanline", [0.92, 0.02, 0.01], [0, 0.9, 0.062], M.amber);
  strip(s, "standby_dot", [0.04, 0.04, 0.02], [0.5, 0.62, 0.06], M.red);
  cyl(s, "antenna", 0.012, 0.012, 0.5, [0.4, 1.5, -0.1], M.steel, [0, 0, -0.5], 8);
  return s;
}

/** Service wall rupture: wallpaper torn back from a conduit wound (wall module). */
function homeWallRupture() {
  const s = sceneRoot("room_rm_home_wall_rupture");
  box(s, "wall_section", [1.7, 1.5, 0.07], [0, 0.75, 0], M.showWhite);
  // torn wallpaper flaps
  box(s, "flap_left", [0.4, 0.7, 0.02], [-0.5, 0.78, 0.05], M.fabric, [0, 0, 0.3]);
  box(s, "flap_right", [0.34, 0.56, 0.02], [0.46, 0.66, 0.05], M.fabric, [0, 0, -0.4]);
  // the wound: dark cavity with conduit
  box(s, "cavity", [0.66, 0.8, 0.05], [0, 0.72, 0.025], M.darkSteel);
  cyl(s, "conduit_a", 0.045, 0.045, 0.76, [-0.12, 0.72, 0.06], M.copper, [0, 0, 0], 10);
  cyl(s, "conduit_b", 0.035, 0.035, 0.7, [0.12, 0.7, 0.06], M.steel, [0, 0, 0.1], 10);
  strip(s, "live_wire_glow", [0.02, 0.66, 0.02], [0.01, 0.72, 0.08], M.cyan);
  strip(s, "inspection_tag", [0.14, 0.07, 0.015], [0.6, 1.3, 0.05], M.amber);
  return s;
}

/** Memory photo cluster: five frames, one turned to face the wall (wall module). */
function homePhotoCluster() {
  const s = sceneRoot("room_rm_home_photo_cluster");
  box(s, "cluster_rail", [1.8, 0.05, 0.05], [0, 1.18, 0], M.warmWood);
  const frames = [
    [-0.7, 0.84, 0.34, 0.42, 0.04, true],
    [-0.22, 0.94, 0.28, 0.34, -0.05, true],
    [0.2, 0.8, 0.36, 0.44, 0.07, true],
    [0.66, 0.94, 0.26, 0.32, -0.03, true],
    [0.46, 0.46, 0.3, 0.38, 0.12, false], // turned to face the wall
  ];
  frames.forEach(([x, y, w, h, tilt, faceOut], index) => {
    box(s, `frame_${index}`, [w, h, 0.035], [x, y, 0.03], M.warmWood, [0, 0, tilt]);
    box(s, `photo_${index}`, [w - 0.07, h - 0.07, 0.02], [x, y, faceOut ? 0.05 : 0.012], faceOut ? M.blackGlass : M.fabric, [0, 0, tilt]);
  });
  strip(s, "warm_wash", [1.5, 0.03, 0.02], [0, 1.24, 0.04], M.amber);
  return s;
}

/** Fake kitchenette: counter with a glued fruit bowl and a kettle that never boiled. */
function homeKitchenFake() {
  const s = sceneRoot("room_rm_home_kitchen_fake");
  addShadow(s, 1.9, 1.0);
  box(s, "counter_body", [1.6, 0.86, 0.66], [0, 0.43, 0], M.showWhite);
  box(s, "counter_top", [1.68, 0.05, 0.74], [0, 0.88, 0], M.warmWood);
  box(s, "drawer_face_a", [0.7, 0.16, 0.03], [-0.4, 0.62, 0.34], M.showWhite);
  box(s, "drawer_face_b", [0.7, 0.16, 0.03], [0.4, 0.62, 0.34], M.showWhite);
  cyl(s, "fruit_bowl", 0.17, 0.12, 0.1, [-0.42, 0.95, 0.06], M.fabric, [0, 0, 0], 16);
  for (const [x, z] of [[-0.48, 0.02], [-0.36, 0.1], [-0.42, -0.04]]) {
    cyl(s, `fruit_${x}_${z}`, 0.05, 0.05, 0.08, [x, 1.0, z], M.hazardPaint, [0, 0, 0], 10);
  }
  box(s, "kettle_body", [0.2, 0.22, 0.2], [0.5, 1.0, -0.08], M.steel);
  cyl(s, "kettle_spout", 0.025, 0.035, 0.16, [0.64, 1.04, -0.08], M.steel, [0, 0, -1.1], 8);
  strip(s, "glued_label", [0.2, 0.04, 0.015], [-0.42, 0.86, 0.38], M.cyan);
  return s;
}

/** Crib monitor: a child's crib whose mobile arm carries antennae, not toys. */
function homeCribMonitor() {
  const s = sceneRoot("room_rm_home_crib_monitor");
  addShadow(s, 1.5, 1.1);
  box(s, "crib_base", [1.2, 0.1, 0.8], [0, 0.36, 0], M.warmWood);
  box(s, "mattress", [1.1, 0.1, 0.7], [0, 0.44, 0], M.showWhite);
  for (const [x, z] of [[-0.58, -0.38], [0.58, -0.38], [-0.58, 0.38], [0.58, 0.38]]) {
    box(s, `crib_post_${x}_${z}`, [0.07, 0.92, 0.07], [x, 0.46, z], M.warmWood);
  }
  for (let i = 0; i < 7; i += 1) {
    box(s, `rail_bar_front_${i}`, [0.035, 0.5, 0.035], [-0.48 + i * 0.16, 0.66, 0.4], M.warmWood);
  }
  box(s, "rail_top_front", [1.2, 0.06, 0.07], [0, 0.92, 0.4], M.warmWood);
  cyl(s, "mobile_arm", 0.025, 0.025, 0.7, [0.5, 1.22, -0.2], M.steel, [0, 0, -0.7], 8);
  for (const [dx, len] of [[-0.06, 0.18], [0.1, 0.26], [0.24, 0.14]]) {
    cyl(s, `antenna_${dx}`, 0.008, 0.008, len, [0.78 + dx, 1.34 - len / 2, -0.2], M.steel, [0, 0, 0.1], 6);
  }
  strip(s, "monitor_dot", [0.03, 0.03, 0.015], [0.9, 1.42, -0.2], M.red);
  return s;
}

/** Door intercom: speaker grille, call button, an amber light that is always on (wall). */
function homeIntercomPanel() {
  const s = sceneRoot("room_rm_home_intercom_panel");
  box(s, "intercom_plate", [0.4, 0.62, 0.06], [0, 0.31, 0], M.showWhite);
  box(s, "grille_recess", [0.28, 0.22, 0.02], [0, 0.42, 0.035], M.darkSteel);
  for (let i = 0; i < 4; i += 1) {
    strip(s, `grille_slot_${i}`, [0.22, 0.015, 0.01], [0, 0.35 + i * 0.045, 0.05], M.steel);
  }
  cyl(s, "call_button", 0.045, 0.045, 0.03, [0, 0.16, 0.045], M.steel, [Math.PI / 2, 0, 0], 12);
  strip(s, "always_on", [0.05, 0.05, 0.02], [0.12, 0.16, 0.045], M.amber);
  return s;
}

// ---------------------------------------------------------------------------
// 重制博物馆 — human museum
// ---------------------------------------------------------------------------

/** Tall specimen case: brass-framed glass over an empty internal pedestal. */
function museumSpecimenCase() {
  const s = sceneRoot("room_rm_museum_specimen_case");
  addShadow(s, 1.1, 1.1);
  box(s, "case_plinth", [0.92, 0.42, 0.92], [0, 0.21, 0], M.darkWood);
  box(s, "plinth_trim", [1.0, 0.06, 1.0], [0, 0.45, 0], M.brass);
  box(s, "glass_shell", [0.78, 1.4, 0.78], [0, 1.18, 0], M.glass);
  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
    box(s, `corner_rib_${x}_${z}`, [0.05, 1.4, 0.05], [x, 1.18, z], M.brass);
  }
  box(s, "case_cap", [0.9, 0.1, 0.9], [0, 1.93, 0], M.darkWood);
  cyl(s, "inner_pedestal", 0.16, 0.2, 0.5, [0, 0.73, 0], M.marble, [0, 0, 0], 14);
  strip(s, "base_uplight", [0.6, 0.02, 0.6], [0, 0.49, 0], M.amber);
  strip(s, "vacancy_tag", [0.16, 0.07, 0.015], [0, 0.3, 0.47], M.red);
  return s;
}

/** Archive plinth: stone block with a slanted brass label plate. */
function museumArchivePlinth() {
  const s = sceneRoot("room_rm_museum_archive_plinth");
  addShadow(s, 0.9, 0.9);
  box(s, "plinth_block", [0.66, 1.04, 0.66], [0, 0.52, 0], M.marble);
  box(s, "plinth_foot", [0.78, 0.12, 0.78], [0, 0.06, 0], M.darkWood);
  box(s, "label_plate", [0.5, 0.3, 0.03], [0, 1.06, 0.3], M.brass, [-0.5, 0, 0]);
  strip(s, "label_lines_a", [0.36, 0.02, 0.01], [0, 1.12, 0.34], M.amber, [-0.5, 0, 0]);
  strip(s, "label_lines_b", [0.28, 0.02, 0.01], [0, 1.06, 0.36], M.amber, [-0.5, 0, 0]);
  box(s, "display_item", [0.18, 0.12, 0.14], [0, 1.12, -0.06], M.blackGlass, [0, 0.5, 0]);
  return s;
}

/** Body-reference display: silhouette relief with measurement ticks (wall module). */
function museumBodyDisplay() {
  const s = sceneRoot("room_rm_museum_body_display");
  box(s, "display_board", [1.2, 1.7, 0.06], [0, 0.85, 0], M.darkWood);
  box(s, "board_frame", [1.28, 0.06, 0.1], [0, 1.73, 0], M.brass);
  // human silhouette relief
  cyl(s, "silhouette_head", 0.12, 0.12, 0.03, [0, 1.42, 0.04], M.marble, [Math.PI / 2, 0, 0], 16, false);
  box(s, "silhouette_torso", [0.3, 0.46, 0.03], [0, 1.05, 0.04], M.marble);
  box(s, "silhouette_legs", [0.24, 0.5, 0.03], [0, 0.56, 0.04], M.marble);
  box(s, "silhouette_arm_l", [0.09, 0.42, 0.03], [-0.24, 1.04, 0.04], M.marble, [0, 0, 0.12]);
  box(s, "silhouette_arm_r", [0.09, 0.42, 0.03], [0.24, 1.04, 0.04], M.marble, [0, 0, -0.12]);
  // measurement ticks down the side
  for (let i = 0; i < 6; i += 1) {
    strip(s, `tick_${i}`, [0.1, 0.02, 0.015], [0.48, 0.4 + i * 0.24, 0.045], M.brass);
  }
  strip(s, "spec_highlight", [0.3, 0.025, 0.015], [0.42, 1.42, 0.05], M.amber);
  return s;
}

/** Route inlay: brass arrows set into a stone floor strip — the museum tells you where to walk. */
function museumRouteInlay() {
  const s = sceneRoot("room_rm_museum_route_inlay");
  box(s, "inlay_bed", [2.0, 0.04, 0.5], [0, 0.02, 0], M.marble);
  for (let i = 0; i < 3; i += 1) {
    box(s, `arrow_shaft_${i}`, [0.3, 0.025, 0.08], [-0.6 + i * 0.6, 0.045, 0], M.brass);
    box(s, `arrow_head_a_${i}`, [0.14, 0.025, 0.06], [-0.45 + i * 0.6, 0.045, 0.06], M.brass, [0, -0.7, 0]);
    box(s, `arrow_head_b_${i}`, [0.14, 0.025, 0.06], [-0.45 + i * 0.6, 0.045, -0.06], M.brass, [0, 0.7, 0]);
  }
  strip(s, "route_glow", [1.9, 0.012, 0.04], [0, 0.05, 0.18], M.amber);
  return s;
}

/** Curator desk: dark wood, green-shaded lamp, an open ledger nobody finished. */
function museumCuratorDesk() {
  const s = sceneRoot("room_rm_museum_curator_desk");
  addShadow(s, 1.9, 1.2);
  box(s, "desk_top", [1.5, 0.06, 0.8], [0, 0.78, 0], M.darkWood);
  box(s, "desk_side_l", [0.5, 0.74, 0.74], [-0.48, 0.37, 0], M.darkWood);
  box(s, "desk_side_r", [0.36, 0.74, 0.74], [0.55, 0.37, 0], M.darkWood);
  box(s, "drawer_face", [0.44, 0.14, 0.03], [-0.48, 0.6, 0.38], M.brass);
  box(s, "ledger_open", [0.42, 0.03, 0.3], [-0.1, 0.83, 0.1], M.marble, [0, 0.2, 0]);
  strip(s, "ledger_lines", [0.34, 0.012, 0.2], [-0.1, 0.85, 0.1], M.amber, [0, 0.2, 0]);
  cyl(s, "lamp_stem", 0.02, 0.025, 0.34, [0.42, 1.0, -0.18], M.brass, [0, 0, -0.16], 10);
  box(s, "lamp_shade", [0.3, 0.1, 0.16], [0.36, 1.18, -0.16], M.green, [0, 0, -0.16], false);
  strip(s, "lamp_glow", [0.26, 0.02, 0.12], [0.36, 1.12, -0.16], M.amber);
  return s;
}

/** Audio guide stand: brass horn on a dial post — it still whispers exhibit numbers. */
function museumAudioStand() {
  const s = sceneRoot("room_rm_museum_audio_stand");
  addShadow(s, 0.7, 0.7);
  cyl(s, "stand_base", 0.22, 0.26, 0.08, [0, 0.04, 0], M.darkWood, [0, 0, 0], 16);
  cyl(s, "stand_post", 0.035, 0.045, 1.1, [0, 0.63, 0], M.brass, [0, 0, 0], 10);
  box(s, "dial_box", [0.24, 0.18, 0.12], [0, 1.16, 0.02], M.darkWood);
  cyl(s, "dial", 0.06, 0.06, 0.04, [0, 1.16, 0.1], M.brass, [Math.PI / 2, 0, 0], 14);
  cyl(s, "horn_throat", 0.03, 0.08, 0.22, [0.04, 1.38, -0.04], M.brass, [0.7, 0, -0.3], 12);
  cyl(s, "horn_bell", 0.08, 0.16, 0.14, [0.13, 1.5, -0.12], M.brass, [0.7, 0, -0.3], 14);
  strip(s, "whisper_dot", [0.03, 0.03, 0.015], [0.1, 1.1, 0.09], M.green);
  return s;
}

/** Restoration bench: clamps, a specimen tray, and work that stopped mid-motion. */
function museumRestorationBench() {
  const s = sceneRoot("room_rm_museum_restoration_bench");
  addShadow(s, 1.8, 1.1);
  box(s, "bench_top", [1.5, 0.07, 0.76], [0, 0.82, 0], M.darkWood);
  for (const [x, z] of [[-0.66, -0.3], [0.66, -0.3], [-0.66, 0.3], [0.66, 0.3]]) {
    box(s, `bench_leg_${x}_${z}`, [0.09, 0.8, 0.09], [x, 0.4, z], M.steel);
  }
  box(s, "clamp_post", [0.06, 0.3, 0.06], [-0.5, 1.0, -0.2], M.steel);
  box(s, "clamp_jaw", [0.2, 0.05, 0.1], [-0.44, 1.14, -0.2], M.brass);
  box(s, "specimen_tray", [0.5, 0.05, 0.34], [0.3, 0.88, 0.06], M.marble);
  box(s, "specimen_fragment", [0.16, 0.08, 0.1], [0.26, 0.94, 0.04], M.blackGlass, [0, 0.4, 0.1]);
  cyl(s, "magnifier_arm", 0.015, 0.015, 0.4, [0.62, 1.05, -0.22], M.brass, [0.4, 0, -0.6], 8);
  cyl(s, "magnifier_lens", 0.08, 0.08, 0.02, [0.76, 1.2, -0.06], M.glass, [0.9, 0, -0.6], 16, false);
  strip(s, "work_lamp_line", [0.5, 0.02, 0.02], [0, 0.86, -0.34], M.amber);
  return s;
}

/** Rope stanchion: two brass posts and a rope that sags from being respected. */
function museumStanchion() {
  const s = sceneRoot("room_rm_museum_stanchion");
  addShadow(s, 1.6, 0.5);
  for (const x of [-0.65, 0.65]) {
    cyl(s, `post_base_${x}`, 0.16, 0.19, 0.06, [x, 0.03, 0], M.darkWood, [0, 0, 0], 14);
    cyl(s, `post_${x}`, 0.025, 0.03, 0.92, [x, 0.52, 0], M.brass, [0, 0, 0], 10);
    cyl(s, `post_cap_${x}`, 0.05, 0.05, 0.04, [x, 1.0, 0], M.brass, [0, 0, 0], 10);
  }
  // sagging rope: three short cylinders approximating a catenary
  cyl(s, "rope_a", 0.025, 0.025, 0.5, [-0.42, 0.92, 0], M.rust, [0, 0, Math.PI / 2 + 0.22], 8);
  cyl(s, "rope_b", 0.025, 0.025, 0.46, [0, 0.84, 0], M.rust, [0, 0, Math.PI / 2], 8);
  cyl(s, "rope_c", 0.025, 0.025, 0.5, [0.42, 0.92, 0], M.rust, [0, 0, Math.PI / 2 - 0.22], 8);
  return s;
}

// ---------------------------------------------------------------------------
// 重制诊所 — memory clinic
// ---------------------------------------------------------------------------

/** Remaster therapy chair: recliner with a halo head-ring and wrist rests that clamp. */
function clinicTherapyChair() {
  const s = sceneRoot("room_rm_clinic_therapy_chair");
  addShadow(s, 1.4, 1.8);
  box(s, "chair_base", [0.8, 0.3, 1.2], [0, 0.15, 0], M.shell);
  box(s, "seat_pan", [0.66, 0.12, 0.6], [0, 0.46, 0.18], M.blueFabric);
  box(s, "leg_rest", [0.6, 0.1, 0.5], [0, 0.4, 0.74], M.blueFabric, [0.3, 0, 0]);
  box(s, "back_rest", [0.66, 0.9, 0.14], [0, 0.94, -0.34], M.blueFabric, [-0.3, 0, 0]);
  box(s, "arm_left", [0.14, 0.1, 0.5], [-0.44, 0.6, 0.1], M.shell);
  box(s, "arm_right", [0.14, 0.1, 0.5], [0.44, 0.6, 0.1], M.shell);
  cyl(s, "wrist_clamp_l", 0.06, 0.06, 0.12, [-0.44, 0.68, 0.26], M.steel, [0, 0, Math.PI / 2], 12);
  cyl(s, "wrist_clamp_r", 0.06, 0.06, 0.12, [0.44, 0.68, 0.26], M.steel, [0, 0, Math.PI / 2], 12);
  cyl(s, "halo_ring", 0.2, 0.2, 0.05, [0, 1.42, -0.44], M.steel, [0.9, 0, 0], 18);
  strip(s, "halo_glow", [0.34, 0.02, 0.02], [0, 1.5, -0.4], M.cyan);
  strip(s, "session_dot", [0.04, 0.04, 0.02], [0.4, 0.36, 0.6], M.green);
  return s;
}

/** Sedation gate: a walk-through frame with nozzles and lamps — the clinic's customs. */
function clinicSedationGate() {
  const s = sceneRoot("room_rm_clinic_sedation_gate");
  addShadow(s, 1.8, 0.8);
  box(s, "gate_post_l", [0.22, 2.2, 0.4], [-0.72, 1.1, 0], M.shell);
  box(s, "gate_post_r", [0.22, 2.2, 0.4], [0.72, 1.1, 0], M.shell);
  box(s, "gate_lintel", [1.7, 0.26, 0.4], [0, 2.3, 0], M.shell);
  for (const x of [-0.5, 0, 0.5]) {
    cyl(s, `nozzle_${x}`, 0.035, 0.05, 0.1, [x, 2.14, 0.1], M.steel, [0.6, 0, 0], 10);
  }
  strip(s, "lamp_pass", [0.08, 0.08, 0.02], [-0.72, 1.9, 0.21], M.green);
  strip(s, "lamp_hold", [0.08, 0.08, 0.02], [0.72, 1.9, 0.21], M.red);
  strip(s, "mist_line", [1.2, 0.02, 0.02], [0, 2.02, 0.14], M.cyan);
  box(s, "floor_plate", [1.44, 0.04, 0.6], [0, 0.02, 0], M.blueFabric);
  return s;
}

/** Diagnosis terminal: dual-screen cart that reads you before you speak. */
function clinicDiagnosisTerminal() {
  const s = sceneRoot("room_rm_clinic_diagnosis_terminal");
  addShadow(s, 1.1, 0.9);
  box(s, "cart_body", [0.8, 0.84, 0.56], [0, 0.42, 0], M.shell);
  for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) {
    cyl(s, `wheel_${x}_${z}`, 0.06, 0.06, 0.05, [x, 0.06, z], M.darkSteel, [Math.PI / 2, 0, 0], 10);
  }
  box(s, "screen_main", [0.6, 0.42, 0.05], [-0.06, 1.2, -0.04], M.blackGlass, [-0.2, 0, 0]);
  box(s, "screen_side", [0.3, 0.3, 0.04], [0.36, 1.06, 0.06], M.blackGlass, [-0.1, -0.5, 0]);
  cyl(s, "screen_mast", 0.03, 0.04, 0.5, [0, 0.96, -0.1], M.steel, [0, 0, 0], 10);
  strip(s, "vitals_wave", [0.46, 0.02, 0.01], [-0.06, 1.22, -0.005], M.green, [-0.2, 0, 0]);
  strip(s, "side_marker", [0.2, 0.015, 0.01], [0.35, 1.08, 0.085], M.cyan, [-0.1, -0.5, 0]);
  strip(s, "intake_amber", [0.3, 0.03, 0.02], [0, 0.7, 0.29], M.amber);
  return s;
}

/** Memory projector: tripod reel projector throwing a faint warm cone at nothing. */
function clinicMemoryProjector() {
  const s = sceneRoot("room_rm_clinic_memory_projector");
  addShadow(s, 1.0, 1.0);
  for (const angle of [0.4, 2.5, 4.4]) {
    cyl(s, `tripod_leg_${angle}`, 0.025, 0.03, 1.0, [Math.cos(angle) * 0.3, 0.5, Math.sin(angle) * 0.3], M.steel, [Math.sin(angle) * 0.35, 0, Math.cos(angle) * -0.35], 8);
  }
  box(s, "projector_body", [0.4, 0.26, 0.3], [0, 1.06, 0], M.darkSteel);
  cyl(s, "reel_front", 0.14, 0.14, 0.04, [-0.1, 1.32, 0], M.steel, [0, 0, Math.PI / 2], 16);
  cyl(s, "reel_back", 0.11, 0.11, 0.04, [0.14, 1.3, 0], M.steel, [0, 0, Math.PI / 2], 16);
  cyl(s, "lens_barrel", 0.05, 0.06, 0.14, [0, 1.06, 0.22], M.shell, [Math.PI / 2, 0, 0], 12);
  // light cone: low-opacity additive frustum
  cyl(s, "memory_cone", 0.3, 0.05, 0.9, [0, 1.02, 0.74], M.amber, [Math.PI / 2 + 0.08, 0, 0], 14, false);
  strip(s, "run_lamp", [0.04, 0.04, 0.02], [0.16, 1.18, 0.14], M.green);
  return s;
}

/** Surgical curtain: L-rail with cloth panels — privacy for procedures nobody consented to. */
function clinicSurgicalCurtain() {
  const s = sceneRoot("room_rm_clinic_surgical_curtain");
  addShadow(s, 1.9, 1.1);
  cyl(s, "rail_post", 0.03, 0.04, 2.05, [-0.85, 1.02, 0.45], M.steel, [0, 0, 0], 10);
  cyl(s, "rail_long", 0.025, 0.025, 1.7, [0, 2.02, 0.45], M.steel, [0, 0, Math.PI / 2], 8);
  cyl(s, "rail_short", 0.025, 0.025, 0.9, [0.85, 2.02, 0], M.steel, [Math.PI / 2, 0, 0], 8);
  // hanging cloth panels with slight sway
  box(s, "curtain_panel_a", [0.8, 1.6, 0.02], [-0.4, 1.18, 0.45], M.curtain, [0, 0, 0.03]);
  box(s, "curtain_panel_b", [0.74, 1.6, 0.02], [0.4, 1.16, 0.46], M.curtain, [0, 0, -0.04]);
  box(s, "curtain_panel_c", [0.02, 1.6, 0.7], [0.85, 1.14, 0.1], M.curtain, [0.03, 0, 0]);
  for (let i = 0; i < 6; i += 1) {
    cyl(s, `ring_${i}`, 0.03, 0.03, 0.015, [-0.72 + i * 0.3, 2.02, 0.45], M.shell, [Math.PI / 2, 0, 0], 10, false);
  }
  strip(s, "hem_blue", [1.5, 0.03, 0.01], [0, 0.4, 0.47], M.cyan);
  return s;
}

/** Dosage cart: trolley of vials, one row conspicuously emptied today. */
function clinicDosageCart() {
  const s = sceneRoot("room_rm_clinic_dosage_cart");
  addShadow(s, 0.9, 0.8);
  box(s, "cart_frame", [0.7, 0.9, 0.5], [0, 0.49, 0], M.shell);
  for (const [x, z] of [[-0.26, -0.16], [0.26, -0.16], [-0.26, 0.16], [0.26, 0.16]]) {
    cyl(s, `wheel_${x}_${z}`, 0.05, 0.05, 0.04, [x, 0.05, z], M.darkSteel, [Math.PI / 2, 0, 0], 10);
  }
  box(s, "tray_top", [0.76, 0.04, 0.56], [0, 0.96, 0], M.steel);
  for (let i = 0; i < 5; i += 1) {
    cyl(s, `vial_${i}`, 0.025, 0.025, 0.12, [-0.24 + i * 0.12, 1.04, -0.12], M.glass, [0, 0, 0], 8);
  }
  strip(s, "empty_row_tag", [0.4, 0.02, 0.02], [0, 0.99, 0.14], M.red);
  box(s, "drawer_a", [0.6, 0.14, 0.03], [0, 0.66, 0.26], M.shell);
  box(s, "drawer_b", [0.6, 0.14, 0.03], [0, 0.46, 0.26], M.blueFabric);
  strip(s, "dose_meter", [0.2, 0.03, 0.02], [0.2, 0.84, 0.26], M.green);
  return s;
}

/** Waiting row: three linked seats; the middle one is worn down to the frame. */
function clinicWaitingRow() {
  const s = sceneRoot("room_rm_clinic_waiting_row");
  addShadow(s, 2.1, 0.9);
  box(s, "row_beam", [1.9, 0.08, 0.1], [0, 0.36, -0.1], M.steel);
  box(s, "beam_leg_l", [0.08, 0.36, 0.4], [-0.8, 0.18, 0], M.darkSteel);
  box(s, "beam_leg_r", [0.08, 0.36, 0.4], [0.8, 0.18, 0], M.darkSteel);
  for (const [x, worn] of [[-0.62, false], [0, true], [0.62, false]]) {
    box(s, `seat_${x}`, [0.5, 0.06, 0.46], [x, 0.44, 0.04], worn ? M.steel : M.blueFabric);
    box(s, `back_${x}`, [0.5, 0.44, 0.06], [x, 0.72, -0.22], worn ? M.steel : M.blueFabric, [-0.16, 0, 0]);
  }
  strip(s, "queue_number", [0.12, 0.06, 0.02], [0.84, 0.84, -0.2], M.amber);
  return s;
}

/** Eye chart lightbox: glowing acuity chart whose letters degrade into glyphs (wall). */
function clinicEyeLightbox() {
  const s = sceneRoot("room_rm_clinic_eye_lightbox");
  box(s, "lightbox_frame", [0.62, 0.88, 0.07], [0, 0.44, 0], M.shell);
  strip(s, "lightbox_face", [0.52, 0.78, 0.02], [0, 0.44, 0.04], M.cyan);
  // rows of "letters" shrinking downward, the last rows are wrong
  strip(s, "row_1", [0.26, 0.08, 0.015], [0, 0.7, 0.055], M.darkSteel === M.darkSteel ? M.blackGlass : M.blackGlass);
  for (const [y, w, count, wrong] of [[0.56, 0.07, 3, false], [0.44, 0.05, 4, false], [0.33, 0.04, 5, true], [0.24, 0.03, 6, true]]) {
    for (let i = 0; i < count; i += 1) {
      strip(s, `glyph_${y}_${i}`, [w * 0.7, w, 0.015], [-(count - 1) * w * 0.55 + i * w * 1.1, y, 0.055], wrong ? M.red : M.blackGlass);
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// 重制核心 — reclamation core
// ---------------------------------------------------------------------------

/** Reclamation altar: stepped dais with a central clamp ring — the protocol's endpoint. */
function coreReclamationAltar() {
  const s = sceneRoot("room_rm_core_reclamation_altar");
  addShadow(s, 2.4, 2.4);
  box(s, "dais_lower", [2.1, 0.18, 2.1], [0, 0.09, 0], M.darkSteel);
  box(s, "dais_upper", [1.5, 0.18, 1.5], [0, 0.27, 0], M.wetBase);
  cyl(s, "altar_drum", 0.5, 0.58, 0.5, [0, 0.61, 0], M.darkSteel, [0, 0, 0], 20);
  cyl(s, "clamp_ring", 0.62, 0.62, 0.1, [0, 0.92, 0], M.steel, [0, 0, 0], 20);
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    box(s, `clamp_jaw_${angle}`, [0.16, 0.2, 0.1], [Math.cos(angle) * 0.56, 1.0, Math.sin(angle) * 0.56], M.steel, [0, -angle, 0.2]);
  }
  strip(s, "ring_glow", [1.1, 0.02, 0.06], [0, 0.98, 0], M.cyan);
  strip(s, "ring_glow_cross", [0.06, 0.02, 1.1], [0, 0.98, 0], M.cyan);
  strip(s, "step_red_seam", [1.46, 0.02, 0.04], [0, 0.37, 0.74], M.red);
  return s;
}

/** Identity server: black monolith with rows of name-plate slots, most blank. */
function coreIdentityServer() {
  const s = sceneRoot("room_rm_core_identity_server");
  addShadow(s, 1.1, 0.9);
  box(s, "server_monolith", [0.84, 2.2, 0.6], [0, 1.1, 0], M.darkSteel);
  box(s, "spine_rib", [0.1, 2.2, 0.66], [0, 1.1, 0], M.steel);
  for (let row = 0; row < 6; row += 1) {
    for (const x of [-0.26, 0.26]) {
      const filled = (row * 2 + (x > 0 ? 1 : 0)) % 5 === 0;
      box(s, `plate_${row}_${x}`, [0.3, 0.1, 0.02], [x, 0.4 + row * 0.3, 0.31], filled ? M.brass : M.wetBase);
      if (filled) strip(s, `plate_glow_${row}_${x}`, [0.22, 0.015, 0.01], [x, 0.4 + row * 0.3, 0.325], M.amber);
    }
  }
  strip(s, "head_band", [0.86, 0.04, 0.02], [0, 2.12, 0.31], M.cyan);
  strip(s, "fault_dot", [0.05, 0.05, 0.02], [0.3, 2.0, 0.31], M.red);
  return s;
}

/** Coolant manifold: heavy block with twin wheels — pairs with valve_matrix beats. */
function coreCoolantManifold() {
  const s = sceneRoot("room_rm_core_coolant_manifold");
  addShadow(s, 1.6, 1.0);
  box(s, "manifold_block", [1.3, 0.8, 0.56], [0, 0.7, 0], M.darkSteel);
  box(s, "block_foot", [1.42, 0.3, 0.66], [0, 0.15, 0], M.wetBase);
  cyl(s, "feed_pipe_l", 0.1, 0.1, 0.6, [-0.65, 1.0, 0], M.steel, [0, 0, Math.PI / 2], 12);
  cyl(s, "feed_pipe_r", 0.1, 0.1, 0.6, [0.65, 0.8, 0], M.steel, [0, 0, Math.PI / 2], 12);
  for (const [x, tilt] of [[-0.3, 0.1], [0.3, -0.14]]) {
    cyl(s, `wheel_stem_${x}`, 0.04, 0.04, 0.2, [x, 1.14, 0.2], M.steel, [0.6, 0, 0], 8);
    cyl(s, `wheel_${x}`, 0.18, 0.18, 0.05, [x, 1.24, 0.3], M.copper, [Math.PI / 2 - 0.6 + tilt, 0, 0], 16);
  }
  cyl(s, "gauge_center", 0.1, 0.1, 0.05, [0, 0.88, 0.31], M.shell, [Math.PI / 2, 0, 0], 16);
  strip(s, "gauge_needle", [0.02, 0.07, 0.01], [0, 0.9, 0.34], M.red, [0, 0, 0.5]);
  strip(s, "flow_line", [1.2, 0.025, 0.02], [0, 0.42, 0.3], M.cyan);
  return s;
}

/** Final lock column: three lock collars on one column — the level's three keys, made physical. */
function coreFinalLockColumn() {
  const s = sceneRoot("room_rm_core_final_lock_column");
  addShadow(s, 1.2, 1.2);
  cyl(s, "column_core", 0.3, 0.36, 2.5, [0, 1.25, 0], M.darkSteel, [0, 0, 0], 18);
  const collars = [
    [0.7, M.cyan, 0.1],
    [1.4, M.amber, -0.16],
    [2.1, M.red, 0.22],
  ];
  for (const [y, glow, twist] of collars) {
    cyl(s, `collar_${y}`, 0.46, 0.46, 0.18, [0, y, 0], M.steel, [0, twist, 0], 18);
    box(s, `collar_key_${y}`, [0.2, 0.12, 0.16], [Math.sin(twist) * 0.5, y, Math.cos(twist) * 0.5], M.darkSteel, [0, -twist, 0]);
    strip(s, `collar_glow_${y}`, [0.96, 0.025, 0.025], [0, y + 0.1, 0], glow);
  }
  cyl(s, "crown_insulator", 0.18, 0.26, 0.24, [0, 2.6, 0], M.shell, [0, 0, 0], 14);
  return s;
}

/** Boss arena marker: a flat glowing ring segment bolted to the floor. */
function coreArenaMarker() {
  const s = sceneRoot("room_rm_core_arena_marker");
  cyl(s, "marker_ring", 0.9, 0.9, 0.05, [0, 0.025, 0], M.darkSteel, [0, 0, 0], 24);
  cyl(s, "marker_inner", 0.68, 0.68, 0.055, [0, 0.028, 0], M.wetBase, [0, 0, 0], 24);
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    box(s, `bolt_lug_${angle}`, [0.14, 0.06, 0.1], [Math.cos(angle) * 0.92, 0.03, Math.sin(angle) * 0.92], M.steel, [0, -angle, 0]);
  }
  strip(s, "ring_glow_a", [1.5, 0.015, 0.05], [0, 0.06, 0], M.red);
  strip(s, "ring_glow_b", [0.05, 0.015, 1.5], [0, 0.06, 0], M.red);
  return s;
}

/** Conveyor segment: rollers and side rails — the reclamation line itself. */
function coreConveyorSegment() {
  const s = sceneRoot("room_rm_core_conveyor_segment");
  addShadow(s, 2.3, 1.0);
  box(s, "conveyor_frame", [2.1, 0.5, 0.8], [0, 0.25, 0], M.darkSteel);
  box(s, "side_rail_front", [2.1, 0.16, 0.05], [0, 0.64, 0.4], M.hazardPaint);
  box(s, "side_rail_back", [2.1, 0.16, 0.05], [0, 0.64, -0.4], M.hazardPaint);
  for (let i = 0; i < 7; i += 1) {
    cyl(s, `roller_${i}`, 0.07, 0.07, 0.72, [-0.9 + i * 0.3, 0.56, 0], M.steel, [Math.PI / 2, 0, 0], 12);
  }
  box(s, "carried_crate", [0.4, 0.3, 0.4], [0.5, 0.78, 0], M.wetBase, [0, 0.3, 0]);
  strip(s, "direction_glow", [1.9, 0.02, 0.05], [0, 0.66, 0], M.cyan);
  strip(s, "jam_lamp", [0.05, 0.05, 0.02], [-1.0, 0.7, 0.42], M.red);
  return s;
}

/** Incinerator hatch: radial floor petals with a red rim you should not stand on. */
function coreIncineratorHatch() {
  const s = sceneRoot("room_rm_core_incinerator_hatch");
  cyl(s, "hatch_rim", 0.78, 0.84, 0.1, [0, 0.05, 0], M.darkSteel, [0, 0, 0], 20);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    box(s, `petal_${i}`, [0.52, 0.04, 0.34], [Math.cos(angle) * 0.26, 0.11, Math.sin(angle) * 0.26], M.steel, [0, -angle, 0]);
  }
  cyl(s, "hub_cap", 0.14, 0.14, 0.06, [0, 0.14, 0], M.rust, [0, 0, 0], 12);
  strip(s, "rim_red_a", [1.4, 0.02, 0.05], [0, 0.11, 0], M.red);
  strip(s, "rim_red_b", [0.05, 0.02, 1.4], [0, 0.11, 0], M.red);
  return s;
}

/** Warning pylon: striped post with a rotating beacon head. */
function coreWarningPylon() {
  const s = sceneRoot("room_rm_core_warning_pylon");
  addShadow(s, 0.7, 0.7);
  cyl(s, "pylon_base", 0.22, 0.28, 0.12, [0, 0.06, 0], M.darkSteel, [0, 0, 0], 14);
  box(s, "pylon_post", [0.14, 1.5, 0.14], [0, 0.87, 0], M.hazardPaint);
  for (let i = 0; i < 3; i += 1) {
    strip(s, `stripe_${i}`, [0.15, 0.12, 0.15], [0, 0.4 + i * 0.42, 0], M.darkSteel === M.darkSteel ? M.wetBase : M.wetBase);
  }
  cyl(s, "beacon_cage", 0.12, 0.14, 0.26, [0, 1.75, 0], M.steel, [0, 0, 0], 12);
  strip(s, "beacon_core", [0.12, 0.12, 0.12], [0, 1.76, 0], M.amber);
  strip(s, "beacon_red_slit", [0.16, 0.03, 0.03], [0, 1.84, 0], M.red);
  return s;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

function asset(modelKey, label, build, family, footprintFamily, opts = {}) {
  return { modelKey, label, build, family, footprintFamily, ...opts };
}

const assets = [
  // 维修 maintenance
  asset("room_rm_maint_broken_cradle", "破损检修台", maintBrokenCradle, "bed_or_exam_table", "bed", { role: "hero", lane: "maintenance" }),
  asset("room_rm_maint_cable_spine", "脊柱电缆槽", maintCableSpine, "storage_crate", "barrier", { lane: "maintenance" }),
  asset("room_rm_maint_weapon_cradle", "武器认领架", maintWeaponCradle, "control_console", "pedestal", { role: "interactive", lane: "maintenance" }),
  asset("room_rm_maint_battery_rack", "电池充能架", maintBatteryRack, "cabinet", "cabinet", { role: "interactive", lane: "maintenance", wall: "back" }),
  asset("room_rm_maint_door_console", "压力门操作台", maintDoorConsole, "control_console", "table", { role: "interactive", lane: "maintenance" }),
  asset("room_rm_maint_tool_wall", "工具挂板", maintToolWall, "wall_panel_or_picture_frame", "wall_panel", { mount: "wall", solid: false, lane: "maintenance" }),
  asset("room_rm_maint_coolant_drums", "冷却剂桶组", maintCoolantDrums, "storage_crate", "crate", { lane: "maintenance" }),
  asset("room_rm_maint_gantry_hoist", "龙门吊架", maintGantryHoist, "control_console", "column", { lane: "maintenance" }),
  // 居住 residential
  asset("room_rm_home_family_table", "全家餐桌", homeFamilyTable, "desk", "table", { role: "anchor", lane: "residential", holdsProps: true }),
  asset("room_rm_home_observation_sofa", "观察沙发", homeObservationSofa, "sofa_bench", "sofa", { role: "anchor", lane: "residential" }),
  asset("room_rm_home_tv_shrine_broken", "故障电视柜", homeTvBrokenShrine, "control_console", "cabinet", { role: "interactive", lane: "residential", wall: "back" }),
  asset("room_rm_home_wall_rupture", "墙面破口", homeWallRupture, "wall_panel_or_picture_frame", "wall_panel", { mount: "wall", solid: false, role: "clue", lane: "residential" }),
  asset("room_rm_home_photo_cluster", "记忆照片墙", homePhotoCluster, "wall_panel_or_picture_frame", "wall_panel", { mount: "wall", solid: false, role: "clue", lane: "residential" }),
  asset("room_rm_home_kitchen_fake", "样板厨台", homeKitchenFake, "desk", "table", { lane: "residential", holdsProps: true }),
  asset("room_rm_home_crib_monitor", "监听婴儿床", homeCribMonitor, "bed_or_exam_table", "bed", { role: "clue", lane: "residential" }),
  asset("room_rm_home_intercom_panel", "门口对讲器", homeIntercomPanel, "wall_panel_or_picture_frame", "wall_panel", { mount: "wall", solid: false, role: "interactive", lane: "residential" }),
  // 博物馆 museum
  asset("room_rm_museum_specimen_case", "高型标本柜", museumSpecimenCase, "display_case", "display_case", { role: "hero", lane: "museum" }),
  asset("room_rm_museum_archive_plinth", "档案基座", museumArchivePlinth, "display_case", "pedestal", { lane: "museum", holdsProps: true }),
  asset("room_rm_museum_body_display", "人体参照板", museumBodyDisplay, "wall_panel_or_picture_frame", "wall_panel", { mount: "wall", solid: false, role: "clue", lane: "museum" }),
  asset("room_rm_museum_route_inlay", "导览地标", museumRouteInlay, "storage_crate", "barrier", { solid: false, role: "clue", lane: "museum" }),
  asset("room_rm_museum_curator_desk", "策展人书桌", museumCuratorDesk, "desk", "table", { role: "interactive", lane: "museum", holdsProps: true }),
  asset("room_rm_museum_audio_stand", "语音导览架", museumAudioStand, "control_console", "lamp", { role: "interactive", lane: "museum" }),
  asset("room_rm_museum_restoration_bench", "修复工作台", museumRestorationBench, "desk", "table", { role: "interactive", lane: "museum", holdsProps: true }),
  asset("room_rm_museum_stanchion", "导览围栏", museumStanchion, "storage_crate", "barrier", { lane: "museum" }),
  // 诊所 clinic
  asset("room_rm_clinic_therapy_chair", "治疗躺椅", clinicTherapyChair, "bed_or_exam_table", "bed", { role: "hero", lane: "clinic" }),
  asset("room_rm_clinic_sedation_gate", "镇静闸门", clinicSedationGate, "control_console", "barrier", { role: "interactive", lane: "clinic" }),
  asset("room_rm_clinic_diagnosis_terminal", "诊断终端车", clinicDiagnosisTerminal, "control_console", "table", { role: "interactive", lane: "clinic" }),
  asset("room_rm_clinic_memory_projector", "记忆放映机", clinicMemoryProjector, "control_console", "lamp", { role: "interactive", lane: "clinic" }),
  asset("room_rm_clinic_surgical_curtain", "手术隔帘", clinicSurgicalCurtain, "wall_panel_or_picture_frame", "barrier", { solid: false, lane: "clinic" }),
  asset("room_rm_clinic_dosage_cart", "剂量推车", clinicDosageCart, "storage_crate", "crate", { lane: "clinic" }),
  asset("room_rm_clinic_waiting_row", "候诊连排椅", clinicWaitingRow, "sofa_bench", "sofa", { lane: "clinic" }),
  asset("room_rm_clinic_eye_lightbox", "视力灯箱", clinicEyeLightbox, "wall_panel_or_picture_frame", "wall_panel", { mount: "wall", solid: false, role: "clue", lane: "clinic" }),
  // 核心 core
  asset("room_rm_core_reclamation_altar", "回收祭坛", coreReclamationAltar, "bed_or_exam_table", "pedestal", { role: "hero", lane: "core" }),
  asset("room_rm_core_identity_server", "身份服务器", coreIdentityServer, "cabinet", "column", { role: "interactive", lane: "core", wall: "back" }),
  asset("room_rm_core_coolant_manifold", "冷却歧管", coreCoolantManifold, "control_console", "pedestal", { role: "interactive", lane: "core" }),
  asset("room_rm_core_final_lock_column", "终锁立柱", coreFinalLockColumn, "cabinet", "column", { role: "hero", lane: "core" }),
  asset("room_rm_core_arena_marker", "决战地环", coreArenaMarker, "storage_crate", "barrier", { solid: false, lane: "core" }),
  asset("room_rm_core_conveyor_segment", "回收传送段", coreConveyorSegment, "control_console", "table", { lane: "core" }),
  asset("room_rm_core_incinerator_hatch", "焚化舱口", coreIncineratorHatch, "storage_crate", "crate", { solid: false, lane: "core" }),
  asset("room_rm_core_warning_pylon", "警示信标柱", coreWarningPylon, "storage_crate", "lamp", { lane: "core" }),
];

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

const manifestAssets = [];
for (const entry of assets) {
  const scene = entry.build();
  if (scene.name !== entry.modelKey) {
    throw new Error(`scene name ${scene.name} does not match modelKey ${entry.modelKey}`);
  }
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const glbName = `hp_${entry.modelKey}.glb`;
  await exportGlb(scene, join(cookedModelRoot, glbName));
  manifestAssets.push({
    modelKey: entry.modelKey,
    label: entry.label,
    assetKind: "furniture",
    family: entry.family,
    group: "官卡重制",
    source: "hp-internal-asset-factory",
    sourceAssetId: `hp_rm_${entry.modelKey.replace(/^room_rm_/, "")}_v1`,
    themeId: `hp_official_remaster_${entry.lane}`,
    glbFile: `../../models-cooked/environment/hp-official-remaster-batch01/${glbName}`,
    sizeMeters: [round3(size.x), round3(size.y), round3(size.z)],
    solid: entry.solid !== false,
    mount: entry.mount ?? "floor",
    wallPreferred: entry.mount === "wall" || entry.wall === "back" ? "back" : "none",
    canHoldSmallProps: Boolean(entry.holdsProps),
    clueCapacity: entry.role === "clue" ? 1 : entry.role === "interactive" || entry.role === "hero" ? 2 : 0,
    footprintFamily: entry.footprintFamily,
    tags: [`lane:${entry.lane}`, `role:${entry.role ?? "filler"}`, "style:hp-official-remaster"],
  });
  console.log(`built ${entry.modelKey} [${round3(size.x)} x ${round3(size.y)} x ${round3(size.z)}]`);
}

const manifest = {
  schemaVersion: "hp.builder.assetPack.v1",
  packId: "hp_official_remaster_batch01_v1",
  label: "官方关卡重制包 01",
  sourceTool: "hp-internal-asset-factory",
  generatedAt: "2026-06-11",
  assets: manifestAssets,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nwrote ${manifestAssets.length} assets + manifest ${manifestPath}`);

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
