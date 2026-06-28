import { enemyModelAssets, type EnemyModelKey } from "../../assets/enemyModelAssets";
import { environmentModelAssets, modelKeyForDoor, modelKeyForInteraction, modelKeyForPuzzleOrbTarget } from "../../assets/environmentModelAssets";
import { rawViewmodelCookAssets } from "../../assets/rawViewmodelCookAssets";
import type { LevelDefinition } from "../../game/config/schema/levelConfig";
import { pickupVisualIntents } from "../../game/visual/PickupVisualIntent";
import { STORY_PAINTING_ART_MODEL_KEYS } from "../../game/visual/StoryPaintingArtKeys";
import {
  isRawViewmodelProceduralModelKey,
  RAW_VIEWMODEL_HAND_MODEL_KEYS,
  RAW_VIEWMODEL_MODEL_KEYS,
  RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS,
} from "../../render/raw-webgpu/RawViewmodelMode";
import { builderPropCatalog } from "../BuilderAssetCatalog";
import { builderPuzzleRuntime } from "../BuilderPuzzleRuntimeRegistry";
import { resolveBuilderBakePlan, type ResolvedBuilderBakePlan } from "../official-bridge/ResolvedBakePlan";
import type { BuilderProject } from "../BuilderTypes";

export type BuilderRuntimeAssetKind = "surface" | "door" | "enemy" | "furniture" | "pickup" | "viewmodel" | "hand";
export type BuilderNativeRawAssetKind = BuilderRuntimeAssetKind;
export type BuilderDeepModelRequestKind = "furniture" | "pickup" | "enemy" | "viewmodel";

export interface BuilderRuntimeAssetIndexEntry {
  modelKey: string;
  kind: BuilderRuntimeAssetKind;
  roles: readonly BuilderRuntimeAssetKind[];
  glbUrl: string | null;
  nativeRawEligible: boolean;
}

export interface BuilderNativeRawModelRequest {
  modelKey: string;
  kind: BuilderNativeRawAssetKind;
}

export interface BuilderDeepModelRequest {
  modelKey: string;
  url: string;
  kind: BuilderDeepModelRequestKind;
}

export interface BuilderDeepModelCollection {
  requests: BuilderDeepModelRequest[];
  /** modelKeys with no registry URL - these stay proxy and are reported. */
  unresolved: string[];
}

export interface BuilderRuntimeAssetIndexSummary {
  total: number;
  mapped: number;
  missing: string[];
  byKind: Record<BuilderRuntimeAssetKind, { total: number; mapped: number; missing: number }>;
}

export const BUILDER_NATIVE_RAW_RESOURCE_PACK_ID = "builder_runtime_resources";

export const BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS = [
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
] as const;

export const BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS = [
  ...BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS,
  BUILDER_NATIVE_RAW_RESOURCE_PACK_ID,
] as const;

const BUILDER_NATIVE_SHARED_PUZZLE_CONSOLE_MODEL_KEYS = new Set<string>([
  "puzzle_console_color_sequence",
  "puzzle_console_valve_matrix",
]);

const BUILDER_SHARED_PUZZLE_CONSOLE_MODEL_KEYS = [
  ...new Set(
    Object.values(builderPuzzleRuntime)
      .map((entry) => entry.consoleModelKey)
      .filter((modelKey) => BUILDER_NATIVE_SHARED_PUZZLE_CONSOLE_MODEL_KEYS.has(modelKey)),
  ),
];

export const BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS = new Set<string>([
  ...BUILDER_SHARED_PUZZLE_CONSOLE_MODEL_KEYS,
  "room_museum_last_human_tool_vitrine",
  "room_museum_voice_archive_case",
  "room_museum_skeleton_vitrine",
]);

const BUILDER_TEXTURED_STORY_PAINTING_MODEL_KEYS = new Set<string>(STORY_PAINTING_ART_MODEL_KEYS);

const BUILDER_LEVEL_PROP_RESOURCE_EXCLUDE_KEYS = new Set<string>([
  "room_ceiling_panel_maintenance",
]);

