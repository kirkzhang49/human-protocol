import type { LevelDoorDefinition } from "../../game/config/schema/levelConfig";
import { DOOR_FRAME_HEIGHT, DOOR_LEAF_HEIGHT } from "./builderRuntimePackConstants";
import type { GeometryWriter } from "./GeometryWriter";

/**
 * Door kit geometry (frame / leaf / status visuals) and the door status color
 * lookup for the builder runtime pack. Extracted verbatim from
 * compileBuilderRuntimePack — modelKey, bounds, and lock/interact behavior are
 * decided by the caller; these helpers only write geometry / pick a color.
 */
export type BuilderDoorDetailMode = "normal" | "quiet";

export function pushDoorFrameBake(
  geometry: GeometryWriter,
  frameMaterial: number,
  panelMaterial: number,
  darkTrimMaterial: number,
  statusMaterial: number,
  brassMaterial: number,
  detailMode: BuilderDoorDetailMode = "normal",
) {
  geometry.pushBox(-1.78, DOOR_FRAME_HEIGHT / 2, 0, 0.36, DOOR_FRAME_HEIGHT, 0.58, frameMaterial);
  geometry.pushBox(1.78, DOOR_FRAME_HEIGHT / 2, 0, 0.36, DOOR_FRAME_HEIGHT, 0.58, frameMaterial);
  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.14, 0, 3.92, 0.32, 0.58, frameMaterial);
  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.42, -0.02, 3.22, 0.12, 0.62, darkTrimMaterial);
  geometry.pushBox(0, 0.045, 0, 4.16, 0.09, 0.98, brassMaterial);
  if (detailMode === "quiet") return;

  geometry.pushBox(0, 0.12, 0.12, 3.28, 0.08, 0.2, panelMaterial);
  geometry.pushBox(-1.48, 1.42, 0.32, 0.055, 2.02, 0.08, statusMaterial);
  geometry.pushBox(1.48, 1.42, 0.32, 0.055, 2.02, 0.08, statusMaterial);
  geometry.pushBox(-1.62, 1.42, 0.24, 0.08, 2.24, 0.06, darkTrimMaterial);
  geometry.pushBox(1.62, 1.42, 0.24, 0.08, 2.24, 0.06, darkTrimMaterial);
  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.29, 0.33, 0.74, 0.06, 0.07, statusMaterial);
  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.14, 0.36, 1.82, 0.055, 0.055, darkTrimMaterial);
  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.29, -0.33, 0.74, 0.06, 0.07, statusMaterial);
  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.14, -0.36, 1.82, 0.055, 0.055, darkTrimMaterial);
  for (const side of [-1, 1]) {
    geometry.pushBox(side * 1.58, 2.58, 0.28, 0.28, 0.12, 0.1, darkTrimMaterial);
    geometry.pushBox(side * 1.58, 2.58, -0.28, 0.28, 0.12, 0.1, darkTrimMaterial);
  }
}

