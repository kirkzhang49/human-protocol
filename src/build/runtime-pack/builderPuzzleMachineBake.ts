import type { BuilderPuzzleKind } from "../BuilderTypes";
import type { GeometryWriter } from "./GeometryWriter";
import type { MaterialTable } from "./MaterialTable";

/**
 * Procedural-fallback console geometry for each puzzle family, plus the color
 * orb marker. Used only when no cooked GLB is available. Extracted verbatim
 * from compileBuilderRuntimePack — each helper only writes through the supplied
 * GeometryWriter / MaterialTable, so behavior is unchanged.
 */

export function pushBuilderPuzzleOrb(
  geometry: GeometryWriter,
  materials: MaterialTable,
  colorKey: string,
  hex: string,
  orbCenterY: number,
) {
  const base = materials.surface(`marker:orb-base:${colorKey}`, { color: "#10161c", roughness: 0.52, visualRole: "structural_dark" });
  const brass = materials.surface(`marker:orb-brass:${colorKey}`, { color: "#9c7836", roughness: 0.36, visualRole: "route_gold" });
  const glass = materials.emissive(`marker:orb-glass:${colorKey}`, hex, 2.4, "cyan_emissive");
  const core = materials.emissive(`marker:orb-core:${colorKey}`, "#f8ffff", 0.72, "screen_label");
  const y = Math.max(0.72, orbCenterY);
  geometry.pushBox(0, 0.035, 0, 0.48, 0.07, 0.48, base);
  geometry.pushBox(0, 0.12, 0, 0.34, 0.045, 0.34, brass);
  geometry.pushBox(0, y * 0.5, 0, 0.055, y * 0.84, 0.055, base);
  geometry.pushBox(0, y - 0.25, 0, 0.22, 0.035, 0.22, brass);
  geometry.pushDiamond(0, y, 0, 0.26, 0.3, 0.26, glass);
  geometry.pushDiamond(0, y, 0, 0.13, 0.15, 0.13, core);
  geometry.pushBox(0, y + 0.28, 0, 0.12, 0.026, 0.12, brass);
}

export function pushCoolingValveClusterProxy(geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) {
  const dark = materials.surface("prop:coolant-cluster-dark", { color: "#10161b", roughness: 0.52, visualRole: "structural_dark" });
  const steel = materials.surface("prop:coolant-cluster-steel", { color: "#5f7076", roughness: 0.42, visualRole: "neutral_surface" });
  const brass = materials.surface("prop:coolant-cluster-brass", { color: "#9c7836", roughness: 0.35, visualRole: "route_gold" });
  const cyan = materials.emissive("prop:coolant-cluster-cyan", "#54e0ff", 0.74, "door_access_cyan");
  const amber = materials.emissive("prop:coolant-cluster-amber", "#ffb34f", 0.74, "route_gold");
  const red = materials.emissive("prop:coolant-cluster-red", "#ff5b4c", 0.64, "danger_red");

  geometry.pushBox(0, 0.045, 0, 1.22, 0.09, 0.8, dark);
  geometry.pushBox(0, 0.42, 0, 1.04, 0.64, 0.44, bodyMaterial);
  geometry.pushBox(0, 0.78, 0.02, 1.16, 0.12, 0.16, steel);
  geometry.pushBox(0, 0.3, 0.28, 1.18, 0.075, 0.08, steel);
  geometry.pushBox(0, 0.16, 0.36, 0.94, 0.028, 0.04, amber);

  const wheelXs = [-0.38, 0, 0.38];
  wheelXs.forEach((x, index) => {
    const glow = index === 0 ? cyan : index === 1 ? amber : red;
    const y = index === 1 ? 1.14 : 1.05;
    geometry.pushBox(x, 0.96, 0.2, 0.07, 0.36, 0.07, steel);
    geometry.pushDiamond(x, y, 0.32, 0.18, 0.18, 0.045, brass);
    geometry.pushBox(x, y, 0.36, 0.33, 0.045, 0.035, glow);
    geometry.pushBox(x, y, 0.36, 0.045, 0.33, 0.035, glow);
    geometry.pushBox(x, y, 0.385, 0.07, 0.07, 0.035, dark);
  });

  for (const x of [-0.44, 0.44]) {
    geometry.pushDiamond(x, 0.55, 0.34, 0.12, 0.12, 0.035, amber);
    geometry.pushBox(x, 0.55, 0.37, 0.045, 0.16, 0.024, dark);
  }
}

