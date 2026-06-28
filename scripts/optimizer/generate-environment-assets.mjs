import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  TorusGeometry,
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
const assetRoot = join(root, "src/assets");
const modelRoot = join(assetRoot, "models/environment");
const textureRoot = join(assetRoot, "textures/environment");
const manifestRoot = join(assetRoot, "manifests");

const material = {
  darkRubber: new MeshStandardMaterial({ color: "#161b20", roughness: 0.82, metalness: 0.18 }),
  darkMetal: new MeshStandardMaterial({ color: "#202a32", roughness: 0.52, metalness: 0.72 }),
  wornMetal: new MeshStandardMaterial({ color: "#6f7880", roughness: 0.58, metalness: 0.65 }),
  whiteShell: new MeshStandardMaterial({ color: "#e7ecec", roughness: 0.48, metalness: 0.22 }),
  redShell: new MeshStandardMaterial({ color: "#b82832", roughness: 0.5, metalness: 0.28 }),
  yellowShell: new MeshStandardMaterial({ color: "#f4c54c", roughness: 0.46, metalness: 0.42 }),
  amberGlass: new MeshStandardMaterial({ color: "#ffc65a", emissive: "#ff9d28", emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.58 }),
  cyanGlow: new MeshBasicMaterial({ color: "#72f4ff", transparent: true, opacity: 0.92, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  amberGlow: new MeshBasicMaterial({ color: "#ffbf55", transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  redGlow: new MeshBasicMaterial({ color: "#ff4b42", transparent: true, opacity: 0.92, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  paper: new MeshStandardMaterial({ color: "#d9ddd4", roughness: 0.78, metalness: 0.02 }),
  shadow: new MeshBasicMaterial({ color: "#05070a", transparent: true, opacity: 0.36, side: DoubleSide }),
};

function ensureDirs() {
  [
    join(modelRoot, "props"),
    join(modelRoot, "terminals"),
    join(modelRoot, "doors"),
    textureRoot,
    manifestRoot,
  ].forEach((dir) => mkdirSync(dir, { recursive: true }));
}

function box(scene, name, size, position, mat, castShadow = true) {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function cyl(scene, name, radius, depth, position, rotation, mat, segments = 24) {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, segments), mat);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function plane(scene, name, size, position, rotation, mat) {
  const mesh = new Mesh(new PlaneGeometry(size[0], size[1]), mat);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function pickupKey() {
  const s = new Scene();
  box(s, "key_body_yellow_access_module", [0.75, 0.16, 0.28], [0, 0.13, 0], material.yellowShell);
  box(s, "key_black_grip", [0.22, 0.2, 0.34], [-0.24, 0.14, 0], material.darkRubber);
  box(s, "key_reader_tooth", [0.18, 0.12, 0.18], [0.36, 0.16, 0], material.wornMetal);
  box(s, "key_cyan_light_strip", [0.44, 0.025, 0.032], [0.07, 0.225, 0.151], material.cyanGlow, false);
  box(s, "key_amber_status_window", [0.16, 0.028, 0.034], [0.24, 0.225, -0.151], material.amberGlow, false);
  return s;
}

function medkit() {
  const s = new Scene();
  box(s, "medkit_hard_white_case", [0.62, 0.34, 0.42], [0, 0.17, 0], material.whiteShell);
  box(s, "medkit_dark_latch_left", [0.08, 0.06, 0.46], [-0.24, 0.22, 0], material.darkMetal);
  box(s, "medkit_dark_latch_right", [0.08, 0.06, 0.46], [0.24, 0.22, 0], material.darkMetal);
  box(s, "medkit_red_cross_vertical", [0.08, 0.018, 0.3], [0, 0.352, 0], material.redShell);
  box(s, "medkit_red_cross_horizontal", [0.3, 0.02, 0.08], [0, 0.354, 0], material.redShell);
  return s;
}

function energyCell() {
  const s = new Scene();
  cyl(s, "energy_cell_amber_core", 0.17, 0.78, [0, 0.45, 0], [0, 0, 0], material.amberGlass, 32);
  cyl(s, "energy_cell_top_cap", 0.22, 0.08, [0, 0.86, 0], [0, 0, 0], material.darkMetal, 32);
  cyl(s, "energy_cell_bottom_cap", 0.22, 0.08, [0, 0.04, 0], [0, 0, 0], material.darkMetal, 32);
  for (let i = 0; i < 4; i += 1) {
    const a = (Math.PI / 2) * i;
    box(s, `energy_cell_guard_${i + 1}`, [0.035, 0.78, 0.04], [Math.cos(a) * 0.19, 0.45, Math.sin(a) * 0.19], material.wornMetal);
  }
  return s;
}

function chipCluster() {
  const s = new Scene();
  box(s, "memory_chip_base_plate", [0.45, 0.035, 0.34], [0, 0.035, 0], material.darkMetal);
  box(s, "memory_chip_blue_board_a", [0.18, 0.035, 0.13], [-0.09, 0.08, -0.055], material.darkRubber);
  box(s, "memory_chip_blue_board_b", [0.15, 0.035, 0.12], [0.12, 0.085, 0.065], material.darkRubber);
  box(s, "memory_chip_gold_contact_a", [0.12, 0.014, 0.03], [-0.12, 0.106, 0.04], material.yellowShell);
  box(s, "memory_chip_gold_contact_b", [0.1, 0.014, 0.03], [0.14, 0.11, -0.04], material.yellowShell);
  box(s, "memory_chip_cyan_data_led", [0.08, 0.012, 0.018], [0.03, 0.114, 0.13], material.cyanGlow, false);
  return s;
}

function ammoMagazine() {
  const s = new Scene();
  box(s, "ammo_magazine_body", [0.18, 0.36, 0.1], [0, 0.18, 0], material.darkMetal);
  box(s, "ammo_magazine_floor_plate", [0.24, 0.04, 0.13], [0, 0.02, 0], material.darkRubber);
  box(s, "ammo_magazine_round_window", [0.12, 0.16, 0.012], [0, 0.21, 0.057], material.amberGlow, false);
  return s;
}

function shadowDisc() {
  const s = new Scene();
  plane(s, "soft_floor_shadow_disc", [0.78, 0.78], [0, 0.004, 0], [-Math.PI / 2, 0, 0], material.shadow);
  return s;
}

function wallSwitch(color = "cyan") {
  const s = new Scene();
  const glow = color === "red" ? material.redGlow : material.cyanGlow;
  box(s, "switch_wall_backplate", [0.7, 1.1, 0.06], [0, 0.55, 0.03], material.darkMetal);
  box(s, "switch_recessed_face", [0.54, 0.78, 0.09], [0, 0.55, 0.09], material.darkRubber);
  box(s, "switch_status_screen", [0.4, 0.2, 0.026], [0, 0.74, 0.148], glow, false);
  box(s, "switch_hand_plate", [0.32, 0.2, 0.05], [0, 0.43, 0.15], material.wornMetal);
  box(s, "switch_route_symbol_bar_a", [0.24, 0.025, 0.03], [0, 0.28, 0.154], glow, false);
  box(s, "switch_route_symbol_bar_b", [0.025, 0.17, 0.03], [-0.095, 0.35, 0.155], glow, false);
  return s;
}

function floorLever() {
  const s = new Scene();
  box(s, "floor_lever_base", [0.9, 0.16, 0.35], [0, 0.08, 0], material.darkMetal);
  box(s, "floor_lever_guard_left", [0.08, 0.28, 0.42], [-0.34, 0.24, 0], material.wornMetal);
  box(s, "floor_lever_guard_right", [0.08, 0.28, 0.42], [0.34, 0.24, 0], material.wornMetal);
  cyl(s, "floor_lever_hinge", 0.08, 0.5, [0, 0.28, 0], [Math.PI / 2, 0, 0], material.wornMetal, 24);
  box(s, "floor_lever_handle", [0.08, 0.54, 0.08], [0.13, 0.53, 0], material.yellowShell);
  box(s, "floor_lever_cyan_state", [0.48, 0.018, 0.035], [0, 0.17, 0.19], material.cyanGlow, false);
  return s;
}

function stateLight(color) {
  const s = new Scene();
  const glow = color === "red" ? material.redGlow : color === "amber" ? material.amberGlow : material.cyanGlow;
  box(s, "state_light_mount", [0.12, 0.75, 0.04], [0, 0.375, 0.02], material.darkMetal);
  box(s, `state_light_${color}_lens`, [0.055, 0.62, 0.026], [0, 0.375, 0.056], glow, false);
  return s;
}

function archiveBook() {
  const s = new Scene();
  box(s, "archive_book_left_page", [0.41, 0.035, 0.55], [-0.215, 0.045, 0], material.paper);
  box(s, "archive_book_right_page", [0.41, 0.035, 0.55], [0.215, 0.045, 0], material.paper);
  box(s, "archive_book_spine", [0.05, 0.07, 0.57], [0, 0.035, 0], material.darkMetal);
  box(s, "archive_book_clipboard_back", [0.9, 0.035, 0.62], [0, 0.014, 0], material.darkRubber);
  box(s, "archive_book_h0_label_plate", [0.16, 0.018, 0.055], [0.18, 0.071, -0.18], material.cyanGlow, false);
  return s;
}

function archiveReader() {
  const s = new Scene();
  box(s, "archive_reader_floor_stem", [0.18, 0.72, 0.18], [0, 0.36, 0], material.darkMetal);
  box(s, "archive_reader_console", [0.9, 0.28, 0.38], [0, 0.91, 0], material.darkMetal);
  box(s, "archive_reader_cyan_scan_bed", [0.56, 0.025, 0.24], [0, 1.065, 0.03], material.cyanGlow, false);
  box(s, "archive_reader_side_handle_l", [0.06, 0.18, 0.42], [-0.46, 0.9, 0], material.wornMetal);
  box(s, "archive_reader_side_handle_r", [0.06, 0.18, 0.42], [0.46, 0.9, 0], material.wornMetal);
  return s;
}

function quizPanel(red = false) {
  const s = new Scene();
  const glow = red ? material.redGlow : material.cyanGlow;
  box(s, "quiz_panel_backplate", [0.82, 1.18, 0.08], [0, 0.59, 0.04], material.darkMetal);
  box(s, "quiz_panel_screen", [0.55, 0.32, 0.035], [0, 0.82, 0.102], glow, false);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      box(s, `quiz_panel_input_${row}_${col}`, [0.12, 0.09, 0.035], [(col - 1) * 0.18, 0.46 - row * 0.13, 0.105], material.wornMetal);
    }
  }
  box(s, "quiz_panel_warning_rail", [0.66, 0.03, 0.04], [0, 0.22, 0.108], glow, false);
  return s;
}

function identityDoor() {
  const s = new Scene();
  box(s, "identity_archive_frame", [5.2, 3.5, 0.32], [0, 1.75, 0], material.darkMetal);
  box(s, "identity_archive_left_panel", [2.28, 3.12, 0.18], [-1.18, 1.75, 0.15], material.whiteShell);
  box(s, "identity_archive_right_panel", [2.28, 3.12, 0.18], [1.18, 1.75, 0.15], material.whiteShell);
  box(s, "identity_archive_center_seam", [0.08, 3.18, 0.045], [0, 1.75, 0.27], material.redGlow, false);
  box(s, "identity_archive_status_light_left", [0.08, 2.35, 0.045], [-2.18, 1.75, 0.27], material.redGlow, false);
  box(s, "identity_archive_status_light_right", [0.08, 2.35, 0.045], [2.18, 1.75, 0.27], material.redGlow, false);
  box(s, "identity_archive_access_panel_mount", [0.48, 0.78, 0.14], [2.72, 1.22, 0.18], material.darkRubber);
  return s;
}

const assetDefinitions = [
  {
    key: "pickup_large_yellow_key",
    file: "models/environment/props/hp_pickup_large_yellow_key.glb",
    scene: pickupKey,
    category: "pickup",
    defaultVisualKey: "large_yellow_key",
    sizeMeters: [0.75, 0.28, 0.45],
    pivot: "bottom_center",
    materialAtlas: "props_pickups_atlas",
    tags: ["pickup", "key", "yellow", "door-access", "config"],
  },
  {
    key: "pickup_medkit_white_red",
    file: "models/environment/props/hp_pickup_medkit_white_red.glb",
    scene: medkit,
    category: "pickup",
    defaultVisualKey: "maintenance_crate",
    sizeMeters: [0.62, 0.34, 0.42],
    pivot: "bottom_center",
    materialAtlas: "props_pickups_atlas",
    tags: ["pickup", "medkit", "repair-kit", "white", "red"],
  },
  {
    key: "pickup_energy_cell_amber",
    file: "models/environment/props/hp_pickup_energy_cell_amber.glb",
    scene: energyCell,
    category: "pickup",
    defaultVisualKey: "maintenance_crate",
    sizeMeters: [0.42, 0.42, 0.9],
    pivot: "bottom_center",
    materialAtlas: "props_pickups_atlas",
    tags: ["pickup", "energy-cell", "amber", "boss-prep"],
  },
  {
    key: "pickup_memory_chip_cluster",
    file: "models/environment/props/hp_pickup_memory_chip_cluster.glb",
    scene: chipCluster,
    category: "pickup",
    defaultVisualKey: "yellow_access_card",
    sizeMeters: [0.45, 0.08, 0.34],
    pivot: "bottom_center",
    materialAtlas: "props_pickups_atlas",
    tags: ["pickup", "memory", "chip", "archive"],
  },
  {
    key: "pickup_ammo_magazine",
    file: "models/environment/props/hp_pickup_ammo_magazine.glb",
    scene: ammoMagazine,
    category: "pickup",
    defaultVisualKey: "maintenance_crate",
    sizeMeters: [0.24, 0.36, 0.13],
    pivot: "bottom_center",
    materialAtlas: "props_pickups_atlas",
    tags: ["pickup", "ammo", "magazine", "pistol"],
  },
  {
    key: "prop_small_floor_shadow_disc",
    file: "models/environment/props/hp_prop_small_floor_shadow_disc.glb",
    scene: shadowDisc,
    category: "prop",
    defaultVisualKey: "maintenance_crate",
    sizeMeters: [0.78, 0.01, 0.78],
    pivot: "bottom_center",
    materialAtlas: "props_pickups_atlas",
    tags: ["prop", "shadow", "pickup-grounding", "low-cost"],
  },
  {
    key: "switch_panel_wall_cyan",
    file: "models/environment/props/hp_switch_panel_wall_cyan.glb",
    scene: () => wallSwitch("cyan"),
    category: "interaction",
    defaultVisualKey: "direction_keypad_panel",
    sizeMeters: [0.7, 1.1, 0.18],
    pivot: "back_center",
    materialAtlas: "switch_panel_atlas",
    tags: ["switch", "door-route", "wall", "cyan", "config"],
  },
  {
    key: "switch_panel_wall_red",
    file: "models/environment/props/hp_switch_panel_wall_red.glb",
    scene: () => wallSwitch("red"),
    category: "interaction",
    defaultVisualKey: "direction_keypad_panel",
    sizeMeters: [0.7, 1.1, 0.18],
    pivot: "back_center",
    materialAtlas: "switch_panel_atlas",
    tags: ["switch", "door-route", "wall", "red", "danger"],
  },
  {
    key: "switch_panel_floor_lever",
    file: "models/environment/props/hp_switch_panel_floor_lever.glb",
    scene: floorLever,
    category: "interaction",
    defaultVisualKey: "direction_keypad_panel",
    sizeMeters: [0.9, 0.35, 0.7],
    pivot: "bottom_center",
    materialAtlas: "switch_panel_atlas",
    tags: ["switch", "lever", "floor", "door-route", "config"],
  },
  ...["cyan", "amber", "red"].map((color) => ({
    key: `switch_state_light_${color}`,
    file: `models/environment/props/hp_switch_state_light_${color}.glb`,
    scene: () => stateLight(color),
    category: "interaction",
    defaultVisualKey: "direction_keypad_panel",
    sizeMeters: [0.12, 0.75, 0.04],
    pivot: "back_center",
    materialAtlas: "switch_panel_atlas",
    tags: ["switch", "state-light", color, "door-route"],
  })),
  {
    key: "prop_archive_book_open",
    file: "models/environment/props/hp_prop_archive_book_open.glb",
    scene: archiveBook,
    category: "interaction",
    defaultVisualKey: "archive_book",
    sizeMeters: [0.85, 0.12, 0.55],
    pivot: "bottom_center",
    materialAtlas: "archive_reader_atlas",
    tags: ["archive", "article", "readable", "level05", "config"],
  },
  {
    key: "terminal_archive_reader",
    file: "models/environment/terminals/hp_terminal_archive_reader.glb",
    scene: archiveReader,
    category: "interaction",
    defaultVisualKey: "exit_panel",
    sizeMeters: [0.9, 1.2, 0.38],
    pivot: "bottom_center",
    materialAtlas: "archive_reader_atlas",
    tags: ["terminal", "archive", "reader", "museum", "clinic"],
  },
  {
    key: "terminal_quiz_panel_red",
    file: "models/environment/terminals/hp_terminal_quiz_panel_red.glb",
    scene: () => quizPanel(true),
    category: "interaction",
    defaultVisualKey: "direction_keypad_panel",
    sizeMeters: [0.82, 1.18, 0.18],
    pivot: "back_center",
    materialAtlas: "switch_panel_atlas",
    tags: ["terminal", "quiz", "red", "danger", "level05", "config"],
  },
  {
    key: "terminal_quiz_panel_cyan",
    file: "models/environment/terminals/hp_terminal_quiz_panel_cyan.glb",
    scene: () => quizPanel(false),
    category: "interaction",
    defaultVisualKey: "direction_keypad_panel",
    sizeMeters: [0.82, 1.18, 0.18],
    pivot: "back_center",
    materialAtlas: "switch_panel_atlas",
    tags: ["terminal", "quiz", "cyan", "config"],
  },
  {
    key: "door_identity_archive",
    file: "models/environment/doors/hp_door_identity_archive.glb",
    scene: identityDoor,
    category: "door",
    defaultVisualKey: "service_elevator_door",
    sizeMeters: [5.2, 3.5, 0.46],
    pivot: "bottom_center",
    materialAtlas: "door_terminal_atlas",
    tags: ["door", "identity-archive", "level05", "hero", "red-lock"],
    mobileCost: "medium",
  },
];

function relativeRuntimeFile(file) {
  return `assets/${file}`;
}

async function exportGlb(scene, outputFile) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(scene, { binary: true });
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, Buffer.from(glb));
}

function writeAtlas(baseName, palette) {
  const size = 512;
  const ppm = [`P3\n${size} ${size}\n255\n`];
  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) {
      const tileX = Math.floor(x / 128);
      const tileY = Math.floor(y / 128);
      const color = palette[(tileY * 4 + tileX) % palette.length];
      row.push(`${color[0]} ${color[1]} ${color[2]}`);
    }
    ppm.push(`${row.join(" ")}\n`);
  }
  const ppmPath = join(textureRoot, `${baseName}.ppm`);
  const jpgPath = join(textureRoot, `${baseName}.jpg`);
  writeFileSync(ppmPath, ppm.join(""));
  execFileSync("/usr/bin/sips", ["-s", "format", "jpeg", ppmPath, "--out", jpgPath], { stdio: "ignore" });
  unlinkSync(ppmPath);
}

async function main() {
  ensureDirs();

  writeAtlas("props_pickups_atlas", [
    [244, 197, 76], [231, 236, 236], [184, 40, 50], [32, 42, 50],
    [255, 198, 90], [114, 244, 255], [111, 120, 128], [22, 27, 32],
  ]);
  writeAtlas("switch_panel_atlas", [
    [32, 42, 50], [22, 27, 32], [114, 244, 255], [255, 75, 66],
    [255, 191, 85], [111, 120, 128], [18, 42, 50], [70, 30, 32],
  ]);
  writeAtlas("archive_reader_atlas", [
    [217, 221, 212], [32, 42, 50], [114, 244, 255], [255, 75, 66],
    [231, 236, 236], [22, 27, 32], [111, 120, 128], [18, 42, 50],
  ]);
  writeAtlas("door_terminal_atlas", [
    [231, 236, 236], [32, 42, 50], [255, 75, 66], [114, 244, 255],
    [111, 120, 128], [22, 27, 32], [255, 191, 85], [70, 30, 32],
  ]);

  const manifest = [];
  for (const asset of assetDefinitions) {
    const scene = asset.scene();
    scene.name = asset.key;
    const outputFile = join(assetRoot, asset.file);
    await exportGlb(scene, outputFile);
    manifest.push({
      modelKey: asset.key,
      file: relativeRuntimeFile(asset.file),
      category: asset.category,
      defaultVisualKey: asset.defaultVisualKey,
      sizeMeters: asset.sizeMeters,
      pivot: asset.pivot,
      collision: { type: "box", sizeMeters: asset.sizeMeters },
      materialAtlas: asset.materialAtlas,
      mobileCost: asset.mobileCost ?? "low",
      tags: asset.tags,
      notes: "Procedural low-poly Human Protocol environment asset generated from scripts/optimizer/generate-environment-assets.mjs.",
    });
  }

  writeFileSync(
    join(manifestRoot, "human_protocol_environment_assets.json"),
    `${JSON.stringify({ schemaVersion: "hp.environment-assets.v1", generatedBy: "scripts/optimizer/generate-environment-assets.mjs", assets: manifest }, null, 2)}\n`,
  );

  console.log(`Generated ${manifest.length} environment assets.`);
  for (const entry of manifest) {
    console.log(`${entry.modelKey} -> src/${entry.file}`);
  }
  if (!existsSync(join(manifestRoot, "human_protocol_environment_assets.json"))) {
    throw new Error("Manifest was not written.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