export const BUILDER_ALL_ENEMY_MODEL_KEYS = Object.keys(enemyModelAssets) as EnemyModelKey[];

export const BUILDER_ASSETS_V1_NATIVE_RAW_MODEL_KEYS = new Set<string>([
  "puzzle_orb_free_blue",
  "puzzle_orb_free_cyan",
  "puzzle_orb_free_green",
  "puzzle_orb_free_purple",
  "puzzle_orb_free_red",
  "puzzle_orb_free_white",
  "puzzle_orb_free_yellow",
]);

function builderRuntimeEnvironmentGlbUrl(modelKey: string): string | null {
  if (BUILDER_TEXTURED_STORY_PAINTING_MODEL_KEYS.has(modelKey)) return null;
  return environmentModelAssets[modelKey as keyof typeof environmentModelAssets]?.url ?? null;
}

export function builderRuntimeAssetIndexForLevel(level: LevelDefinition): BuilderRuntimeAssetIndexEntry[] {
  const entries = new Map<string, MutableBuilderRuntimeAssetIndexEntry>();
  registerBuilderEnemyAssets(entries);
  registerBuilderLevelFurnitureAssets(entries, [level]);
  registerBuilderInteractionAssets(entries, [level]);
  registerBuilderPuzzleTargetAssets(entries, [level]);
  registerBuilderSharedRuntimeAssets(entries);

  return finalizeBuilderRuntimeAssetEntries(entries);
}

export function builderRuntimeAssetIndexForProject(level: LevelDefinition, project: BuilderProject): BuilderRuntimeAssetIndexEntry[] {
  const bakePlan = resolveBuilderBakePlan(level, project);
  const entries = new Map<string, MutableBuilderRuntimeAssetIndexEntry>();
  registerBuilderEnemyAssets(entries);
  registerBuilderLevelFurnitureAssets(entries, [level]);
  registerBuilderInteractionAssets(entries, [level]);
  registerBuilderProjectShellAssets(entries, level, project, bakePlan);
  registerBuilderSharedRuntimeAssets(entries);

  return finalizeBuilderRuntimeAssetEntries(entries);
}

export function builderWgpuResourceIndexForLevels(levels: readonly LevelDefinition[]): BuilderRuntimeAssetIndexEntry[] {
  const entries = new Map<string, MutableBuilderRuntimeAssetIndexEntry>();
  registerBuilderEnemyAssets(entries);
  registerBuilderLevelFurnitureAssets(entries, levels);
  registerBuilderInteractionAssets(entries, levels);
  registerBuilderPuzzleTargetAssets(entries, levels);
  registerBuilderCatalogFurnitureAssets(entries);
  registerBuilderSharedRuntimeAssets(entries);

  return finalizeBuilderRuntimeAssetEntries(entries);
}

function registerBuilderEnemyAssets(entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>) {
  for (const modelKey of BUILDER_ALL_ENEMY_MODEL_KEYS) {
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "enemy",
      glbUrl: enemyModelAssets[modelKey]?.url ?? null,
      nativeRawEligible: true,
    });
  }
}

function registerBuilderLevelFurnitureAssets(entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>, levels: readonly LevelDefinition[]) {
  for (const level of levels) {
    for (const prop of level.map?.props ?? []) {
      if (BUILDER_LEVEL_PROP_RESOURCE_EXCLUDE_KEYS.has(prop.modelKey)) continue;
      registerBuilderRuntimeAsset(entries, {
        modelKey: prop.modelKey,
        kind: "furniture",
        glbUrl: builderRuntimeEnvironmentGlbUrl(prop.modelKey),
        nativeRawEligible: true,
      });
    }
  }
}