// ---------------------------------------------------------------------------
// Puzzle machines — one recognizable cabinet per puzzle family
// ---------------------------------------------------------------------------

/** 灯序墙: physical light panel; the answer order is only shown by the 2D playback overlay. */
export function pushColorPatternEasel(geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) {
  const easelDark = materials.surface("puzzle:easel-board", { color: "#120e16", roughness: 0.4, visualRole: "structural_dark" });
  const brass = materials.surface("puzzle:easel-brass", { color: "#9c7836", roughness: 0.35, visualRole: "route_gold" });
  const trim = materials.surface("puzzle:easel-trim", { color: "#2f2635", roughness: 0.42, visualRole: "neutral_surface" });
  const dimLens = materials.surface("puzzle:lamp-wall-dim-lens", { color: "#142a2c", roughness: 0.24, visualRole: "glass_shell" });
  // splayed legs + cross bar
  geometry.pushBox(-0.42, 0.48, 0.1, 0.07, 0.96, 0.07, bodyMaterial);
  geometry.pushBox(0.42, 0.48, 0.1, 0.07, 0.96, 0.07, bodyMaterial);
  geometry.pushBox(0, 0.34, 0.1, 0.86, 0.055, 0.07, bodyMaterial);
  geometry.pushBox(0, 0.08, 0, 0.82, 0.08, 0.42, trim);
  // tilted display board with brass cap
  geometry.pushBox(0, 1.02, -0.04, 1.02, 0.72, 0.08, easelDark);
  geometry.pushBox(0, 1.42, -0.06, 1.1, 0.07, 0.1, brass);
  geometry.pushBox(0, 1.06, 0.012, 0.84, 0.18, 0.028, materials.emissive("puzzle:lamp-wall-idle-slot", "#49e7d8", 0.32, "cyan_emissive"));
  const colors = ["#ff5f54", "#64a7ff", "#ffd45f", "#65f19a", "#bc83ff", "#eefbff", "#5ff3ff"];
  const spread = 0.78;
  colors.forEach((hex, index) => {
    const x = -spread / 2 + (spread / (colors.length - 1)) * index;
    const lamp = materials.emissive(`puzzle:lamp-wall-lens:${index}`, hex, index === 0 ? 1.35 : 0.72, "cyan_emissive");
    geometry.pushBox(x, 1.08, 0.035, 0.075, 0.075, 0.034, lamp);
    geometry.pushBox(x, 0.91, 0.018, 0.066, 0.028, 0.026, dimLens);
  });
  geometry.pushBox(0, 1.31, 0.01, 0.42, 0.035, 0.03, materials.emissive("puzzle:lamp-wall-ready-line", "#b47aff", 1.15, "cyan_emissive"));
}

/** 配电壁龛: upright circuit cabinet with a live 3x3 trace grid + conduits. */
export function pushCircuitCabinet(geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) {
  const recess = materials.surface("puzzle:circuit-recess", { color: "#0a1016", roughness: 0.42, visualRole: "structural_dark" });
  const trace = materials.emissive("puzzle:circuit-trace", "#54f1ff", 1.55, "door_access_cyan");
  const dead = materials.surface("puzzle:circuit-dead", { color: "#27313c", roughness: 0.5, visualRole: "neutral_surface" });
  const hazard = materials.emissive("puzzle:circuit-hazard", "#ffb34f", 0.9, "route_gold");
  geometry.pushBox(0, 0.75, 0, 0.84, 1.5, 0.3, bodyMaterial);
  geometry.pushBox(0, 0.82, 0.15, 0.66, 0.92, 0.05, recess);
  // 3x3 cell grid: powered L-path glows, the rest is dead conduit
  const lit = new Set([0, 3, 4, 5, 8]);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const index = row * 3 + col;
      geometry.pushBox(-0.21 + col * 0.21, 1.1 - row * 0.23, 0.19, 0.145, 0.145, 0.032, lit.has(index) ? trace : dead);
    }
  }
  // conduit pipes feeding the cabinet + hazard skirt
  geometry.pushBox(-0.24, 1.62, 0, 0.1, 0.26, 0.1, bodyMaterial);
  geometry.pushBox(0.24, 1.62, 0, 0.1, 0.26, 0.1, bodyMaterial);
  geometry.pushBox(0, 0.13, 0.15, 0.72, 0.06, 0.045, hazard);
}

