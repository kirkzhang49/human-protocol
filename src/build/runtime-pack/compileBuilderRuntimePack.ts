import type {
  LevelDefinition,
  LevelDoorDefinition,
  LevelMapConfig,
} from "../../game/config/schema/levelConfig";
import {
  resolveRoomPresentation,
  resolveRoomRelativePosition,
  type RoomLightingDefinition,
  type RoomLightingPresetDefinition,
} from "../../game/config/RoomPresentationRegistry";
import { createPropLocalLights } from "../../game/config/PropLocalLightRegistry";
import { resolveRenderLightPosition } from "../../game/core/RenderLightBudget";
import { modelKeyForDoor, modelKeyForKeyVisual } from "../../assets/environmentModelAssets";
import level01HumanBodyReferenceDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_body_reference.png";
import level01HumanHandReferenceDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_hand_reference.png";
import level01HumanSpineReferenceDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_spine_reference.png";
import level01HumanReferenceTriptychDecalUrl from "../../assets/textures/environment/level01/reference-decals/hp_decal_human_reference_triptych.png";
import { isStoryPaintingArtModelKey, storyPaintingArtRuntimeSpec, storyPaintingArtUrl } from "../../game/visual/StoryPaintingArt";
import { FLOATS_PER_VERTEX } from "../../render/raw-webgpu/RawWebGpuConstants";
import type {
  RawPlanGeometryAsset,
  RawPlanGeometry,
  RawPlanInstance,
  RawPlanLight,
  RawPlanMaterial,
  RawPlanMaterialTexture,
  RawPlanBaseColorTexture,
  RawRenderPlan,
  Tuple3,
  Tuple4,
} from "../../render/raw-webgpu/RawWebGpuTypes";
import { propEntry, roomStyleEntry } from "../BuilderAssetCatalog";
import {
  clampLighting,
  roomCeiling,
  roomFloor,
  roomSurfaceTextureOverride,
  roomWall,
} from "../BuilderEnvironment";
import {
  puzzleConsoleLightColor,
  puzzleConsoleProceduralBoundsHalf,
} from "../BuilderPuzzleRuntimeRegistry";
import { applyOfficialLightingTuning, hasOfficialLightingTuning } from "../official-bridge/OfficialLightingProfileBridge";
import { resolveBuilderBakePlan } from "../official-bridge/ResolvedBakePlan";
import type { BuilderProject } from "../BuilderTypes";
import { isFreePuzzleOrbModelKey } from "../../game/visual/intents/PuzzleTargetVisualIntent";
import { GeometryWriter } from "./GeometryWriter";
import { MaterialTable } from "./MaterialTable";
import {
  pushBuilderPuzzleOrb,
  pushBuilderPuzzleOrbStand,
  pushCoolingValveClusterProxy,
  pushRouteSwitchConsole,
  puzzleConsoleFallbackBake,
} from "./builderPuzzleMachineBake";
import type { BuilderNativeRawAssetKind, BuilderRuntimeAssetIndexEntry } from "./BuilderRuntimeAssetIndex";
import {
  BUILDER_RUNTIME_PACK_ENGINE_VERSION,
  type BuilderPackTextureBlob,
  type BuilderRuntimePackBakeMode,
  type BuilderRuntimePackManifest,
} from "./BuilderRuntimePackTypes";
import { paginateBuilderRuntimePackTextures } from "./BuilderRuntimeTexturePaging";
import { isExitButtonPanelProp } from "../official-bridge/InteractionHostBridge";
import type { CookedGlbLibrary, CookedGlbMaterial, CookedGlbModel } from "./cookGlbModels";
import { clampNumber, DOOR_FRAME_HEIGHT, DOOR_GAP_WIDTH, DOOR_LEAF_HEIGHT, FLOOR_THICKNESS } from "./builderRuntimePackConstants";
import {
  pushCeilingSurfaceBake,
  pushFloorSurfaceBake,
  pushPolygonBorder,
  pushPolygonRoomWalls,
  pushPolygonSlab,
  pushRoomWalls,
  surfaceAccentRole,
  type BuilderSurfaceDetailMode,
} from "./builderSurfaceBake";
import { builderDoorStatusColor, pushDoorFrameBake, pushDoorLeafBake, pushDoorStatusBake, type BuilderDoorDetailMode } from "./builderDoorBake";
import {
  buildVisibilityScenarios,
  defaultCeilingHeightForRuntime,
  defaultWallHeightForRuntime,
  presentationFrom,
  roomKeyLightHeight,
  warmthForRoom,
} from "./builderLightingBake";

/**
 * Browser-side runtime-pack compiler: turns a compiled generated
 * LevelDefinition (+ the source builder project for environment presets)
 * into an in-memory Raw WebGPU render plan and packed geometry buffer.
 *
 * v1 is deliberately procedural — floor slabs, wall boxes with door gaps,
 * door frames/leaves/status lights, furniture proxy boxes, marker meshes —
 * and never cooks GLB geometry in the browser. It exists so /build playtests
 * can run on the Raw WebGPU renderer without writing static render_plan
 * files or running the offline compiler.
 */

export interface BuilderRuntimePackCompileResult {
  renderPlan: RawRenderPlan;
  geometryBuffer: ArrayBuffer;
  /** Base color textures extracted from cooked GLBs (deep packs only). */
  textures: BuilderPackTextureBlob[];
  manifest: BuilderRuntimePackManifest;
  diagnostics: string[];
}

export interface BuilderRuntimePackCompileOptions {
  /** Deep bake: cooked GLB library; furniture/pickups/enemies/viewmodels render real. */
  cooked?: CookedGlbLibrary;
  /** Fast-path native Raw models copied from an already baked official plan. */
  nativeRawModels?: BuilderNativeRawModelLibrary;
  /** Canonical builder resource map used to audit modelKey -> WGPU geometry coverage. */
  assetIndex?: readonly BuilderRuntimeAssetIndexEntry[];
  /** Storage/cache identity for the pack; fast packs remain proxy-mode even while auditing WGPU resources. */
  manifestBakeMode?: BuilderRuntimePackBakeMode;
  /** Version hash over the resolved asset URLs (deep bake cache key). */
  assetVersionHash?: string;
}

export interface BuilderRuntimePackExternalTextureResult {
  textures: BuilderPackTextureBlob[];
  diagnostics: string[];
}

export interface BuilderRuntimePackExternalTextureOptions {
  baseUrl?: string;
}

export interface BuilderNativeRawModel {
  modelKey: string;
  kind: BuilderNativeRawAssetKind;
  sourceLevelId: string;
  asset: RawPlanGeometryAsset;
  vertices: Float32Array;
}

export interface BuilderNativeRawModelLibrary {
  models: Map<string, BuilderNativeRawModel>;
  materials: RawPlanMaterial[];
  baseColorTextures: RawPlanBaseColorTexture[];
  materialTextures: RawPlanMaterialTexture[];
  baseColorTextureSize?: number;
  materialTextureSize?: number;
  libraryId: string;
  sourceLevelIds: string[];
}

const referenceDecalRuntimeSpecs = {
  decal_human_body_reference: {
    textureUrl: level01HumanBodyReferenceDecalUrl,
    size: [1, 1] as const,
  },
  decal_human_hand_reference: {
    textureUrl: level01HumanHandReferenceDecalUrl,
    size: [1, 1] as const,
  },
  decal_human_spine_reference: {
    textureUrl: level01HumanSpineReferenceDecalUrl,
    size: [1, 1] as const,
  },
  decal_human_reference_triptych: {
    textureUrl: level01HumanReferenceTriptychDecalUrl,
    size: [2.46, 1.22] as const,
  },
} as const;

function referenceDecalRuntimeSpec(modelKey: string) {
  return referenceDecalRuntimeSpecs[modelKey as keyof typeof referenceDecalRuntimeSpecs] ?? null;
}

function storyPaintingRuntimeSpec(modelKey: string) {
  const textureUrl = storyPaintingArtUrl(modelKey);
  const spec = storyPaintingArtRuntimeSpec(modelKey);
  if (!textureUrl || !isStoryPaintingArtModelKey(modelKey)) return null;
  return {
    textureUrl,
    size: spec?.size ?? ([0.98, 0.9] as const),
    frame: spec?.frame ?? 0.065,
    centerY: spec?.centerY ?? 0.68,
  };
}

