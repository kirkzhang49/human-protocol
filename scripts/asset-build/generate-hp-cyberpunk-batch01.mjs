// Human Protocol cyberpunk batch-01 — hand-directed prop pack.
//
// Every prop here is intentionally designed part-by-part (no candidate
// sampling): surgical metal, black glass, cyan cable trails, amber hazard
// strips, red reserved for danger, fake-home shells hiding lab machinery.
// Output: GLBs under src/assets/models-cooked/environment/hp-cyberpunk-batch01/
// plus an hp.builder.assetPack.v1 manifest consumed by the existing
// generate-builder-asset-pack-registry.mjs ingest pipeline.
//
// Run: node scripts/asset-build/generate-hp-cyberpunk-batch01.mjs
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
const cookedModelRoot = join(root, "src/assets/models-cooked/environment/hp-cyberpunk-batch01");
const manifestPath = join(root, "src/assets/manifests/builder/hp_cyberpunk_batch01_v1.json");
mkdirSync(cookedModelRoot, { recursive: true });

const M = {
  surgical: new MeshStandardMaterial({ name: "cyber_surgical_shell", color: "#c3ced1", roughness: 0.52, metalness: 0.3 }),
  titanium: new MeshStandardMaterial({ name: "cyber_smoked_titanium", color: "#11181d", roughness: 0.46, metalness: 0.72 }),
  steel: new MeshStandardMaterial({ name: "cyber_joint_steel", color: "#69777b", roughness: 0.42, metalness: 0.74 }),
  blackGlass: new MeshStandardMaterial({ name: "cyber_black_glass", color: "#05080b", roughness: 0.22, metalness: 0.45, emissive: "#0b2025", emissiveIntensity: 0.14 }),
  frostedGlass: new MeshStandardMaterial({ name: "cyber_frosted_glass", color: "#6edbe2", roughness: 0.18, metalness: 0.02, transparent: true, opacity: 0.32, emissive: "#1a656a", emissiveIntensity: 0.16 }),
  homeWood: new MeshStandardMaterial({ name: "cyber_fake_home_wood", color: "#7a5a3e", roughness: 0.62, metalness: 0.06 }),
  homeFabric: new MeshStandardMaterial({ name: "cyber_fake_home_fabric", color: "#9b8a74", roughness: 0.82, metalness: 0.02 }),
  copper: new MeshStandardMaterial({ name: "cyber_cable_copper", color: "#b87b4a", roughness: 0.4, metalness: 0.7 }),
  wetBase: new MeshStandardMaterial({ name: "cyber_wet_floor_base", color: "#1b2125", roughness: 0.28, metalness: 0.38 }),
  cyan: new MeshBasicMaterial({ name: "cyber_cyan_trail", color: "#54f1ff", transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  cyanDim: new MeshBasicMaterial({ name: "cyber_cyan_dim", color: "#2e8b96", transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  amber: new MeshBasicMaterial({ name: "cyber_amber_hazard", color: "#ffb84f", transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  red: new MeshBasicMaterial({ name: "cyber_red_danger", color: "#ff5b4c", transparent: true, opacity: 0.66, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  green: new MeshBasicMaterial({ name: "cyber_bio_green", color: "#7dffb8", transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  shadow: new MeshBasicMaterial({ name: "cyber_contact_shadow", color: "#020305", transparent: true, opacity: 0.3, side: DoubleSide }),
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

function cyl(scene, name, radiusTop, radiusBottom, height, position, material, rotation = [0, 0, 0], segments = 18, castShadow = true) {
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

/** Thin emissive strip helper — the cyan/amber light language of the pack. */
function strip(scene, name, size, position, material, rotation = [0, 0, 0]) {
  return box(scene, name, size, position, material, rotation, false);
}

// ---------------------------------------------------------------------------
// Level 6 — 赛博前厅 cyber foyer
// ---------------------------------------------------------------------------

/** Security turnstile: two asymmetric black-glass blades over a wet steel base. */
function gateTurnstile() {
  const s = sceneRoot("room_cyber_gate_turnstile");
  addShadow(s, 1.6, 1.0);
  box(s, "base_wet_plinth", [1.5, 0.09, 0.82], [0, 0.045, 0], M.wetBase);
  box(s, "pillar_left", [0.3, 1.12, 0.62], [-0.58, 0.65, 0], M.titanium);
  box(s, "pillar_right", [0.3, 0.96, 0.62], [0.58, 0.57, 0], M.titanium);
  box(s, "blade_glass_left", [0.5, 0.62, 0.05], [-0.21, 0.74, 0], M.blackGlass);
  box(s, "blade_glass_right", [0.42, 0.62, 0.05], [0.26, 0.7, 0], M.blackGlass, [0, 0.12, 0]);
  box(s, "scanner_head", [0.22, 0.1, 0.3], [-0.58, 1.26, 0.12], M.steel);
  strip(s, "scan_cyan_line", [0.92, 0.025, 0.03], [0, 1.02, 0.27], M.cyan);
  strip(s, "lane_amber_edge", [1.5, 0.02, 0.04], [0, 0.095, 0.4], M.amber);
  strip(s, "status_dot_red", [0.05, 0.05, 0.02], [0.58, 1.08, 0.32], M.red);
  return s;
}

/** Holo directory pylon: leaning black monolith, frosted holo plate, cable spine. */
function holoPylon() {
  const s = sceneRoot("room_cyber_holo_pylon");
  addShadow(s, 1.0, 1.0);
  box(s, "plinth", [0.74, 0.12, 0.74], [0, 0.06, 0], M.wetBase);
  box(s, "monolith", [0.46, 1.92, 0.3], [0.04, 1.08, 0], M.titanium, [0, 0, -0.05]);
  box(s, "holo_plate", [0.56, 0.78, 0.035], [0.07, 1.46, 0.18], M.frostedGlass, [0, 0, -0.05]);
  cyl(s, "cable_spine", 0.035, 0.035, 1.7, [-0.24, 0.97, -0.12], M.copper, [0, 0, 0.08], 10);
  strip(s, "spine_cyan", [0.02, 1.62, 0.02], [-0.18, 0.99, -0.1], M.cyan, [0, 0, 0.08]);
  strip(s, "ticker_line_1", [0.4, 0.03, 0.01], [0.07, 1.7, 0.2], M.cyan, [0, 0, -0.05]);
  strip(s, "ticker_line_2", [0.32, 0.03, 0.01], [0.05, 1.58, 0.2], M.cyanDim, [0, 0, -0.05]);
  box(s, "maintenance_hatch", [0.3, 0.22, 0.02], [0.06, 0.42, 0.16], M.steel);
  return s;
}

/** Floor cable trunk: long ridged conduit with pulsing cyan seams — leads the eye. */
function cableTrunk() {
  const s = sceneRoot("room_cyber_cable_trunk");
  addShadow(s, 2.6, 0.7);
  box(s, "trunk_body", [2.4, 0.18, 0.42], [0, 0.09, 0], M.titanium);
  for (let i = 0; i < 5; i += 1) {
    box(s, `rib_${i}`, [0.08, 0.22, 0.48], [-1.0 + i * 0.5, 0.11, 0], M.steel);
  }
  cyl(s, "spill_cable_a", 0.04, 0.04, 0.9, [1.05, 0.05, 0.3], M.copper, [0, 0.5, Math.PI / 2], 8);
  cyl(s, "spill_cable_b", 0.03, 0.03, 0.7, [-1.12, 0.04, -0.26], M.copper, [0, -0.7, Math.PI / 2], 8);
  strip(s, "pulse_seam", [2.34, 0.02, 0.05], [0, 0.19, 0.1], M.cyan);
  strip(s, "pulse_seam_dim", [2.34, 0.02, 0.05], [0, 0.19, -0.12], M.cyanDim);
  return s;
}

/** Wall mural: circuit-city map. Raised traces + three glyph blocks (clue surface). */
function muralCircuitCity() {
  const s = sceneRoot("room_cyber_mural_circuit_city");
  box(s, "mural_backing", [2.2, 1.3, 0.06], [0, 0.65, 0], M.titanium);
  box(s, "mural_frame_top", [2.28, 0.06, 0.09], [0, 1.32, 0], M.steel);
  box(s, "mural_frame_bottom", [2.28, 0.06, 0.09], [0, -0.02 + 0.03, 0], M.steel);
  // city blocks
  box(s, "district_a", [0.5, 0.4, 0.025], [-0.7, 0.82, 0.04], M.blackGlass);
  box(s, "district_b", [0.36, 0.62, 0.025], [-0.06, 0.66, 0.04], M.blackGlass);
  box(s, "district_c", [0.46, 0.3, 0.025], [0.68, 0.5, 0.04], M.blackGlass);
  // power traces — the circuit-grid tutorial clue
  strip(s, "trace_main", [1.7, 0.035, 0.02], [-0.05, 0.36, 0.055], M.cyan);
  strip(s, "trace_rise_a", [0.035, 0.5, 0.02], [-0.7, 0.58, 0.055], M.cyan);
  strip(s, "trace_rise_b", [0.035, 0.36, 0.02], [0.68, 0.52, 0.055], M.cyanDim);
  strip(s, "trace_cross", [0.7, 0.035, 0.02], [0.32, 0.92, 0.055], M.cyanDim);
  // glyphs: source bolt / node ring / sealed gate
  box(s, "glyph_source", [0.16, 0.16, 0.03], [-0.7, 0.82, 0.062], M.amber, [0, 0, Math.PI / 4]);
  cyl(s, "glyph_node", 0.09, 0.09, 0.03, [-0.06, 0.66, 0.062], M.green, [Math.PI / 2, 0, 0], 16, false);
  box(s, "glyph_gate", [0.18, 0.05, 0.03], [0.68, 0.5, 0.062], M.red);
  return s;
}

/** Security reception desk: black glass top, recessed monitor, amber service strip. */
function securityDesk() {
  const s = sceneRoot("room_cyber_security_desk");
  addShadow(s, 2.2, 1.2);
  box(s, "desk_body", [1.9, 0.88, 0.7], [0, 0.44, 0], M.titanium);
  box(s, "desk_face_armor", [1.96, 0.5, 0.05], [0, 0.42, 0.37], M.surgical);
  box(s, "glass_top", [2.04, 0.05, 0.84], [0, 0.92, 0], M.blackGlass);
  box(s, "inset_monitor", [0.56, 0.34, 0.05], [-0.5, 1.16, -0.12], M.blackGlass, [-0.35, 0, 0]);
  box(s, "monitor_arm", [0.07, 0.3, 0.07], [-0.5, 0.97, -0.18], M.steel);
  cyl(s, "stool_dock", 0.16, 0.2, 0.18, [0.74, 0.09, -0.5], M.steel, [0, 0, 0], 14);
  strip(s, "service_amber", [1.9, 0.03, 0.02], [0, 0.7, 0.4], M.amber);
  strip(s, "monitor_scanline", [0.46, 0.02, 0.01], [-0.5, 1.18, -0.085], M.cyan, [-0.35, 0, 0]);
  return s;
}

/** Protein vending unit: surgical shell, glass column of cartridges, one red jam light. */
function vendingUnit() {
  const s = sceneRoot("room_cyber_vending_unit");
  addShadow(s, 1.1, 0.9);
  box(s, "shell", [0.92, 1.96, 0.66], [0, 0.98, 0], M.surgical);
  box(s, "side_armor", [0.06, 1.96, 0.66], [0.49, 0.98, 0], M.titanium);
  box(s, "window_column", [0.4, 1.2, 0.04], [-0.14, 1.22, 0.34], M.frostedGlass);
  for (let i = 0; i < 4; i += 1) {
    box(s, `cartridge_${i}`, [0.3, 0.12, 0.1], [-0.14, 0.78 + i * 0.3, 0.3], M.blackGlass);
  }
  box(s, "dispense_tray", [0.5, 0.16, 0.18], [-0.1, 0.32, 0.34], M.titanium);
  box(s, "keypad", [0.2, 0.3, 0.03], [0.31, 1.3, 0.34], M.blackGlass);
  strip(s, "brand_cyan", [0.6, 0.06, 0.02], [-0.05, 1.92, 0.34], M.cyan);
  strip(s, "jam_red_dot", [0.05, 0.05, 0.02], [0.31, 1.52, 0.345], M.red);
  return s;
}

// ---------------------------------------------------------------------------
// Level 7 — 监控档案区 surveillance hub
// ---------------------------------------------------------------------------

/** Monitor wall: 3x2 bank of staggered black screens on a service chassis. */
function monitorWall() {
  const s = sceneRoot("room_cyber_monitor_wall");
  addShadow(s, 2.6, 1.0);
  box(s, "chassis", [2.4, 0.5, 0.5], [0, 0.25, 0], M.titanium);
  box(s, "spine", [2.3, 1.5, 0.18], [0, 1.25, -0.1], M.steel);
  const screens = [
    [-0.78, 1.62, 0.7, 0.42],
    [0.0, 1.7, 0.7, 0.42],
    [0.78, 1.62, 0.7, 0.42],
    [-0.78, 1.12, 0.7, 0.42],
    [0.0, 1.04, 0.7, 0.42],
    [0.78, 1.12, 0.7, 0.42],
  ];
  screens.forEach(([x, y, w, h], index) => {
    box(s, `screen_${index}`, [w, h, 0.06], [x, y, 0.04], M.blackGlass, [index % 2 ? -0.04 : 0.02, 0, 0]);
    strip(s, `scan_${index}`, [w * 0.84, 0.018, 0.01], [x, y + 0.08, 0.078], index === 4 ? M.amber : M.cyanDim, [index % 2 ? -0.04 : 0.02, 0, 0]);
  });
  cyl(s, "cable_drop_a", 0.035, 0.035, 0.8, [-1.0, 0.45, -0.3], M.copper, [0.3, 0, 0], 8);
  cyl(s, "cable_drop_b", 0.03, 0.03, 0.66, [1.08, 0.4, -0.28], M.copper, [0.45, 0, 0], 8);
  strip(s, "rec_red", [0.05, 0.05, 0.02], [1.05, 1.86, 0.05], M.red);
  return s;
}

/** Wall camera cluster: three lenses on an articulated bracket, one looks away. */
function cameraCluster() {
  const s = sceneRoot("room_cyber_camera_cluster");
  box(s, "wall_bracket", [0.5, 0.42, 0.08], [0, 0.55, 0], M.steel);
  cyl(s, "arm_main", 0.045, 0.045, 0.42, [0, 0.62, 0.22], M.titanium, [Math.PI / 2, 0, 0], 10);
  cyl(s, "cam_a_body", 0.08, 0.08, 0.26, [-0.14, 0.66, 0.42], M.titanium, [Math.PI / 2, 0, -0.3], 12);
  cyl(s, "cam_b_body", 0.08, 0.08, 0.26, [0.14, 0.6, 0.42], M.titanium, [Math.PI / 2, 0, 0.32], 12);
  cyl(s, "cam_c_body", 0.07, 0.07, 0.22, [0, 0.34, 0.34], M.titanium, [Math.PI / 1.6, 0, 0], 12);
  cyl(s, "lens_a", 0.05, 0.05, 0.02, [-0.18, 0.66, 0.55], M.blackGlass, [Math.PI / 2, 0, -0.3], 12, false);
  cyl(s, "lens_b", 0.05, 0.05, 0.02, [0.18, 0.6, 0.55], M.blackGlass, [Math.PI / 2, 0, 0.32], 12, false);
  strip(s, "rec_a", [0.03, 0.03, 0.015], [-0.1, 0.74, 0.5], M.red);
  strip(s, "rec_b", [0.03, 0.03, 0.015], [0.22, 0.68, 0.5], M.cyanDim);
  return s;
}

/** Slim server rack: vented titanium, cartridge LEDs, one pulled tray. */
function serverRack() {
  const s = sceneRoot("room_cyber_server_rack");
  addShadow(s, 0.9, 0.9);
  box(s, "rack_body", [0.7, 2.0, 0.74], [0, 1.0, 0], M.titanium);
  box(s, "vent_panel", [0.72, 1.86, 0.04], [0, 1.0, 0.37], M.steel);
  for (let i = 0; i < 7; i += 1) {
    strip(s, `led_row_${i}`, [0.42, 0.02, 0.02], [0, 0.4 + i * 0.24, 0.4], i === 3 ? M.amber : M.cyanDim);
  }
  box(s, "pulled_tray", [0.56, 0.12, 0.3], [0.02, 1.18, 0.54], M.steel);
  strip(s, "tray_warning", [0.06, 0.06, 0.02], [0.24, 1.18, 0.69], M.red);
  cyl(s, "exhaust", 0.09, 0.09, 0.2, [0.16, 2.08, -0.2], M.steel, [0, 0, 0], 12);
  return s;
}

/** Wall mural: eye array — camera glyph grid; one eye is closed (the answer). */
function muralEyeArray() {
  const s = sceneRoot("room_cyber_mural_eye_array");
  box(s, "mural_backing", [1.9, 1.2, 0.06], [0, 0.6, 0], M.titanium);
  box(s, "mural_frame", [1.98, 0.05, 0.09], [0, 1.22, 0], M.steel);
  const eyes = [
    [-0.62, 0.84], [0, 0.84], [0.62, 0.84],
    [-0.62, 0.38], [0, 0.38], [0.62, 0.38],
  ];
  eyes.forEach(([x, y], index) => {
    cyl(s, `eye_ring_${index}`, 0.14, 0.14, 0.03, [x, y, 0.045], M.steel, [Math.PI / 2, 0, 0], 18);
    if (index === 4) {
      strip(s, "eye_closed_slit", [0.18, 0.03, 0.02], [x, y, 0.065], M.red);
    } else {
      cyl(s, `eye_iris_${index}`, 0.06, 0.06, 0.03, [x, y, 0.06], M.cyanDim, [Math.PI / 2, 0, 0], 14, false);
    }
  });
  strip(s, "caption_bar", [1.2, 0.04, 0.02], [0, 0.1, 0.05], M.cyanDim);
  return s;
}

/** Evidence vitrine: museum case remixed — black glass dome over a tagged exhibit. */
function evidenceVitrine() {
  const s = sceneRoot("room_cyber_evidence_vitrine");
  addShadow(s, 1.2, 1.0);
  box(s, "plinth", [0.96, 0.86, 0.76], [0, 0.43, 0], M.titanium);
  box(s, "plinth_trim", [1.02, 0.06, 0.82], [0, 0.89, 0], M.steel);
  box(s, "glass_case", [0.8, 0.6, 0.6], [0, 1.22, 0], M.frostedGlass);
  box(s, "exhibit_core", [0.22, 0.3, 0.16], [0.05, 1.12, 0], M.blackGlass, [0, 0.4, 0.08]);
  box(s, "evidence_tag", [0.18, 0.1, 0.02], [-0.26, 1.04, 0.2], M.surgical, [0, 0.3, 0]);
  strip(s, "case_base_glow", [0.78, 0.02, 0.58], [0, 0.93, 0], M.amber);
  strip(s, "seal_red", [0.05, 0.05, 0.02], [0.4, 0.7, 0.39], M.red);
  return s;
}

/** Interrogation chair: clinic chair remixed with wrist clamps and a confession lamp. */
function interrogationChair() {
  const s = sceneRoot("room_cyber_interrogation_chair");
  addShadow(s, 1.1, 1.3);
  box(s, "base_sled", [0.7, 0.14, 0.96], [0, 0.07, 0], M.titanium);
  box(s, "seat_pan", [0.6, 0.1, 0.56], [0, 0.5, 0.06], M.steel);
  box(s, "seat_cushion", [0.56, 0.08, 0.52], [0, 0.59, 0.06], M.homeFabric);
  box(s, "backrest", [0.58, 0.78, 0.1], [0, 1.0, -0.24], M.steel, [-0.12, 0, 0]);
  box(s, "back_cushion", [0.52, 0.7, 0.06], [0, 1.0, -0.17], M.homeFabric, [-0.12, 0, 0]);
  box(s, "arm_left", [0.1, 0.08, 0.5], [-0.36, 0.72, 0.08], M.titanium);
  box(s, "arm_right", [0.1, 0.08, 0.5], [0.36, 0.72, 0.08], M.titanium);
  cyl(s, "clamp_left", 0.07, 0.07, 0.1, [-0.36, 0.8, 0.22], M.steel, [0, 0, Math.PI / 2], 12);
  cyl(s, "clamp_right", 0.07, 0.07, 0.1, [0.36, 0.8, 0.22], M.steel, [0, 0, Math.PI / 2], 12);
  cyl(s, "lamp_boom", 0.03, 0.03, 0.9, [0.2, 1.5, -0.3], M.steel, [0.5, 0, -0.4], 8);
  cyl(s, "lamp_head", 0.1, 0.13, 0.12, [0.52, 1.78, 0.05], M.titanium, [1.0, 0, -0.4], 14);
  strip(s, "lamp_face", [0.16, 0.16, 0.02], [0.56, 1.74, 0.13], M.amber, [1.0, 0, -0.4]);
  return s;
}

// ---------------------------------------------------------------------------
// Level 8 — 配电管廊 power district
// ---------------------------------------------------------------------------

/** Substation console: angled breaker desk with cable risers and gauge cluster. */
function substationConsole() {
  const s = sceneRoot("room_cyber_substation_console");
  addShadow(s, 1.9, 1.2);
  box(s, "console_body", [1.6, 0.92, 0.72], [0, 0.46, 0], M.titanium);
  box(s, "console_slope", [1.6, 0.07, 0.62], [0, 0.99, 0.07], M.steel, [-0.32, 0, 0]);
  box(s, "breaker_bank", [0.6, 0.32, 0.04], [-0.42, 1.04, 0.18], M.blackGlass, [-0.32, 0, 0]);
  for (let i = 0; i < 3; i += 1) {
    box(s, `breaker_${i}`, [0.1, 0.16, 0.06], [-0.6 + i * 0.18, 1.05, 0.21], M.steel, [-0.32, 0, 0]);
  }
  cyl(s, "gauge_main", 0.11, 0.11, 0.05, [0.36, 1.06, 0.18], M.surgical, [Math.PI / 2 - 0.32, 0, 0], 18);
  cyl(s, "gauge_aux", 0.07, 0.07, 0.05, [0.62, 1.0, 0.22], M.surgical, [Math.PI / 2 - 0.32, 0, 0], 14);
  cyl(s, "riser_a", 0.05, 0.05, 0.8, [-0.62, 1.3, -0.3], M.copper, [0.2, 0, 0], 10);
  cyl(s, "riser_b", 0.05, 0.05, 0.96, [-0.42, 1.38, -0.32], M.copper, [0.16, 0, 0], 10);
  strip(s, "load_cyan", [1.4, 0.025, 0.02], [0, 0.74, 0.37], M.cyan);
  strip(s, "trip_red", [0.05, 0.05, 0.02], [0.66, 1.08, 0.225], M.red);
  return s;
}

/** Coolant valve cluster: three wheels on a manifold block — valve_matrix anchor. */
function valveCluster() {
  const s = sceneRoot("room_cyber_valve_cluster");
  addShadow(s, 1.4, 1.0);
  box(s, "manifold_block", [1.2, 0.6, 0.5], [0, 0.62, 0], M.steel);
  cyl(s, "feed_pipe", 0.11, 0.11, 1.3, [0, 0.24, 0], M.titanium, [0, 0, Math.PI / 2], 14);
  const wheels = [
    [-0.4, 1.06, 0.14],
    [0.0, 1.12, 0.18],
    [0.4, 1.02, 0.12],
  ];
  wheels.forEach(([x, y, tilt], index) => {
    cyl(s, `valve_stem_${index}`, 0.04, 0.04, 0.26, [x, y - 0.12, 0.16], M.steel, [0.5, 0, 0], 10);
    cyl(s, `valve_wheel_${index}`, 0.17, 0.17, 0.05, [x, y, 0.28], index === 1 ? M.copper : M.steel, [Math.PI / 2 - 0.5 + tilt, 0, 0], 16);
  });
  cyl(s, "gauge_left", 0.09, 0.09, 0.05, [-0.46, 0.74, 0.27], M.surgical, [Math.PI / 2, 0, 0], 16);
  cyl(s, "gauge_right", 0.09, 0.09, 0.05, [0.46, 0.74, 0.27], M.surgical, [Math.PI / 2, 0, 0], 16);
  strip(s, "pressure_amber", [1.06, 0.025, 0.02], [0, 0.36, 0.13], M.amber);
  strip(s, "leak_red", [0.04, 0.04, 0.02], [0.46, 0.86, 0.3], M.red);
  return s;
}

/** Hazard catwalk barrier: leaning amber-striped rail segment with kick plate. */
function hazardBarrier() {
  const s = sceneRoot("room_cyber_hazard_barrier");
  addShadow(s, 1.9, 0.6);
  box(s, "kick_plate", [1.7, 0.12, 0.3], [0, 0.06, 0], M.wetBase);
  box(s, "post_left", [0.09, 1.0, 0.09], [-0.76, 0.62, 0], M.titanium, [0, 0, 0.04]);
  box(s, "post_right", [0.09, 1.0, 0.09], [0.76, 0.62, 0], M.titanium, [0, 0, -0.04]);
  box(s, "rail_top", [1.7, 0.08, 0.1], [0, 1.1, 0], M.steel);
  box(s, "rail_mid", [1.7, 0.06, 0.08], [0, 0.68, 0], M.steel);
  for (let i = 0; i < 4; i += 1) {
    strip(s, `hazard_chevron_${i}`, [0.18, 0.05, 0.02], [-0.6 + i * 0.4, 1.1, 0.06], M.amber, [0, 0, Math.PI / 5]);
  }
  return s;
}

/** Pipe manifold wall module: stacked runs, junction box, one weeping gauge. */
function pipeManifold() {
  const s = sceneRoot("room_cyber_pipe_manifold");
  box(s, "back_plate", [1.6, 1.5, 0.06], [0, 0.95, 0], M.titanium);
  cyl(s, "run_upper", 0.08, 0.08, 1.5, [0, 1.5, 0.12], M.steel, [0, 0, Math.PI / 2], 12);
  cyl(s, "run_lower", 0.1, 0.1, 1.5, [0, 0.62, 0.13], M.titanium, [0, 0, Math.PI / 2], 12);
  cyl(s, "drop_pipe", 0.06, 0.06, 0.9, [-0.5, 1.06, 0.12], M.steel, [0, 0, 0], 10);
  box(s, "junction_box", [0.4, 0.34, 0.2], [0.42, 1.06, 0.14], M.steel);
  cyl(s, "weep_gauge", 0.1, 0.1, 0.06, [0.42, 1.06, 0.3], M.surgical, [Math.PI / 2, 0, 0], 16);
  strip(s, "flow_cyan", [1.44, 0.02, 0.02], [0, 1.5, 0.22], M.cyanDim);
  strip(s, "weep_red", [0.04, 0.1, 0.02], [0.42, 0.88, 0.26], M.red);
  return s;
}

/** Drone charging cradle: repair-cradle remix sized for a service drone. */
function droneCradle() {
  const s = sceneRoot("room_cyber_drone_cradle");
  addShadow(s, 1.5, 1.3);
  box(s, "cradle_base", [1.2, 0.34, 1.0], [0, 0.17, 0], M.titanium);
  box(s, "saddle_left", [0.18, 0.3, 0.9], [-0.38, 0.48, 0], M.steel, [0, 0, 0.3]);
  box(s, "saddle_right", [0.18, 0.3, 0.9], [0.38, 0.48, 0], M.steel, [0, 0, -0.3]);
  cyl(s, "charge_mast", 0.05, 0.07, 1.2, [-0.48, 0.94, -0.36], M.titanium, [0, 0, 0.1], 10);
  box(s, "charge_head", [0.26, 0.12, 0.2], [-0.42, 1.56, -0.32], M.steel);
  cyl(s, "charge_coupler", 0.05, 0.05, 0.2, [-0.36, 1.48, -0.2], M.copper, [1.2, 0, 0], 10);
  strip(s, "bay_cyan_rim", [1.14, 0.02, 0.04], [0, 0.35, 0.49], M.cyan);
  strip(s, "charge_amber", [0.2, 0.03, 0.02], [-0.42, 1.62, -0.21], M.amber);
  return s;
}

/** Cable pit cover: grated floor plate over glowing trunk lines. */
function cablePitCover() {
  const s = sceneRoot("room_cyber_cable_pit_cover");
  box(s, "pit_frame", [1.3, 0.1, 0.9], [0, 0.05, 0], M.wetBase);
  strip(s, "pit_glow", [1.1, 0.02, 0.7], [0, 0.075, 0], M.cyanDim);
  for (let i = 0; i < 6; i += 1) {
    box(s, `grate_bar_${i}`, [1.22, 0.05, 0.07], [0, 0.12, -0.32 + i * 0.13], M.steel);
  }
  box(s, "lift_handle", [0.2, 0.05, 0.1], [0.42, 0.16, 0.28], M.titanium);
  strip(s, "edge_amber", [1.3, 0.02, 0.04], [0, 0.105, 0.44], M.amber);
  return s;
}

// ---------------------------------------------------------------------------
// Level 9 — 黑市公寓 fake apartment hiding a lab
// ---------------------------------------------------------------------------

/** TV shrine: warm wood cabinet — the side panel is torn off, lab guts exposed. */
function tvShrine() {
  const s = sceneRoot("room_cyber_tv_shrine");
  addShadow(s, 2.2, 1.0);
  box(s, "wood_cabinet", [1.9, 0.56, 0.58], [0, 0.28, 0], M.homeWood);
  box(s, "wood_shelf", [1.9, 0.05, 0.58], [0, 0.58, 0], M.homeWood);
  box(s, "tv_panel", [1.4, 0.82, 0.08], [0, 1.12, -0.12], M.blackGlass);
  box(s, "tv_stand", [0.5, 0.12, 0.3], [0, 0.66, -0.1], M.titanium);
  // the lie: torn side reveals lab machinery
  box(s, "torn_side_cavity", [0.4, 0.5, 0.5], [0.78, 0.3, 0.02], M.titanium);
  for (let i = 0; i < 3; i += 1) {
    strip(s, `lab_led_${i}`, [0.26, 0.02, 0.02], [0.78, 0.16 + i * 0.14, 0.26], i === 1 ? M.green : M.cyanDim);
  }
  cyl(s, "lab_cable", 0.03, 0.03, 0.6, [0.92, 0.3, 0.3], M.copper, [0.9, 0, 0.4], 8);
  strip(s, "tv_static_line", [1.24, 0.02, 0.01], [0, 1.2, -0.07], M.cyanDim);
  strip(s, "standby_red", [0.04, 0.04, 0.02], [0.62, 0.8, -0.07], M.red);
  return s;
}

/** Kitchen island: half home counter, half chem bench — the seam is visible. */
function kitchenLabIsland() {
  const s = sceneRoot("room_cyber_kitchen_lab_island");
  addShadow(s, 2.0, 1.2);
  box(s, "island_home_half", [0.9, 0.9, 0.9], [-0.5, 0.45, 0], M.homeWood);
  box(s, "island_lab_half", [0.9, 0.9, 0.9], [0.5, 0.45, 0], M.surgical);
  box(s, "counter_top", [1.94, 0.06, 1.0], [0, 0.93, 0], M.blackGlass);
  box(s, "home_drawer", [0.7, 0.16, 0.04], [-0.5, 0.62, 0.46], M.homeWood);
  cyl(s, "lab_flask", 0.08, 0.05, 0.24, [0.4, 1.08, 0.16], M.frostedGlass, [0, 0, 0], 12);
  cyl(s, "lab_flask_tall", 0.05, 0.05, 0.34, [0.66, 1.13, -0.14], M.frostedGlass, [0, 0, 0], 12);
  box(s, "burner_plate", [0.3, 0.04, 0.3], [0.4, 0.97, 0.16], M.steel);
  strip(s, "seam_amber", [0.03, 0.9, 0.92], [0, 0.45, 0], M.amber);
  strip(s, "bio_green_drip", [0.03, 0.2, 0.02], [0.66, 0.86, 0.46], M.green);
  return s;
}

/** Sensor plant: plastic houseplant whose stake is an antenna array. */
function sensorPlant() {
  const s = sceneRoot("room_cyber_sensor_plant");
  addShadow(s, 0.7, 0.7);
  cyl(s, "pot", 0.21, 0.16, 0.34, [0, 0.17, 0], M.homeWood, [0, 0, 0], 14);
  cyl(s, "soil", 0.18, 0.18, 0.04, [0, 0.35, 0], M.titanium, [0, 0, 0], 14);
  for (const [angle, lean, height] of [[0.4, 0.3, 0.6], [2.4, -0.25, 0.7], [4.2, 0.2, 0.5]]) {
    box(s, `leaf_${angle}`, [0.1, height, 0.02], [Math.cos(angle) * 0.1, 0.36 + height / 2, Math.sin(angle) * 0.1], M.green, [lean, angle, 0], false);
  }
  cyl(s, "antenna_stake", 0.012, 0.012, 0.7, [0.06, 0.7, 0.04], M.steel, [0, 0, -0.08], 8);
  cyl(s, "antenna_tip", 0.03, 0.03, 0.04, [0.11, 1.05, 0.04], M.copper, [0, 0, -0.08], 8);
  strip(s, "tip_red", [0.025, 0.025, 0.015], [0.12, 1.09, 0.04], M.red);
  return s;
}

/** Wall mural: family photo wall mid-glitch — frames slide into scanline static. */
function muralFamilyGlitch() {
  const s = sceneRoot("room_cyber_mural_family_glitch");
  box(s, "mural_backing", [2.0, 1.24, 0.06], [0, 0.62, 0], M.homeWood);
  const frames = [
    [-0.66, 0.86, 0.42, 0.5, 0.0],
    [-0.1, 0.78, 0.34, 0.42, 0.06],
    [0.46, 0.88, 0.38, 0.46, -0.08],
  ];
  frames.forEach(([x, y, w, h, tilt], index) => {
    box(s, `frame_${index}`, [w, h, 0.04], [x, y, 0.045], M.steel, [0, 0, tilt]);
    box(s, `photo_${index}`, [w - 0.08, h - 0.08, 0.02], [x, y, 0.065], M.blackGlass, [0, 0, tilt]);
  });
  // the fourth family member is pure static
  box(s, "frame_glitch", [0.38, 0.46, 0.04], [0.84, 0.42, 0.05], M.steel, [0, 0, 0.18]);
  for (let i = 0; i < 4; i += 1) {
    strip(s, `static_line_${i}`, [0.3, 0.025, 0.015], [0.84, 0.28 + i * 0.09, 0.075], i % 2 ? M.cyan : M.cyanDim, [0, 0, 0.18]);
  }
  strip(s, "caption_warm", [0.9, 0.035, 0.02], [-0.4, 0.22, 0.05], M.amber);
  return s;
}

/** Smart bed pod: domestic bed with a medical gantry folded under the headboard. */
function smartBedPod() {
  const s = sceneRoot("room_cyber_smart_bed_pod");
  addShadow(s, 1.4, 2.3);
  box(s, "bed_frame", [1.1, 0.32, 2.05], [0, 0.16, 0], M.homeWood);
  box(s, "mattress", [1.0, 0.18, 1.9], [0, 0.41, 0], M.homeFabric);
  box(s, "pillow", [0.6, 0.12, 0.36], [0, 0.54, -0.7], M.surgical);
  box(s, "headboard", [1.1, 0.78, 0.1], [0, 0.66, -1.02], M.homeWood);
  // folded medical gantry — the bed is also a procedure table
  cyl(s, "gantry_arm", 0.035, 0.035, 0.9, [0.48, 0.86, -0.8], M.steel, [0.9, 0, -0.3], 10);
  cyl(s, "gantry_head", 0.07, 0.09, 0.1, [0.66, 1.18, -0.46], M.titanium, [1.2, 0, -0.3], 12);
  strip(s, "gantry_green", [0.07, 0.07, 0.02], [0.68, 1.2, -0.38], M.green);
  strip(s, "frame_cyan_seam", [0.02, 0.02, 1.9], [0.54, 0.33, 0], M.cyanDim);
  strip(s, "sedation_port_red", [0.04, 0.04, 0.02], [-0.5, 0.6, -0.96], M.red);
  return s;
}

// ---------------------------------------------------------------------------
// Level 10 — 黑诊所核心 black clinic core
// ---------------------------------------------------------------------------

/** Operating pod: black-glass dome over a surgical bed, drainage gutter visible. */
function operatingPod() {
  const s = sceneRoot("room_cyber_operating_pod");
  addShadow(s, 1.6, 2.4);
  box(s, "pod_base", [1.3, 0.5, 2.2], [0, 0.25, 0], M.titanium);
  box(s, "drain_gutter", [1.36, 0.05, 2.26], [0, 0.52, 0], M.wetBase);
  box(s, "surgical_bed", [0.84, 0.16, 1.8], [0, 0.62, 0], M.surgical);
  box(s, "head_cradle", [0.4, 0.1, 0.3], [0, 0.72, -0.72], M.steel);
  cyl(s, "dome_rib_a", 0.05, 0.05, 1.5, [0, 1.3, -0.5], M.steel, [0, 0, Math.PI / 2], 12);
  cyl(s, "dome_rib_b", 0.05, 0.05, 1.5, [0, 1.36, 0.2], M.steel, [0, 0, Math.PI / 2], 12);
  box(s, "dome_glass", [1.2, 0.7, 1.6], [0, 1.16, -0.1], M.frostedGlass);
  cyl(s, "instrument_turret", 0.12, 0.16, 0.34, [0, 1.62, -0.1], M.titanium, [0, 0, 0], 14);
  strip(s, "theatre_ring", [1.24, 0.02, 0.04], [0, 0.54, 1.12], M.cyan);
  strip(s, "occupied_red", [0.06, 0.06, 0.02], [0.62, 0.56, -1.05], M.red);
  return s;
}

/** Organ printer tower: stacked bio-vats, red-only status — this one is danger. */
function organPrinterTower() {
  const s = sceneRoot("room_cyber_organ_printer");
  addShadow(s, 1.1, 1.1);
  box(s, "tower_chassis", [0.84, 2.1, 0.84], [0, 1.05, 0], M.titanium);
  for (let i = 0; i < 3; i += 1) {
    cyl(s, `vat_${i}`, 0.26, 0.26, 0.4, [0, 0.55 + i * 0.58, 0.3], M.frostedGlass, [0, 0, 0], 16);
    strip(s, `vat_glow_${i}`, [0.18, 0.05, 0.02], [0, 0.55 + i * 0.58, 0.56], i === 2 ? M.red : M.green);
  }
  box(s, "printer_head_rail", [0.7, 0.08, 0.1], [0, 2.16, 0.3], M.steel);
  box(s, "printer_head", [0.14, 0.2, 0.14], [-0.16, 2.04, 0.3], M.steel);
  strip(s, "danger_band", [0.86, 0.05, 0.02], [0, 1.86, 0.43], M.red);
  cyl(s, "feed_line", 0.035, 0.035, 1.6, [-0.36, 1.2, -0.34], M.copper, [0.12, 0, 0], 8);
  return s;
}

/** Neural uplink throne: boss seat — tall crown of pins, cables rooting it down. */
function uplinkThrone() {
  const s = sceneRoot("room_cyber_uplink_throne");
  addShadow(s, 1.6, 1.6);
  box(s, "dais", [1.4, 0.18, 1.4], [0, 0.09, 0], M.wetBase);
  box(s, "seat_block", [0.74, 0.5, 0.7], [0, 0.43, 0.06], M.titanium);
  box(s, "seat_pad", [0.66, 0.1, 0.6], [0, 0.72, 0.06], M.homeFabric);
  box(s, "back_tower", [0.7, 1.5, 0.22], [0, 1.4, -0.32], M.titanium);
  for (let i = 0; i < 5; i += 1) {
    cyl(s, `crown_pin_${i}`, 0.025, 0.04, 0.4 + (i % 2) * 0.18, [-0.24 + i * 0.12, 2.28 + (i % 2) * 0.08, -0.32], M.steel, [0, 0, (i - 2) * 0.1], 8);
  }
  strip(s, "crown_cyan", [0.6, 0.03, 0.02], [0, 2.12, -0.2], M.cyan);
  cyl(s, "root_cable_a", 0.05, 0.05, 1.0, [-0.62, 0.12, 0.42], M.copper, [0, 0.6, Math.PI / 2.2], 10);
  cyl(s, "root_cable_b", 0.05, 0.05, 1.2, [0.6, 0.14, -0.5], M.copper, [0, -0.8, Math.PI / 2.3], 10);
  strip(s, "spine_red", [0.04, 1.3, 0.02], [0, 1.4, -0.2], M.red);
  return s;
}

/** Core power spine: vertical bus column with breaker collars — circuit finale anchor. */
function corePowerSpine() {
  const s = sceneRoot("room_cyber_core_power_spine");
  addShadow(s, 1.1, 1.1);
  box(s, "spine_column", [0.6, 2.5, 0.6], [0, 1.25, 0], M.titanium);
  for (let i = 0; i < 3; i += 1) {
    box(s, `collar_${i}`, [0.76, 0.16, 0.76], [0, 0.5 + i * 0.82, 0], M.steel);
    strip(s, `collar_cyan_${i}`, [0.8, 0.03, 0.03], [0, 0.59 + i * 0.82, 0.38], M.cyan);
  }
  strip(s, "bus_line_front", [0.05, 2.4, 0.02], [0.12, 1.25, 0.31], M.cyan);
  strip(s, "bus_line_back", [0.05, 2.4, 0.02], [-0.14, 1.25, -0.31], M.cyanDim);
  cyl(s, "top_insulator", 0.16, 0.22, 0.3, [0, 2.65, 0], M.surgical, [0, 0, 0], 14);
  strip(s, "overload_red", [0.06, 0.06, 0.02], [0.31, 2.3, 0.2], M.red);
  return s;
}

/** Cryo specimen column: frosted cylinder, a silhouette suggested by dark mass. */
function cryoColumn() {
  const s = sceneRoot("room_cyber_cryo_column");
  addShadow(s, 1.1, 1.1);
  cyl(s, "cryo_base", 0.46, 0.52, 0.4, [0, 0.2, 0], M.titanium, [0, 0, 0], 18);
  cyl(s, "cryo_glass", 0.38, 0.38, 1.7, [0, 1.25, 0], M.frostedGlass, [0, 0, 0], 18);
  box(s, "specimen_mass", [0.3, 1.1, 0.22], [0.02, 1.2, 0], M.blackGlass, [0, 0.2, 0.06]);
  cyl(s, "cryo_cap", 0.44, 0.4, 0.26, [0, 2.23, 0], M.steel, [0, 0, 0], 18);
  cyl(s, "feed_hose", 0.04, 0.04, 0.8, [0.4, 0.5, 0.2], M.copper, [0, 0, 0.9], 10);
  strip(s, "cryo_ring_glow", [0.02, 0.04, 0.02], [0, 0.42, 0.44], M.cyan);
  strip(s, "temp_band", [0.2, 0.03, 0.02], [0, 2.3, 0.4], M.cyanDim);
  return s;
}

/** Wall mural: the Protocol finale — a human outline queued behind robot outlines. */
function muralProtocolFinale() {
  const s = sceneRoot("room_cyber_mural_protocol_finale");
  box(s, "mural_backing", [2.4, 1.4, 0.06], [0, 0.7, 0], M.titanium);
  box(s, "mural_frame", [2.48, 0.06, 0.1], [0, 1.42, 0], M.steel);
  // queue of robot silhouettes
  for (let i = 0; i < 3; i += 1) {
    box(s, `robot_body_${i}`, [0.22, 0.5, 0.025], [-0.84 + i * 0.5, 0.62, 0.045], M.blackGlass);
    box(s, `robot_head_${i}`, [0.16, 0.14, 0.025], [-0.84 + i * 0.5, 0.96, 0.045], M.blackGlass);
  }
  // the human at the end of the queue — warm, smaller, wrong
  box(s, "human_body", [0.18, 0.42, 0.025], [0.78, 0.56, 0.045], M.amber);
  cyl(s, "human_head", 0.08, 0.08, 0.025, [0.78, 0.88, 0.045], M.amber, [Math.PI / 2, 0, 0], 14, false);
  strip(s, "queue_floor_line", [2.1, 0.03, 0.02], [0, 0.3, 0.055], M.cyanDim);
  strip(s, "door_red_slot", [0.07, 0.5, 0.02], [1.12, 0.62, 0.055], M.red);
  return s;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const assets = [
  // L6 cyber foyer
  asset("room_cyber_gate_turnstile", "安检闸机", gateTurnstile, "control_console", "barrier", { solid: true, role: "interactive", lane: "foyer" }),
  asset("room_cyber_holo_pylon", "导览全息柱", holoPylon, "control_console", "column", { solid: true, role: "filler", lane: "foyer" }),
  asset("room_cyber_cable_trunk", "地面电缆槽", cableTrunk, "storage_crate", "barrier", { solid: true, role: "filler", lane: "foyer" }),
  asset("room_cyber_mural_circuit_city", "电路城市壁画", muralCircuitCity, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "clue", lane: "foyer" }),
  asset("room_cyber_security_desk", "安保前台", securityDesk, "desk", "table", { solid: true, role: "anchor", lane: "foyer", holdsProps: true }),
  asset("room_cyber_vending_unit", "蛋白贩卖机", vendingUnit, "cabinet", "cabinet", { solid: true, role: "filler", lane: "foyer", wall: "back" }),
  // L7 surveillance hub
  asset("room_cyber_monitor_wall", "监控屏墙", monitorWall, "control_console", "cabinet", { solid: true, role: "hero", lane: "surveillance", wall: "back" }),
  asset("room_cyber_camera_cluster", "壁挂摄像簇", cameraCluster, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "filler", lane: "surveillance" }),
  asset("room_cyber_server_rack", "薄型服务器柜", serverRack, "cabinet", "cabinet", { solid: true, role: "filler", lane: "surveillance", wall: "back" }),
  asset("room_cyber_mural_eye_array", "瞳阵壁画", muralEyeArray, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "clue", lane: "surveillance" }),
  asset("room_cyber_evidence_vitrine", "证物展示罩", evidenceVitrine, "display_case", "display_case", { solid: true, role: "interactive", lane: "surveillance", holdsProps: true }),
  asset("room_cyber_interrogation_chair", "审讯软椅", interrogationChair, "chair", "chair", { solid: false, role: "filler", lane: "surveillance" }),
  // L8 power district
  asset("room_cyber_substation_console", "变电操作台", substationConsole, "control_console", "table", { solid: true, role: "hero", lane: "power", holdsProps: true }),
  asset("room_cyber_valve_cluster", "冷却阀组", valveCluster, "control_console", "pedestal", { solid: true, role: "interactive", lane: "power" }),
  asset("room_cyber_hazard_barrier", "警示护栏", hazardBarrier, "storage_crate", "barrier", { solid: true, role: "filler", lane: "power" }),
  asset("room_cyber_pipe_manifold", "壁挂管汇", pipeManifold, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "filler", lane: "power" }),
  asset("room_cyber_drone_cradle", "无人机充能架", droneCradle, "bed_or_exam_table", "bed", { solid: true, role: "filler", lane: "power" }),
  asset("room_cyber_cable_pit_cover", "电缆井盖板", cablePitCover, "storage_crate", "crate", { solid: true, role: "filler", lane: "power" }),
  // L9 fake apartment
  asset("room_cyber_tv_shrine", "永播电视墙柜", tvShrine, "control_console", "cabinet", { solid: true, role: "hero", lane: "apartment", wall: "back", holdsProps: true }),
  asset("room_cyber_kitchen_lab_island", "厨房实验岛台", kitchenLabIsland, "desk", "table", { solid: true, role: "anchor", lane: "apartment", holdsProps: true }),
  asset("room_cyber_sensor_plant", "传感盆栽", sensorPlant, "storage_crate", "lamp", { solid: false, role: "filler", lane: "apartment" }),
  asset("room_cyber_mural_family_glitch", "故障全家福墙", muralFamilyGlitch, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "clue", lane: "apartment" }),
  asset("room_cyber_smart_bed_pod", "智能床舱", smartBedPod, "bed_or_exam_table", "bed", { solid: true, role: "filler", lane: "apartment" }),
  // L10 black clinic core
  asset("room_cyber_operating_pod", "黑诊所手术舱", operatingPod, "bed_or_exam_table", "bed", { solid: true, role: "hero", lane: "clinic_core" }),
  asset("room_cyber_organ_printer", "器官打印塔", organPrinterTower, "cabinet", "column", { solid: true, role: "interactive", lane: "clinic_core", wall: "back" }),
  asset("room_cyber_uplink_throne", "神经上行王座", uplinkThrone, "chair", "chair", { solid: true, role: "hero", lane: "clinic_core" }),
  asset("room_cyber_core_power_spine", "核心供电脊柱", corePowerSpine, "cabinet", "column", { solid: true, role: "interactive", lane: "clinic_core" }),
  asset("room_cyber_cryo_column", "冷冻标本柱", cryoColumn, "display_case", "column", { solid: true, role: "filler", lane: "clinic_core" }),
  asset("room_cyber_mural_protocol_finale", "协议终幕壁画", muralProtocolFinale, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "clue", lane: "clinic_core" }),
];

function asset(modelKey, label, build, family, footprintFamily, opts = {}) {
  return { modelKey, label, build, family, footprintFamily, ...opts };
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
    group: "赛博",
    source: "hp-internal-asset-factory",
    sourceAssetId: `hp_cyber_${entry.modelKey.replace(/^room_cyber_/, "")}_v1`,
    themeId: "hp_cyberpunk_surgical_blackglass",
    glbFile: `../../models-cooked/environment/hp-cyberpunk-batch01/${glbName}`,
    sizeMeters: [round3(size.x), round3(size.y), round3(size.z)],
    solid: entry.solid !== false,
    mount: entry.mount ?? "floor",
    wallPreferred: entry.mount === "wall" || entry.wall === "back" ? "back" : "none",
    canHoldSmallProps: Boolean(entry.holdsProps),
    clueCapacity: entry.role === "clue" ? 1 : entry.role === "interactive" || entry.role === "hero" ? 2 : 0,
    footprintFamily: entry.footprintFamily,
    tags: [`lane:${entry.lane}`, `role:${entry.role}`, "style:hp-cyberpunk"],
  });
  console.log(`built ${entry.modelKey} [${round3(size.x)} x ${round3(size.y)} x ${round3(size.z)}]`);
}

const manifest = {
  schemaVersion: "hp.builder.assetPack.v1",
  packId: "hp_cyberpunk_batch01_v1",
  label: "HP 赛博朋克手作包 01",
  sourceTool: "hp-internal-asset-factory",
  generatedAt: "2026-06-11",
  assets: manifestAssets,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nwrote ${manifestAssets.length} assets + manifest ${manifestPath}`);

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