/** 监控比对台: console desk, triple screen bank (one dead), camera mast. */
export function pushSurveillanceBank(geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) {
  const live = materials.emissive("puzzle:cam-live", "#9be8ff", 1.25, "screen_label");
  const dead = materials.surface("puzzle:cam-dead", { color: "#05080c", roughness: 0.25, visualRole: "structural_dark" });
  const trim = materials.surface("puzzle:cam-trim", { color: "#3a4754", roughness: 0.45, visualRole: "neutral_surface" });
  // desk console
  geometry.pushBox(0, 0.34, 0.08, 0.98, 0.68, 0.38, bodyMaterial);
  geometry.pushBox(0, 0.72, 0.16, 0.84, 0.05, 0.24, trim);
  // riser with three screens — the middle one shows no signal
  geometry.pushBox(0, 1.04, -0.08, 0.9, 0.44, 0.09, trim);
  geometry.pushBox(-0.28, 1.04, -0.015, 0.23, 0.3, 0.028, live);
  geometry.pushBox(0, 1.04, -0.015, 0.23, 0.3, 0.028, dead);
  geometry.pushBox(0.28, 1.04, -0.015, 0.23, 0.3, 0.028, live);
  // camera mast watching the player back
  geometry.pushBox(0.43, 1.24, -0.12, 0.05, 0.92, 0.05, trim);
  geometry.pushBox(0.43, 1.68, -0.04, 0.22, 0.12, 0.16, bodyMaterial);
  geometry.pushBox(0.43, 1.66, 0.06, 0.07, 0.055, 0.035, materials.emissive("puzzle:cam-eye", "#ff5b4c", 1.15, "danger_red"));
}

/** 闸门配平台: screen terminal with three shutter gates and status readouts. */
export function pushValveManifold(geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) {
  const dark = materials.surface("puzzle:gate-balance-dark", { color: "#05090c", roughness: 0.64, visualRole: "structural_dark" });
  const trim = materials.surface("puzzle:gate-balance-trim", { color: "#5f7076", roughness: 0.38, visualRole: "neutral_surface" });
  const glass = materials.emissive("puzzle:gate-balance-screen", "#8dfaff", 0.82, "screen_label");
  const safe = materials.emissive("puzzle:gate-balance-safe", "#63ffd4", 1.0, "door_access_cyan");
  const amber = materials.emissive("puzzle:gate-balance-amber", "#ffbd61", 0.82, "route_gold");

  geometry.pushBox(0, 0.09, 0, 1.42, 0.18, 0.42, dark);
  geometry.pushBox(0, 0.78, 0, 1.36, 1.08, 0.34, bodyMaterial);
  geometry.pushBox(0, 0.96, 0.2, 1.16, 0.72, 0.055, trim);
  geometry.pushBox(0, 0.96, 0.238, 1.04, 0.58, 0.028, glass);
  [-0.31, 0, 0.31].forEach((x, index) => {
    const gateGlow = index === 1 ? safe : amber;
    geometry.pushBox(x, 1.05, 0.27, 0.2, 0.3, 0.035, dark);
    geometry.pushBox(x - 0.045, 1.05, 0.295, 0.018, 0.24, 0.025, glass);
    geometry.pushBox(x + 0.045, 1.05, 0.295, 0.018, 0.24, 0.025, glass);
    geometry.pushBox(x, index === 1 ? 1.04 : 0.99, 0.312, 0.12, index === 1 ? 0.18 : 0.1, 0.026, gateGlow);
    geometry.pushBox(x, 0.73, 0.296, 0.12, 0.026, 0.024, gateGlow);
  });
  geometry.pushBox(0, 0.48, 0.24, 1.06, 0.055, 0.05, amber);
  for (let index = 0; index < 8; index += 1) {
    geometry.pushBox(-0.42 + index * 0.12, 0.36, 0.28, 0.055, 0.08, 0.045, amber);
  }
  geometry.pushBox(0.78, 0.82, 0, 0.18, 0.66, 0.24, bodyMaterial);
  geometry.pushBox(0.78, 1.06, 0.15, 0.08, 0.08, 0.035, safe);
  geometry.pushBox(0.78, 0.84, 0.15, 0.055, 0.055, 0.032, amber);
}

