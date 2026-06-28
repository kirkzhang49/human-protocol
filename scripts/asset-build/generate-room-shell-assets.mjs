import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
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
const shellRoot = join(root, "src/assets/models/environment/shells");

const kits = {
  maintenance: {
    base: "#34474e",
    plate: "#7b8784",
    dark: "#071016",
    trim: "#9ba6a1",
    glow: "#73f4ff",
    warn: "#e1b750",
    grime: "#27353a",
  },
  residential: {
    base: "#24302d",
    plate: "#56675f",
    dark: "#101615",
    trim: "#8fa99a",
    glow: "#86f1dc",
    warn: "#d7b26a",
    grime: "#171d1a",
  },
  museum: {
    base: "#20252d",
    plate: "#565f70",
    dark: "#0d1118",
    trim: "#a1aab8",
    glow: "#78d7ff",
    warn: "#b8a56a",
    grime: "#141923",
  },
  clinic: {
    base: "#d6dddd",
    plate: "#9fb6ba",
    dark: "#10181c",
    trim: "#edf5f4",
    glow: "#84f7ff",
    warn: "#7fb9c2",
    grime: "#b8c4c5",
  },
  core: {
    base: "#24181a",
    plate: "#513338",
    dark: "#0e080a",
    trim: "#8b6b67",
    glow: "#ff6254",
    warn: "#e4bd56",
    grime: "#170d0f",
  },
};

function standard(color, roughness = 0.52, metalness = 0.58) {
  return new MeshStandardMaterial({ color, roughness, metalness });
}

