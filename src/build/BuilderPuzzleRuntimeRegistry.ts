import type { EnvironmentModelKey } from "../assets/environmentModelAssets";
import type { LevelPuzzleDefinition } from "../game/config/schema/levelConfig";
import { builderPuzzleKinds, builderPuzzlePublicKinds, puzzleKindEntry, type BuilderPuzzleKindEntry } from "./BuilderPuzzleCatalog";
import type { BuilderPuzzleInstance, BuilderPuzzleKind } from "./BuilderTypes";

/**
 * Single source of truth for how each builder puzzle kind maps onto runtime
 * assets and systems. Display facets (label / glyph / tier) live in
 * {@link builderPuzzleKinds}; this registry adds the *runtime/asset* facets that
 * used to be duplicated across `BuilderRuntimeAssetIndex`,
 * `compileBuilderRuntimePack`, and `BuilderPreview3D` as hand-written switches.
 *
 * Changing a console model key, fallback bounds, accent light, or runtime-type
 * alias now happens in one place. This file intentionally does not change any
 * compiled output — it only centralizes the existing mappings.
 */
export type BuilderPuzzleRuntimeFamily = "color_orbs" | "console_2d";

export interface BuilderPuzzleRuntimeEntry {
  kind: BuilderPuzzleKind;
  /** Console GLB / runtime model key (`puzzle_console_*`). */
  consoleModelKey: EnvironmentModelKey;
  /** How this kind compiles onto the existing runtime systems. */
  runtimeFamily: BuilderPuzzleRuntimeFamily;
  /**
   * Runtime `LevelPuzzleDefinition["type"]` values that resolve back to this
   * builder kind. Some kinds carry a legacy alias (e.g. `tool_calibration` and
   * `circuit_grid` both map to the `circuit_grid` console).
   */
  runtimeTypes: readonly LevelPuzzleDefinition["type"][];
  /**
   * Procedural-fallback console half-extents `[x, y, z]`, used only when no
   * cooked GLB is available (the cooked path uses the real GLB bounds).
   */
  proceduralBoundsHalf: readonly [number, number, number];
  /** Console accent point-light color. */
  lightColor: string;
}

/** Half-extents for an unknown / unmapped console (legacy `puzzleMachineBounds(null)`). */
export const PUZZLE_CONSOLE_DEFAULT_BOUNDS_HALF: readonly [number, number, number] = [0.35, 0.75, 0.3];

const RUNTIME_FACETS: Record<BuilderPuzzleKind, Omit<BuilderPuzzleRuntimeEntry, "kind">> = {
  color_sequence: {
    consoleModelKey: "puzzle_console_color_sequence",
    runtimeFamily: "color_orbs",
    runtimeTypes: ["hit_sequence"],
    proceduralBoundsHalf: [0.62, 0.82, 0.28],
    lightColor: "#b47aff",
  },
  circuit_grid: {
    consoleModelKey: "puzzle_console_circuit_grid",
    runtimeFamily: "console_2d",
    runtimeTypes: ["tool_calibration", "circuit_grid"],
    proceduralBoundsHalf: [0.46, 0.9, 0.24],
    lightColor: "#54e0ff",
  },
  code_lock: {
    consoleModelKey: "terminal_code_keypad",
    runtimeFamily: "console_2d",
    runtimeTypes: ["code_lock"],
    proceduralBoundsHalf: [0.38, 0.78, 0.24],
    lightColor: "#ffcf6a",
  },
  archive_merge: {
    consoleModelKey: "puzzle_console_archive_merge",
    runtimeFamily: "console_2d",
    runtimeTypes: ["archive_merge"],
    proceduralBoundsHalf: [0.52, 0.84, 0.26],
    lightColor: "#ffb34f",
  },
  gallery_reading: {
    consoleModelKey: "puzzle_console_gallery_reading",
    runtimeFamily: "console_2d",
    runtimeTypes: ["gallery_reading"],
    proceduralBoundsHalf: [0.52, 1.04, 0.24],
    lightColor: "#ffb34f",
  },
  surveillance_match: {
    consoleModelKey: "puzzle_console_surveillance_match",
    runtimeFamily: "console_2d",
    runtimeTypes: ["surveillance_match"],
    proceduralBoundsHalf: [0.56, 0.92, 0.28],
    lightColor: "#54e0ff",
  },
  valve_matrix: {
    consoleModelKey: "puzzle_console_valve_matrix",
    runtimeFamily: "console_2d",
    runtimeTypes: ["valve_matrix"],
    proceduralBoundsHalf: [0.86, 0.77, 0.28],
    lightColor: "#63ffd4",
  },
};

export const builderPuzzleRuntime: Record<BuilderPuzzleKind, BuilderPuzzleRuntimeEntry> = Object.fromEntries(
  (Object.entries(RUNTIME_FACETS) as [BuilderPuzzleKind, Omit<BuilderPuzzleRuntimeEntry, "kind">][]).map(
    ([kind, facets]) => [kind, { kind, ...facets }],
  ),
) as Record<BuilderPuzzleKind, BuilderPuzzleRuntimeEntry>;

export function puzzleRuntimeEntry(kind: BuilderPuzzleKind): BuilderPuzzleRuntimeEntry {
  return builderPuzzleRuntime[kind];
}

/** Display + runtime facets for one kind, merged into a single lookup. */
export function puzzleKindInfo(kind: BuilderPuzzleKind): BuilderPuzzleKindEntry & BuilderPuzzleRuntimeEntry {
  return { ...puzzleKindEntry(kind), ...builderPuzzleRuntime[kind] };
}

const RUNTIME_TYPE_TO_KIND: ReadonlyMap<LevelPuzzleDefinition["type"], BuilderPuzzleKind> = new Map(
  Object.values(builderPuzzleRuntime).flatMap((entry) =>
    entry.runtimeTypes.map((type) => [type, entry.kind] as const),
  ),
);

/** Reverse map: a runtime puzzle `type` → its builder console kind (or null). */
export function builderPuzzleKindForRuntimeType(type: LevelPuzzleDefinition["type"]): BuilderPuzzleKind | null {
  return RUNTIME_TYPE_TO_KIND.get(type) ?? null;
}

export function puzzleConsoleModelKey(kind: BuilderPuzzleKind): EnvironmentModelKey {
  return builderPuzzleRuntime[kind].consoleModelKey;
}

export function puzzleConsoleProceduralBoundsHalf(kind: BuilderPuzzleKind | null): [number, number, number] {
  const half = kind ? builderPuzzleRuntime[kind].proceduralBoundsHalf : PUZZLE_CONSOLE_DEFAULT_BOUNDS_HALF;
  return [half[0], half[1], half[2]];
}

export function puzzleConsoleLightColor(kind: BuilderPuzzleKind): string {
  return builderPuzzleRuntime[kind].lightColor;
}

/** Imported/official puzzles can be hosted by an existing prop instead of drawing a standalone console. */
export function puzzleInstanceUsesHostedInteraction(instance: Pick<BuilderPuzzleInstance, "sourceInteraction">): boolean {
  return Boolean(instance.sourceInteraction?.hostPropId);
}

export { builderPuzzleKinds, builderPuzzlePublicKinds };