function registerBuilderPuzzleTargetAssets(entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>, levels: readonly LevelDefinition[]) {
  for (const level of levels) {
    for (const puzzle of level.puzzles ?? []) {
      if (puzzle.type !== "hit_sequence") continue;
      for (const target of puzzle.targets) {
        const modelKey = modelKeyForPuzzleOrbTarget(target);
        if (!modelKey) continue;
        registerBuilderRuntimeAsset(entries, {
          modelKey,
          kind: "furniture",
          glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
          nativeRawEligible: true,
        });
      }
    }
  }
}

function registerBuilderInteractionAssets(entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>, levels: readonly LevelDefinition[]) {
  for (const level of levels) {
    for (const interaction of level.map?.interactions ?? []) {
      const modelKey = modelKeyForInteraction(interaction);
      if (!modelKey) continue;
      registerBuilderRuntimeAsset(entries, {
        modelKey,
        kind: "furniture",
        glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
        nativeRawEligible: true,
      });
    }
  }
}

function registerBuilderCatalogFurnitureAssets(entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>) {
  for (const prop of builderPropCatalog) {
    registerBuilderRuntimeAsset(entries, {
      modelKey: prop.modelKey,
      kind: "furniture",
      glbUrl: builderRuntimeEnvironmentGlbUrl(prop.modelKey),
      nativeRawEligible: true,
    });
  }
}

function registerBuilderProjectShellAssets(
  entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>,
  level: LevelDefinition,
  project: BuilderProject,
  bakePlan: ResolvedBuilderBakePlan = resolveBuilderBakePlan(level, project),
) {
  const shellKeys = new Set<string>();
  for (const room of bakePlan.rooms) {
    const surfaceKeys = room.surfaceModelKeys;
    shellKeys.add(surfaceKeys.floorModelKey);
    shellKeys.add(surfaceKeys.wallModelKey);
    if (room.ceilingVisible) shellKeys.add(surfaceKeys.ceilingModelKey);
  }
  for (const modelKey of shellKeys) {
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "surface",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: false,
    });
  }

  // Puzzle machines: prefer the curated Raw/GLB console when the shared
  // resource library has one, then fall back to procedural geometry.
  const puzzleMachineModelKeys = new Set(bakePlan.puzzleMachines.map((machine) => machine.modelKey));
  for (const modelKey of puzzleMachineModelKeys) {
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "furniture",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: true,
    });
  }

  if (bakePlan.routeSwitchInteractionIds.size > 0 || (project.routeSwitches ?? []).length > 0) {
    registerBuilderRuntimeAsset(entries, {
      modelKey: "builder_route_switch_console",
      kind: "furniture",
      glbUrl: builderRuntimeEnvironmentGlbUrl("builder_route_switch_console"),
      nativeRawEligible: true,
    });
  }

  for (const door of level.map?.doors ?? []) {
    const modelKey = modelKeyForDoor(door);
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "door",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: true,
    });
    if (door.visualKey === "service_elevator_door" || door.skinKey === "service_elevator_hero") {
      registerBuilderRuntimeAsset(entries, {
        modelKey: "door_threshold_service_elevator",
        kind: "surface",
        glbUrl: builderRuntimeEnvironmentGlbUrl("door_threshold_service_elevator"),
        nativeRawEligible: false,
      });
    }
  }

  for (const target of bakePlan.puzzleTargets) {
    const modelKey = target.visual.modelKey;
    if (!modelKey) continue;
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "furniture",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: true,
    });
  }

  for (const interactionBake of bakePlan.interactions) {
    if (!interactionBake.intent.bakeStandalone && !interactionBake.intent.bakeExitPanel) continue;
    const modelKey = interactionBake.modelKey;
    if (!modelKey) continue;
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "surface",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: false,
    });
  }
}