function glow(color, opacity = 0.88) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function box(scene, name, size, position, material, castShadow = true) {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function cyl(scene, name, radius, depth, position, rotation, material, segments = 24) {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, segments), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function floorTile(style, kit) {
  const s = new Scene();
  const base = standard(kit.base, 0.32, 0.78);
  const plate = standard(kit.plate, 0.28, 0.82);
  const grime = standard(kit.grime, 0.58, 0.58);
  const dark = standard(kit.dark, 0.68, 0.5);
  const trim = standard(kit.trim, 0.34, 0.78);
  const accent = glow(kit.glow, style === "core" ? 0.24 : 0.18);

  box(s, `${style}_floor_slab_base`, [4.25, 0.035, 3.05], [0, 0.018, 0], base);
  box(s, `${style}_floor_large_grey_plate`, [3.72, 0.018, 2.48], [0, 0.052, 0], plate);
  box(s, `${style}_floor_center_worn_path`, [1.18, 0.012, 2.72], [0, 0.071, 0], grime);
  box(s, `${style}_floor_front_raised_border`, [3.94, 0.026, 0.08], [0, 0.092, 1.28], trim);
  box(s, `${style}_floor_back_raised_border`, [3.94, 0.026, 0.08], [0, 0.092, -1.28], trim);
  box(s, `${style}_floor_left_raised_border`, [0.08, 0.026, 2.52], [-1.98, 0.092, 0], trim);
  box(s, `${style}_floor_right_raised_border`, [0.08, 0.026, 2.52], [1.98, 0.092, 0], trim);
  box(s, `${style}_floor_inner_panel_a`, [1.08, 0.012, 0.92], [-1.05, 0.081, 0.52], base);
  box(s, `${style}_floor_inner_panel_b`, [1.08, 0.012, 0.92], [1.05, 0.081, -0.52], base);
  box(s, `${style}_floor_dark_cable_trench`, [0.16, 0.018, 2.68], [0.78, 0.101, 0], dark);
  box(s, `${style}_floor_cyan_line_a`, [1.9, 0.006, 0.026], [-0.72, 0.115, 0.9], accent, false);
  box(s, `${style}_floor_cyan_line_b`, [1.35, 0.006, 0.026], [0.82, 0.115, -0.82], accent, false);
  for (const [x, z] of [[-1.62, 1.02], [1.62, 1.02], [-1.62, -1.02], [1.62, -1.02]]) {
    cyl(s, `${style}_floor_round_fastener_${x}_${z}`, 0.035, 0.008, [x, 0.116, z], [Math.PI / 2, 0, 0], dark, 18);
  }
  return s;
}

function wallPanel(style, kit) {
  const s = new Scene();
  const base = standard(kit.base, 0.5, 0.65);
  const plate = standard(kit.plate, 0.4, 0.72);
  const dark = standard(kit.dark, 0.64, 0.55);
  const trim = standard(kit.trim, 0.42, 0.76);
  const accent = glow(kit.glow, style === "core" ? 0.7 : 0.48);
  const warn = glow(kit.warn, 0.46);

  box(s, `${style}_wall_structural_back`, [2.4, 1.65, 0.16], [0, 0.825, 0], base);
  box(s, `${style}_wall_inset_shadow`, [2.08, 1.24, 0.08], [0, 0.88, 0.09], dark);
  box(s, `${style}_wall_main_panel_left`, [0.82, 1.05, 0.075], [-0.52, 0.86, 0.145], plate);
  box(s, `${style}_wall_main_panel_right`, [0.82, 1.05, 0.075], [0.52, 0.86, 0.145], plate);
  box(s, `${style}_wall_top_rail`, [2.18, 0.075, 0.09], [0, 1.52, 0.17], trim);
  box(s, `${style}_wall_bottom_rail`, [2.18, 0.075, 0.09], [0, 0.12, 0.17], trim);
  box(s, `${style}_wall_center_seam`, [0.055, 1.28, 0.09], [0, 0.84, 0.18], dark);
  box(s, `${style}_wall_status_strip`, [1.75, 0.035, 0.04], [0, 1.34, 0.224], accent, false);
  box(s, `${style}_wall_data_chip_a`, [0.22, 0.035, 0.04], [-0.72, 0.28, 0.226], warn, false);
  box(s, `${style}_wall_data_chip_b`, [0.22, 0.035, 0.04], [0.72, 0.28, 0.226], accent, false);
  for (const x of [-1.03, 1.03]) cyl(s, `${style}_wall_side_pipe_${x}`, 0.025, 1.32, [x, 0.83, 0.21], [0, 0, 0], trim, 16);
  return s;
}

function ceilingPanel(style, kit) {
  const s = new Scene();
  const base = standard("#03070b", 0.62, 0.78);
  const recess = standard(kit.dark, 0.72, 0.58);
  const beam = standard("#07151c", 0.44, 0.84);
  const wornPanel = standard(kit.grime, 0.6, 0.42);
  const accent = glow(kit.glow, style === "core" ? 0.74 : 0.58);

  box(s, `${style}_ceiling_shadow_backplate`, [3.2, 0.08, 2.2], [0, 0.04, 0], base);
  box(s, `${style}_ceiling_recess_left`, [1.16, 0.035, 0.74], [-0.82, 0.098, -0.36], recess);
  box(s, `${style}_ceiling_recess_right`, [1.16, 0.035, 0.74], [0.82, 0.098, 0.36], recess);
  box(s, `${style}_ceiling_worn_insert_a`, [0.72, 0.026, 0.36], [-0.62, 0.123, 0.48], wornPanel);
  box(s, `${style}_ceiling_worn_insert_b`, [0.72, 0.026, 0.36], [0.62, 0.123, -0.48], wornPanel);
  for (const x of [-1.32, -0.44, 0.44, 1.32]) {
    box(s, `${style}_ceiling_long_beam_${x}`, [0.105, 0.18, 2.12], [x, 0.19, 0], beam);
  }
  for (const z of [-0.86, -0.28, 0.28, 0.86]) {
    box(s, `${style}_ceiling_cross_beam_${z}`, [3.05, 0.145, 0.085], [0, 0.205, z], beam);
  }
  box(s, `${style}_ceiling_cyan_spine`, [0.045, 0.035, 1.86], [0.44, 0.297, 0], accent, false);
  box(s, `${style}_ceiling_cyan_short_a`, [0.78, 0.03, 0.035], [-0.72, 0.3, 0.62], accent, false);
  box(s, `${style}_ceiling_cyan_short_b`, [0.58, 0.03, 0.035], [0.92, 0.3, -0.62], accent, false);
  return s;
}

function serviceElevatorThreshold() {
  const kit = kits.maintenance;
  const s = new Scene();
  const base = standard("#12191f", 0.42, 0.78);
  const plate = standard("#44565d", 0.36, 0.74);
  const trim = standard("#a5b7b8", 0.38, 0.76);
  const cyan = glow(kit.glow, 0.68);
  const red = glow("#ff594d", 0.58);
  const amber = glow(kit.warn, 0.42);

  box(s, "service_elevator_threshold_base", [4.45, 0.09, 0.74], [0, 0.045, 0], base);
  box(s, "service_elevator_threshold_inset_plate", [3.72, 0.028, 0.42], [0, 0.112, 0.02], plate);
  box(s, "service_elevator_threshold_front_lip", [4.18, 0.045, 0.065], [0, 0.145, 0.33], trim);
  box(s, "service_elevator_threshold_back_lip", [4.18, 0.045, 0.055], [0, 0.145, -0.32], trim);
  box(s, "service_elevator_threshold_left_anchor", [0.24, 0.22, 0.68], [-2.25, 0.14, 0], base);
  box(s, "service_elevator_threshold_right_anchor", [0.24, 0.22, 0.68], [2.25, 0.14, 0], base);
  box(s, "service_elevator_threshold_cyan_floor_line", [3.35, 0.012, 0.035], [0, 0.176, 0.22], cyan, false);
  box(s, "service_elevator_threshold_red_lock_line", [0.62, 0.012, 0.035], [-1.55, 0.178, -0.18], red, false);
  box(s, "service_elevator_threshold_amber_index", [0.32, 0.012, 0.035], [1.65, 0.178, -0.18], amber, false);
  for (const x of [-1.95, 1.95]) {
    cyl(s, `service_elevator_threshold_floor_pin_${x}`, 0.04, 0.035, [x, 0.19, 0.18], [Math.PI / 2, 0, 0], trim, 18);
  }
  return s;
}

function cornerPillar(style, kit) {
  const s = new Scene();
  const base = standard(kit.dark, 0.44, 0.76);
  const plate = standard(kit.base, 0.48, 0.68);
  const trim = standard(kit.trim, 0.38, 0.78);
  const accent = glow(kit.glow, style === "core" ? 0.36 : 0.24);

  box(s, `${style}_corner_pillar_core`, [0.42, 2.55, 0.42], [0, 1.275, 0], base);
  box(s, `${style}_corner_pillar_front_plate`, [0.34, 1.92, 0.055], [0, 1.24, 0.235], plate);
  box(s, `${style}_corner_pillar_side_plate`, [0.055, 1.92, 0.34], [0.235, 1.24, 0], plate);
  box(s, `${style}_corner_pillar_top_cap`, [0.54, 0.16, 0.54], [0, 2.54, 0], trim);
  box(s, `${style}_corner_pillar_floor_cap`, [0.58, 0.12, 0.58], [0, 0.06, 0], trim);
  box(s, `${style}_corner_pillar_vertical_light`, [0.035, 1.55, 0.025], [-0.12, 1.32, 0.268], accent, false);
  box(s, `${style}_corner_pillar_low_status`, [0.18, 0.025, 0.028], [0.1, 0.38, 0.27], accent, false);
  return s;
}

function wallWashLight(style, kit) {
  const s = new Scene();
  const base = standard(kit.dark, 0.46, 0.7);
  const trim = standard(kit.trim, 0.38, 0.78);
  const accent = glow(kit.glow, style === "core" ? 0.42 : 0.3);

  box(s, `${style}_wall_wash_mount`, [1.45, 0.12, 0.08], [0, 0.06, 0], base);
  box(s, `${style}_wall_wash_upper_lip`, [1.52, 0.045, 0.045], [0, 0.14, 0.035], trim);
  box(s, `${style}_wall_wash_emissive_blade`, [1.2, 0.025, 0.03], [0, 0.19, 0.055], accent, false);
  box(s, `${style}_wall_wash_soft_pool`, [1.68, 0.012, 0.035], [0, 0.03, 0.07], accent, false);
  return s;
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

const definitions = Object.entries(kits).flatMap(([style, kit]) => [
  { key: `room_floor_tile_${style}`, file: `hp_room_floor_tile_${style}.glb`, scene: floorTile(style, kit) },
  { key: `room_wall_panel_${style}`, file: `hp_room_wall_panel_${style}.glb`, scene: wallPanel(style, kit) },
  { key: `room_ceiling_panel_${style}`, file: `hp_room_ceiling_panel_${style}.glb`, scene: ceilingPanel(style, kit) },
  { key: `room_corner_pillar_${style}`, file: `hp_room_corner_pillar_${style}.glb`, scene: cornerPillar(style, kit) },
  { key: `room_wall_wash_light_${style}`, file: `hp_room_wall_wash_light_${style}.glb`, scene: wallWashLight(style, kit) },
]);
definitions.push({
  key: "door_threshold_service_elevator",
  file: "hp_door_threshold_service_elevator.glb",
  scene: serviceElevatorThreshold(),
});

mkdirSync(shellRoot, { recursive: true });
for (const definition of definitions) {
  await exportGlb(definition.scene, join(shellRoot, definition.file));
  console.log(`generated ${definition.key}`);
}

console.log(`Generated ${definitions.length} room shell assets in ${shellRoot}`);
