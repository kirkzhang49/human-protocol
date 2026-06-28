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
const outputRoots = [
  join(root, "src/assets/models/environment/shells"),
  join(root, "src/assets/models-cooked/environment/shells"),
];

function standard(color, roughness = 0.5, metalness = 0.7) {
  return new MeshStandardMaterial({ color, roughness, metalness });
}

function glow(color, opacity = 0.72) {
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

function cyl(scene, name, radius, depth, position, rotation, material, segments = 32) {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, segments), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function serviceElevatorInteriorShell() {
  const s = new Scene();
  const wall = standard("#29343d", 0.42, 0.78);
  const inset = standard("#111920", 0.64, 0.58);
  const plate = standard("#4f5e66", 0.36, 0.72);
  const trim = standard("#89a8ac", 0.34, 0.78);
  const dark = standard("#050b10", 0.7, 0.62);
  const cyan = glow("#71f2ff", 0.64);
  const amber = glow("#d3a14a", 0.42);

  box(s, "service_elevator_shell_back_wall", [5.74, 3.12, 0.18], [0, 1.56, -2.46], wall);
  box(s, "service_elevator_shell_back_inset", [4.96, 2.42, 0.08], [0, 1.58, -2.36], inset);
  box(s, "service_elevator_shell_back_panel_left", [2.18, 2.08, 0.07], [-1.24, 1.54, -2.3], plate);
  box(s, "service_elevator_shell_back_panel_right", [2.18, 2.08, 0.07], [1.24, 1.54, -2.3], plate);
  box(s, "service_elevator_shell_back_center_seam", [0.055, 2.52, 0.085], [0, 1.58, -2.245], dark);
  box(s, "service_elevator_shell_back_top_rail", [5.28, 0.1, 0.095], [0, 2.92, -2.24], trim);
  box(s, "service_elevator_shell_back_low_rail", [5.28, 0.08, 0.09], [0, 0.24, -2.24], trim);

  box(s, "service_elevator_shell_left_wall", [0.18, 3.08, 4.72], [-3.04, 1.54, -0.06], wall);
  box(s, "service_elevator_shell_right_wall", [0.18, 3.08, 4.72], [3.04, 1.54, -0.06], wall);
  box(s, "service_elevator_shell_left_inset", [0.08, 2.24, 3.7], [-2.94, 1.58, -0.1], inset);
  box(s, "service_elevator_shell_right_inset", [0.08, 2.24, 3.7], [2.94, 1.58, -0.1], inset);

  box(s, "service_elevator_shell_ceiling_shadow", [5.74, 0.16, 4.82], [0, 3.18, -0.08], dark);
  box(s, "service_elevator_shell_ceiling_center_plate", [3.9, 0.08, 3.42], [0, 3.08, -0.36], wall);
  box(s, "service_elevator_shell_front_top_lintel", [5.92, 0.34, 0.24], [0, 2.94, 2.22], dark);

  for (const x of [-2.42, 0, 2.42]) {
    box(s, `service_elevator_shell_cyan_vertical_${x}`, [0.042, 2.12, 0.04], [x, 1.54, -2.185], cyan, false);
  }
  for (const y of [1.12, 2.16]) {
    box(s, `service_elevator_shell_cyan_horizontal_${y}`, [4.92, 0.042, 0.04], [0, y, -2.18], cyan, false);
  }
  box(s, "service_elevator_shell_left_cyan_floor_line", [0.035, 0.032, 3.82], [-2.88, 0.21, -0.2], cyan, false);
  box(s, "service_elevator_shell_right_cyan_floor_line", [0.035, 0.032, 3.82], [2.88, 0.21, -0.2], cyan, false);
  box(s, "service_elevator_shell_amber_status_tick", [0.32, 0.04, 0.04], [1.98, 0.58, -2.17], amber, false);

  return s;
}

function serviceElevatorCallButtons() {
  const s = new Scene();
  const mount = standard("#070d12", 0.46, 0.82);
  const bevel = standard("#8fa3a5", 0.34, 0.78);
  const screen = glow("#8bf7ff", 0.78);
  const amber = glow("#e0a446", 0.78);
  const cyan = glow("#62efff", 0.88);

  box(s, "service_elevator_call_panel_mount", [0.42, 0.7, 0.08], [0, 0, 0], mount);
  box(s, "service_elevator_call_panel_bezel_top", [0.34, 0.04, 0.04], [0, 0.31, 0.055], bevel);
  box(s, "service_elevator_call_panel_bezel_bottom", [0.34, 0.04, 0.04], [0, -0.31, 0.055], bevel);
  box(s, "service_elevator_call_panel_screen", [0.27, 0.14, 0.035], [0, 0.15, 0.072], screen, false);
  cyl(s, "service_elevator_call_button_cyan", 0.075, 0.04, [-0.09, -0.13, 0.083], [Math.PI / 2, 0, 0], cyan, 32);
  cyl(s, "service_elevator_call_button_amber", 0.075, 0.04, [0.09, -0.13, 0.083], [Math.PI / 2, 0, 0], amber, 32);
  box(s, "service_elevator_call_panel_cyan_label", [0.24, 0.026, 0.03], [0, -0.27, 0.075], cyan, false);

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

const definitions = [
  {
    key: "service_elevator_interior_shell",
    file: "hp_service_elevator_interior_shell.glb",
    scene: serviceElevatorInteriorShell(),
  },
  {
    key: "service_elevator_call_buttons",
    file: "hp_service_elevator_call_buttons.glb",
    scene: serviceElevatorCallButtons(),
  },
];

for (const outputRoot of outputRoots) {
  mkdirSync(outputRoot, { recursive: true });
  for (const definition of definitions) {
    await exportGlb(definition.scene, join(outputRoot, definition.file));
    console.log(`generated ${definition.key} -> ${outputRoot}`);
  }
}