/** 身份压缩柜: archive file compressor with lit tile matrix and brass clamp rail. */
export function pushArchiveMergeCabinet(geometry: GeometryWriter, materials: MaterialTable, _bodyMaterial: number) {
  const shell = materials.surface("puzzle:archive-merge-shell", { color: "#071012", roughness: 0.58, visualRole: "structural_dark" });
  const dark = materials.surface("puzzle:archive-merge-recess", { color: "#020607", roughness: 0.46, visualRole: "structural_dark" });
  const cheek = materials.surface("puzzle:archive-merge-worn-ceramic-edge", { color: "#2f3c3d", roughness: 0.56, visualRole: "neutral_surface" });
  const brass = materials.surface("puzzle:archive-merge-brass", { color: "#9f7736", roughness: 0.36, visualRole: "route_gold" });
  const glass = materials.surface("puzzle:archive-merge-smoked-glass", { color: "#173338", roughness: 0.24, visualRole: "glass_shell" });
  const live = materials.emissive("puzzle:archive-merge-live-tile", "#f0c46f", 1.15, "route_gold");
  const cyan = materials.emissive("puzzle:archive-merge-cyan-line", "#70f0ff", 0.72, "door_access_cyan");
  const dimTile = materials.surface("puzzle:archive-merge-dim-tile", { color: "#172024", roughness: 0.42, visualRole: "neutral_surface" });

  geometry.pushBox(0, 0.06, 0, 1.1, 0.12, 0.52, dark);
  geometry.pushBox(0, 0.15, 0, 1.02, 0.18, 0.44, shell);
  geometry.pushBox(0, 0.86, 0, 0.98, 1.36, 0.36, shell);
  geometry.pushBox(-0.52, 0.86, 0, 0.075, 1.28, 0.42, cheek);
  geometry.pushBox(0.52, 0.86, 0, 0.075, 1.28, 0.42, cheek);
  geometry.pushBox(0, 1.57, 0, 0.94, 0.11, 0.42, dark);
  geometry.pushBox(0, 1.57, 0.23, 0.86, 0.05, 0.045, brass);

  geometry.pushBox(0, 1.42, 0.23, 0.62, 0.22, 0.07, dark);
  geometry.pushBox(0, 1.42, 0.275, 0.55, 0.16, 0.026, glass);
  geometry.pushBox(-0.11, 1.42, 0.305, 0.09, 0.13, 0.024, live);
  geometry.pushBox(0.11, 1.42, 0.305, 0.09, 0.13, 0.024, live);
  geometry.pushBox(-0.39, 1.42, 0.29, 0.055, 0.075, 0.032, cyan);
  geometry.pushBox(0.39, 1.42, 0.29, 0.055, 0.075, 0.032, live);

  geometry.pushBox(0, 1.03, 0.2, 0.78, 0.76, 0.08, dark);
  geometry.pushBox(0, 1.03, 0.255, 0.7, 0.68, 0.024, glass);
  const liveTiles = new Set([0, 5, 6, 9, 10, 15]);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const index = row * 4 + col;
      const x = -0.255 + col * 0.17;
      const y = 1.255 - row * 0.16;
      const tileMaterial = liveTiles.has(index) ? (index === 0 || index === 5 ? cyan : live) : dimTile;
      geometry.pushBox(x, y, 0.31, 0.122, 0.118, 0.052, tileMaterial);
    }
  }

  geometry.pushBox(0, 1.31, 0.32, 0.72, 0.045, 0.04, brass);
  geometry.pushBox(0, 0.72, 0.32, 0.72, 0.038, 0.035, brass);
  geometry.pushBox(-0.36, 1.02, 0.32, 0.04, 0.58, 0.04, brass);
  geometry.pushBox(0.36, 1.02, 0.32, 0.04, 0.58, 0.04, brass);

  geometry.pushBox(-0.22, 0.52, 0.25, 0.34, 0.12, 0.06, dark);
  geometry.pushBox(-0.22, 0.52, 0.305, 0.2, 0.018, 0.02, cyan);
  geometry.pushBox(0.22, 0.52, 0.25, 0.3, 0.18, 0.065, dark);
  geometry.pushBox(0.22, 0.52, 0.315, 0.14, 0.026, 0.018, brass);
  for (let index = 0; index < 3; index += 1) {
    geometry.pushBox(0.22, 0.3 + index * 0.035, 0.31, 0.28, 0.01, 0.018, cheek);
  }
  geometry.pushBox(-0.34, 0.52, 0.32, 0.028, 0.028, 0.026, cyan);
  geometry.pushBox(-0.1, 0.52, 0.32, 0.028, 0.028, 0.026, cyan);
}

