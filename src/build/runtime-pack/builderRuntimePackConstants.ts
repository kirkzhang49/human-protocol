/**
 * Shared dimensional constants and tiny math utilities for the builder runtime
 * pack. Extracted so the bake helpers (surface / door / lighting) and the
 * compileBuilderRuntimePack orchestrator read the same values without one
 * importing the other. Values are unchanged from the original module.
 */
export const WALL_THICKNESS = 0.16;
export const DOOR_GAP_WIDTH = 3.6;
export const FLOOR_THICKNESS = 0.12;
export const SURFACE_DETAIL_THICKNESS = 0.018;
export const DOOR_FRAME_HEIGHT = 2.82;
export const DOOR_LEAF_HEIGHT = 2.36;
export const TIER_LIGHT_BUDGET = { high: 10, balanced: 8, rescue: 4 } as const;

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