export function compileBuilderRuntimePack(
  level: LevelDefinition,
  project: BuilderProject,
  options: BuilderRuntimePackCompileOptions = {},
): BuilderRuntimePackCompileResult {
  const map = level.map;
  if (!map) throw new Error("生成的关卡缺少地图数据，无法生成试玩包。");
  const bakeStartedMs = Date.now();
  const cooked = options.cooked ?? null;
  const nativeRawModels = options.nativeRawModels ?? null;
  const cookedModelKeys: string[] = [];
  const nativeRawModelKeys: string[] = [];
  const nativeRawEnemyModelKeys: string[] = [];
  const nativeRawFurnitureModelKeys: string[] = [];
  const fallbackProxyModels = new Set<string>();
  const proceduralResourceKeys = new Map<string, string>();
  const diagnostics: string[] = [];
  const lighting = clampLighting(project.lighting);
  const geometry = new GeometryWriter();
  const materials = new MaterialTable();
  const instances: RawPlanInstance[] = [];
  const lights: RawPlanLight[] = [];
  const builderRoomsById = new Map(project.rooms.map((room) => [room.id, room]));
  const bakePlan = resolveBuilderBakePlan(level, project);
  const roomBakeById = new Map(bakePlan.rooms.map((room) => [room.roomId, room]));
  const interactionBakeById = new Map(bakePlan.interactions.map((interaction) => [interaction.interaction.id, interaction]));
  const exitButtonPanelByRoom = new Map((map.props ?? []).filter(isExitButtonPanelProp).map((prop) => [prop.roomId, prop]));
  const puzzleTargetBakeById = new Map(
    bakePlan.puzzleTargets.map((target) => [puzzleTargetBakeKey(target.puzzleId, target.target.id), target]),
  );
  const counts = { walls: 0, props: 0, markers: 0 };
  const roomPresentation = resolveRoomPresentation(map);
  const officialLighting = roomPresentation?.lighting ?? null;
  const markProceduralResource = (modelKey: string | null | undefined, geometryModelKey: string) => {
    if (!modelKey) return;
    fallbackProxyModels.add(modelKey);
    if (!proceduralResourceKeys.has(modelKey)) proceduralResourceKeys.set(modelKey, geometryModelKey);
  };

  // Deep bake: append one cooked geometry asset per model under its own
  // modelKey, interning the model's materials into the shared table and its
  // base color textures into the pack texture list.
  const cookedAssetKeys = new Map<string, string>();
  const nativeRawAssetKeys = new Map<string, string>();
  const packTextures: BuilderPackTextureBlob[] = [];
  // Native-raw enemy/furniture base color textures number their layers from 1.
  // Surface overrides and cooked GLB images share one layer allocator starting
  // after the highest native layer so all three texture sources can coexist.
  const nativeRawBaseColorLayerOffset =
    nativeRawModels?.baseColorTextures.reduce((max, texture) => Math.max(max, texture.layer), 0) ?? 0;
  let nextBaseColorLayer = nativeRawBaseColorLayerOffset + 1;
  const externalBaseColorTextures: RawPlanBaseColorTexture[] = [];
  const externalBaseColorLayerByUrl = new Map<string, number>();
  const ensureExternalBaseColorTexture = (url: string, name: string) => {
    const existing = externalBaseColorLayerByUrl.get(url);
    if (existing !== undefined) return { layer: existing, name, url, mimeType: mimeTypeForTextureUrl(url) };
    const layer = nextBaseColorLayer;
    nextBaseColorLayer += 1;
    externalBaseColorLayerByUrl.set(url, layer);
    externalBaseColorTextures.push({
      layer,
      url,
      name,
      mimeType: mimeTypeForTextureUrl(url),
    });
    return { layer, name, url, mimeType: mimeTypeForTextureUrl(url) };
  };
  const ensureCookedAsset = (model: CookedGlbModel): string => {
    const existing = cookedAssetKeys.get(model.modelKey);
    if (existing) return existing;
    const layerBySlot = model.images.map((image, slot) => {
      // Layer 0 is the loader's reserved white-fallback layer (entries with
      // layer <= 0 are never uploaded).
      const layer = nextBaseColorLayer;
      nextBaseColorLayer += 1;
      packTextures.push({
        layer,
        mimeType: image.mimeType,
        bytes: image.bytes,
        name: `${model.modelKey}:image${image.imageIndex}:slot${slot}`,
      });
      return { layer, stats: image.stats };
    });
    const materialRemap = model.materials.map((material) =>
      materials.cooked(
        model.modelKey,
        material,
        material.baseColorImageIndex !== undefined ? layerBySlot[material.baseColorImageIndex] : undefined,
      ),
    );
    geometry.beginAsset(model.modelKey);
    geometry.pushRawVertices(model.vertices, (localIndex) => materialRemap[localIndex] ?? materialRemap[0] ?? 0);
    if (model.nodeChunks?.length) geometry.setCurrentNodeChunks(model.nodeChunks);
    const assetKey = geometry.endAsset();
    cookedAssetKeys.set(model.modelKey, assetKey);
    cookedModelKeys.push(model.modelKey);
    for (const warning of model.warnings) diagnostics.push(`「${model.modelKey}」：${warning}`);
    return assetKey;
  };
  let nativeRawMaterialRemap: Map<number, number> | null = null;
  const ensureNativeRawAsset = (model: BuilderNativeRawModel): string => {
    const existing = nativeRawAssetKeys.get(model.modelKey);
    if (existing) return existing;
    nativeRawMaterialRemap ??= materials.nativeRaw(nativeRawModels?.materials ?? [], nativeRawModels?.libraryId ?? "native-raw");
    geometry.beginAsset(model.modelKey);
    geometry.pushRawVertices(model.vertices, (sourceMaterialIndex) => nativeRawMaterialRemap?.get(sourceMaterialIndex) ?? 0);
    geometry.setCurrentRawMetadata(model.asset);
    const assetKey = geometry.endAsset();
    nativeRawAssetKeys.set(model.modelKey, assetKey);
    nativeRawModelKeys.push(model.modelKey);
    if (model.kind === "enemy") nativeRawEnemyModelKeys.push(model.modelKey);
    if (model.kind === "furniture") nativeRawFurnitureModelKeys.push(model.modelKey);
    return assetKey;
  };
  const referenceDecalAssetKeys = new Map<string, string>();
  const ensureReferenceDecalAsset = (modelKey: string, spec: NonNullable<ReturnType<typeof referenceDecalRuntimeSpec>>) => {
    const existing = referenceDecalAssetKeys.get(modelKey);
    if (existing) return existing;
    const textureSlot = ensureExternalBaseColorTexture(spec.textureUrl, `prop:${modelKey}:reference-decal`);
    const decalMaterial = materials.surface(`reference-decal:${modelKey}`, {
      color: "#ffffff",
      roughness: 0.58,
      visualRole: "neutral_surface",
      baseColorTexture: textureSlot,
      doubleSided: true,
    });
    geometry.beginAsset(modelKey);
    geometry.pushTexturedQuadXY(0, 0, 0, spec.size[0], spec.size[1], decalMaterial);
    const assetKey = geometry.endAsset();
    markProceduralResource(modelKey, assetKey);
    referenceDecalAssetKeys.set(modelKey, assetKey);
    return assetKey;
  };
  const storyPaintingAssetKeys = new Map<string, string>();
  const ensureStoryPaintingAsset = (modelKey: string, spec: NonNullable<ReturnType<typeof storyPaintingRuntimeSpec>>) => {
    const existing = storyPaintingAssetKeys.get(modelKey);
    if (existing) return existing;
    const textureSlot = ensureExternalBaseColorTexture(spec.textureUrl, `prop:${modelKey}:story-painting`);
    const artMaterial = materials.surface(`story-painting-art:${modelKey}`, {
      color: "#ffffff",
      roughness: 0.48,
      visualRole: "neutral_surface",
      baseColorTexture: textureSlot,
      doubleSided: true,
    });
    const backingMaterial = materials.surface(`story-painting-backing:${modelKey}`, {
      color: "#19130c",
      roughness: 0.56,
      visualRole: "structural_dark",
    });
    const frameMaterial = materials.surface(`story-painting-frame:${modelKey}`, {
      color: "#8b672c",
      roughness: 0.34,
      visualRole: "exhibit_warm",
      emissiveColor: "#ffcb74",
      emissiveStrength: 0.04,
    });
    const [artWidth, artHeight] = spec.size;
    const frame = spec.frame;
    const outerWidth = artWidth + frame * 2.6;
    const outerHeight = artHeight + frame * 2.5;
    const centerY = spec.centerY;
    geometry.beginAsset(modelKey);
    geometry.pushBox(0, centerY, -0.04, outerWidth, outerHeight, 0.055, backingMaterial);
    geometry.pushBox(0, centerY + artHeight / 2 + frame / 2, 0, outerWidth, frame, 0.095, frameMaterial);
    geometry.pushBox(0, centerY - artHeight / 2 - frame / 2, 0, outerWidth, frame, 0.095, frameMaterial);
    geometry.pushBox(-artWidth / 2 - frame / 2, centerY, 0, frame, outerHeight, 0.095, frameMaterial);
    geometry.pushBox(artWidth / 2 + frame / 2, centerY, 0, frame, outerHeight, 0.095, frameMaterial);
    geometry.pushTexturedQuadXY(0, centerY, 0.035, artWidth, artHeight, artMaterial);
    const assetKey = geometry.endAsset();
    markProceduralResource(modelKey, assetKey);
    storyPaintingAssetKeys.set(modelKey, assetKey);
    return assetKey;
  };

  // The exit room is the old Level 3 闭馆电梯 lobby: brushed-steel walls + cyan
  // service rails, regardless of the builder room style. Drives both rooms and
  // the elevator door below so the swap is consistent in fast + deep packs.
  const exitRoomId = (map.interactions ?? []).find((interaction) => interaction.type === "exit")?.roomId ?? null;
  const exitDoorIds = new Set(
    exitRoomId ? map.doors.filter((door) => door.toRoomId === exitRoomId || door.fromRoomId === exitRoomId).map((door) => door.id) : [],
  );
  const ELEVATOR_WALL_COLOR = "#2c343c";
  const ELEVATOR_WALL_ACCENT = "#7ff2ff";
  const ELEVATOR_FLOOR_COLOR = "#1b2228";
  const humanMuseumBuilderSurfaces = project.sourceLevel?.levelId === "level_03_human_museum";

  // --- Rooms: floor slab + wall runs with door gaps + optional ceiling ----
  for (const room of map.rooms) {
    const builderRoom = builderRoomsById.get(room.id);
    const isExitRoom = room.id === exitRoomId;
    const style = builderRoom ? roomStyleEntry(builderRoom.style) : roomStyleEntry("sterile");
    const center = room.bounds.center;
    const size = room.bounds.size;
    const museumSurfaceReadability = humanMuseumBuilderSurfaces && !isExitRoom;
    const floor = builderRoom ? roomFloor(builderRoom) : null;
    const wall = builderRoom ? roomWall(builderRoom) : null;
    const ceiling = builderRoom ? roomCeiling(builderRoom) : null;
    const surfaceKeys = roomBakeById.get(room.id)?.surfaceModelKeys ?? null;
    const surfaceDetailMode: BuilderSurfaceDetailMode = museumSurfaceReadability ? "quiet" : "normal";
    const floorTexture =
      builderRoom && !isExitRoom
        ? roomSurfaceTextureOverride(builderRoom, "floor")
        : null;
    const floorBaseColorTexture =
      floorTexture
        ? ensureExternalBaseColorTexture(floorTexture.albedoUrl, `surface:${room.id}:floor:${floorTexture.preset.id}`)
        : null;

    const floorMaterial = materials.surface(`floor:${room.id}`, {
      color: isExitRoom ? ELEVATOR_FLOOR_COLOR : floor?.color ?? "#1a2430",
      roughness: isExitRoom ? 0.4 : floor?.preset.roughness ?? 0.6,
      visualRole: "floor_surface",
      baseColorTexture: floorBaseColorTexture,
      ...(museumSurfaceReadability ? { emissiveColor: floor?.color ?? "#c8cdd6", emissiveStrength: 0.055 } : {}),
    });
    const floorDetailMaterial = materials.surface(`floor-detail:${room.id}`, {
      color: museumSurfaceReadability ? "#4f5662" : floor?.preset.accent ?? style.accentColor,
      roughness: Math.max(0.28, (floor?.preset.roughness ?? 0.58) - 0.14),
      visualRole: surfaceAccentRole(floor?.preset.pattern ?? "tile"),
    });
    const floorGlowMaterial = materials.emissive(
      `floor-glow:${room.id}`,
      floor?.preset.accent ?? style.accentColor,
      museumSurfaceReadability ? 0.12 : 0.45,
      surfaceAccentRole(floor?.preset.pattern ?? "tile"),
    );
    const shapePoints = room.bounds.shape?.points ?? null;
    geometry.beginAsset(`builder:floor:${room.id}`);
    if (shapePoints) {
      // Triangulated polygon slab + glowing edge outline — not a bounding box.
      pushPolygonSlab(geometry, shapePoints, 0, -FLOOR_THICKNESS, floorMaterial);
      if (surfaceDetailMode !== "quiet") pushPolygonBorder(geometry, shapePoints, 0.2, 0.006, 0.06, floorGlowMaterial);
    } else {
      geometry.pushBox(0, -FLOOR_THICKNESS / 2, 0, size[0], FLOOR_THICKNESS, size[2], floorMaterial);
      if (floor) pushFloorSurfaceBake(geometry, size[0], size[2], floor, floorDetailMaterial, floorGlowMaterial, surfaceDetailMode);
    }
    const floorAsset = geometry.endAsset();
    markProceduralResource(surfaceKeys?.floorModelKey, floorAsset);
    instances.push(
      planInstance(`floor_${room.id}`, "floor", floorAsset, room.id, [center[0], 0.001, center[2]], [size[0] / 2, FLOOR_THICKNESS / 2, size[2] / 2]),
    );

    const authoredWallHeight = wall?.height ?? defaultWallHeightForRuntime();
    // Playable shell height: walls must reach the ceiling. Legacy drafts store
    // explicit half-walls (1.12m) in env.wallHeight — the playtest never ships
    // those as room shells (future partitions should be a separate wallKind).
    const shellHeight = ceiling?.visible
      ? Math.max(authoredWallHeight, ceiling.height)
      : Math.max(authoredWallHeight, 3.12);
    const wallTexture =
      builderRoom && !isExitRoom
        ? roomSurfaceTextureOverride(builderRoom, "wall")
        : null;
    const wallBaseColorTexture =
      wallTexture
        ? ensureExternalBaseColorTexture(wallTexture.albedoUrl, `surface:${room.id}:wall:${wallTexture.preset.id}`)
        : null;
    const wallMaterial = materials.surface(`wall:${room.id}`, {
      color: isExitRoom ? ELEVATOR_WALL_COLOR : wall?.color ?? "#243246",
      roughness: isExitRoom ? 0.34 : wall?.preset.roughness ?? 0.6,
      visualRole: "neutral_surface",
      baseColorTexture: wallBaseColorTexture,
      ...(museumSurfaceReadability ? { emissiveColor: wall?.color ?? "#b8b09e", emissiveStrength: 0.16 } : {}),
    });
    const accentMaterial = materials.emissive(
      `accent:${isExitRoom ? ELEVATOR_WALL_ACCENT : style.accentColor}`,
      isExitRoom ? ELEVATOR_WALL_ACCENT : style.accentColor,
      isExitRoom ? 1.1 : museumSurfaceReadability ? 0.28 : 0.9,
    );
    const wallDetailMaterial = materials.surface(`wall-detail:${room.id}`, {
      color: isExitRoom ? ELEVATOR_WALL_ACCENT : museumSurfaceReadability ? "#6d6659" : wall?.preset.accent ?? style.accentColor,
      roughness: isExitRoom ? 0.3 : Math.max(0.26, (wall?.preset.roughness ?? 0.58) - 0.12),
      visualRole: surfaceAccentRole(wall?.preset.pattern ?? "panel"),
    });
    geometry.beginAsset(`builder:walls:${room.id}`);
    counts.walls += shapePoints
      ? pushPolygonRoomWalls(geometry, shapePoints, room.id, map.doors, center, shellHeight, wallMaterial, accentMaterial, wallDetailMaterial, surfaceDetailMode)
      : pushRoomWalls(geometry, room.bounds, map.doors, wall ?? null, shellHeight, wallMaterial, accentMaterial, wallDetailMaterial, surfaceDetailMode);
    const wallsAsset = geometry.endAsset();
    markProceduralResource(surfaceKeys?.wallModelKey, wallsAsset);
    instances.push(
      planInstance(`walls_${room.id}`, "wall", wallsAsset, room.id, [center[0], 0, center[2]], [size[0] / 2, shellHeight / 2 + 0.1, size[2] / 2]),
    );

    if (ceiling?.visible) {
      const ceilingTexture =
        builderRoom && !isExitRoom
          ? roomSurfaceTextureOverride(builderRoom, "ceiling")
          : null;
      const ceilingBaseColorTexture =
        ceilingTexture
          ? ensureExternalBaseColorTexture(ceilingTexture.albedoUrl, `surface:${room.id}:ceiling:${ceilingTexture.preset.id}`)
          : null;
      const ceilingMaterial = materials.surface(`ceiling:${room.id}`, {
        color: ceiling.color,
        roughness: ceiling.preset.roughness,
        visualRole: "ceiling_surface",
        baseColorTexture: ceilingBaseColorTexture,
        ...(museumSurfaceReadability ? { emissiveColor: ceiling.color, emissiveStrength: 0.065 } : {}),
      });
      const ceilingDetailMaterial = materials.surface(`ceiling-detail:${room.id}`, {
        color: ceiling.preset.accent,
        roughness: Math.max(0.32, ceiling.preset.roughness - 0.1),
        visualRole: "ceiling_surface",
      });
      // Mood-aware light panels: the practical glow follows the project key
      // light (cold clinic / warm home / emergency cyan / alert amber-red).
      const ceilingGlowMaterial = materials.emissive(
        `ceiling-glow:${room.id}`,
        lighting.keyColor,
        clampNumber(0.7 + lighting.keyIntensity * 0.85 + lighting.ambient * 0.4, 0.5, 2.4),
        surfaceAccentRole(ceiling.preset.pattern),
      );
      const ceilingCoveMaterial = materials.emissive(`ceiling-cove:${room.id}`, ceiling.preset.accent, 0.6, surfaceAccentRole(ceiling.preset.pattern));
      geometry.beginAsset(`builder:ceiling:${room.id}`);
      if (shapePoints) {
        pushPolygonSlab(geometry, shapePoints, 0.06, -0.06, ceilingMaterial);
      } else {
        geometry.pushBox(0, 0, 0, size[0], 0.12, size[2], ceilingMaterial);
        pushCeilingSurfaceBake(geometry, size[0], size[2], ceiling.preset.pattern, ceilingDetailMaterial, ceilingGlowMaterial, ceilingCoveMaterial);
      }
      const ceilingAsset = geometry.endAsset();
      markProceduralResource(surfaceKeys?.ceilingModelKey, ceilingAsset);
      instances.push(
        planInstance(`ceiling_${room.id}`, "ceiling", ceilingAsset, room.id, [center[0], ceiling.height, center[2]], [size[0] / 2, 0.05, size[2] / 2]),
      );
    }

    if (!officialLighting) {
      lights.push({
        id: `light_room_${room.id}`,
        type: "point",
        roomId: room.id,
        doorId: null,
        color: lighting.keyColor,
        intensity: 0.85 + lighting.keyIntensity * 1.2,
        position: [center[0], roomKeyLightHeight(shellHeight, ceiling?.visible ? ceiling.height : null), center[2]],
        distance: Math.max(size[0], size[2]) * 1.05,
        decay: 1.55,
        semanticRole: "builder_room_key",
      });
    }
    if (!officialLighting && ceiling?.visible) {
      // Practical fill hugging the light panels so the new roof never reads
      // as a black lid; tinted by the project mood.
      lights.push({
        id: `light_ceiling_${room.id}`,
        type: "point",
        roomId: room.id,
        doorId: null,
        color: lighting.keyColor,
        intensity: 0.45 + lighting.ambient * 0.7,
        position: [center[0], ceiling.height - 0.32, center[2]],
        distance: Math.max(size[0], size[2]) * 0.85,
        decay: 1.8,
        semanticRole: "builder_ceiling_practical",
      });
    }
  }

  // --- Doors: frame + lifting leaf + status light ------------------------
  // The door(s) fronting the exit room are the service-elevator 闭馆电梯门:
  // they lift taller/slower so the closing-elevator beat reads in playtest
  // (exitRoomId / exitDoorIds are computed above for the elevator lobby).
  const frameMaterial = materials.surface("door:frame", { color: "#10151c", roughness: 0.42, visualRole: "structural_dark" });
  const doorPanelMaterial = materials.surface("door:panel-lines", { color: "#455160", roughness: 0.34, visualRole: "neutral_surface" });
  const doorDarkTrimMaterial = materials.surface("door:dark-trim", { color: "#070a0d", roughness: 0.5, visualRole: "structural_dark" });
  for (const door of map.doors) {
    const doorResourceKey = modelKeyForDoor(door);
    const locked = door.defaultState === "locked";
    const isExitDoor = exitDoorIds.has(door.id);
    const doorDetailMode: BuilderDoorDetailMode = humanMuseumBuilderSurfaces && !isExitDoor ? "quiet" : "normal";
    const statusColor = builderDoorStatusColor(door);
    // Exit/elevator door is brushed service-elevator steel even while locked
    // (the lock light still goes red→cyan); other doors keep the lock-tinted leaf.
    const leafMaterial = isExitDoor
      ? materials.surface("door:elevator-leaf", { color: "#39434d", roughness: 0.32, visualRole: "neutral_surface" })
      : locked
      ? materials.surface(`door:leaf-locked:${door.lock.type}`, { color: "#201a16", roughness: 0.46, visualRole: door.lock.type === "survive_wave" ? "danger_red" : "route_gold" })
      : materials.surface("door:leaf", { color: "#2c3a4a", roughness: 0.5, visualRole: "neutral_surface" });
    const statusMaterial = locked
      ? materials.emissive(`door:status-locked:${door.lock.type}`, statusColor, 2.2, door.lock.type === "survive_wave" ? "danger_red" : "door_access_cyan")
      : materials.emissive("door:status-open", "#54e0ff", 2.0, "door_access_cyan");
    const brassMaterial = materials.surface("door:brass-trim", { color: "#9c7836", roughness: 0.35, visualRole: "route_gold" });
    const doorFrameMat = isExitDoor ? materials.surface("door:elevator-frame", { color: "#1a2026", roughness: 0.34, visualRole: "structural_dark" }) : frameMaterial;
    const doorPanelMat = isExitDoor ? materials.surface("door:elevator-panel", { color: "#4c5c6a", roughness: 0.3, visualRole: "neutral_surface" }) : doorPanelMaterial;

    // Deep bake: when the door's family GLB is cooked, render the real premium
    // door (frame + leaf as one mesh) scaled to the wall opening, lifting as a
    // unit so it still opens. Exit door keeps the tuned procedural elevator
    // treatment. Fast/proxy pack falls back to the procedural frame + leaf.
    const nativeRawDoor = !isExitDoor ? nativeRawModels?.models.get(doorResourceKey) : undefined;
    const cookedDoor = !isExitDoor && !nativeRawDoor ? cooked?.models.get(doorResourceKey) : undefined;
    const bakedDoorSize = nativeRawDoor?.asset.bounds?.size ?? cookedDoor?.bounds.size;
    if (bakedDoorSize) {
      const gapScale = DOOR_GAP_WIDTH / Math.max(0.1, bakedDoorSize[0]);
      const liftHeight = bakedDoorSize[1] * gapScale;
      const doorAsset = nativeRawDoor ? ensureNativeRawAsset(nativeRawDoor) : ensureCookedAsset(cookedDoor as CookedGlbModel);
      instances.push({
        ...planInstance(`door_leaf_${door.id}`, "door_leaf", doorAsset, door.fromRoomId, [door.position[0], 0, door.position[2]], [
          (bakedDoorSize[0] * gapScale) / 2,
          liftHeight / 2,
          (bakedDoorSize[2] * gapScale) / 2,
        ]),
        secondaryRoomId: door.toRoomId,
        rotation: [0, door.yaw, 0],
        scale: [gapScale, gapScale, gapScale],
        visibility: { type: "door", doorId: door.id },
        state: {
          doorId: door.id,
          openAnimation: { type: "vertical_lift", axis: "y", distance: liftHeight + 0.3 },
          openVisualPolicy: {
            hideClosedHardwareAfterOpen: door.openVisualPolicy?.hideClosedHardwareAfterOpen ?? false,
            hidePanelAfterOpen: door.openVisualPolicy?.hidePanelAfterOpen ?? false,
          },
        },
      });
    } else {
      geometry.beginAsset(`builder:door-frame:${door.id}`);
      pushDoorFrameBake(geometry, doorFrameMat, doorPanelMat, doorDarkTrimMaterial, statusMaterial, brassMaterial, doorDetailMode);
      const frameAsset = geometry.endAsset();
      markProceduralResource("door_threshold_service_elevator", frameAsset);
      instances.push({
        ...planInstance(`door_frame_${door.id}`, "wall", frameAsset, door.fromRoomId, [door.position[0], 0, door.position[2]], [2.05, DOOR_FRAME_HEIGHT / 2, 0.32]),
        secondaryRoomId: door.toRoomId,
        rotation: [0, door.yaw, 0],
        visibility: { type: "door", doorId: door.id },
      });

      {
        // Push the lifting leaf for ALL procedural doors INCLUDING the exit
        // elevator. Previously the exit door got a frame but no leaf, so it
        // rendered as a hollow/see-through opening ("门是空的/透明的") instead of a
        // closed door. The exit door uses its elevator-leaf material (set above)
        // and still lifts out of view on open via the vertical_lift state below.
        geometry.beginAsset(`builder:door-leaf:${door.id}`);
        pushDoorLeafBake(geometry, leafMaterial, doorPanelMat, doorDarkTrimMaterial, statusMaterial, doorFrameMat, locked, doorDetailMode);
        const leafAsset = geometry.endAsset();
        markProceduralResource(doorResourceKey, leafAsset);
        instances.push({
          ...planInstance(`door_leaf_${door.id}`, "door_leaf", leafAsset, door.fromRoomId, [door.position[0], 0, door.position[2]], [1.55, DOOR_LEAF_HEIGHT / 2 + 0.2, 0.14]),
          secondaryRoomId: door.toRoomId,
          rotation: [0, door.yaw, 0],
          visibility: { type: "door", doorId: door.id },
          state: {
            doorId: door.id,
            openAnimation: { type: "vertical_lift", axis: "y", distance: 2.65 },
            openVisualPolicy: {
              hideClosedHardwareAfterOpen: door.openVisualPolicy?.hideClosedHardwareAfterOpen ?? false,
              hidePanelAfterOpen: door.openVisualPolicy?.hidePanelAfterOpen ?? false,
            },
          },
        });
      }
    }

    geometry.beginAsset(`builder:door-status:${door.id}`);
    pushDoorStatusBake(geometry, doorFrameMat, doorDarkTrimMaterial, statusMaterial, doorDetailMode);
    const statusAsset = geometry.endAsset();
    instances.push({
      ...planInstance(`door_status_${door.id}`, "door_panel", statusAsset, door.fromRoomId, [door.position[0], 0, door.position[2]], [0.7, 0.2, 0.16]),
      secondaryRoomId: door.toRoomId,
      rotation: [0, door.yaw, 0],
      visibility: { type: "door", doorId: door.id },
    });

    lights.push({
      id: `light_door_${door.id}`,
      type: "point",
      roomId: door.fromRoomId,
      doorId: door.id,
      color: locked ? statusColor : "#54e0ff",
      intensity: 0.85,
      position: [door.position[0], DOOR_FRAME_HEIGHT - 0.28, door.position[2]],
      distance: 4.6,
      decay: 1.9,
      semanticRole: "builder_door_status",
    });
  }

  // --- Furniture: cooked GLB when available, proxy boxes otherwise --------
  const baseMaterial = materials.surface("prop:base", { color: "#101418", roughness: 0.8, visualRole: "structural_dark" });
  const propAssetByModel = new Map<string, string>();
  for (const prop of map.props ?? []) {
    const storyPainting = storyPaintingRuntimeSpec(prop.modelKey);
    if (storyPainting) {
      const assetKey = ensureStoryPaintingAsset(prop.modelKey, storyPainting);
      const scale = typeof prop.scale === "number" ? prop.scale : 1;
      const [artWidth, artHeight] = storyPainting.size;
      const frame = storyPainting.frame;
      const outerWidth = artWidth + frame * 2.6;
      const outerHeight = artHeight + frame * 2.5;
      const position = [prop.position[0], prop.position[1], prop.position[2]] as Tuple3;
      const halfSize = [
        Math.max(0.05, (outerWidth * scale) / 2),
        Math.max(0.05, (outerHeight * scale) / 2),
        0.055,
      ] as Tuple3;
      instances.push({
        ...planInstance(`prop_${prop.id}`, prop.modelKey, assetKey, prop.roomId, position, halfSize),
        rotation: [prop.rotation?.[0] ?? 0, prop.rotation?.[1] ?? 0, prop.rotation?.[2] ?? 0],
        scale: [scale, scale, scale],
        ...(prop.tags ? { tags: [...prop.tags] } : {}),
        estimatedBounds: {
          center: [position[0], position[1] + storyPainting.centerY * scale, position[2]],
          halfSize,
        },
      });
      lights.push({
        id: `light_story_painting_${prop.id}`,
        type: "point",
        roomId: prop.roomId,
        doorId: null,
        color: "#ffc878",
        intensity: 0.055,
        position: [position[0], position[1] + storyPainting.centerY * scale, position[2]],
        distance: 1.25,
        decay: 1.85,
        semanticRole: "story_painting",
      });
      counts.props += 1;
      continue;
    }
    const referenceDecal = referenceDecalRuntimeSpec(prop.modelKey);
    if (referenceDecal) {
      const assetKey = ensureReferenceDecalAsset(prop.modelKey, referenceDecal);
      const scale = typeof prop.scale === "number" ? prop.scale : 1;
      const position = [prop.position[0], prop.position[1], prop.position[2]] as Tuple3;
      const halfSize = [
        Math.max(0.05, (referenceDecal.size[0] * scale) / 2),
        Math.max(0.05, (referenceDecal.size[1] * scale) / 2),
        0.035,
      ] as Tuple3;
      instances.push({
        ...planInstance(`prop_${prop.id}`, prop.modelKey, assetKey, prop.roomId, position, halfSize),
        rotation: [prop.rotation?.[0] ?? 0, prop.rotation?.[1] ?? 0, prop.rotation?.[2] ?? 0],
        scale: [scale, scale, scale],
        ...(prop.tags ? { tags: [...prop.tags] } : {}),
        estimatedBounds: {
          center: position,
          halfSize,
        },
      });
      lights.push({
        id: `light_decal_${prop.id}`,
        type: "point",
        roomId: prop.roomId,
        doorId: null,
        color: "#9af7ff",
        intensity: prop.modelKey === "decal_human_reference_triptych" ? 0.035 : 0.02,
        position,
        distance: prop.modelKey === "decal_human_reference_triptych" ? 1.3 : 0.9,
        decay: 1.9,
        semanticRole: "reference_decal",
      });
      counts.props += 1;
      continue;
    }
    const nativeRawModel = nativeRawModels?.models.get(prop.modelKey);
    if (nativeRawModel) {
      const assetKey = ensureNativeRawAsset(nativeRawModel);
      const scale = typeof prop.scale === "number" ? prop.scale : 1;
      const boundsSize = nativeRawModel.asset.bounds?.size ?? ([1, 1, 1] as Tuple3);
      instances.push({
        ...planInstance(`prop_${prop.id}`, "prop", assetKey, prop.roomId, [prop.position[0], prop.position[1], prop.position[2]], [
          Math.max(0.05, (boundsSize[0] * scale) / 2),
          Math.max(0.05, (boundsSize[1] * scale) / 2),
          Math.max(0.05, (boundsSize[2] * scale) / 2),
        ]),
        rotation: [prop.rotation?.[0] ?? 0, prop.rotation?.[1] ?? 0, prop.rotation?.[2] ?? 0],
        scale: [scale, scale, scale],
        ...(prop.tags ? { tags: [...prop.tags] } : {}),
      });
      counts.props += 1;
      continue;
    }
    const cookedModel = cooked?.models.get(prop.modelKey);
    if (cookedModel) {
      const assetKey = ensureCookedAsset(cookedModel);
      const scale = typeof prop.scale === "number" ? prop.scale : 1;
      instances.push({
        ...planInstance(`prop_${prop.id}`, "prop", assetKey, prop.roomId, [prop.position[0], prop.position[1], prop.position[2]], [
          Math.max(0.05, (cookedModel.bounds.size[0] * scale) / 2),
          Math.max(0.05, (cookedModel.bounds.size[1] * scale) / 2),
          Math.max(0.05, (cookedModel.bounds.size[2] * scale) / 2),
        ]),
        rotation: [prop.rotation?.[0] ?? 0, prop.rotation?.[1] ?? 0, prop.rotation?.[2] ?? 0],
        scale: [scale, scale, scale],
        ...(prop.tags ? { tags: [...prop.tags] } : {}),
      });
      counts.props += 1;
      continue;
    }
    if (nativeRawModels || cooked) fallbackProxyModels.add(prop.modelKey);
    const entry = propEntry(prop.modelKey);
    const serviceElevatorProxySize = serviceElevatorPropProxySize(prop.modelKey);
    let size: Tuple3;
    if (serviceElevatorProxySize) {
      size = serviceElevatorProxySize;
    } else if (entry) {
      size = [entry.sizeMeters[0], entry.sizeMeters[1], entry.sizeMeters[2]];
    } else if (prop.collider) {
      size = [prop.collider.halfSize[0] * 2, prop.collider.halfSize[1] * 2, prop.collider.halfSize[2] * 2];
      diagnostics.push(`家具「${prop.modelKey}」不在目录里，使用碰撞体尺寸代理。`);
    } else {
      size = [0.8, 0.9, 0.8];
      diagnostics.push(`家具「${prop.modelKey}」缺少尺寸信息，使用默认代理尺寸。`);
    }
    let assetKey = propAssetByModel.get(prop.modelKey);
    if (!assetKey) {
      const bodyMaterial = materials.propBody(prop.modelKey);
      geometry.beginAsset(`builder:prop:${prop.modelKey}`);
      if (pushServiceElevatorPropProxy(geometry, materials, prop.modelKey, bodyMaterial, baseMaterial)) {
        // Hand-authored fallback: keep the exit readable even when a deep bake
        // misses the GLB or a fast pack intentionally uses procedural geometry.
      } else if (prop.modelKey === "room_cyber_valve_cluster") {
        pushCoolingValveClusterProxy(geometry, materials, bodyMaterial);
      } else {
        geometry.pushBox(0, Math.min(0.04, size[1] * 0.06) / 2, 0, size[0] * 0.94, Math.min(0.08, size[1] * 0.12), size[2] * 0.94, baseMaterial);
        geometry.pushBox(0, size[1] / 2, 0, size[0] * 0.82, size[1] * 0.88, size[2] * 0.82, bodyMaterial);
      }
      assetKey = geometry.endAsset();
      markProceduralResource(prop.modelKey, assetKey);
      propAssetByModel.set(prop.modelKey, assetKey);
    }
    const scale = typeof prop.scale === "number" ? prop.scale : 1;
    instances.push({
      ...planInstance(`prop_${prop.id}`, "prop", assetKey, prop.roomId, [prop.position[0], prop.position[1], prop.position[2]], [
        (size[0] * scale) / 2,
        (size[1] * scale) / 2,
        (size[2] * scale) / 2,
      ]),
      rotation: [prop.rotation?.[0] ?? 0, prop.rotation?.[1] ?? 0, prop.rotation?.[2] ?? 0],
      scale: [scale, scale, scale],
      ...(prop.tags ? { tags: [...prop.tags] } : {}),
    });
    counts.props += 1;
  }

  // --- Markers: spawn pad, exit, key items, terminals, puzzle orbs --------
  const spawnRoomId = map.rooms[0]?.id ?? null;
  const spawnMaterial = materials.surface("marker:spawn-pad", { color: "#0a1518", roughness: 0.68, visualRole: "structural_dark" });
  const spawnLineMaterial = materials.emissive("marker:spawn-line", "#54e0ff", 0.42, "cyan_emissive");
  geometry.beginAsset("builder:spawn-pad");
  geometry.pushBox(0, 0.012, 0, 1.08, 0.024, 1.08, spawnMaterial);
  geometry.pushBox(0, 0.03, -0.47, 0.78, 0.018, 0.028, spawnLineMaterial);
  geometry.pushBox(0, 0.03, 0.47, 0.78, 0.018, 0.028, spawnLineMaterial);
  geometry.pushBox(-0.47, 0.03, 0, 0.028, 0.018, 0.78, spawnLineMaterial);
  geometry.pushBox(0.47, 0.03, 0, 0.028, 0.018, 0.78, spawnLineMaterial);
  geometry.pushBox(0, 0.042, 0, 0.22, 0.018, 0.22, spawnLineMaterial);
  const spawnAsset = geometry.endAsset();
  instances.push(
    planInstance("marker_spawn", "wall_wash_light_mesh", spawnAsset, spawnRoomId, [level.spawnPoint[0], 0, level.spawnPoint[2]], [0.58, 0.04, 0.58]),
  );
  counts.markers += 1;

  const keyFallbackAssets = new Map<string, string>();
  const routeOutputOrbColor = (visualKey: string) => {
    if (visualKey === "route_output_orb_2") return "#ffd76b";
    if (visualKey === "route_output_orb_3") return "#71dc92";
    if (visualKey === "route_output_orb_4") return "#b995ff";
    return "#72e8ff";
  };
  const keyAssetForVisual = (visualKey: string) => {
    const modelKey = modelKeyForKeyVisual(visualKey);
    const nativeRawModel = nativeRawModels?.models.get(modelKey);
    if (nativeRawModel) return ensureNativeRawAsset(nativeRawModel);
    const routeOutputOrb = /^route_output_orb_[1-4]$/.test(visualKey);
    const cookedKeyModel = routeOutputOrb ? cooked?.models.get(modelKey) : null;
    if (cookedKeyModel) return ensureCookedAsset(cookedKeyModel);
    // NOTE: deliberately skip the deep-cooked key GLB. Its color lives in a base
    // color texture with a white baseColorFactor, so the deep cook renders it as
    // a white blob; the procedural gold proxy below reads correctly as a key.
    const fallbackKey = `${modelKey}:${visualKey}`;
    const existing = keyFallbackAssets.get(fallbackKey);
    if (existing) return existing;
    const routeChip = visualKey === "route_access_chip";
    const accentMaterial = routeChip
      ? materials.emissive("marker:route-key", "#7ff2ff", 2.1, "route_key_cyan")
      : materials.emissive("marker:key", "#ffd24f", 1.8, "route_gold");
    const keyBodyMaterial = materials.surface(routeChip ? "marker:route-key-body" : "marker:key-body", {
      color: routeChip ? "#10242b" : "#21170a",
      roughness: 0.36,
      visualRole: "structural_dark",
    });
    geometry.beginAsset(fallbackKey);
    if (routeChip) {
      geometry.pushBox(0, 0.12, 0, 0.86, 0.16, 0.62, keyBodyMaterial);
      geometry.pushBox(0, 0.26, 0, 0.66, 0.08, 0.44, frameMaterial);
      geometry.pushBox(0, 0.4, 0, 0.72, 0.045, 0.5, accentMaterial);
      geometry.pushBox(-0.24, 0.48, -0.1, 0.12, 0.038, 0.3, accentMaterial);
      geometry.pushBox(0.02, 0.5, 0, 0.1, 0.038, 0.36, accentMaterial);
      geometry.pushBox(0.26, 0.48, 0.1, 0.14, 0.038, 0.28, accentMaterial);
      geometry.pushBox(-0.38, 0.31, 0, 0.12, 0.055, 0.22, keyBodyMaterial);
      geometry.pushBox(0.38, 0.31, 0, 0.12, 0.055, 0.22, keyBodyMaterial);
      geometry.pushBox(0, 0.06, 0, 1.26, 0.03, 1.26, accentMaterial);
      geometry.pushBox(0, 0.68, 0, 0.34, 0.028, 0.34, accentMaterial);
    } else {
      geometry.pushBox(0, 0.18, 0, 0.58, 0.36, 0.42, keyBodyMaterial);
      geometry.pushBox(0, 0.46, 0, 0.36, 0.16, 0.3, frameMaterial);
      geometry.pushBox(0, 0.74, 0, 0.62, 0.08, 0.38, accentMaterial);
      geometry.pushBox(0.13, 0.81, 0, 0.2, 0.035, 0.22, accentMaterial);
      geometry.pushBox(0, 0.05, 0, 1.08, 0.035, 1.08, accentMaterial);
    }
    const assetKey = geometry.endAsset();
    markProceduralResource(modelKey, assetKey);
    keyFallbackAssets.set(fallbackKey, assetKey);
    return assetKey;
  };
  for (const keyItem of map.keyItems ?? []) {
    const keyAsset = keyAssetForVisual(keyItem.visualKey);
    const routeChip = keyItem.visualKey === "route_access_chip";
    const routeOutputOrb = /^route_output_orb_[1-4]$/.test(keyItem.visualKey);
    const keyColor = routeOutputOrb ? routeOutputOrbColor(keyItem.visualKey) : routeChip ? "#7ff2ff" : "#ffd24f";
    instances.push({
      ...planInstance(`key_${keyItem.id}`, "key_item", keyAsset, keyItem.roomId, [keyItem.position[0], 0, keyItem.position[2]], routeChip ? [0.175, 0.49, 0.175] : routeOutputOrb ? [0.23, 0.275, 0.23] : [0.25, 0.7, 0.25]),
      state: { keyItemId: keyItem.id },
    });
    counts.markers += 1;
    lights.push({
      id: `light_key_${keyItem.id}`,
      type: "point",
      roomId: keyItem.roomId,
      doorId: null,
      color: keyColor,
      intensity: routeOutputOrb ? 1.12 : routeChip ? 1.28 : 0.8,
      position: [keyItem.position[0], 1.5, keyItem.position[2]],
      distance: routeOutputOrb ? 4.2 : routeChip ? 4.8 : 3.6,
      decay: 2,
      semanticRole: routeOutputOrb ? "builder_route_output_orb_key_item" : routeChip ? "builder_route_key_item" : "builder_key_item",
    });
  }

  const puzzleOrbStandAssets = new Map<string, string>();
  const puzzleOrbStandAssetFor = (colorKey: string, hex: string, orbCenterY: number) => {
    const assetId = `builder:orb-stand:${colorKey}:${Math.round(Math.max(0.72, orbCenterY) * 100)}`;
    const existing = puzzleOrbStandAssets.get(assetId);
    if (existing) return existing;
    geometry.beginAsset(assetId);
    pushBuilderPuzzleOrbStand(geometry, materials, colorKey, hex, orbCenterY);
    const assetKey = geometry.endAsset();
    puzzleOrbStandAssets.set(assetId, assetKey);
    return assetKey;
  };
  const pushCookedPuzzleOrbStand = (
    target: { id: string; roomId: string },
    targetPosition: readonly [number, number, number],
    colorKey: string,
    hex: string,
    proxyHalfSize: Tuple3,
  ) => {
    const standAsset = puzzleOrbStandAssetFor(colorKey, hex, targetPosition[1]);
    instances.push({
      ...planInstance(`orb_stand_${target.id}`, "puzzle_orb_stand", standAsset, target.roomId, [targetPosition[0], 0, targetPosition[2]], proxyHalfSize),
      state: { targetId: target.id, colorKey },
    });
    counts.markers += 1;
  };

  const terminalMaterial = materials.surface("marker:terminal-body", { color: "#1b2733", roughness: 0.5, visualRole: "structural_dark" });
  const screenMaterial = materials.emissive("marker:terminal-screen", "#54e0ff", 1.9, "screen_label");
  const routeSwitchInteractionIds = bakePlan.routeSwitchInteractionIds;
  const escapeCyan = materials.emissive("marker:exit-cyan", "#7ff2ff", 1.8, "door_access_cyan");
  const exitPanelFallbackAssets = new Map<string, string>();
  const exitPanelAssetForModel = (modelKey: string | null) => {
    if (!modelKey) return null;
    const cookedPanelModel = cooked?.models.get(modelKey);
    if (cookedPanelModel) {
      return {
        assetKey: ensureCookedAsset(cookedPanelModel),
        halfSize: [
          Math.max(0.05, cookedPanelModel.bounds.size[0] / 2),
          Math.max(0.05, cookedPanelModel.bounds.size[1] / 2),
          Math.max(0.05, cookedPanelModel.bounds.size[2] / 2),
        ] as Tuple3,
      };
    }
    const existing = exitPanelFallbackAssets.get(modelKey);
    if (existing) return { assetKey: existing, halfSize: [0.36, 0.62, 0.12] as Tuple3 };
    geometry.beginAsset(`builder:exit-panel:${modelKey}`);
    geometry.pushBox(0, 0.58, 0, 0.56, 1.16, 0.16, terminalMaterial);
    geometry.pushBox(0, 1.03, 0.06, 0.42, 0.18, 0.05, screenMaterial);
    geometry.pushBox(0, 0.62, 0.07, 0.2, 0.2, 0.045, escapeCyan);
    const assetKey = geometry.endAsset();
    markProceduralResource(modelKey, assetKey);
    exitPanelFallbackAssets.set(modelKey, assetKey);
    return { assetKey, halfSize: [0.36, 0.62, 0.12] as Tuple3 };
  };
  for (const interaction of map.interactions ?? []) {
    const interactionBake = interactionBakeById.get(interaction.id);
    if (!interactionBake) continue;
    const machine = interactionBake.puzzleMachine;
    const bakeIntent = interactionBake.intent;
    if (interaction.type === "exit") {
      if (bakeIntent.bakeExitFloorPad) {
        geometry.beginAsset(`builder:exit:${interaction.id}`);
        geometry.pushBox(0, 0.02, 0, 1.15, 0.04, 1.15, escapeCyan);
        const exitAsset = geometry.endAsset();
        instances.push({
          ...planInstance(`exit_${interaction.id}`, "interaction_exit", exitAsset, interaction.roomId, [interaction.position[0], 0, interaction.position[2]], [1.15, 0.02, 1.15]),
          state: { interactionId: interaction.id, type: "exit" },
        });
      }
      const panelAsset = bakeIntent.bakeExitPanel ? exitPanelAssetForModel(interactionBake.modelKey) : null;
      if (panelAsset) {
        instances.push({
          ...planInstance(
            `exit_panel_${interaction.id}`,
            "interaction_terminal",
            panelAsset.assetKey,
            interaction.roomId,
            [interaction.position[0], 0, interaction.position[2]],
            panelAsset.halfSize,
          ),
          state: { interactionId: interaction.id, type: "exit" },
        });
        counts.markers += 1;
      }
      if (bakeIntent.bakeExitFloorPad) {
        lights.push({
          id: `light_exit_${interaction.id}`,
          type: "floor_glow",
          roomId: interaction.roomId,
          doorId: null,
          color: "#7ff2ff",
          intensity: 1.2,
          position: [interaction.position[0], 0.4, interaction.position[2]],
          distance: 5.4,
          decay: 1.7,
          semanticRole: "builder_exit",
        });
      } else {
        const sideButton = exitButtonPanelByRoom.get(interaction.roomId);
        if (sideButton) {
          lights.push({
            id: `light_exit_button_${interaction.id}`,
            type: "point",
            roomId: interaction.roomId,
            doorId: null,
            color: "#7ff2ff",
            intensity: 0.55,
            position: [sideButton.position[0], Math.max(0.85, sideButton.position[1] + 0.34), sideButton.position[2]],
            distance: 2.6,
            decay: 1.9,
            semanticRole: "builder_exit_button",
          });
        }
      }
    } else {
      if (!bakeIntent.bakeStandalone) {
        continue;
      }
      const routeSwitchModelKey = "builder_route_switch_console";
      const nativeRouteSwitchModel = routeSwitchInteractionIds.has(interaction.id) ? nativeRawModels?.models.get(routeSwitchModelKey) : null;
      const routeSwitchModel = routeSwitchInteractionIds.has(interaction.id) && !nativeRouteSwitchModel ? cooked?.models.get(routeSwitchModelKey) : null;
      if (nativeRouteSwitchModel || routeSwitchModel) {
        const switchAsset = nativeRouteSwitchModel ? ensureNativeRawAsset(nativeRouteSwitchModel) : ensureCookedAsset(routeSwitchModel as CookedGlbModel);
        const boundsSize = nativeRouteSwitchModel?.asset.bounds?.size ?? routeSwitchModel?.bounds.size ?? ([1.2, 0.98, 0.77] as Tuple3);
        instances.push({
          ...planInstance(
            `route_switch_${interaction.id}`,
            "interaction_terminal",
            switchAsset,
            interaction.roomId,
            [interaction.position[0], 0, interaction.position[2]],
            [
              Math.max(0.05, boundsSize[0] / 2),
              Math.max(0.05, boundsSize[1] / 2),
              Math.max(0.05, boundsSize[2] / 2),
            ],
          ),
          rotation: [0, interaction.yaw ?? 0, 0],
          state: { interactionId: interaction.id, type: interaction.type },
        });
        lights.push({
          id: `light_route_switch_${interaction.id}`,
          type: "point",
          roomId: interaction.roomId,
          doorId: null,
          color: "#5ee8c8",
          intensity: 0.86,
          position: [interaction.position[0], 1.05, interaction.position[2]],
          distance: 3.8,
          decay: 2,
          semanticRole: "builder_route_switch_console",
        });
        counts.markers += 1;
        continue;
      }
      const standaloneModelKey = !machine && !routeSwitchInteractionIds.has(interaction.id) ? interactionBake.modelKey : null;
      const nativeStandaloneModel = standaloneModelKey ? nativeRawModels?.models.get(standaloneModelKey) : null;
      const cookedStandaloneModel = standaloneModelKey && !nativeStandaloneModel ? cooked?.models.get(standaloneModelKey) : null;
      if (standaloneModelKey && (nativeStandaloneModel || cookedStandaloneModel)) {
        const standaloneAsset = nativeStandaloneModel ? ensureNativeRawAsset(nativeStandaloneModel) : ensureCookedAsset(cookedStandaloneModel as CookedGlbModel);
        const boundsSize = nativeStandaloneModel?.asset.bounds?.size ?? cookedStandaloneModel?.bounds.size ?? ([0.62, 1.1, 0.46] as Tuple3);
        const position: Tuple3 = [interaction.position[0], interaction.position[1] ?? 0, interaction.position[2]];
        instances.push({
          ...planInstance(
            `interaction_${interaction.id}`,
            "interaction_terminal",
            standaloneAsset,
            interaction.roomId,
            position,
            [
              Math.max(0.05, boundsSize[0] / 2),
              Math.max(0.05, boundsSize[1] / 2),
              Math.max(0.05, boundsSize[2] / 2),
            ],
          ),
          rotation: [0, interaction.yaw ?? 0, 0],
          state: { interactionId: interaction.id, type: interaction.type },
        });
        if (standaloneModelKey === "hp_wall_door_switch_button_v1") {
          lights.push({
            id: `light_wall_door_switch_${interaction.id}`,
            type: "point",
            roomId: interaction.roomId,
            doorId: null,
            color: "#7ff2ff",
            intensity: 0.38,
            position: [interaction.position[0], Math.max(0.65, position[1] + 0.16), interaction.position[2]],
            distance: 2.4,
            decay: 2,
            semanticRole: "builder_wall_door_switch",
          });
        }
        counts.markers += 1;
        continue;
      }
      const nativePuzzleModel = machine ? nativeRawModels?.models.get(machine.modelKey) : null;
      const cookedPuzzleModel = machine && !nativePuzzleModel ? cooked?.models.get(machine.modelKey) : null;
      if (machine && (nativePuzzleModel || cookedPuzzleModel)) {
        const terminalAsset = nativePuzzleModel ? ensureNativeRawAsset(nativePuzzleModel) : ensureCookedAsset(cookedPuzzleModel as CookedGlbModel);
        const boundsSize = nativePuzzleModel?.asset.bounds?.size ?? cookedPuzzleModel?.bounds.size ?? ([1, 1.4, 0.5] as Tuple3);
        instances.push({
          ...planInstance(
            `terminal_${interaction.id}`,
            "interaction_terminal",
            terminalAsset,
            interaction.roomId,
            [interaction.position[0], 0, interaction.position[2]],
            [
              Math.max(0.05, boundsSize[0] / 2),
              Math.max(0.05, boundsSize[1] / 2),
              Math.max(0.05, boundsSize[2] / 2),
            ],
          ),
          rotation: [0, interaction.yaw ?? 0, 0],
          state: { interactionId: interaction.id, type: interaction.type },
        });
        lights.push({
          id: `light_puzzle_${interaction.id}`,
          type: "point",
          roomId: interaction.roomId,
          doorId: null,
          color: puzzleConsoleLightColor(machine.kind),
          intensity: 0.46,
          position: [interaction.position[0], 1.35, interaction.position[2]],
          distance: 2.8,
          decay: 2,
          semanticRole: "builder_puzzle_console",
        });
        counts.markers += 1;
        continue;
      }
      // Route switch with no cooked GLB (fast packs): render the recognizable
      // route-control console fallback, not a generic terminal box.
      const isRouteSwitch = routeSwitchInteractionIds.has(interaction.id);
      const assetKey = isRouteSwitch
        ? `builder:route:${interaction.id}`
        : machine
        ? `builder:puzzle:${machine.kind}:${interaction.id}`
        : `builder:terminal:${interaction.id}`;
      geometry.beginAsset(assetKey);
      if (isRouteSwitch) {
        pushRouteSwitchConsole(geometry, materials, terminalMaterial);
      } else if (machine) {
        puzzleConsoleFallbackBake(machine.kind, geometry, materials, terminalMaterial);
      } else {
        geometry.pushBox(0, 0.55, 0, 0.62, 1.1, 0.46, terminalMaterial);
        geometry.pushBox(0, 1.28, 0.05, 0.54, 0.4, 0.08, screenMaterial);
      }
      const terminalAsset = geometry.endAsset();
      if (isRouteSwitch) markProceduralResource("builder_route_switch_console", terminalAsset);
      else if (machine) markProceduralResource(machine.modelKey, terminalAsset);
      const terminalHalfSize: Tuple3 = isRouteSwitch ? [0.6, 0.55, 0.4] : puzzleConsoleProceduralBoundsHalf(machine?.kind ?? null);
      instances.push({
        ...planInstance(`terminal_${interaction.id}`, "interaction_terminal", terminalAsset, interaction.roomId, [interaction.position[0], 0, interaction.position[2]], terminalHalfSize),
        rotation: [0, interaction.yaw ?? 0, 0],
        state: { interactionId: interaction.id, type: interaction.type },
      });
      if (machine) {
        lights.push({
          id: `light_puzzle_${interaction.id}`,
          type: "point",
          roomId: interaction.roomId,
          doorId: null,
          color: puzzleConsoleLightColor(machine.kind),
          intensity: 0.6,
          position: [interaction.position[0], 1.7, interaction.position[2]],
          distance: 3.4,
          decay: 2,
          semanticRole: "builder_puzzle_console",
        });
      }
    }
    counts.markers += 1;
  }

  for (const puzzle of level.puzzles ?? []) {
    if (puzzle.type !== "hit_sequence") continue;
    for (const target of puzzle.targets) {
      const targetBake = puzzleTargetBakeById.get(puzzleTargetBakeKey(puzzle.id, target.id));
      const targetVisual = targetBake?.visual;
      if (!targetVisual) continue;
      const targetPosition = targetBake?.actor.position ?? target.position;
      const colorKey = targetVisual.colorKey;
      const hex = targetVisual.colorHex;
      const orbModelKey = targetVisual.modelKey;
      const orbPositionY = isFreePuzzleOrbModelKey(orbModelKey) ? 0 : targetPosition[1];
      const nativeRawOrbModel = orbModelKey ? nativeRawModels?.models.get(orbModelKey) : null;
      if (nativeRawOrbModel) {
        const orbAsset = ensureNativeRawAsset(nativeRawOrbModel);
        const boundsSize = nativeRawOrbModel.asset.bounds?.size ?? ([0.7, 0.8, 0.7] as Tuple3);
        pushCookedPuzzleOrbStand(target, targetPosition, colorKey, hex, targetVisual.proxyHalfSize);
        instances.push({
          ...planInstance(`orb_${target.id}`, "prop", orbAsset, target.roomId, [targetPosition[0], orbPositionY, targetPosition[2]], [
            Math.max(0.05, boundsSize[0] / 2),
            Math.max(0.05, boundsSize[1] / 2),
            Math.max(0.05, boundsSize[2] / 2),
          ]),
          state: { puzzleId: puzzle.id, targetId: target.id, colorKey },
        });
        counts.markers += 1;
        lights.push({
          id: `light_orb_${target.id}`,
          type: "point",
          roomId: target.roomId,
          doorId: null,
          color: hex,
          intensity: 0.7,
          position: targetVisual.lightPosition,
          distance: 3.2,
          decay: 2,
          semanticRole: "builder_puzzle_orb",
        });
        continue;
      }
      const cookedOrbModel = orbModelKey ? cooked?.models.get(orbModelKey) : null;
      if (cookedOrbModel) {
        const orbAsset = ensureCookedAsset(cookedOrbModel);
        pushCookedPuzzleOrbStand(target, targetPosition, colorKey, hex, targetVisual.proxyHalfSize);
        instances.push({
          ...planInstance(`orb_${target.id}`, "prop", orbAsset, target.roomId, [targetPosition[0], orbPositionY, targetPosition[2]], [
            Math.max(0.05, cookedOrbModel.bounds.size[0] / 2),
            Math.max(0.05, cookedOrbModel.bounds.size[1] / 2),
            Math.max(0.05, cookedOrbModel.bounds.size[2] / 2),
          ]),
          state: { puzzleId: puzzle.id, targetId: target.id, colorKey },
        });
        counts.markers += 1;
        lights.push({
          id: `light_orb_${target.id}`,
          type: "point",
          roomId: target.roomId,
          doorId: null,
          color: hex,
          intensity: 0.7,
          position: targetVisual.lightPosition,
          distance: 3.2,
          decay: 2,
          semanticRole: "builder_puzzle_orb",
        });
        continue;
      }
      geometry.beginAsset(`builder:orb:${target.id}`);
      pushBuilderPuzzleOrb(geometry, materials, colorKey, hex, targetPosition[1]);
      const orbAsset = geometry.endAsset();
      markProceduralResource(orbModelKey, orbAsset);
      instances.push({
        ...planInstance(`orb_${target.id}`, "prop", orbAsset, target.roomId, [targetPosition[0], 0, targetPosition[2]], targetVisual.proxyHalfSize),
        state: { puzzleId: puzzle.id, targetId: target.id, colorKey },
      });
      counts.markers += 1;
      lights.push({
        id: `light_orb_${target.id}`,
        type: "point",
        roomId: target.roomId,
        doorId: null,
        color: hex,
        intensity: 0.7,
        position: targetVisual.lightPosition,
        distance: 3.2,
        decay: 2,
        semanticRole: "builder_puzzle_orb",
      });
    }
  }

  // --- Deep bake: dynamic-entity models (no static instances) -------------
  // Pickups, enemies, and the weapon viewmodels are looked up by modelKey at
  // runtime by the renderer's dynamic paths; registering their cooked
  // geometry here is enough to upgrade them from proxy boxes.
  if (cooked) {
    for (const model of cooked.models.values()) {
      if (referenceDecalRuntimeSpec(model.modelKey)) continue;
      if (storyPaintingRuntimeSpec(model.modelKey)) continue;
      if (!cookedAssetKeys.has(model.modelKey)) ensureCookedAsset(model);
    }
    for (const missing of cooked.missing) {
      fallbackProxyModels.add(missing.modelKey);
      diagnostics.push(`「${missing.modelKey}」：${missing.reason}，使用简化造型代替。`);
    }
  }

  // --- Fast native enemies: copy official Raw-baked geometry -----------------
  if (nativeRawModels?.models.size) {
    for (const model of nativeRawModels.models.values()) {
      if (referenceDecalRuntimeSpec(model.modelKey)) continue;
      if (storyPaintingRuntimeSpec(model.modelKey)) continue;
      if (cookedAssetKeys.has(model.modelKey)) continue;
      ensureNativeRawAsset(model);
    }
  }

  // --- Plan assembly ------------------------------------------------------
  const geometryBuffer = geometry.finish();
  const geometryAssets = geometry.assets();
  const packTexturePlanEntries = packTextures.map((texture) => ({
    page: texture.page ?? 0,
    layer: texture.layer,
    // Placeholder; the pack loader rewrites these to blob URLs.
    url: `builder-pack://texture/${texture.page ?? 0}/${texture.layer}`,
    name: texture.name,
  }));
  const builderBaseColorTextures = [...externalBaseColorTextures, ...packTexturePlanEntries];
  const presetLights = officialLighting ? rawPresetLightsForMap(map, officialLighting.lights, roomPresentation?.overrides ?? {}) : [];
  const propLocalLights = rawPresetLightsForMap(map, createPropLocalLights(map), roomPresentation?.overrides ?? {}, "");
  const renderLights = officialLighting ? [...presetLights, ...propLocalLights, ...lights] : [...propLocalLights, ...lights];
  const lightingProfiles = applyOfficialLightingTuning(
    project.sourceLevel?.levelId,
    map.rooms.map((room) => ({
      roomId: room.id,
      artist: { exposure: 1.02, contrast: 1.06, saturation: 1.0, warmth: warmthForRoom(builderRoomsById.get(room.id)?.style) },
      bounce: { floor: 0.22, ceiling: 0.32, side: 0.2, shadowDepth: 0.62 + lighting.shadow * 0.3 },
      algorithm: { contact: 0.7 + lighting.shadow * 0.4, shadowReceiver: 0.72 },
    })),
  );
  if (hasOfficialLightingTuning(project.sourceLevel?.levelId)) {
    diagnostics.push(`官方光影调优已应用：${project.sourceLevel!.levelId}`);
  }
  const rawGeometry: RawPlanGeometry = {
    binaryFile: "builder-runtime-pack://geometry",
    vertexStrideFloats: FLOATS_PER_VERTEX,
    materials: materials.list(),
    baseColorTextures: nativeRawModels
      ? [...nativeRawModels.baseColorTextures, ...builderBaseColorTextures]
      : builderBaseColorTextures,
    ...(nativeRawModels
      ? {
          baseColorTextureSize: nativeRawModels.baseColorTextureSize,
          materialTextureSize: nativeRawModels.materialTextureSize,
          materialTextures: nativeRawModels.materialTextures,
        }
      : {}),
    assets: geometryAssets,
  };
  const pagedTextures = paginateBuilderRuntimePackTextures(rawGeometry, geometryBuffer, packTextures);
  if (pagedTextures.baseColorPagesUsed > 1 || pagedTextures.materialPagesUsed > 1) {
    diagnostics.push(
      `Raw WebGPU 贴图分页：baseColor ${Math.max(1, pagedTextures.baseColorPagesUsed)} 页，material ${Math.max(1, pagedTextures.materialPagesUsed)} 页。`,
    );
  }

  const renderPlan: RawRenderPlan = {
    level: { id: level.id },
    officialBuilderSurfaceBridge: builderRuntimeSurfaceBridge(instances),
    presentation: officialLighting ? rawPresentationFromOfficialLighting(officialLighting) : presentationFrom(lighting),
    rooms: map.rooms.map((room) => ({
      id: room.id,
      mood: room.mood ?? null,
      skinKey: room.skinKey ?? null,
      bounds: { center: [...room.bounds.center] as Tuple3, size: [...room.bounds.size] as Tuple3 },
    })),
    instances,
    lights: renderLights,
    lightingProfiles,
    visibilityScenarios: buildVisibilityScenarios(map, renderLights),
    geometry: pagedTextures.geometry,
  };
  const geometryAssetsByKey = new Map(geometryAssets.map((asset) => [asset.modelKey, asset]));
  const missingCookedReasons = new Map((cooked?.missing ?? []).map((entry) => [entry.modelKey, entry.reason]));
  const wgpuResources = (options.assetIndex ?? []).map((entry) => {
    const nativeRawModel = nativeRawModels?.models.get(entry.modelKey);
    if (nativeRawAssetKeys.has(entry.modelKey) && geometryAssetsByKey.has(entry.modelKey)) {
      return {
        modelKey: entry.modelKey,
        kind: entry.kind,
        roles: [...entry.roles],
        status: "native-raw" as const,
        geometryModelKey: entry.modelKey,
        sourceLevelId: nativeRawModel?.sourceLevelId,
      };
    }
    if (cookedAssetKeys.has(entry.modelKey) && geometryAssetsByKey.has(entry.modelKey)) {
      return {
        modelKey: entry.modelKey,
        kind: entry.kind,
        roles: [...entry.roles],
        status: "cooked-glb" as const,
        geometryModelKey: entry.modelKey,
      };
    }
    const proceduralGeometryKey = proceduralResourceKeys.get(entry.modelKey);
    if (proceduralGeometryKey && geometryAssetsByKey.has(proceduralGeometryKey)) {
      return {
        modelKey: entry.modelKey,
        kind: entry.kind,
        roles: [...entry.roles],
        status: "proxy" as const,
        geometryModelKey: proceduralGeometryKey,
        reason: "Builder surface/door was baked as procedural Raw geometry for this room.",
      };
    }
    if (fallbackProxyModels.has(entry.modelKey)) {
      return {
        modelKey: entry.modelKey,
        kind: entry.kind,
        roles: [...entry.roles],
        status: "proxy" as const,
        geometryModelKey: null,
        reason: "WGPU resource map missing; procedural proxy was used.",
      };
    }
    return {
      modelKey: entry.modelKey,
      kind: entry.kind,
      roles: [...entry.roles],
      status: "missing" as const,
      geometryModelKey: null,
      reason: missingCookedReasons.get(entry.modelKey) ?? "No WGPU geometry was registered for this modelKey.",
    };
  });

  const manifest: BuilderRuntimePackManifest = {
    schemaVersion: BUILDER_RUNTIME_PACK_ENGINE_VERSION,
    levelId: level.id,
    title: level.title,
    bakeMode: options.manifestBakeMode ?? (cooked ? "cooked-glb" : "proxy"),
    cookedModels: cookedModelKeys,
    nativeRawModels: nativeRawModelKeys,
    nativeRawEnemyModels: nativeRawEnemyModelKeys,
    nativeRawFurnitureModels: nativeRawFurnitureModelKeys,
    wgpuResources,
    cookedMaterials: materials.cookedCount(),
    transparentMaterials: materials.transparentCount(),
    missingModels: cooked ? [...cooked.missing] : [],
    fallbackProxyModels: [...fallbackProxyModels],
    bakeDurationMs: Date.now() - bakeStartedMs,
    geometryBytes: geometryBuffer.byteLength,
    textureBytes: pagedTextures.textureBlobs.reduce((sum, texture) => sum + texture.bytes.byteLength, 0),
    textureFallbackModels: cooked ? [...cooked.textureFallbackModels] : [],
    assetVersionHash: options.assetVersionHash ?? "",
    // The robot animation bridge requires native Raw node chunks. Deep packs
    // now prefer official Raw enemy geometry and only fall back to cooked
    // static poses when that bridgeable source is unavailable.
    enemyAnimationMode: nativeRawEnemyModelKeys.length > 0 ? "bridge" : "static",
    enemyAnimationFallbackReason:
      nativeRawEnemyModelKeys.length > 0
        ? undefined
        : cooked
          ? "本地烘焙的机器人使用整体动作，没有关节动画。"
          : "快速包的机器人使用简化造型。",
    counts: {
      rooms: map.rooms.length,
      walls: counts.walls,
      doors: map.doors.length,
      props: counts.props,
      markers: counts.markers,
      robots: (level.waves ?? []).reduce((total, wave) => total + wave.enemies.reduce((sum, enemy) => sum + enemy.count, 0), 0),
      materials: materials.list().length,
      lights: lights.length,
      instances: instances.length,
      vertices: geometry.vertexCount(),
      triangles: geometry.vertexCount() / 3,
    },
  };

  return { renderPlan, geometryBuffer, textures: pagedTextures.textureBlobs, manifest, diagnostics };
}