/**
 * Procedural-fallback console geometry per puzzle kind. The cooked GLB takes
 * priority in compileBuilderRuntimePack; this map is only used when no cooked
 * model exists. Heavy geometry stays in this module — the registry only knows
 * model keys / bounds / light color.
 */
const PUZZLE_CONSOLE_FALLBACK_BAKE: Record<
  BuilderPuzzleKind,
  (geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) => void
> = {
  color_sequence: pushColorPatternEasel,
  circuit_grid: pushCircuitCabinet,
  code_lock: pushCircuitCabinet,
  surveillance_match: pushSurveillanceBank,
  valve_matrix: pushValveManifold,
  archive_merge: pushArchiveMergeCabinet,
  gallery_reading: pushGalleryReaderCabinet,
};

export function puzzleConsoleFallbackBake(
  kind: BuilderPuzzleKind,
  geometry: GeometryWriter,
  materials: MaterialTable,
  bodyMaterial: number,
): void {
  PUZZLE_CONSOLE_FALLBACK_BAKE[kind](geometry, materials, bodyMaterial);
}

/** 展画审读机: gallery reader desk — framed painting slot, inspection lamp, answer-card tray. */
export function pushGalleryReaderCabinet(geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) {
  const dark = materials.surface("puzzle:gallery-dark", { color: "#171109", roughness: 0.4, visualRole: "structural_dark" });
  const brass = materials.surface("puzzle:gallery-brass", { color: "#b89450", roughness: 0.32, visualRole: "route_gold" });
  const canvas = materials.surface("puzzle:gallery-canvas", { color: "#3a2c16", roughness: 0.55, visualRole: "glass_shell" });
  const lamp = materials.emissive("puzzle:gallery-lamp", "#f6e7bf", 1.4, "route_gold");
  const cyan = materials.emissive("puzzle:gallery-card-line", "#70f0ff", 0.6, "door_access_cyan");
  // Reader plinth + angled reading desk.
  geometry.pushBox(0, 0.5, 0, 0.92, 1.0, 0.4, bodyMaterial);
  geometry.pushBox(0, 1.02, 0.04, 0.86, 0.12, 0.46, dark);
  // Framed painting slot on the upper wall plate.
  geometry.pushBox(0, 1.5, -0.04, 0.78, 0.84, 0.08, dark);
  geometry.pushBox(0, 1.5, 0.0, 0.64, 0.7, 0.04, canvas);
  geometry.pushBox(0, 1.5, 0.022, 0.66, 0.72, 0.02, brass);
  // Inspection lamp arching over the painting.
  geometry.pushBox(0, 1.98, 0.16, 0.1, 0.1, 0.34, brass);
  geometry.pushBox(0, 1.96, 0.32, 0.34, 0.08, 0.12, lamp);
  // Answer-card tray: three lit slots on the desk.
  for (let index = 0; index < 3; index += 1) {
    geometry.pushBox(-0.26 + index * 0.26, 1.06, 0.2, 0.2, 0.02, 0.12, index === 1 ? lamp : dark);
  }
  geometry.pushBox(0, 1.12, 0.18, 0.66, 0.02, 0.03, cyan);
  // Brass side rails.
  geometry.pushBox(-0.4, 0.74, 0.04, 0.06, 1.4, 0.06, brass);
  geometry.pushBox(0.4, 0.74, 0.04, 0.06, 1.4, 0.06, brass);
}