function registerBuilderSharedRuntimeAssets(entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>) {
  for (const modelKey of BUILDER_SHARED_PUZZLE_CONSOLE_MODEL_KEYS) {
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "furniture",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: true,
    });
  }

  registerBuilderRuntimeAsset(entries, {
    modelKey: "pickup_large_yellow_key",
    kind: "pickup",
    glbUrl: builderRuntimeEnvironmentGlbUrl("pickup_large_yellow_key"),
    nativeRawEligible: true,
  });

  for (const modelKey of ["pickup_route_output_orb_1", "pickup_route_output_orb_2", "pickup_route_output_orb_3", "pickup_route_output_orb_4"]) {
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "pickup",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: true,
    });
  }

  for (const intent of Object.values(pickupVisualIntents)) {
    registerBuilderRuntimeAsset(entries, {
      modelKey: intent.modelKey,
      kind: "pickup",
      glbUrl: builderRuntimeEnvironmentGlbUrl(intent.modelKey),
      nativeRawEligible: true,
    });
  }

  for (const modelKey of Object.values(RAW_VIEWMODEL_MODEL_KEYS)) {
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "viewmodel",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: true,
    });
  }

  for (const modelKey of Object.values(RAW_VIEWMODEL_ULTIMATE_MODEL_KEYS)) {
    if (isRawViewmodelProceduralModelKey(modelKey)) continue;
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "viewmodel",
      glbUrl: builderRuntimeEnvironmentGlbUrl(modelKey),
      nativeRawEligible: true,
    });
  }

  for (const modelKey of Object.values(RAW_VIEWMODEL_HAND_MODEL_KEYS)) {
    registerBuilderRuntimeAsset(entries, {
      modelKey,
      kind: "hand",
      glbUrl: rawViewmodelCookAssets[modelKey as keyof typeof rawViewmodelCookAssets]?.url ?? null,
      nativeRawEligible: true,
    });
  }
}

function finalizeBuilderRuntimeAssetEntries(entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>): BuilderRuntimeAssetIndexEntry[] {
  return [...entries.values()]
    .map((entry) => ({
      ...entry,
      roles: [...entry.roles].sort(compareBuilderRuntimeAssetKinds),
    }))
    .sort((left, right) => left.modelKey.localeCompare(right.modelKey));
}

export function builderNativeRawRequestsForLevel(level: LevelDefinition): BuilderNativeRawModelRequest[] {
  return builderNativeRawRequestsForAssetIndex(builderRuntimeAssetIndexForLevel(level));
}

export function builderNativeRawRequestsForAssetIndex(assetIndex: readonly BuilderRuntimeAssetIndexEntry[]): BuilderNativeRawModelRequest[] {
  return assetIndex
    .filter((entry) => entry.nativeRawEligible && !isBuilderRuntimeProceduralMapped(entry))
    .map((entry) => ({ modelKey: entry.modelKey, kind: nativeRawKindForRuntimeAsset(entry) }));
}

export function builderDeepModelRequestsForLevel(level: LevelDefinition): BuilderDeepModelCollection {
  return builderDeepModelRequestsForAssetIndex(builderRuntimeAssetIndexForLevel(level));
}

export function builderDeepModelRequestsForAssetIndex(assetIndex: readonly BuilderRuntimeAssetIndexEntry[]): BuilderDeepModelCollection {
  const requests = new Map<string, BuilderDeepModelRequest>();
  const unresolved = new Set<string>();

  for (const entry of assetIndex) {
    if (!entry.glbUrl) {
      if (!isAssetsV1NativeRawMapped(entry) && !isBuilderRuntimeProceduralMapped(entry)) unresolved.add(entry.modelKey);
      continue;
    }
    requests.set(entry.modelKey, {
      modelKey: entry.modelKey,
      url: entry.glbUrl,
      kind: deepKindForRuntimeAsset(entry),
    });
  }

  return { requests: [...requests.values()], unresolved: [...unresolved] };
}