// ---------------------------------------------------------------------------
// Baked builder surfaces
// ---------------------------------------------------------------------------







// ---------------------------------------------------------------------------
// Geometry writer (14-float raw vertex format)
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function puzzleTargetBakeKey(puzzleId: string, targetId: string) {
  return `${puzzleId}::${targetId}`;
}

function mimeTypeForTextureUrl(url: string) {
  const clean = url.split("?")[0]?.toLowerCase() ?? url.toLowerCase();
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function collectExternalBuilderRuntimeTextureBlobs(
  renderPlan: RawRenderPlan,
  existing: readonly BuilderPackTextureBlob[] = [],
  options: BuilderRuntimePackExternalTextureOptions = {},
): Promise<BuilderRuntimePackExternalTextureResult> {
  const diagnostics: string[] = [];
  const textures = [...existing];
  const seen = new Set(textures.map((texture) => texturePageLayerKey(texture.page, texture.layer)));

  for (const entry of renderPlan.geometry?.baseColorTextures ?? []) {
    if (!entry.url || entry.url.startsWith("builder-pack://")) continue;
    const key = texturePageLayerKey(entry.page, entry.layer);
    if (seen.has(key)) continue;
    try {
      const response = await fetch(resolveExternalTextureUrl(entry.url, options.baseUrl));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const mimeType = response.headers.get("content-type")?.split(";")[0] || entry.mimeType || mimeTypeForTextureUrl(entry.url);
      textures.push({
        page: entry.page ?? 0,
        layer: entry.layer,
        mimeType,
        bytes,
        name: entry.name ?? `external-base-color:${key}`,
      });
      seen.add(key);
    } catch (error) {
      diagnostics.push(
        `外部贴图未能写入试玩包 ${entry.name ?? entry.url}：${error instanceof Error ? error.message : "未知错误"}。`,
      );
    }
  }

  return { textures, diagnostics };
}

function texturePageLayerKey(page: number | null | undefined, layer: number | null | undefined) {
  const safePage = Number.isFinite(page) ? Math.max(0, Math.floor(Number(page))) : 0;
  return `${safePage}:${Number(layer)}`;
}

function resolveExternalTextureUrl(url: string, baseUrl?: string) {
  if (/^[a-z][a-z0-9+.-]*:/iu.test(url)) return url;
  const base =
    baseUrl ||
    (typeof document !== "undefined" ? document.baseURI : undefined) ||
    (typeof location !== "undefined" ? location.href : undefined);
  return base ? new URL(url, base).toString() : url;
}

function planInstance(
  id: string,
  role: string,
  modelKey: string,
  roomId: string | null,
  position: Tuple3,
  halfSize: Tuple3,
): RawPlanInstance {
  return {
    id,
    role,
    modelKey,
    roomId,
    secondaryRoomId: null,
    position,
    localOffset: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visibility: { type: "room" },
    state: null,
    estimatedBounds: {
      center: [position[0], position[1] + halfSize[1], position[2]],
      halfSize,
    },
  };
}

function builderRuntimeSurfaceBridge(instances: readonly RawPlanInstance[]): NonNullable<RawRenderPlan["officialBuilderSurfaceBridge"]> {
  const surfaceInstances = instances.filter(
    (instance) =>
      (instance.role === "floor" || instance.role === "wall" || instance.role === "ceiling") &&
      (instance.modelKey.startsWith("builder:floor:") ||
        instance.modelKey.startsWith("builder:walls:") ||
        instance.modelKey.startsWith("builder:ceiling:")),
  );
  const roomIds = [...new Set(surfaceInstances.map((instance) => instance.roomId).filter((roomId): roomId is string => Boolean(roomId)))].sort();
  const surfaceAssetKeys = [...new Set(surfaceInstances.map((instance) => instance.modelKey))].sort();
  return {
    enabled: surfaceInstances.length > 0,
    reason: surfaceInstances.length > 0 ? "builder-runtime-pack-surfaces" : "no-surface-overrides",
    roomIds,
    surfaceAssetKeys,
    insertedInstances: surfaceInstances.length,
    removedShellInstances: 0,
    prunedShellAssets: 0,
  };
}

function serviceElevatorPropProxySize(modelKey: string): Tuple3 | null {
  if (modelKey === "service_elevator_exit_stage") return [6.3, 3.9, 5.0];
  if (modelKey === "service_elevator_call_buttons") return [0.82, 1.08, 0.16];
  if (modelKey === "service_elevator_interior_shell") return [6.1, 3.3, 5.0];
  if (modelKey === "service_elevator_ascent_shaft_fx") return [6.2, 3.9, 4.2];
  if (modelKey === "door_threshold_service_elevator") return [4.5, 0.22, 0.74];
  return null;
}

function rawPresentationFromOfficialLighting(lighting: RoomLightingPresetDefinition): RawRenderPlan["presentation"] {
  return {
    lighting: {
      ambient: { ...lighting.ambient },
      hemisphereIntensity: lighting.hemisphereIntensity ?? 0,
      directional: lighting.directional
        ? {
            color: lighting.directional.color,
            intensity: lighting.directional.intensity,
            position: [...lighting.directional.position] as Tuple3,
          }
        : null,
      fog: { ...lighting.fog },
      bloom: { ...lighting.bloom },
    },
  };
}

function rawPresetLightsForMap(
  map: LevelMapConfig,
  presetLights: readonly RoomLightingDefinition[],
  overrides: { ceilingLightIntensity?: number },
  idPrefix = "preset",
): RawPlanLight[] {
  return presetLights.map((light): RawPlanLight => {
    const overrideScale = "overrideScale" in light && light.overrideScale ? Number(overrides[light.overrideScale] ?? 1) : 1;
    const scaled = Number.isFinite(overrideScale) ? overrideScale : 1;
    const position = resolveRenderLightPosition(map, light);
    const targetPosition =
      "target" in light && light.target
        ? light.target
        : "targetRoomRelative" in light && light.targetRoomRelative
        ? resolveRoomRelativePosition(map, light.targetRoomId ?? light.roomId, light.targetRoomRelative)
        : null;
    return {
      id: idPrefix ? `${idPrefix}_${light.id}` : light.id,
      type: light.type,
      roomId: light.roomId ?? null,
      doorId: light.doorId ?? null,
      color: light.color,
      intensity: light.type === "floor_glow" ? (light.opacity ?? 0) * scaled : (light.intensity ?? 0) * scaled,
      position: [...position] as Tuple3,
      targetPosition: targetPosition ? ([...targetPosition] as Tuple3) : null,
      distance: "distance" in light ? light.distance ?? null : null,
      decay: "decay" in light ? light.decay ?? null : null,
      angle: "angle" in light ? light.angle ?? null : null,
      penumbra: "penumbra" in light ? light.penumbra ?? null : null,
      width: light.type === "area" ? light.width : null,
      height: light.type === "area" ? light.height : null,
      opacity: light.type === "floor_glow" ? (light.opacity ?? 0) * scaled : null,
      castShadow: light.type === "spot" ? Boolean(light.castShadow) : false,
      semanticRole: "semanticRole" in light && typeof light.semanticRole === "string" ? light.semanticRole : "official_preset",
      semanticSourceId: "semanticSourceId" in light && typeof light.semanticSourceId === "string" ? light.semanticSourceId : light.id,
    };
  });
}

function pushServiceElevatorPropProxy(
  geometry: GeometryWriter,
  materials: MaterialTable,
  modelKey: string,
  bodyMaterial: number,
  baseMaterial: number,
) {
  if (modelKey === "service_elevator_call_buttons") {
    const mount = materials.surface("elevator-call:mount", { color: "#071018", roughness: 0.46, visualRole: "structural_dark" });
    const trim = materials.surface("elevator-call:trim", { color: "#7d8d8e", roughness: 0.3, visualRole: "neutral_surface" });
    const socket = materials.surface("elevator-call:single-button-socket", { color: "#02070a", roughness: 0.62, visualRole: "structural_dark" });
    const plunger = materials.surface("elevator-call:single-button-plunger", {
      color: "#cbd7d2",
      roughness: 0.18,
      visualRole: "neutral_surface",
      emissiveColor: "#5feeff",
      emissiveStrength: 0.16,
    });
    const ring = materials.emissive("elevator-call:single-button-ring", "#62efff", 0.92, "cyan_emissive");
    const screen = materials.emissive("elevator-call:screen", "#8bf7ff", 0.72, "cyan_emissive");
    geometry.pushBox(0, 0.54, 0, 0.82, 1.08, 0.1, mount);
    geometry.pushBox(0, 0.91, 0.062, 0.46, 0.052, 0.035, screen);
    geometry.pushDiscXY(0, 0.48, 0.092, 0.29, socket, 72);
    geometry.pushDiscXY(0, 0.48, 0.118, 0.205, plunger, 72);
    geometry.pushRingXY(0, 0.48, 0.132, 0.232, 0.255, ring, 80);
    for (const x of [-0.315, 0.315]) {
      for (const y of [0.085, 0.995]) geometry.pushBox(x, y, 0.075, 0.04, 0.04, 0.024, trim);
    }
    geometry.pushBox(0, 0.11, 0.06, 0.42, 0.04, 0.035, screen);
    return true;
  }

  if (modelKey === "service_elevator_exit_stage") {
    pushServiceElevatorPropProxy(geometry, materials, "service_elevator_interior_shell", bodyMaterial, baseMaterial);
    pushServiceElevatorPropProxy(geometry, materials, "service_elevator_call_buttons", bodyMaterial, baseMaterial);
    pushServiceElevatorPropProxy(geometry, materials, "service_elevator_ascent_shaft_fx", bodyMaterial, baseMaterial);
    return true;
  }

  if (modelKey === "service_elevator_interior_shell") {
    const wall = materials.surface("elevator-shell:wall", { color: "#27323a", roughness: 0.42, visualRole: "neutral_surface" });
    const inset = materials.surface("elevator-shell:inset", { color: "#101920", roughness: 0.64, visualRole: "structural_dark" });
    const plate = materials.surface("elevator-shell:plate", { color: "#4c5b63", roughness: 0.36, visualRole: "neutral_surface" });
    const dark = materials.surface("elevator-shell:dark-trim", { color: "#050b10", roughness: 0.7, visualRole: "structural_dark" });
    const cyan = materials.emissive("elevator-shell:cyan-lines", "#71f2ff", 0.9, "cyan_emissive");
    geometry.pushBox(0, 1.56, -2.46, 5.74, 3.12, 0.18, wall);
    geometry.pushBox(0, 1.58, -2.35, 4.96, 2.42, 0.08, inset);
    geometry.pushBox(-1.24, 1.54, -2.29, 2.18, 2.08, 0.07, plate);
    geometry.pushBox(1.24, 1.54, -2.29, 2.18, 2.08, 0.07, plate);
    geometry.pushBox(0, 1.58, -2.23, 0.055, 2.52, 0.085, dark);
    geometry.pushBox(-3.04, 1.54, -0.06, 0.18, 3.08, 4.72, wall);
    geometry.pushBox(3.04, 1.54, -0.06, 0.18, 3.08, 4.72, wall);
    geometry.pushBox(-2.94, 1.58, -0.1, 0.08, 2.24, 3.7, inset);
    geometry.pushBox(2.94, 1.58, -0.1, 0.08, 2.24, 3.7, inset);
    geometry.pushBox(0, 3.18, -0.08, 5.74, 0.16, 4.82, dark);
    geometry.pushBox(0, 2.94, 2.22, 5.92, 0.34, 0.24, dark);
    for (const x of [-2.42, 0, 2.42]) geometry.pushBox(x, 1.54, -2.17, 0.042, 2.12, 0.04, cyan);
    for (const y of [1.12, 2.16]) geometry.pushBox(0, y, -2.16, 4.92, 0.042, 0.04, cyan);
    return true;
  }

  if (modelKey === "service_elevator_ascent_shaft_fx") {
    const glass = materials.surface("elevator-shaft:glass", {
      color: "#1a3036",
      roughness: 0.18,
      visualRole: "glass_shell",
      emissiveColor: "#59eaff",
      emissiveStrength: 0.28,
      alphaMode: "BLEND",
      doubleSided: true,
      transparency: { mode: "blend", alpha: 0.2, source: "service_elevator_ascent_shaft_fx_fallback" },
    });
    const cyan = materials.emissive("elevator-shaft:cyan-column", "#62efff", 0.7, "cyan_emissive");
    const amber = materials.emissive("elevator-shaft:amber-marker", "#d4a35c", 0.45, "route_gold");
    const rib = materials.surface("elevator-shaft:dark-rib", { color: "#05090c", roughness: 0.58, visualRole: "structural_dark" });
    geometry.pushBox(-2.58, 1.72, -0.96, 0.12, 3.5, 0.08, cyan);
    geometry.pushBox(2.58, 1.72, -0.82, 0.12, 3.5, 0.08, cyan);
    geometry.pushBox(-1.18, 1.72, 1.92, 0.86, 3.2, 0.032, glass);
    geometry.pushBox(1.18, 1.72, 1.92, 0.86, 3.2, 0.032, glass);
    geometry.pushBox(-2.96, 1.72, 0.34, 0.12, 3.5, 0.08, rib);
    geometry.pushBox(2.96, 1.72, 0.34, 0.12, 3.5, 0.08, rib);
    for (const y of [0.52, 1.62, 2.86]) geometry.pushBox(0, y, 1.68, 4.8, 0.065, 0.06, rib);
    geometry.pushBox(-1.2, 0.96, -1.82, 1.36, 0.055, 0.045, amber);
    return true;
  }

  if (modelKey === "door_threshold_service_elevator") {
    const trim = materials.surface("elevator-threshold:trim", { color: "#6d8086", roughness: 0.32, visualRole: "neutral_surface" });
    const dark = materials.surface("elevator-threshold:dark", { color: "#071018", roughness: 0.62, visualRole: "structural_dark" });
    const cyan = materials.emissive("elevator-threshold:cyan-line", "#71f2ff", 0.85, "cyan_emissive");
    geometry.pushBox(0, 0.08, 0, 4.5, 0.16, 0.74, dark);
    geometry.pushBox(0, 0.16, 0, 3.96, 0.08, 0.48, trim);
    geometry.pushBox(0, 0.22, -0.24, 3.5, 0.035, 0.035, cyan);
    geometry.pushBox(-1.95, 0.18, 0, 0.12, 0.12, 0.56, bodyMaterial);
    geometry.pushBox(1.95, 0.18, 0, 0.12, 0.12, 0.56, bodyMaterial);
    return true;
  }

  void baseMaterial;
  return false;
}