/**
 * 管制路由台: low route-control console fallback (fast packs, no cooked GLB).
 * Wide base, raised brass deck with a rotary direction ring, a locked key
 * authorization core, and four colour-coded output sockets over cable lanes —
 * visibly a router, distinct from the upright puzzle consoles.
 */
export function pushRouteSwitchConsole(geometry: GeometryWriter, materials: MaterialTable, bodyMaterial: number) {
  const dark = materials.surface("route:console-dark", { color: "#10161b", roughness: 0.5, visualRole: "structural_dark" });
  const steel = materials.surface("route:console-steel", { color: "#566973", roughness: 0.4, visualRole: "neutral_surface" });
  const brass = materials.surface("route:console-brass", { color: "#9c7836", roughness: 0.34, visualRole: "route_gold" });
  const ring = materials.emissive("route:console-ring", "#5ee8c8", 1.2, "door_access_cyan");
  const keyCore = materials.emissive("route:console-key", "#ffd76b", 1.0, "route_gold");
  const outputHexes = ["#ff5f54", "#ffd45f", "#64a7ff", "#65f19a"];
  // Grounded base + brass control deck (low, landscape — not an upright tower).
  geometry.pushBox(0, 0.07, 0, 1.18, 0.14, 0.74, dark);
  geometry.pushBox(0, 0.5, 0, 1.0, 0.78, 0.58, bodyMaterial);
  geometry.pushBox(0, 0.93, 0, 1.06, 0.12, 0.64, steel);
  geometry.pushBox(0, 1.0, -0.04, 0.92, 0.04, 0.5, brass);
  // Rotary direction ring + hub on the deck.
  geometry.pushDiamond(-0.24, 1.06, 0.0, 0.2, 0.05, 0.2, brass);
  geometry.pushBox(-0.24, 1.07, 0.0, 0.26, 0.018, 0.26, ring);
  geometry.pushDiamond(-0.24, 1.08, 0.0, 0.07, 0.05, 0.07, steel);
  // Locked key-authorization core (front-centre).
  geometry.pushBox(0.04, 0.62, 0.3, 0.18, 0.34, 0.08, dark);
  geometry.pushBox(0.04, 0.7, 0.345, 0.1, 0.04, 0.03, keyCore);
  // Four colour-coded output sockets + cable lanes dropping to the floor.
  outputHexes.forEach((hex, index) => {
    const x = -0.36 + index * 0.24;
    const lens = materials.emissive(`route:console-out:${index}`, hex, 1.1, "cyan_emissive");
    geometry.pushBox(x, 1.04, 0.22, 0.085, 0.03, 0.085, steel);
    geometry.pushBox(x, 1.07, 0.22, 0.06, 0.02, 0.06, lens);
    geometry.pushBox(x, 0.14, 0.34, 0.04, 0.18, 0.03, dark);
  });
  geometry.pushBox(0, 0.16, 0.32, 0.94, 0.05, 0.04, materials.emissive("route:console-cable-rail", "#5ee8c8", 0.5, "door_access_cyan"));
}