export function summarizeBuilderRuntimeAssetIndex(entries: readonly BuilderRuntimeAssetIndexEntry[]): BuilderRuntimeAssetIndexSummary {
  const byKind = Object.fromEntries(
    BUILDER_RUNTIME_ASSET_KIND_ORDER.map((kind) => [kind, { total: 0, mapped: 0, missing: 0 }]),
  ) as BuilderRuntimeAssetIndexSummary["byKind"];
  const missing: string[] = [];
  for (const entry of entries) {
    const mapped = isBuilderRuntimeAssetMapped(entry);
    if (!mapped) missing.push(entry.modelKey);
    for (const role of entry.roles) {
      byKind[role].total += 1;
      if (mapped) byKind[role].mapped += 1;
      else byKind[role].missing += 1;
    }
  }
  return {
    total: entries.length,
    mapped: entries.length - missing.length,
    missing,
    byKind,
  };
}

export function isBuilderRuntimeAssetMapped(entry: BuilderRuntimeAssetIndexEntry): boolean {
  return Boolean(entry.glbUrl) || isAssetsV1NativeRawMapped(entry) || isBuilderRuntimeProceduralMapped(entry);
}

function isAssetsV1NativeRawMapped(entry: Pick<BuilderRuntimeAssetIndexEntry, "modelKey" | "nativeRawEligible">): boolean {
  return entry.nativeRawEligible && BUILDER_ASSETS_V1_NATIVE_RAW_MODEL_KEYS.has(entry.modelKey);
}

export function isBuilderRuntimeProceduralMapped(entry: Pick<BuilderRuntimeAssetIndexEntry, "modelKey">): boolean {
  return BUILDER_TEXTURED_STORY_PAINTING_MODEL_KEYS.has(entry.modelKey);
}

const BUILDER_RUNTIME_ASSET_KIND_ORDER: readonly BuilderRuntimeAssetKind[] = [
  "surface",
  "door",
  "enemy",
  "furniture",
  "pickup",
  "viewmodel",
  "hand",
];

type MutableBuilderRuntimeAssetIndexEntry = Omit<BuilderRuntimeAssetIndexEntry, "roles"> & {
  roles: BuilderRuntimeAssetKind[];
};

function registerBuilderRuntimeAsset(
  entries: Map<string, MutableBuilderRuntimeAssetIndexEntry>,
  asset: {
    modelKey: string;
    kind: BuilderRuntimeAssetKind;
    glbUrl: string | null;
    nativeRawEligible?: boolean;
  },
) {
  const existing = entries.get(asset.modelKey);
  if (!existing) {
    entries.set(asset.modelKey, {
      modelKey: asset.modelKey,
      kind: asset.kind,
      roles: [asset.kind],
      glbUrl: asset.glbUrl,
      nativeRawEligible: asset.nativeRawEligible ?? false,
    });
    return;
  }

  if (!existing.roles.includes(asset.kind)) existing.roles.push(asset.kind);
  if (!existing.glbUrl && asset.glbUrl) existing.glbUrl = asset.glbUrl;
  existing.nativeRawEligible ||= asset.nativeRawEligible ?? false;
  if (compareBuilderRuntimeAssetKinds(asset.kind, existing.kind) > 0) existing.kind = asset.kind;
}

function compareBuilderRuntimeAssetKinds(left: BuilderRuntimeAssetKind, right: BuilderRuntimeAssetKind) {
  return BUILDER_RUNTIME_ASSET_KIND_ORDER.indexOf(left) - BUILDER_RUNTIME_ASSET_KIND_ORDER.indexOf(right);
}

function deepKindForRuntimeAsset(entry: BuilderRuntimeAssetIndexEntry): BuilderDeepModelRequestKind {
  if (entry.roles.includes("viewmodel") || entry.roles.includes("hand")) return "viewmodel";
  if (entry.roles.includes("enemy")) return "enemy";
  if (entry.roles.includes("pickup")) return "pickup";
  return "furniture";
}

function nativeRawKindForRuntimeAsset(entry: BuilderRuntimeAssetIndexEntry): BuilderNativeRawAssetKind {
  if (entry.roles.includes("hand")) return "hand";
  if (entry.roles.includes("viewmodel")) return "viewmodel";
  if (entry.roles.includes("pickup")) return "pickup";
  if (entry.roles.includes("enemy")) return "enemy";
  return "furniture";
}