export function pushDoorLeafBake(
  geometry: GeometryWriter,
  leafMaterial: number,
  panelMaterial: number,
  darkTrimMaterial: number,
  statusMaterial: number,
  frameMaterial: number,
  locked: boolean,
  detailMode: BuilderDoorDetailMode = "normal",
) {
  const centerY = 0.16 + DOOR_LEAF_HEIGHT / 2;
  // `locked` controls status/detail styling, not whether the door is open.
  // Runtime visibility/animation hides or lifts the leaf when a door opens.
  // A closed `lock.type === "none"` door still needs to cover the carved wall
  // gap; the old narrow unlocked panels left a wide visual hole in L3 entry.
  const leafCenters = [-0.72, 0.72];
  const leafWidth = 1.28;
  for (const x of leafCenters) {
    geometry.pushBox(x, centerY, 0, leafWidth, DOOR_LEAF_HEIGHT, 0.16, leafMaterial);
    if (detailMode === "quiet") continue;
    geometry.pushBox(x, centerY, 0.088, leafWidth * 0.84, DOOR_LEAF_HEIGHT * 0.82, 0.028, darkTrimMaterial);
    geometry.pushBox(x, centerY + DOOR_LEAF_HEIGHT * 0.23, 0.096, leafWidth * 0.74, 0.055, 0.045, panelMaterial);
    geometry.pushBox(x, centerY - DOOR_LEAF_HEIGHT * 0.22, 0.098, leafWidth * 0.7, 0.05, 0.045, darkTrimMaterial);
    geometry.pushBox(x, centerY + DOOR_LEAF_HEIGHT * 0.42, 0.098, leafWidth * 0.8, 0.05, 0.045, darkTrimMaterial);
    geometry.pushBox(x - leafWidth * 0.39, centerY, 0.1, 0.045, DOOR_LEAF_HEIGHT * 0.72, 0.045, panelMaterial);
    geometry.pushBox(x + leafWidth * 0.39, centerY, 0.1, 0.045, DOOR_LEAF_HEIGHT * 0.72, 0.045, panelMaterial);
    geometry.pushBox(x, centerY, -0.088, leafWidth * 0.84, DOOR_LEAF_HEIGHT * 0.82, 0.028, darkTrimMaterial);
    geometry.pushBox(x, centerY + DOOR_LEAF_HEIGHT * 0.23, -0.096, leafWidth * 0.74, 0.055, 0.045, panelMaterial);
    geometry.pushBox(x, centerY - DOOR_LEAF_HEIGHT * 0.22, -0.098, leafWidth * 0.7, 0.05, 0.045, darkTrimMaterial);
    geometry.pushBox(x, centerY + DOOR_LEAF_HEIGHT * 0.42, -0.098, leafWidth * 0.8, 0.05, 0.045, darkTrimMaterial);
    geometry.pushBox(x - leafWidth * 0.39, centerY, -0.1, 0.045, DOOR_LEAF_HEIGHT * 0.72, 0.045, panelMaterial);
    geometry.pushBox(x + leafWidth * 0.39, centerY, -0.1, 0.045, DOOR_LEAF_HEIGHT * 0.72, 0.045, panelMaterial);
  }
  if (detailMode === "quiet") return;

  if (locked) {
    geometry.pushBox(0, centerY, 0.112, 0.1, DOOR_LEAF_HEIGHT * 0.76, 0.07, darkTrimMaterial);
    geometry.pushBox(0, centerY + DOOR_LEAF_HEIGHT * 0.3, 0.12, 0.72, 0.055, 0.06, statusMaterial);
    geometry.pushBox(0, centerY - DOOR_LEAF_HEIGHT * 0.35, 0.112, 2.28, 0.045, 0.045, darkTrimMaterial);
    geometry.pushBox(1.12, centerY - 0.05, 0.16, 0.34, 0.56, 0.12, frameMaterial);
    geometry.pushBox(1.12, centerY + 0.11, 0.24, 0.18, 0.06, 0.055, statusMaterial);
    geometry.pushBox(-1.12, centerY + 0.62, 0.14, 0.18, 0.18, 0.07, statusMaterial);
    geometry.pushBox(0, centerY, -0.112, 0.1, DOOR_LEAF_HEIGHT * 0.76, 0.07, darkTrimMaterial);
    geometry.pushBox(0, centerY + DOOR_LEAF_HEIGHT * 0.3, -0.12, 0.72, 0.055, 0.06, statusMaterial);
    geometry.pushBox(0, centerY - DOOR_LEAF_HEIGHT * 0.35, -0.112, 2.28, 0.045, 0.045, darkTrimMaterial);
    geometry.pushBox(-1.12, centerY - 0.05, -0.16, 0.34, 0.56, 0.12, frameMaterial);
    geometry.pushBox(-1.12, centerY + 0.11, -0.24, 0.18, 0.06, 0.055, statusMaterial);
  } else {
    geometry.pushBox(0, 0.13, 0.095, 2.18, 0.07, 0.065, statusMaterial);
    geometry.pushBox(0, centerY + 0.52, 0.12, 0.82, 0.055, 0.055, statusMaterial);
    geometry.pushBox(0, 0.13, -0.095, 2.18, 0.07, 0.065, statusMaterial);
    geometry.pushBox(0, centerY + 0.52, -0.12, 0.82, 0.055, 0.055, statusMaterial);
  }
}

export function pushDoorStatusBake(
  geometry: GeometryWriter,
  frameMaterial: number,
  darkTrimMaterial: number,
  statusMaterial: number,
  detailMode: BuilderDoorDetailMode = "normal",
) {
  if (detailMode === "quiet") {
    geometry.pushBox(1.24, 1.36, 0.36, 0.26, 0.5, 0.12, darkTrimMaterial);
    geometry.pushBox(1.24, 1.5, 0.45, 0.12, 0.07, 0.055, statusMaterial);
    return;
  }

  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.22, 0.34, 1.18, 0.16, 0.12, frameMaterial);
  geometry.pushBox(0, DOOR_FRAME_HEIGHT - 0.22, 0.43, 0.72, 0.055, 0.055, statusMaterial);
  geometry.pushBox(-0.48, DOOR_FRAME_HEIGHT - 0.22, 0.42, 0.12, 0.12, 0.06, statusMaterial);
  geometry.pushBox(0.48, DOOR_FRAME_HEIGHT - 0.22, 0.42, 0.12, 0.12, 0.06, statusMaterial);
  geometry.pushBox(1.24, 1.36, 0.36, 0.28, 0.52, 0.12, darkTrimMaterial);
  geometry.pushBox(1.24, 1.5, 0.45, 0.14, 0.07, 0.055, statusMaterial);
}

export function builderDoorStatusColor(door: LevelDoorDefinition) {
  if (door.lock.type === "key_item") return "#ffd24f";
  if (door.lock.type === "survive_wave") return "#ff5b4c";
  if (door.lock.type === "puzzle_complete") return "#b47aff";
  if (door.materialKey === "terminal_red") return "#ff5b4c";
  return "#54e0ff";
}
