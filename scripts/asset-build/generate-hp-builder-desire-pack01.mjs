// Human Protocol builder desire pack 01 — hand-directed "archive heist" set.
//
// Curated escape-room furniture matching the builder target image: dark wood,
// brass, aged metal, smoked glass, cyan emissive strips, warm desk lights.
// Every piece is purposeful (clue / lock / memory archive / surveillance /
// recovery) with a recognizable silhouette at builder camera distance.
//
// Output: GLBs under src/assets/models-cooked/environment/hp-builder-desire-pack01/
// plus an hp.builder.assetPack.v1 manifest consumed by
// generate-builder-asset-pack-registry.mjs (--emit).
//
// Run: node scripts/asset-build/generate-hp-builder-desire-pack01.mjs
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
const cookedModelRoot = join(root, "src/assets/models-cooked/environment/hp-builder-desire-pack01");
const manifestPath = join(root, "src/assets/manifests/builder/hp_builder_desire_pack_v1.json");
mkdirSync(cookedModelRoot, { recursive: true });

// Material language: archive noir. Brass + dark wood carry warmth; cyan is
// reserved for "data/alive", amber for lamps, red only for danger locks.
const M = {
  darkWood: new MeshStandardMaterial({ name: "desire_dark_wood", color: "#3a2a1c", roughness: 0.62, metalness: 0.05 }),
  ebonyWood: new MeshStandardMaterial({ name: "desire_ebony_wood", color: "#241a12", roughness: 0.58, metalness: 0.06 }),
  brass: new MeshStandardMaterial({ name: "desire_brass", color: "#c9a14f", roughness: 0.34, metalness: 0.85 }),
  brassDark: new MeshStandardMaterial({ name: "desire_brass_aged", color: "#8a6c34", roughness: 0.46, metalness: 0.8 }),
  agedMetal: new MeshStandardMaterial({ name: "desire_aged_metal", color: "#23262b", roughness: 0.52, metalness: 0.72 }),
  gunMetal: new MeshStandardMaterial({ name: "desire_gun_metal", color: "#171b21", roughness: 0.4, metalness: 0.8 }),
  smokedGlass: new MeshStandardMaterial({
    name: "desire_smoked_glass",
    color: "#0d1418",
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.38,
    side: DoubleSide,
  }),
  leather: new MeshStandardMaterial({ name: "desire_oxblood_leather", color: "#54281e", roughness: 0.78, metalness: 0.02 }),
  fabric: new MeshStandardMaterial({ name: "desire_velvet_fabric", color: "#2c3a4e", roughness: 0.9, metalness: 0 }),
  paper: new MeshStandardMaterial({ name: "desire_paper", color: "#d8cdb4", roughness: 0.92, metalness: 0 }),
  paperOld: new MeshStandardMaterial({ name: "desire_paper_old", color: "#b3a585", roughness: 0.94, metalness: 0 }),
  screenDark: new MeshStandardMaterial({ name: "desire_screen_dark", color: "#05090c", roughness: 0.2, metalness: 0.3, emissive: "#0a2a30", emissiveIntensity: 0.35 }),
  cyan: new MeshBasicMaterial({ name: "desire_cyan_glow", color: "#54f1ff", transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  cyanDim: new MeshBasicMaterial({ name: "desire_cyan_dim", color: "#2c97a8", transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  warmLight: new MeshBasicMaterial({ name: "desire_warm_light", color: "#ffd9a0", transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  warmDim: new MeshBasicMaterial({ name: "desire_warm_dim", color: "#d8a86b", transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  redDanger: new MeshBasicMaterial({ name: "desire_red_danger", color: "#ff5b4c", transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  shadow: new MeshBasicMaterial({ name: "desire_contact_shadow", color: "#020305", transparent: true, opacity: 0.3, side: DoubleSide }),
};

function sceneRoot(name) {
  const scene = new Scene();
  scene.name = name;
  return scene;
}

function box(scene, name, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  scene.add(mesh);
  return mesh;
}

function cyl(scene, name, radiusTop, radiusBottom, height, position, material, rotation = [0, 0, 0], segments = 18) {
  const mesh = new Mesh(new CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  scene.add(mesh);
  return mesh;
}

function sphere(scene, name, radius, position, material, segments = 16) {
  const mesh = new Mesh(new SphereGeometry(radius, segments, Math.max(8, segments - 4)), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
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

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Archive desk: dark wood, brass banker lamp (warm glow), paper stacks, ledger. */
function archiveDesk() {
  const s = sceneRoot("room_desire_archive_desk");
  addShadow(s, 2, 1.1);
  // desk body with side drawer banks
  box(s, "desk_top", [1.9, 0.05, 0.92], [0, 0.76, 0], M.darkWood);
  box(s, "desk_top_inlay", [1.78, 0.012, 0.8], [0, 0.79, 0], M.leather);
  box(s, "desk_edge_brass", [1.9, 0.025, 0.04], [0, 0.755, 0.45], M.brassDark);
  for (const side of [-1, 1]) {
    box(s, `drawer_bank_${side}`, [0.46, 0.66, 0.84], [side * 0.68, 0.41, 0], M.ebonyWood);
    for (let i = 0; i < 3; i += 1) {
      box(s, `drawer_face_${side}_${i}`, [0.4, 0.16, 0.02], [side * 0.68, 0.2 + i * 0.2, 0.43], M.darkWood);
      box(s, `drawer_pull_${side}_${i}`, [0.12, 0.02, 0.02], [side * 0.68, 0.2 + i * 0.2, 0.45], M.brass);
    }
  }
  box(s, "modesty_panel", [0.9, 0.6, 0.03], [0, 0.42, -0.36], M.ebonyWood);
  // banker lamp
  cyl(s, "lamp_base", 0.07, 0.09, 0.03, [-0.55, 0.8, -0.26], M.brass, [0, 0, 0], 16);
  cyl(s, "lamp_stem", 0.014, 0.014, 0.26, [-0.55, 0.94, -0.26], M.brass, [0, 0, 0], 10);
  box(s, "lamp_shade", [0.3, 0.09, 0.14], [-0.49, 1.08, -0.22], M.brassDark, [0, 0, -0.16]);
  box(s, "lamp_glow", [0.26, 0.02, 0.1], [-0.49, 1.035, -0.21], M.warmLight, [0, 0, -0.16]);
  // papers, ledger, small objects
  box(s, "paper_stack_a", [0.3, 0.05, 0.4], [0.35, 0.81, -0.12], M.paper, [0, 0.12, 0]);
  box(s, "paper_stack_b", [0.28, 0.025, 0.38], [0.04, 0.8, 0.16], M.paperOld, [0, -0.2, 0]);
  box(s, "ledger", [0.26, 0.04, 0.34], [-0.18, 0.81, 0.14], M.leather, [0, 0.32, 0]);
  box(s, "ledger_spine", [0.03, 0.045, 0.34], [-0.3, 0.81, 0.1], M.brassDark, [0, 0.32, 0]);
  cyl(s, "ink_pot", 0.035, 0.04, 0.06, [0.55, 0.82, 0.2], M.gunMetal, [0, 0, 0], 12);
  cyl(s, "magnifier_lens", 0.06, 0.06, 0.012, [0.62, 0.8, -0.1], M.smokedGlass, [Math.PI / 2, 0, 0.6], 18);
  box(s, "magnifier_handle", [0.12, 0.015, 0.025], [0.72, 0.8, -0.16], M.brass, [0, 0.6, 0]);
  // cyan data slate: the one "alive" object on the desk
  box(s, "data_slate", [0.2, 0.012, 0.14], [0.2, 0.8, 0.32], M.screenDark, [0, -0.3, 0]);
  box(s, "data_slate_glow", [0.17, 0.006, 0.11], [0.2, 0.81, 0.32], M.cyanDim, [0, -0.3, 0]);
  return s;
}

/** Tall vitrine: smoked glass case on brass-trimmed dark base, cyan specimen core. */
function tallVitrine() {
  const s = sceneRoot("room_desire_tall_vitrine");
  addShadow(s, 1.05, 1.05);
  box(s, "base", [0.92, 0.5, 0.92], [0, 0.25, 0], M.ebonyWood);
  box(s, "base_trim", [0.96, 0.05, 0.96], [0, 0.52, 0], M.brassDark);
  box(s, "base_plate", [0.7, 0.02, 0.7], [0, 0.56, 0], M.gunMetal);
  // glass shell with brass corner ribs
  box(s, "glass_shell", [0.78, 1.32, 0.78], [0, 1.22, 0], M.smokedGlass);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    box(s, `rib_${sx}_${sz}`, [0.035, 1.34, 0.035], [sx * 0.39, 1.22, sz * 0.39], M.brass);
  }
  box(s, "cap", [0.86, 0.07, 0.86], [0, 1.93, 0], M.agedMetal);
  box(s, "cap_light", [0.62, 0.015, 0.62], [0, 1.89, 0], M.warmDim);
  // suspended specimen: brass armature holding a cyan memory core
  cyl(s, "armature", 0.012, 0.012, 0.5, [0, 1.62, 0], M.brassDark, [0, 0, 0], 8);
  sphere(s, "specimen_core", 0.12, [0, 1.3, 0], M.cyan, 18);
  const ring = new Mesh(new TorusGeometry(0.18, 0.014, 10, 28), M.brass);
  ring.name = "specimen_ring";
  ring.position.set(0, 1.3, 0);
  ring.rotation.x = Math.PI / 2.6;
  s.add(ring);
  // label plate
  box(s, "label_plate", [0.3, 0.08, 0.012], [0, 0.42, 0.47], M.brass);
  return s;
}

/** Brass safe: heavy lockbox with spoked dial, vault hinges, red armed lamp. */
function brassSafe() {
  const s = sceneRoot("room_desire_brass_safe");
  addShadow(s, 1.05, 0.95);
  box(s, "body", [0.92, 1.04, 0.78], [0, 0.54, 0], M.gunMetal);
  box(s, "body_band_top", [0.96, 0.07, 0.82], [0, 0.99, 0], M.brassDark);
  box(s, "body_band_bottom", [0.96, 0.07, 0.82], [0, 0.1, 0], M.brassDark);
  box(s, "door", [0.74, 0.8, 0.04], [0.02, 0.56, 0.41], M.agedMetal);
  box(s, "door_frame", [0.82, 0.88, 0.02], [0.02, 0.56, 0.39], M.brassDark);
  // spoked dial
  cyl(s, "dial_hub", 0.1, 0.1, 0.06, [0.02, 0.62, 0.45], M.brass, [Math.PI / 2, 0, 0], 20);
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI;
    box(s, `dial_spoke_${i}`, [0.3, 0.025, 0.025], [0.02, 0.62, 0.47], M.brass, [0, 0, angle]);
  }
  cyl(s, "dial_ring", 0.15, 0.15, 0.02, [0.02, 0.62, 0.43], M.brassDark, [Math.PI / 2, 0, 0], 24);
  // handle + hinges
  box(s, "handle", [0.05, 0.22, 0.05], [0.3, 0.56, 0.45], M.brass);
  for (const y of [0.3, 0.82]) {
    box(s, `hinge_${y}`, [0.06, 0.12, 0.07], [-0.4, y, 0.41], M.brassDark);
  }
  // armed lamp: red = locked danger language
  box(s, "armed_lamp", [0.05, 0.05, 0.02], [0.26, 0.86, 0.44], M.redDanger);
  box(s, "maker_plate", [0.24, 0.07, 0.012], [0.02, 0.92, 0.44], M.brass);
  for (const sx of [-1, 1]) {
    box(s, `foot_${sx}`, [0.12, 0.06, 0.7], [sx * 0.36, 0.03, 0], M.gunMetal);
  }
  return s;
}

/** Low bookcase / room divider: dark wood, brass rail, ledgers + artifact boxes. */
function lowBookcase() {
  const s = sceneRoot("room_desire_low_bookcase");
  addShadow(s, 2.3, 0.6);
  box(s, "carcass", [2.2, 1.02, 0.42], [0, 0.53, 0], M.darkWood);
  box(s, "top_slab", [2.28, 0.05, 0.5], [0, 1.06, 0], M.ebonyWood);
  box(s, "brass_rail", [2.2, 0.025, 0.025], [0, 1.13, -0.18], M.brass);
  for (const x of [-1.06, -0.36, 0.36, 1.06]) {
    box(s, `divider_${x}`, [0.04, 0.92, 0.4], [x, 0.5, 0], M.ebonyWood);
  }
  box(s, "shelf_mid", [2.12, 0.03, 0.4], [0, 0.55, 0], M.ebonyWood);
  box(s, "kick", [2.2, 0.08, 0.36], [0, 0.04, 0], M.gunMetal);
  // ledger runs: leaning book blocks with varied heights
  const slots = [
    [-0.88, 0.72, M.leather, 0.3, 0],
    [-0.62, 0.72, M.paperOld, 0.34, 0.1],
    [-0.1, 0.72, M.fabric, 0.3, 0],
    [0.16, 0.72, M.leather, 0.26, -0.12],
    [0.7, 0.72, M.paperOld, 0.34, 0],
    [0.96, 0.72, M.leather, 0.28, 0.08],
    [-0.82, 0.2, M.paperOld, 0.3, 0],
    [0.62, 0.2, M.fabric, 0.32, 0],
  ];
  slots.forEach(([x, y, mat, h, tilt], index) => {
    box(s, `books_${index}`, [0.34, h, 0.3], [x, y + (h - 0.3) / 2, 0], mat, [0, 0, tilt]);
  });
  // artifact box with cyan seal on middle shelf
  box(s, "artifact_box", [0.36, 0.24, 0.3], [-0.36, 0.69, 0], M.gunMetal);
  box(s, "artifact_seal", [0.2, 0.02, 0.02], [-0.36, 0.74, 0.16], M.cyanDim);
  return s;
}

/** Oxblood leather chair: studded club chair with brass feet. */
function leatherChair() {
  const s = sceneRoot("room_desire_leather_chair");
  addShadow(s, 0.95, 0.95);
  box(s, "seat", [0.72, 0.22, 0.66], [0, 0.4, 0.04], M.leather);
  box(s, "seat_cushion", [0.62, 0.08, 0.56], [0, 0.54, 0.06], M.leather);
  box(s, "back", [0.72, 0.62, 0.2], [0, 0.78, -0.3], M.leather, [-0.12, 0, 0]);
  box(s, "back_pad", [0.58, 0.46, 0.06], [0, 0.78, -0.21], M.leather, [-0.12, 0, 0]);
  for (const side of [-1, 1]) {
    box(s, `arm_${side}`, [0.14, 0.3, 0.6], [side * 0.32, 0.62, 0], M.leather);
    cyl(s, `arm_roll_${side}`, 0.07, 0.07, 0.58, [side * 0.32, 0.78, 0], M.leather, [Math.PI / 2, 0, 0], 12);
    // brass stud lines
    box(s, `studs_${side}`, [0.015, 0.2, 0.5], [side * 0.395, 0.6, 0], M.brassDark);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    cyl(s, `foot_${sx}_${sz}`, 0.035, 0.045, 0.3, [sx * 0.28, 0.15, sz * 0.26], M.brass, [0, 0, 0], 10);
  }
  return s;
}

/** Compact security console: angled triple screens, brass-edged dark metal body. */
function securityConsole() {
  const s = sceneRoot("room_desire_security_console");
  addShadow(s, 1.45, 0.95);
  box(s, "pedestal", [1.2, 0.5, 0.6], [0, 0.27, -0.04], M.agedMetal);
  box(s, "pedestal_trim", [1.26, 0.04, 0.66], [0, 0.54, -0.04], M.brassDark);
  box(s, "worktop", [1.34, 0.05, 0.78], [0, 0.6, 0.02], M.ebonyWood);
  // angled console deck with switches
  box(s, "deck", [1.2, 0.07, 0.34], [0, 0.68, 0.12], M.gunMetal, [-0.32, 0, 0]);
  for (let i = 0; i < 6; i += 1) {
    box(s, `switch_${i}`, [0.06, 0.02, 0.06], [-0.45 + i * 0.18, 0.715, 0.12], M.brass, [-0.32, 0, 0]);
  }
  box(s, "deck_glow", [1.08, 0.01, 0.04], [0, 0.7, 0.25], M.cyanDim, [-0.32, 0, 0]);
  // triple monitor bank
  const screens = [
    [-0.42, 0.28, 0.34],
    [0, 0, 0.4],
    [0.42, -0.28, 0.34],
  ];
  screens.forEach(([x, yaw, w], index) => {
    box(s, `screen_frame_${index}`, [w + 0.05, 0.32, 0.04], [x, 1.04, -0.26], M.agedMetal, [-0.08, yaw, 0]);
    box(s, `screen_${index}`, [w, 0.26, 0.015], [x, 1.04, -0.24], M.screenDark, [-0.08, yaw, 0]);
    box(s, `screen_scan_${index}`, [w - 0.06, 0.012, 0.012], [x, 1.1, -0.225], M.cyanDim, [-0.08, yaw, 0]);
  });
  cyl(s, "screen_post", 0.04, 0.05, 0.4, [0, 0.78, -0.28], M.gunMetal, [0, 0, 0], 10);
  // red alert dome: surveillance is dangerous
  sphere(s, "alert_dome", 0.045, [0.58, 0.66, 0.3], M.redDanger, 12);
  return s;
}

/** Recovery bed pod: cot in a brass-ribbed half-shell with cyan vitals strip. */
function bedPod() {
  const s = sceneRoot("room_desire_bed_pod");
  addShadow(s, 2.2, 1.2);
  box(s, "chassis", [2.04, 0.34, 1.04], [0, 0.2, 0], M.agedMetal);
  box(s, "chassis_trim", [2.1, 0.04, 1.1], [0, 0.39, 0], M.brassDark);
  box(s, "mattress", [1.9, 0.14, 0.9], [0, 0.48, 0], M.fabric);
  box(s, "pillow", [0.34, 0.1, 0.6], [-0.72, 0.56, 0], M.paper);
  box(s, "blanket", [1.1, 0.06, 0.92], [0.35, 0.54, 0], M.leather);
  // half-shell canopy over the head end
  for (let i = 0; i < 4; i += 1) {
    const t = i / 3;
    const angle = -0.45 - t * 0.75;
    cyl(s, `canopy_rib_${i}`, 0.025, 0.025, 1.04, [-0.92 + i * 0.16, 0.62 + Math.sin(t * 1.2) * 0.42 + 0.3, 0], M.brassDark, [Math.PI / 2, 0, angle * 0], 8);
  }
  box(s, "canopy_glass", [0.72, 0.5, 1.02], [-0.7, 0.92, 0], M.smokedGlass);
  box(s, "canopy_frame", [0.76, 0.05, 1.06], [-0.7, 1.18, 0], M.brassDark);
  // vitals strip + bedside panel
  box(s, "vitals_strip", [0.6, 0.02, 0.02], [-0.7, 1.2, 0.5], M.cyan);
  box(s, "side_panel", [0.3, 0.24, 0.05], [0.98, 0.5, 0.45], M.gunMetal);
  box(s, "side_panel_screen", [0.22, 0.14, 0.015], [0.98, 0.52, 0.48], M.screenDark);
  box(s, "side_panel_glow", [0.18, 0.014, 0.014], [0.98, 0.46, 0.48], M.warmDim);
  for (const sx of [-1, 1]) {
    box(s, `skid_${sx}`, [0.16, 0.06, 0.96], [sx * 0.86, 0.03, 0], M.gunMetal);
  }
  return s;
}

/** Wall clue board: corkboard with pinned notes, photos and red string runs. */
function clueBoard() {
  const s = sceneRoot("room_desire_clue_board");
  box(s, "frame", [1.5, 1.06, 0.05], [0, 1.4, 0], M.darkWood);
  box(s, "cork", [1.38, 0.94, 0.025], [0, 1.4, 0.02], M.paperOld);
  // pinned notes + photos (slight rotations sell the hand-made look)
  const notes = [
    [-0.5, 1.66, 0.18, 0.14, M.paper, 0.1],
    [-0.16, 1.7, 0.16, 0.12, M.paper, -0.14],
    [0.3, 1.62, 0.2, 0.15, M.screenDark, 0.06],
    [-0.46, 1.28, 0.16, 0.2, M.screenDark, -0.06],
    [0.05, 1.34, 0.22, 0.16, M.paperOld, 0.18],
    [0.48, 1.24, 0.15, 0.12, M.paper, -0.1],
    [0.2, 1.06, 0.18, 0.12, M.paperOld, 0.04],
  ];
  notes.forEach(([x, y, w, h, mat, tilt], index) => {
    box(s, `note_${index}`, [w, h, 0.012], [x, y, 0.045], mat, [0, 0, tilt]);
  });
  // red string web between pins
  const strings = [
    [-0.5, 1.66, 0.05, 1.34],
    [0.05, 1.34, 0.3, 1.62],
    [0.3, 1.62, 0.48, 1.24],
    [-0.46, 1.28, 0.05, 1.34],
    [0.05, 1.34, 0.2, 1.06],
  ];
  strings.forEach(([x1, y1, x2, y2], index) => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    box(s, `string_${index}`, [length, 0.008, 0.008], [(x1 + x2) / 2, (y1 + y2) / 2, 0.055], M.redDanger, [0, 0, angle]);
  });
  // brass pins
  for (const [x, y] of [[-0.5, 1.66], [0.05, 1.34], [0.3, 1.62], [-0.46, 1.28], [0.48, 1.24], [0.2, 1.06], [-0.16, 1.7]]) {
    sphere(s, `pin_${x}_${y}`, 0.014, [x, y, 0.06], M.brass, 8);
  }
  box(s, "ledge", [1.5, 0.05, 0.1], [0, 0.84, 0.04], M.darkWood);
  box(s, "chalk_tray", [0.3, 0.025, 0.06], [-0.4, 0.88, 0.05], M.brassDark);
  return s;
}

/** Numbered portrait panel: museum-style framed subject portrait with brass plaque. */
function portraitPanel() {
  const s = sceneRoot("room_desire_portrait_panel");
  box(s, "frame_outer", [0.92, 1.18, 0.06], [0, 1.5, 0], M.ebonyWood);
  box(s, "frame_inner", [0.8, 1.06, 0.02], [0, 1.5, 0.025], M.brassDark);
  box(s, "canvas", [0.72, 0.98, 0.015], [0, 1.5, 0.04], M.screenDark);
  // abstract subject silhouette: head + shoulders, half-erased by a cyan scanline
  cyl(s, "subject_head", 0.13, 0.13, 0.012, [0, 1.72, 0.052], M.gunMetal, [Math.PI / 2, 0, 0], 18);
  box(s, "subject_torso", [0.4, 0.42, 0.012], [0, 1.36, 0.052], M.gunMetal);
  box(s, "scanline", [0.66, 0.016, 0.012], [0, 1.58, 0.058], M.cyanDim);
  box(s, "redaction", [0.3, 0.06, 0.012], [0.05, 1.72, 0.058], M.redDanger);
  // plaque with subject number
  box(s, "plaque", [0.34, 0.1, 0.02], [0, 0.86, 0.03], M.brass);
  box(s, "plaque_text", [0.24, 0.02, 0.012], [0, 0.86, 0.045], M.gunMetal);
  // picture light: warm wash from above
  box(s, "picture_light_arm", [0.06, 0.04, 0.2], [0, 2.16, 0.08], M.brassDark);
  cyl(s, "picture_light", 0.035, 0.035, 0.5, [0, 2.14, 0.16], M.brass, [0, 0, Math.PI / 2], 10);
  box(s, "picture_light_glow", [0.46, 0.015, 0.03], [0, 2.1, 0.17], M.warmLight);
  return s;
}

/** Light gantry: freestanding brass light bridge — warm wall-washer for any room. */
function lightGantry() {
  const s = sceneRoot("room_desire_light_gantry");
  addShadow(s, 2.3, 0.5);
  for (const side of [-1, 1]) {
    cyl(s, `post_${side}`, 0.035, 0.045, 2.3, [side * 1.05, 1.15, 0], M.gunMetal, [0, 0, 0], 10);
    cyl(s, `post_collar_${side}`, 0.05, 0.05, 0.05, [side * 1.05, 1.86, 0], M.brass, [0, 0, 0], 10);
    box(s, `foot_${side}`, [0.3, 0.05, 0.4], [side * 1.05, 0.025, 0], M.agedMetal);
  }
  // light beam with three warm heads + cyan service strip
  box(s, "beam", [2.3, 0.08, 0.1], [0, 2.26, 0], M.agedMetal);
  box(s, "beam_brass", [2.3, 0.02, 0.11], [0, 2.31, 0], M.brassDark);
  box(s, "service_strip", [2.1, 0.012, 0.02], [0, 2.2, 0.05], M.cyanDim);
  for (const x of [-0.7, 0, 0.7]) {
    box(s, `head_yoke_${x}`, [0.05, 0.1, 0.05], [x, 2.16, 0], M.gunMetal);
    cyl(s, `head_${x}`, 0.07, 0.09, 0.18, [x, 2.04, 0.06], M.brassDark, [0.7, 0, 0], 12);
    cyl(s, `head_glow_${x}`, 0.06, 0.075, 0.02, [x, 1.97, 0.12], M.warmLight, [0.7, 0, 0], 12);
  }
  return s;
}

/** Card catalog cabinet: wall of small brass-pulled drawers — the memory archive. */
function cardCatalog() {
  const s = sceneRoot("room_desire_card_catalog");
  addShadow(s, 1.3, 0.6);
  box(s, "carcass", [1.16, 1.5, 0.5], [0, 0.79, 0], M.darkWood);
  box(s, "crown", [1.24, 0.06, 0.56], [0, 1.57, 0], M.ebonyWood);
  box(s, "plinth", [1.24, 0.1, 0.56], [0, 0.05, 0], M.ebonyWood);
  // 5×4 drawer grid with brass pulls + label frames
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = -0.42 + col * 0.28;
      const y = 0.26 + row * 0.26;
      box(s, `drawer_${row}_${col}`, [0.24, 0.2, 0.02], [x, y, 0.255], M.darkWood);
      box(s, `label_${row}_${col}`, [0.1, 0.05, 0.012], [x, y + 0.04, 0.27], M.paperOld);
      cyl(s, `pull_${row}_${col}`, 0.018, 0.018, 0.025, [x, y - 0.045, 0.27], M.brass, [Math.PI / 2, 0, 0], 10);
    }
  }
  // one drawer pulled open with a glowing index card
  box(s, "open_drawer", [0.24, 0.2, 0.3], [0.42, 0.78, 0.36], M.darkWood);
  box(s, "open_card", [0.16, 0.1, 0.012], [0.42, 0.9, 0.4], M.paper, [-0.5, 0, 0]);
  box(s, "open_card_glow", [0.12, 0.02, 0.012], [0.42, 0.92, 0.42], M.cyanDim, [-0.5, 0, 0]);
  return s;
}

/** Holo globe: brass armillary stand projecting a cyan wireframe sphere. */
function holoGlobe() {
  const s = sceneRoot("room_desire_holo_globe");
  addShadow(s, 0.8, 0.8);
  cyl(s, "base", 0.26, 0.32, 0.08, [0, 0.04, 0], M.ebonyWood, [0, 0, 0], 22);
  cyl(s, "stem", 0.05, 0.07, 0.6, [0, 0.38, 0], M.darkWood, [0, 0, 0], 14);
  cyl(s, "collar", 0.09, 0.09, 0.05, [0, 0.7, 0], M.brass, [0, 0, 0], 16);
  cyl(s, "emitter", 0.12, 0.14, 0.08, [0, 0.76, 0], M.gunMetal, [0, 0, 0], 16);
  cyl(s, "emitter_lens", 0.08, 0.08, 0.015, [0, 0.81, 0], M.cyan, [0, 0, 0], 16);
  // projected globe: glow core + brass meridian rings
  sphere(s, "globe_core", 0.2, [0, 1.12, 0], M.cyanDim, 18);
  const meridian = new Mesh(new TorusGeometry(0.26, 0.012, 8, 32), M.brass);
  meridian.name = "meridian_ring";
  meridian.position.set(0, 1.12, 0);
  meridian.rotation.z = 0.42;
  s.add(meridian);
  const equator = new Mesh(new TorusGeometry(0.3, 0.01, 8, 32), M.brassDark);
  equator.name = "equator_ring";
  equator.position.set(0, 1.12, 0);
  equator.rotation.x = Math.PI / 2;
  s.add(equator);
  return s;
}

/** Memory archive tower: smoked-glass data column with stacked cyan cores. */
function archiveTower() {
  const s = sceneRoot("room_desire_archive_tower");
  addShadow(s, 1, 1);
  box(s, "plinth", [0.86, 0.16, 0.86], [0, 0.08, 0], M.gunMetal);
  box(s, "plinth_trim", [0.92, 0.04, 0.92], [0, 0.18, 0], M.brassDark);
  box(s, "column_shell", [0.62, 1.9, 0.62], [0, 1.16, 0], M.smokedGlass);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    box(s, `column_rib_${sx}_${sz}`, [0.05, 1.94, 0.05], [sx * 0.31, 1.16, sz * 0.31], M.agedMetal);
  }
  // stacked memory cores, alive
  for (let i = 0; i < 5; i += 1) {
    box(s, `core_${i}`, [0.4, 0.07, 0.4], [0, 0.46 + i * 0.34, 0], M.screenDark);
    box(s, `core_glow_${i}`, [0.44, 0.018, 0.44], [0, 0.5 + i * 0.34, 0], i === 3 ? M.warmDim : M.cyanDim);
  }
  box(s, "cap", [0.74, 0.1, 0.74], [0, 2.16, 0], M.agedMetal);
  box(s, "cap_trim", [0.78, 0.025, 0.78], [0, 2.22, 0], M.brass);
  box(s, "cap_beacon", [0.1, 0.02, 0.1], [0, 2.24, 0], M.cyan);
  // access panel with warm key slot
  box(s, "access_panel", [0.26, 0.18, 0.02], [0, 0.92, 0.32], M.gunMetal);
  box(s, "key_slot", [0.05, 0.1, 0.012], [0, 0.92, 0.335], M.warmDim);
  return s;
}

/** Gallery bench: velvet-top bench so players can stage museum rooms. */
function galleryBench() {
  const s = sceneRoot("room_desire_gallery_bench");
  addShadow(s, 1.7, 0.7);
  box(s, "cushion", [1.5, 0.12, 0.5], [0, 0.46, 0], M.fabric);
  box(s, "cushion_trim", [1.54, 0.03, 0.54], [0, 0.39, 0], M.brassDark);
  box(s, "frame", [1.46, 0.06, 0.46], [0, 0.35, 0], M.ebonyWood);
  for (const sx of [-1, 1]) {
    box(s, `leg_panel_${sx}`, [0.08, 0.32, 0.44], [sx * 0.62, 0.16, 0], M.darkWood);
    box(s, `leg_foot_${sx}`, [0.12, 0.03, 0.48], [sx * 0.62, 0.015, 0], M.brass);
  }
  cyl(s, "stretcher", 0.025, 0.025, 1.16, [0, 0.14, 0], M.brassDark, [0, 0, Math.PI / 2], 10);
  return s;
}

/** Tabletop evidence cluster on a drum table: floor-safe decorative prop set. */
function evidenceCluster() {
  const s = sceneRoot("room_desire_evidence_cluster");
  addShadow(s, 0.85, 0.85);
  cyl(s, "drum_table", 0.34, 0.36, 0.66, [0, 0.33, 0], M.darkWood, [0, 0, 0], 22);
  cyl(s, "drum_top", 0.37, 0.37, 0.03, [0, 0.68, 0], M.ebonyWood, [0, 0, 0], 22);
  cyl(s, "drum_band", 0.365, 0.365, 0.03, [0, 0.5, 0], M.brassDark, [0, 0, 0], 22);
  // the cluster: candle lamp, specimen jar, folder, pocket watch
  cyl(s, "oil_lamp_base", 0.05, 0.06, 0.05, [-0.14, 0.72, -0.08], M.brass, [0, 0, 0], 12);
  cyl(s, "oil_lamp_glass", 0.035, 0.045, 0.14, [-0.14, 0.81, -0.08], M.smokedGlass, [0, 0, 0], 12);
  box(s, "oil_lamp_flame", [0.025, 0.05, 0.025], [-0.14, 0.81, -0.08], M.warmLight);
  cyl(s, "specimen_jar", 0.06, 0.06, 0.16, [0.13, 0.78, -0.1], M.smokedGlass, [0, 0, 0], 14);
  cyl(s, "specimen_lid", 0.065, 0.065, 0.02, [0.13, 0.87, -0.1], M.brassDark, [0, 0, 0], 14);
  sphere(s, "specimen_blob", 0.035, [0.13, 0.76, -0.1], M.cyanDim, 10);
  box(s, "folder", [0.26, 0.025, 0.2], [0.02, 0.71, 0.16], M.paperOld, [0, 0.5, 0]);
  box(s, "folder_tab", [0.06, 0.03, 0.04], [0.13, 0.71, 0.23], M.redDanger, [0, 0.5, 0]);
  cyl(s, "pocket_watch", 0.035, 0.035, 0.012, [-0.18, 0.7, 0.14], M.brass, [Math.PI / 2, 0, 0], 14);
  box(s, "watch_chain", [0.12, 0.008, 0.008], [-0.1, 0.7, 0.18], M.brassDark, [0, 0.6, 0]);
  return s;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const assets = [
  asset("room_desire_archive_desk", "档案台灯桌", archiveDesk, "desk", "table", { solid: true, role: "anchor", lane: "archive", holdsProps: true }),
  asset("room_desire_card_catalog", "记忆卡片柜", cardCatalog, "cabinet", "cabinet", { solid: true, role: "interactive", lane: "archive", wall: "back", holdsProps: true }),
  asset("room_desire_low_bookcase", "矮档案书墙", lowBookcase, "bookshelf", "books", { solid: true, role: "filler", lane: "archive", holdsProps: true }),
  asset("room_desire_clue_board", "线索图析板", clueBoard, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "clue", lane: "archive" }),
  asset("room_desire_tall_vitrine", "标本高展柜", tallVitrine, "display_case", "display_case", { solid: true, role: "hero", lane: "museum", holdsProps: true }),
  asset("room_desire_portrait_panel", "编号肖像板", portraitPanel, "wall_panel_or_picture_frame", "wall_panel", { solid: false, mount: "wall", role: "clue", lane: "museum" }),
  asset("room_desire_gallery_bench", "丝绒展厅长凳", galleryBench, "sofa_bench", "sofa", { solid: true, role: "filler", lane: "museum" }),
  asset("room_desire_holo_globe", "全息星仪", holoGlobe, "control_console", "pedestal", { solid: false, role: "filler", lane: "museum" }),
  asset("room_desire_brass_safe", "黄铜保险柜", brassSafe, "safe", "crate", { solid: true, role: "interactive", lane: "vault" }),
  asset("room_desire_archive_tower", "记忆档案塔", archiveTower, "cabinet", "column", { solid: true, role: "hero", lane: "vault" }),
  asset("room_desire_security_console", "紧凑监控台", securityConsole, "control_console", "table", { solid: true, role: "interactive", lane: "surveillance", holdsProps: true }),
  asset("room_desire_leather_chair", "氧血皮革椅", leatherChair, "chair", "chair", { solid: false, role: "filler", lane: "lounge" }),
  asset("room_desire_evidence_cluster", "证物小圆桌", evidenceCluster, "storage_crate", "lamp", { solid: false, role: "clue", lane: "lounge" }),
  asset("room_desire_bed_pod", "恢复床舱", bedPod, "bed_or_exam_table", "bed", { solid: true, role: "anchor", lane: "recovery" }),
  asset("room_desire_light_gantry", "暖光灯桥", lightGantry, "control_console", "barrier", { solid: true, role: "filler", lane: "recovery" }),
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
    group: "密室精选",
    source: "hp-internal-asset-factory",
    sourceAssetId: `hp_desire_${entry.modelKey.replace(/^room_desire_/, "")}_v1`,
    themeId: "hp_desire_archive_brass_noir",
    glbFile: `../../models-cooked/environment/hp-builder-desire-pack01/${glbName}`,
    sizeMeters: [round3(size.x), round3(size.y), round3(size.z)],
    solid: entry.solid !== false,
    mount: entry.mount ?? "floor",
    wallPreferred: entry.mount === "wall" || entry.wall === "back" ? "back" : "none",
    canHoldSmallProps: Boolean(entry.holdsProps),
    clueCapacity: entry.role === "clue" ? 2 : entry.role === "interactive" || entry.role === "hero" ? 2 : 0,
    footprintFamily: entry.footprintFamily,
    tags: [`lane:${entry.lane}`, `role:${entry.role}`, "style:hp-desire-archive"],
  });
  console.log(`built ${entry.modelKey} [${round3(size.x)} x ${round3(size.y)} x ${round3(size.z)}]`);
}

const manifest = {
  schemaVersion: "hp.builder.assetPack.v1",
  packId: "hp_builder_desire_pack_v1",
  label: "HP 密室精选包 01",
  sourceTool: "hp-internal-asset-factory",
  generatedAt: "2026-06-11",
  assets: manifestAssets,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nwrote ${manifestAssets.length} assets + manifest ${manifestPath}`);

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
