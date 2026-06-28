import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { modelKeyForInteraction, modelKeyForKeyVisual, modelKeyForPuzzleOrbTarget } from "../assets/environmentModelAssets";
import { FLOATS_PER_VERTEX, VERTEX_MATERIAL_INDEX_COMPONENT } from "../render/raw-webgpu/RawWebGpuConstants";
import { getBuiltInLevelConfig } from "../game/config/ConfigPackStore";
import { officialExitRoomReferenceId } from "../game/config/shared/exitRoomReference";
import type { LevelDefinition } from "../game/config/schema/levelConfig";
import { validateLevelConfig } from "../game/config/ConfigValidator";
import { builderProjectFromBuiltInLevel, builderProjectFromLevel, normalizeOfficialBuilderProject, pristineOfficialSourceLevelIdForProject } from "./BuilderLevelImport";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import { auditBuilderOfficialBridge } from "./official-bridge/OfficialBridgeAudit";
import { resolveBuilderBakePlan } from "./official-bridge/ResolvedBakePlan";
import { builderNativeRawRequestsForAssetIndex, builderRuntimeAssetIndexForProject } from "./runtime-pack/BuilderRuntimeAssetIndex";
import { loadOfficialBuilderRuntimePackAssets, usesOfficialBuilderRuntimePack } from "./runtime-pack/BuilderRuntimePackAssets";
import { compileBuilderRuntimePack } from "./runtime-pack/compileBuilderRuntimePack";
import { propEntry } from "./BuilderAssetCatalog";
import { moveKeyPickupForDoor, normalizeBuilderKeyPickups } from "./BuilderKeyPickups";
import { pickAt } from "./BuilderPlacementRules";
import { createStarterProject, type BuilderProject } from "./BuilderTypes";

const OFFICIAL_LEVEL_IDS = [
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
] as const;

const OFFICIAL_SURFACE_IMPORTS = [
  [
    "level_02_residential_simulation",
    "hp:residential_false_home_shell_v1",
    "floor_level03_museum_premium_stone_shell",
    "wall_level02_false_home_plaster_v1",
    "ceiling_level02_false_home_plaster_v1",
  ],
  [
    "level_03_human_museum",
    "hp:human_museum_gallery_shell_v1",
    "floor_photo_marble",
    "wall_hp_museum_limestone_panel",
    "ceiling_hp_museum_coffered_limestone",
  ],
] as const;

function mockLocalAssetFetchForGlbs() {
  const originalFetch = globalThis.fetch.bind(globalThis);
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const pathname = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? new URL(rawUrl).pathname : rawUrl;
    if (pathname.startsWith("/src/assets/") && pathname.endsWith(".glb")) {
      const bytes = await fs.readFile(path.join(process.cwd(), pathname.slice(1)));
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": "model/gltf-binary" },
      });
    }
    return originalFetch(input, init);
  });
}

const BUILDER_NATIVE_SOURCE_LEVEL_DISALLOWED_KEYS = [
  "mapPresentation",
  "mapInteractions",
  "spawnPoint",
  "initialInventory",
  "exit",
  "puzzles",
  "objectiveChain",
  "events",
  "environmentStates",
  "pickups",
  "requiresStoryPickupsBeforeWaves",
  "initialWaveStartDelay",
  "combatLimits",
  "presentation",
] as const;

function importAndCompile(levelId: string) {
  const project = builderProjectFromBuiltInLevel(levelId);
  expect(project).not.toBeNull();
  const { level, issues } = compileBuilderProjectToLevel(project!);
  expect(issues).toEqual([]);
  expect(level).not.toBeNull();
  return { project: project!, level: level! };
}

function cookedTriangleModel(modelKey: string, size: [number, number, number]) {
  const vertices = new Float32Array(10 * 3);
  vertices.set([0, 0, 0, 0, 1, 0, 0, 0, 0, -1], 0);
  vertices.set([size[0], 0, 0, 0, 1, 0, 1, 0, 0, -1], 10);
  vertices.set([0, size[1], 0, 0, 1, 0, 0, 1, 0, -1], 20);
  return {
    modelKey,
    vertices,
    vertexCount: 3,
    triangleCount: 1,
    materials: [
      {
        name: `qa_${modelKey}`,
        baseColorFactor: [0.35, 0.48, 0.52, 1] as [number, number, number, number],
        emissiveFactor: [0.02, 0.12, 0.16] as [number, number, number],
        emissiveStrength: 0.5,
        roughnessFactor: 0.48,
        metallicFactor: 0.45,
        alphaMode: "OPAQUE" as const,
        doubleSided: true,
      },
    ],
    images: [],
    bounds: {
      min: [0, 0, 0] as [number, number, number],
      center: [size[0] / 2, size[1] / 2, size[2] / 2] as [number, number, number],
      size,
    },
    warnings: [],
  };
}

function materialTriangleCountsForAsset(pack: ReturnType<typeof compileBuilderRuntimePack>, modelKey: string) {
  const asset = pack.renderPlan.geometry.assets.find((candidate) => candidate.modelKey === modelKey);
  expect(asset).toBeTruthy();
  const vertices = new Float32Array(pack.geometryBuffer);
  const materials = new Map(pack.renderPlan.geometry.materials.map((material) => [material.index, material]));
  const vertexCounts = new Map<string, number>();
  if (!asset) return new Map<string, number>();
  for (let vertex = asset.vertexOffset; vertex < asset.vertexOffset + asset.vertexCount; vertex += 1) {
    const materialIndex = Math.round(vertices[vertex * FLOATS_PER_VERTEX + VERTEX_MATERIAL_INDEX_COMPONENT] ?? -1);
    const name = materials.get(materialIndex)?.name ?? `missing:${materialIndex}`;
    vertexCounts.set(name, (vertexCounts.get(name) ?? 0) + 1);
  }
  const counts = new Map<string, number>();
  for (const [name, vertexCount] of vertexCounts) counts.set(name, vertexCount / 3);
  return counts;
}

function expectCanonicalExitRoom(level: LevelDefinition) {
  const exitInteraction = level.map?.interactions.find((interaction) => interaction.type === "exit");
  expect(exitInteraction).toMatchObject({
    visualKey: "service_elevator_panel",
    materialKey: "terminal_cyan",
  });
  const exitRoomId = exitInteraction?.roomId;
  expect(exitRoomId).toBeTruthy();
  const exitRoom = level.map?.rooms.find((room) => room.id === exitRoomId);
  expect(exitRoom).toMatchObject({
    aesthetic: { style: "exit" },
    skinKey: "service_elevator_hero",
    floorMaterialKey: "service_elevator_metal",
    wallMaterialKey: "service_elevator_metal",
  });
  const exitDoor = level.map?.doors.find((door) => door.id === exitInteraction?.opensDoorId) ??
    level.map?.doors.find((door) => door.fromRoomId === exitRoomId || door.toRoomId === exitRoomId);
  expect(exitDoor).toMatchObject({
    skinKey: "service_elevator_hero",
    visualKey: "service_elevator_door",
    materialKey: "service_elevator_metal",
  });
  expect(exitDoor?.openVisualPolicy).toMatchObject({
    hideClosedHardwareAfterOpen: true,
    hidePanelAfterOpen: true,
  });

  const exitProps = level.map?.props?.filter((prop) => prop.roomId === exitRoomId) ?? [];
  expect(exitProps.map((prop) => prop.modelKey).sort()).toEqual([
    "door_threshold_service_elevator",
    "service_elevator_ascent_shaft_fx",
    "service_elevator_call_buttons",
    "service_elevator_exit_stage",
    "service_elevator_interior_shell",
  ]);
  for (const prop of exitProps) {
    expect(prop.tags).toEqual(expect.arrayContaining([officialExitRoomReferenceId, "elevator"]));
  }
}

describe("official level builder round trip", () => {
  it("compiles selected story paintings as puzzle article prerequisites", () => {
    const storyPropId = "story_awake";
    const expectedArticleId = `article_l4_story_awakened_machine_image2_v1_${storyPropId}`;
    const project: BuilderProject = {
      schemaVersion: "hp.builder.v1",
      projectId: "proj_story_prereq",
      title: "story prereq",
      rooms: [
        { id: "room_spawn", label: "记忆展间", style: "museum", center: [0, 0], size: [8, 8] },
        { id: "room_exit", label: "闸门后室", style: "exit", center: [0, 8], size: [8, 8] },
      ],
      doors: [
        { id: "door_exit", fromRoomId: "room_spawn", toRoomId: "room_exit", lockType: "puzzle_complete", puzzleKind: "gallery_reading" },
      ],
      props: [
        {
          id: storyPropId,
          modelKey: "l4_story_awakened_machine_image2_v1",
          roomId: "room_spawn",
          position: [-2.2, -2.4],
          rotationY: 0,
          scale: 1,
        },
      ],
      puzzles: [
        {
          id: "puzzle_gallery",
          kind: "gallery_reading",
          linkedDoorId: "door_exit",
          roomId: "room_spawn",
          position: [1.8, -1.8],
          rotationY: 0,
          requiredStoryPropIds: [storyPropId],
        } as any,
      ],
      robots: [],
      exitRoomId: "room_exit",
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    expect(level!.articles?.map((article) => article.id)).toContain(expectedArticleId);
    expect(level!.map?.interactions.find((interaction) => interaction.id === "pz_door_exit_panel")).toMatchObject({
      requiresArticleIds: [expectedArticleId],
    });
    expect(validateLevelConfig(level!, { authoringProfile: "generated" }).errors.map((issue) => issue.code)).toEqual([]);
  });

  it("normalizes every key-item door into one movable pickup", () => {
    const starter = createStarterProject();
    expect(starter.doors.find((door) => door.id === "door_c")?.lockType).toBe("key_item");
    expect(starter.pickups?.some((pickup) => pickup.kind === "key_item")).toBe(false);

    const normalized = normalizeBuilderKeyPickups(starter);
    const keyPickup = normalized.pickups?.find((pickup) => pickup.kind === "key_item" && pickup.linkedDoorId === "door_c");
    expect(keyPickup).toMatchObject({
      id: "key_door_c",
      roomId: "room_archive",
    });
    expect(normalized.doors.find((door) => door.id === "door_c")).toMatchObject({ keyRoomId: "room_archive" });
    expect(pickAt(normalized, keyPickup!.position[0] + 0.98, keyPickup!.position[1], () => null, [])).toMatchObject({
      kind: "pickup",
      id: keyPickup!.id,
    });

    const moved = moveKeyPickupForDoor(normalized, "door_c", "room_spawn");
    expect(moved.pickups?.find((pickup) => pickup.id === keyPickup!.id)).toMatchObject({
      roomId: "room_spawn",
      linkedDoorId: "door_c",
    });
    expect(moved.doors.find((door) => door.id === "door_c")).toMatchObject({ keyRoomId: "room_spawn" });

    const unlocked = normalizeBuilderKeyPickups({
      ...moved,
      doors: moved.doors.map((door) => (door.id === "door_c" ? { ...door, lockType: "none" as const } : door)),
    });
    expect(unlocked.pickups?.some((pickup) => pickup.kind === "key_item" && pickup.linkedDoorId === "door_c")).toBe(false);
    expect(unlocked.doors.find((door) => door.id === "door_c")).not.toHaveProperty("keyRoomId");
  });

  it("imports level_01_maintenance_bay with its official builder maintenance bay draft", () => {
    const project = builderProjectFromBuiltInLevel("level_01_maintenance_bay");
    expect(project).not.toBeNull();
    expect(pristineOfficialSourceLevelIdForProject(project!)).toBe("level_01_maintenance_bay");

    const firstGameplayRoom = project!.rooms.find((room) => room.style !== "exit");
    expect(firstGameplayRoom?.env).toMatchObject({
      surfaceKitId: "hp:industrial_panel_arena_shell_v4_image2_floor",
      floorPresetId: "floor_level01_maintenance_image2_v1",
      wallPresetId: "wall_level01_maintenance_gunmetal_v1",
      ceilingPresetId: "ceiling_level01_maintenance_service_ribs_v1",
      ceilingVisible: true,
      wallHeight: 3.36,
      ceilingHeight: 3.36,
    });

    const level01PropModelKeys = project!.props.map((prop) => prop.modelKey);
    expect(level01PropModelKeys).toHaveLength(20);
    expect(level01PropModelKeys).toEqual(expect.arrayContaining([
      "hero_maintenance_repair_bay",
      "hero_maintenance_repair_arm_cluster",
      "light_wall_medical_strip_cyan_1m",
      "light_ceiling_flicker_cyan_2m",
      "decal_human_reference_triptych",
      "room_chair_service",
      "room_crate_stack",
      "room_locker_low",
      "room_maintenance_supply_cabinet",
      "room_l01_p10",
      "room_l1_img2_body_reference_lightbox",
      "room_l1_img2_cable_reel_cart",
      "room_l1_img2_maintenance_privacy_screen",
      "room_l1_img2_sterile_tool_rack",
      "room_l1_img2_sterile_wash_basin",
      "room_l1_img2_warning_barrier",
      "room_l1_img2_wall_tool_board",
      "service_elevator_interior_shell",
      "door_threshold_service_elevator",
      "service_elevator_call_buttons",
    ]));
    expect(project!.props.find((prop) => prop.modelKey === "hero_maintenance_repair_bay")).toMatchObject({
      roomId: "maintenance_bay_floor",
      position: [-2.8, 6.8],
      rotationY: 0.25,
      sourceProp: expect.objectContaining({ label: "维修床" }),
    });
    expect(project!.props.find((prop) => prop.modelKey === "decal_human_reference_triptych")).toMatchObject({
      roomId: "maintenance_bay_floor",
      position: [-1.5, 4.5],
      rotationY: 3.5915926535897933,
      scale: 1.45,
      elevation: 1.78,
      sourceProp: expect.objectContaining({ label: "人体参考三联图" }),
    });
    const refreshedMissingCanonicalProps = normalizeOfficialBuilderProject({
      ...project!,
      props: project!.props.filter((prop) => !["hero_maintenance_repair_bay", "decal_human_reference_triptych"].includes(prop.modelKey)),
    });
    expect(refreshedMissingCanonicalProps.props.map((prop) => prop.modelKey)).toEqual(expect.arrayContaining([
      "hero_maintenance_repair_bay",
      "decal_human_reference_triptych",
    ]));
    expect(propEntry("hero_maintenance_repair_bay")).toMatchObject({ group: "维修" });
    expect(propEntry("decal_human_reference_triptych")).toMatchObject({ group: "维修" });
    expect(propEntry("decal_human_reference_triptych")?.clueCapacity).toBeUndefined();

    const { level, issues } = compileBuilderProjectToLevel(project!);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    expect(level!.map?.presentation).toMatchObject({
      roomKit: "hp:maintenance_combat_bay_v3_art_pass",
      lightingPreset: "hp:cyan_lockdown_arena_v5_age_director",
      shellKit: "hp:industrial_panel_arena_shell_v4_image2_floor",
    });
    const assetIndex = builderRuntimeAssetIndexForProject(level!, project!);
    for (const modelKey of [
      "hero_maintenance_repair_bay",
      "hero_maintenance_repair_arm_cluster",
      "light_wall_medical_strip_cyan_1m",
      "light_ceiling_flicker_cyan_2m",
      "decal_human_reference_triptych",
    ]) {
      expect(assetIndex.find((entry) => entry.modelKey === modelKey)).toMatchObject({
        kind: "furniture",
        nativeRawEligible: true,
      });
    }
    const cookedModels = new Map([
      ["hero_maintenance_repair_bay", cookedTriangleModel("hero_maintenance_repair_bay", [3.2, 1.25, 1.4])],
      ["hero_maintenance_repair_arm_cluster", cookedTriangleModel("hero_maintenance_repair_arm_cluster", [2.2, 2.6, 1.4])],
      ["light_wall_medical_strip_cyan_1m", cookedTriangleModel("light_wall_medical_strip_cyan_1m", [0.12, 1, 0.08])],
      ["light_ceiling_flicker_cyan_2m", cookedTriangleModel("light_ceiling_flicker_cyan_2m", [2, 0.12, 0.18])],
      ["decal_human_reference_triptych", cookedTriangleModel("decal_human_reference_triptych", [2.46, 1.22, 0.02])],
    ]);
    const runtimePack = compileBuilderRuntimePack(level!, project!, {
      assetIndex,
      cooked: { models: cookedModels, missing: [], geometryBytes: 10 * 3 * 4, textureFallbackModels: [] },
    });
    expect(runtimePack.renderPlan.instances.find((instance) => instance.id === "prop_level_01_repair_bay")).toMatchObject({
      modelKey: "hero_maintenance_repair_bay",
    });
    expect(runtimePack.renderPlan.instances.find((instance) => instance.id === "prop_level_01_human_reference_triptych_decal")).toMatchObject({
      modelKey: "decal_human_reference_triptych",
      role: "decal_human_reference_triptych",
    });
    expect(runtimePack.renderPlan.geometry?.baseColorTextures?.some((texture) => texture.name === "prop:decal_human_reference_triptych:reference-decal")).toBe(true);
    expect(runtimePack.renderPlan.geometry?.materials?.find((material) => material.name === "reference-decal:decal_human_reference_triptych")).toMatchObject({
      visualRole: "neutral_surface",
      emissiveStrength: 0,
    });
    expect(runtimePack.renderPlan.lights.find((light) => light.id === "light_decal_level_01_human_reference_triptych_decal")).toMatchObject({
      intensity: 0.035,
      distance: 1.3,
      semanticRole: "reference_decal",
    });
    expect(runtimePack.manifest.cookedModels).toEqual(expect.arrayContaining(["hero_maintenance_repair_bay"]));
    expect(runtimePack.manifest.cookedModels).not.toEqual(expect.arrayContaining(["decal_human_reference_triptych"]));
    expect(runtimePack.manifest.fallbackProxyModels).not.toEqual(
      expect.arrayContaining(["hero_maintenance_repair_bay"]),
    );
    expect(level!.waves.find((wave) => wave.id === "elite_wave")?.enemies.find((enemy) => enemy.tier === "leader")).toMatchObject({
      healthMultiplier: 0.54,
    });
  });

  it.each(OFFICIAL_SURFACE_IMPORTS)("imports %s with its official surface kit", (levelId, surfaceKitId, floorPresetId, wallPresetId, ceilingPresetId) => {
    const project = builderProjectFromBuiltInLevel(levelId);
    expect(project).not.toBeNull();
    expect(pristineOfficialSourceLevelIdForProject(project!)).toBe(levelId);
    const firstGameplayRoom = project!.rooms.find((room) => room.style !== "exit");
    expect(firstGameplayRoom?.env).toMatchObject({
      surfaceKitId,
      floorPresetId,
      wallPresetId,
      ceilingPresetId,
    });
  });

  it.each(["level_01_maintenance_bay", "level_02_residential_simulation"] as const)("keeps %s on a lightweight builder-native source shell", (levelId) => {
    const project = builderProjectFromBuiltInLevel(levelId);
    expect(project).not.toBeNull();
    for (const key of BUILDER_NATIVE_SOURCE_LEVEL_DISALLOWED_KEYS) {
      expect(project!.sourceLevel).not.toHaveProperty(key);
    }
  });

  it("stops direct official playtest once an official import is edited", () => {
    const project = builderProjectFromBuiltInLevel("level_03_human_museum");
    expect(project).not.toBeNull();
    expect(pristineOfficialSourceLevelIdForProject(project!)).toBe("level_03_human_museum");

    const edited: BuilderProject = {
      ...project!,
      props: project!.props.map((prop, index) => (index === 0 ? { ...prop, rotationY: prop.rotationY + Math.PI / 4 } : prop)),
    };

    expect(pristineOfficialSourceLevelIdForProject(edited)).toBeNull();
  });

  it("keeps Level 4 builder-authored door lock edits when refreshing the official import", () => {
    const project = builderProjectFromBuiltInLevel("level_04_memory_clinic");
    expect(project).not.toBeNull();

    const edited: BuilderProject = {
      ...project!,
      doors: project!.doors.map((door) => {
        if (door.id === "level_04_waiting_door") {
          return {
            ...door,
            lockType: "key_item" as const,
            keyRoomId: "level_04_entry_decon",
          };
        }
        if (door.id === "level_04_rescue_door") {
          return {
            ...door,
            lockType: "switch_state" as const,
            wallDoorSwitchId: "l4_wall_memory_gate_valve",
            wallDoorSwitchStateId: "armed",
          };
        }
        if (door.id === "level_04_theater_door") {
          return {
            ...door,
            lockType: "none" as const,
            puzzleKind: undefined,
            puzzleRoomId: undefined,
          };
        }
        return door;
      }),
    };

    const normalized = normalizeOfficialBuilderProject(edited);
    expect(normalized.doors.find((door) => door.id === "level_04_waiting_door")).toMatchObject({
      lockType: "key_item",
      keyRoomId: "level_04_entry_decon",
    });
    expect(normalized.doors.find((door) => door.id === "level_04_rescue_door")).toMatchObject({
      lockType: "switch_state",
      wallDoorSwitchId: "l4_wall_memory_gate_valve",
      wallDoorSwitchStateId: "armed",
    });
    expect(normalized.doors.find((door) => door.id === "level_04_theater_door")).toMatchObject({
      lockType: "none",
      puzzleKind: undefined,
      puzzleRoomId: undefined,
    });
    expect(pristineOfficialSourceLevelIdForProject(normalized)).toBeNull();
  });

  it("round-trips multi-puzzle door locks through official builder import and compile", () => {
    const source = getBuiltInLevelConfig("level_04_memory_clinic");
    const multiPuzzleLevel: LevelDefinition = {
      ...source,
      map: {
        ...source.map,
        doors: source.map.doors.map((door) =>
          door.id === "level_04_body_door" && door.lock.type === "puzzle_complete"
            ? {
                ...door,
                lock: {
                  ...door.lock,
                  puzzleIds: ["pz_level_04_body_door", "pz_level_04_theater_door"],
                },
              }
            : door,
        ),
      },
    };

    const imported = builderProjectFromLevel(multiPuzzleLevel);
    expect(imported).not.toBeNull();
    expect(imported!.doors.find((door) => door.id === "level_04_body_door")?.puzzleIds).toEqual([
      "pz_level_04_body_door",
      "pz_level_04_theater_door",
    ]);

    const { level, issues } = compileBuilderProjectToLevel(imported!);

    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    const bodyDoor = level!.map.doors.find((door) => door.id === "level_04_body_door");
    expect(bodyDoor?.lock).toMatchObject({
      type: "puzzle_complete",
      puzzleId: "pz_level_04_body_door",
      puzzleIds: ["pz_level_04_body_door", "pz_level_04_theater_door"],
    });
    const bodyPuzzleActions = level!.puzzles?.find((puzzle) => puzzle.id === "pz_level_04_body_door")?.success.actions ?? [];
    expect(bodyPuzzleActions).toEqual(
      expect.arrayContaining([{ type: "open_door", doorId: "level_04_body_door", respectLock: true }]),
    );
  });

  it("refreshes cached Level 2 official-import door locks and boss robots", () => {
    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();

    const stale: BuilderProject = {
      ...project!,
      doors: project!.doors.map((door) =>
        door.id === "level_02_care_room_door"
          ? {
              ...door,
              lockType: "none",
              waveId: undefined,
              sourceDoor: {
                ...door.sourceDoor,
                defaultState: "closed",
                lock: { type: "none" },
              },
            }
          : door,
      ),
      robots: project!.robots.filter((robot) => robot.wave?.id !== "level_02_carekeeper_host"),
    };

    const normalized = normalizeOfficialBuilderProject(stale);
    const careDoor = normalized.doors.find((door) => door.id === "level_02_care_room_door");
    const freshCareDoor = project!.doors.find((door) => door.id === "level_02_care_room_door");
    expect(freshCareDoor).toBeDefined();
    expect(careDoor).toMatchObject({
      lockType: freshCareDoor!.lockType,
      sourceDoor: {
        defaultState: "locked",
        lock: freshCareDoor!.sourceDoor?.lock,
      },
    });
    if (freshCareDoor!.waveId !== undefined) expect(careDoor?.waveId).toBe(freshCareDoor!.waveId);
    expect(new Set(careDoor?.surviveRobotIds ?? [])).toEqual(new Set(freshCareDoor?.surviveRobotIds ?? []));
    expect(normalized.robots.some((robot) => robot.wave?.id === "level_02_carekeeper_host" && robot.archetype === "custodian_elite")).toBe(true);
    expect(normalized.sourceLevel?.mapInteractions).toBeUndefined();
    expect(normalized.sourceLevel?.objectiveChain).toBeUndefined();
    expect(normalized.sourceLevel?.mapPresentation).toBeUndefined();
    expect(normalized.sourceLevel?.combatLimits).toBeUndefined();
    expect(normalized.sourceLevel?.presentation).toBeUndefined();

    const { level, issues } = compileBuilderProjectToLevel(normalized);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    const expectedCompiledWaveId = normalized.robots.find((robot) => careDoor?.surviveRobotIds?.includes(robot.id))?.waveChain?.waveId ?? careDoor?.waveId;
    expect(level!.map?.doors.find((door) => door.id === "level_02_care_room_door")).toMatchObject({
      defaultState: "locked",
      lock: { type: "survive_wave", waveId: expectedCompiledWaveId },
    });
    expect(level!.waves.find((wave) => wave.id === "level_02_carekeeper_host")?.enemies[0]).toMatchObject({
      archetype: "custodian_elite",
      tier: "leader",
    });
    expect(level!.map?.interactions.some((interaction) => interaction.id === "level_02_use_exit")).toBe(false);
    expect(level!.map?.interactions.some((interaction) => interaction.id === "level_02_inspect_photo_wall")).toBe(false);
    expect(level!.map?.interactions.some((interaction) => interaction.id === "use_builder_exit")).toBe(true);
    expect(level!.objectiveChain?.some((objective) => objective.id === "obj_survive_level_02_care_room_door")).toBe(true);
    expect(level!.map?.doors.find((door) => door.id === "level_02_light_room_door")?.lock).toMatchObject({
      type: "key_item",
      keyItemId: "key_level_02_light_room_door",
    });
  });

  it("keeps Level 2 official builder-native content from being overwritten by stale source metadata", () => {
    const { project, level } = importAndCompile("level_02_residential_simulation");

    expect(project.sourceLevel?.mapPresentation).toBeUndefined();
    expect(project.sourceLevel?.combatLimits).toBeUndefined();
    expect(project.sourceLevel?.presentation).toBeUndefined();
    expect(project.robots.some((robot) => robot.id.startsWith("robot_wave_gumgzq") || robot.id.startsWith("robot_wave_level_02_light_room"))).toBe(false);

    const colorPuzzle = project.puzzles?.find((puzzle) => puzzle.id === "level_02_light_sequence");
    expect(colorPuzzle).toMatchObject({ kind: "color_sequence" });
    expect(colorPuzzle?.sourcePuzzle).toBeUndefined();
    expect(colorPuzzle?.sourceInteraction).toBeUndefined();
    expect(project.doors.find((door) => door.id === "level_02_light_room_door")?.sourceDoor?.lock?.type).toBe("key_item");

    expect(level.map?.presentation).toBeUndefined();
    expect(level.map?.rooms.find((room) => room.id === "level_02_living_room")).toMatchObject({
      floorMaterialKey: "level03_museum_floor_premium_stone",
      wallMaterialKey: "residential_wall",
    });
    expect(level.map?.rooms.find((room) => room.id === "level_02_care_room")?.floorMaterialKey).not.toBe("hazard_hall_floor");
    expect(level.map?.rooms.find((room) => room.id === "level_02_light_room")?.floorMaterialKey).not.toBe("sterile_lab_floor");

    expect(level.map?.interactions.find((interaction) => interaction.id === "pz_level_02_family_exit_door_panel")).toMatchObject({
      visualKey: "puzzle_console_color_sequence",
      label: "灯序墙",
    });
    expect(level.map?.keyItems.find((item) => item.id === "key_level_02_light_room_door")).toMatchObject({
      roomId: "level_02_care_room",
      position: [11.4, 0, -1.6],
      requiredForDoorIds: ["level_02_light_room_door"],
    });

    const livingWave = level.waves.find((wave) => wave.id === "wave_gumgzq");
    expect(livingWave?.enemies.map((enemy) => [enemy.archetype, enemy.count])).toEqual([
      ["clamp_bot", 2],
      ["clamp_bot", 2],
    ]);
    expect(level.waves.find((wave) => wave.id === "wave_gumgzq_pressure_loop")).toMatchObject({
      nonBlocking: true,
      enemies: [expect.objectContaining({ archetype: "clamp_bot" })],
    });
    const lightWave = level.waves.find((wave) => wave.id === "wave_level_02_light_room");
    expect(lightWave?.enemies.map((enemy) => [enemy.archetype, enemy.count])).toEqual([
      ["shield_tech", 2],
      ["clamp_bot", 2],
    ]);
  });

  it("keeps the Level 2 key item as a movable builder pickup", () => {
    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();

    const keyId = "key_level_02_light_room_door";
    const keyDoorId = "level_02_light_room_door";
    const keyPickup = project!.pickups?.find((pickup) => pickup.id === keyId);
    expect(keyPickup).toMatchObject({
      kind: "key_item",
      linkedDoorId: keyDoorId,
      roomId: "level_02_care_room",
      position: [11.4, -1.6],
    });
    expect(pickAt(project!, keyPickup!.position[0] + 0.98, keyPickup!.position[1], () => null, [])).toMatchObject({
      kind: "pickup",
      id: keyId,
    });

    const staleWithoutKeyPickup = normalizeOfficialBuilderProject({
      ...project!,
      pickups: project!.pickups?.filter((pickup) => pickup.id !== keyId),
    });
    expect(staleWithoutKeyPickup.pickups?.find((pickup) => pickup.id === keyId)).toMatchObject({
      kind: "key_item",
      linkedDoorId: keyDoorId,
    });

    const moved = normalizeOfficialBuilderProject({
      ...project!,
      pickups: project!.pickups?.map((pickup) =>
        pickup.id === keyId
          ? { ...pickup, roomId: "level_02_living_room", position: [-2.75, 1.25] as const }
          : pickup,
      ),
    });
    const movedKey = moved.pickups?.find((pickup) => pickup.id === keyId);
    expect(movedKey).toMatchObject({
      roomId: "level_02_living_room",
      position: [-2.75, 1.25],
    });

    const { level, issues } = compileBuilderProjectToLevel(moved);
    expect(issues).toEqual([]);
    expect(level?.map?.keyItems.find((item) => item.id === keyId)).toMatchObject({
      roomId: "level_02_living_room",
      position: [-2.75, 0, 1.25],
      requiredForDoorIds: [keyDoorId],
    });
  });

  it("keeps builder-native key doors locked even if stale sourceDoor says open", () => {
    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();

    const staleOpenSourceDoor: BuilderProject = {
      ...project!,
      doors: project!.doors.map((door) =>
        door.id === "level_02_light_room_door"
          ? {
              ...door,
              sourceDoor: {
                ...door.sourceDoor,
                defaultState: "open",
                autoOpenOnApproach: true,
                lock: { type: "none" },
              },
            }
          : door,
      ),
    };

    const { level, issues } = compileBuilderProjectToLevel(staleOpenSourceDoor);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    expect(level!.map?.doors.find((door) => door.id === "level_02_light_room_door")).toMatchObject({
      defaultState: "locked",
      autoOpenOnApproach: false,
      lock: { type: "key_item", keyItemId: "key_level_02_light_room_door" },
    });
  });

  it("does not let stale Level 2 source door locks point at missing official puzzles", () => {
    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();

    const { puzzles: _puzzles, ...draftWithoutPuzzles } = project!;
    const normalized = normalizeOfficialBuilderProject(draftWithoutPuzzles);
    const { level, issues } = compileBuilderProjectToLevel(normalized);

    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    const puzzleIds = new Set(level!.puzzles.map((puzzle) => puzzle.id));
    const puzzleLockedDoors = (level!.map?.doors ?? []).filter((door) => door.lock.type === "puzzle_complete");
    expect(puzzleLockedDoors.length).toBeGreaterThan(0);
    for (const door of puzzleLockedDoors) {
      expect(puzzleIds.has(door.lock.puzzleId)).toBe(true);
    }
    expect(validateLevelConfig(level!, { authoringProfile: "generated" }).errors.map((issue) => `${issue.code}:${issue.path}`)).toEqual([]);
  });

  it("does not compile key pickups behind their own locked door", () => {
    const project: BuilderProject = {
      schemaVersion: "hp.builder.v1",
      projectId: "proj_key_behind_door",
      title: "key behind door",
      rooms: [
        { id: "room_spawn", label: "前室", style: "residential", center: [0, 0], size: [8, 8] },
        { id: "room_locked", label: "锁后房间", style: "hazard", center: [0, -8], size: [8, 8] },
      ],
      doors: [
        { id: "door_locked", fromRoomId: "room_spawn", toRoomId: "room_locked", lockType: "key_item", keyRoomId: "room_locked" },
      ],
      props: [],
      pickups: [
        {
          id: "key_door_locked",
          kind: "key_item",
          roomId: "room_locked",
          position: [0, -8],
          linkedDoorId: "door_locked",
        },
      ],
      robots: [],
      exitRoomId: "room_locked",
    };

    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    expect(level!.map?.keyItems.find((item) => item.id === "key_door_locked")).toMatchObject({
      roomId: "room_spawn",
      requiredForDoorIds: ["door_locked"],
    });
    expect(validateLevelConfig(level!, { authoringProfile: "generated" }).errors.map((issue) => issue.code)).not.toContain("key.behind.own.lock");
  });

  it("lets edited Level 2 imported doors use builder-authored wave gates", () => {
    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();

    const edited: BuilderProject = {
      ...project!,
      robots: [
        ...project!.robots.map((robot) =>
          robot.waveChain?.waveId === "wave_gumgzq"
            ? { ...robot, waveChain: { ...robot.waveChain, pressureLoop: undefined } }
            : robot,
        ),
        {
          id: "builder_living_guard_b",
          label: "客厅二段守门组",
          roomId: "level_02_living_room",
          archetype: "clamp_bot",
          count: 2,
          waveChain: {
            waveId: "builder_living_gate_2",
            order: 2,
            label: "波次 2",
            pressureLoop: { enabled: true, archetype: "repair_drone", count: 1, startsAfter: 0.6, every: 7, maxAlive: 2 },
          },
        },
      ],
      doors: project!.doors.map((door) =>
        door.id === "level_02_care_room_door"
          ? {
              ...door,
              lockType: "survive_wave",
              waveId: "builder_living_gate_2",
              waveIds: ["builder_living_gate_2"],
            }
          : door,
      ),
    };

    const normalized = normalizeOfficialBuilderProject(edited);
    expect(normalized.doors.find((door) => door.id === "level_02_care_room_door")).toMatchObject({
      lockType: "survive_wave",
      waveId: "builder_living_gate_2",
      waveIds: ["builder_living_gate_2"],
    });
    expect(normalized.robots.some((robot) => robot.id === "builder_living_guard_b" && robot.waveChain?.waveId === "builder_living_gate_2")).toBe(true);

    const { level, issues } = compileBuilderProjectToLevel(normalized);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const careDoor = level!.map?.doors.find((door) => door.id === "level_02_care_room_door");
    expect(careDoor).toMatchObject({
      lock: { type: "survive_wave", waveId: "builder_living_gate_2" },
    });
    expect(careDoor?.lock.lockedMessage).not.toContain("先清掉生活模拟大厅里的家政单位");

    expect(level!.waves.find((wave) => wave.id === "builder_living_gate_2")?.trigger).toBeUndefined();
    expect(level!.events?.some((event) =>
      event.trigger.type === "wave_completed" &&
      event.trigger.id === "wave_gumgzq" &&
      event.actions.some((action) => action.type === "start_wave" && action.waveId === "builder_living_gate_2")
    )).toBe(true);
    expect(level!.events?.some((event) => event.id === "builder_builder_living_gate_2_complete")).toBe(true);
    expect(level!.events?.some((event) => event.id === "level_02_light_sequence_memory")).toBe(false);
    expect(level!.objectiveChain?.some((objective) => objective.id === "level_02_clear_living")).toBe(false);
    expect(level!.objectiveChain?.some((objective) => objective.type === "survive_wave" && objective.requiredIds?.includes("builder_living_gate_2"))).toBe(true);
    expect(level!.objectiveChain?.find((objective) => objective.id === "obj_reach_exit")).toMatchObject({
      completesWhen: { type: "interaction_completed", id: "use_builder_exit" },
    });
    expect(level!.map?.interactions.some((interaction) => interaction.id === "level_02_use_exit")).toBe(false);
    expect(level!.map?.interactions.some((interaction) => interaction.id === "use_builder_exit")).toBe(true);
    expect(level!.puzzles.find((puzzle) => puzzle.id === "level_02_care_room_puzzle")?.success.completesObjectiveId).toBeUndefined();

    const report = validateLevelConfig(level!, { authoringProfile: "generated" });
    expect(report.errors.map((issue) => `${issue.code}:${issue.path}`)).toEqual([]);
  });

  it("keeps builder wave edits on refreshed Level 2 source robots", () => {
    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();
    const sourceLivingRobot = project!.robots.find((robot) => robot.wave?.id === "level_02_living_swarm");
    expect(sourceLivingRobot).toBeDefined();

    const edited: BuilderProject = {
      ...project!,
      robots: project!.robots.map((robot) =>
        robot.id === sourceLivingRobot!.id
          ? {
              ...robot,
              label: "客厅二段守门组",
              archetype: "clamp_bot",
              count: 2,
              waveChain: { waveId: "builder_living_gate_1", order: 1, label: "波次 1" },
            }
          : robot,
      ),
      doors: project!.doors.map((door) =>
        door.id === "level_02_care_room_door"
          ? {
              ...door,
              lockType: "survive_wave",
              surviveRobotIds: [sourceLivingRobot!.id],
              waveId: "builder_living_gate_1",
              waveIds: ["builder_living_gate_1"],
            }
          : door,
      ),
    };

    const normalized = normalizeOfficialBuilderProject(edited);
    const refreshedRobot = normalized.robots.find((robot) => robot.id === sourceLivingRobot!.id);
    expect(refreshedRobot).toMatchObject({
      label: "客厅二段守门组",
      archetype: "clamp_bot",
      count: 2,
      waveChain: { waveId: "builder_living_gate_1", order: 1, label: "波次 1" },
      wave: { id: "level_02_living_swarm" },
    });

    const { level, issues } = compileBuilderProjectToLevel(normalized);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    expect(level!.waves.find((wave) => wave.id === "builder_living_gate_1")).toMatchObject({
      roomId: "level_02_living_room",
      enemies: [{ archetype: "clamp_bot", count: 2 }],
    });
  });

  it("merges unassigned Level 2 room robots into the imported room-entry wave", () => {
    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();

    const edited: BuilderProject = {
      ...project!,
      robots: [
        ...project!.robots,
        {
          id: "builder_extra_light_room_guard",
          label: "灯控室补充守卫",
          roomId: "level_02_light_room",
          archetype: "custodian_elite",
          count: 1,
        },
      ],
    };

    const { level, issues } = compileBuilderProjectToLevel(edited);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const lightRoomWaves = level!.waves.filter((wave) => wave.id === "wave_level_02_light_room");
    expect(lightRoomWaves).toHaveLength(1);
    expect(lightRoomWaves[0]?.enemies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ archetype: "shield_tech" }),
        expect.objectContaining({ archetype: "clamp_bot" }),
        expect.objectContaining({ archetype: "custodian_elite" }),
      ]),
    );
  });

  it.each(OFFICIAL_LEVEL_IDS)("imports %s on the generated builder lane", (levelId) => {
    const source = getBuiltInLevelConfig(levelId);
    const { project, level } = importAndCompile(levelId);
    const report = validateLevelConfig(level, { authoringProfile: "generated" });
    const bridgeAudit = auditBuilderOfficialBridge(level, project);

    expect(report.errors.map((issue) => `${issue.code}:${issue.path}`)).toEqual([]);
    expect(bridgeAudit.errors).toEqual([]);
    expect(level.map?.rooms.map((room) => room.id)).toEqual(source.map?.rooms.map((room) => room.id));
    expect(level.map?.doors.map((door) => door.id)).toEqual(source.map?.doors.map((door) => door.id));
    expect(level.map?.rooms.map((room) => [room.id, room.floorMaterialKey, room.wallMaterialKey])).toEqual(
      source.map?.rooms.map((room) => [room.id, room.floorMaterialKey, room.wallMaterialKey]),
    );
    expectCanonicalExitRoom(level);
    expectCanonicalExitRoom(source);
  });

  it("uses the builder runtime pack for builder-authored official levels", () => {
    expect(usesOfficialBuilderRuntimePack("level_01_maintenance_bay")).toBe(true);
    expect(usesOfficialBuilderRuntimePack("level_02_residential_simulation")).toBe(true);
    expect(usesOfficialBuilderRuntimePack("level_03_human_museum")).toBe(true);
    expect(usesOfficialBuilderRuntimePack("level_04_memory_clinic")).toBe(true);

    const project = builderProjectFromBuiltInLevel("level_02_residential_simulation");
    expect(project).not.toBeNull();
    const level = getBuiltInLevelConfig("level_02_residential_simulation");
    const assetIndex = builderRuntimeAssetIndexForProject(level, project!);
    const runtimePack = compileBuilderRuntimePack(level, project!, { assetIndex });
    const propInstanceIds = new Set(runtimePack.renderPlan.instances.filter((instance) => instance.role === "prop").map((instance) => instance.id));

    expect(propInstanceIds.has("prop_prop_repzr7")).toBe(true);
    expect(propInstanceIds.has("prop_prop_kn2uz2")).toBe(true);
    expect(propInstanceIds.has("prop_builder_exit_elevator_call_buttons")).toBe(true);
    expect(propInstanceIds.size).toBeGreaterThan(20);
  });

  it("cooks Level 4 official pickup models in the builder runtime pack", async () => {
    const fetchSpy = mockLocalAssetFetchForGlbs();
    try {
      const runtimePack = await loadOfficialBuilderRuntimePackAssets("level_04_memory_clinic");
      expect(runtimePack).not.toBeNull();
      const assetKeys = new Set(runtimePack?.plan.geometry?.assets.map((asset) => asset.modelKey) ?? []);

      expect(assetKeys.has("pickup_medkit_white_red")).toBe(true);
      expect(assetKeys.has("pickup_energy_cell_amber")).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("requests and uses native Raw models for the Level 2 official color board and authored lamps", () => {
    const { project, level } = importAndCompile("level_02_residential_simulation");
    const assetIndex = builderRuntimeAssetIndexForProject(level, project);
    const nativeRequests = builderNativeRawRequestsForAssetIndex(assetIndex);

    expect(assetIndex.find((entry) => entry.modelKey === "puzzle_console_color_sequence")).toMatchObject({
      kind: "furniture",
      nativeRawEligible: true,
    });
    expect(assetIndex.find((entry) => entry.modelKey === "hp_l2_cc0_ceiling_lamp_polyhaven_v1")).toMatchObject({
      kind: "furniture",
      nativeRawEligible: true,
    });
    expect(nativeRequests).toEqual(
      expect.arrayContaining([
        { modelKey: "puzzle_console_color_sequence", kind: "furniture" },
        { modelKey: "hp_l2_cc0_ceiling_lamp_polyhaven_v1", kind: "furniture" },
        { modelKey: "puzzle_orb_free_red", kind: "furniture" },
        { modelKey: "puzzle_orb_free_blue", kind: "furniture" },
        { modelKey: "puzzle_orb_free_green", kind: "furniture" },
      ]),
    );

    const rawModel = (modelKey: string, size: [number, number, number]) => ({
      modelKey,
      kind: "furniture" as const,
      sourceLevelId: "builder_runtime_resources",
      asset: {
        modelKey,
        status: "ready" as const,
        vertexOffset: 0,
        vertexCount: 3,
        bounds: { size },
      },
      vertices: cookedTriangleModel(modelKey, size).vertices,
    });
    const nativePack = compileBuilderRuntimePack(level, project, {
      assetIndex,
      nativeRawModels: {
        models: new Map([
          ["puzzle_console_color_sequence", rawModel("puzzle_console_color_sequence", [1.34, 1.69, 0.42])],
          ["hp_l2_cc0_ceiling_lamp_polyhaven_v1", rawModel("hp_l2_cc0_ceiling_lamp_polyhaven_v1", [0.39, 0.928, 0.39])],
          ["puzzle_orb_free_red", rawModel("puzzle_orb_free_red", [0.64, 1.52, 0.64])],
          ["puzzle_orb_free_blue", rawModel("puzzle_orb_free_blue", [0.64, 1.52, 0.64])],
          ["puzzle_orb_free_green", rawModel("puzzle_orb_free_green", [0.64, 1.52, 0.64])],
        ]),
        materials: [],
        baseColorTextures: [],
        materialTextures: [],
        libraryId: "test-native-raw",
        sourceLevelIds: ["builder_runtime_resources"],
      },
    });

    expect(nativePack.renderPlan.instances.find((instance) => instance.id === "terminal_pz_level_02_family_exit_door_panel")).toMatchObject({
      modelKey: "puzzle_console_color_sequence",
    });
    expect(nativePack.renderPlan.instances.find((instance) => instance.id === "prop_prop_mq3kae")).toMatchObject({
      modelKey: "hp_l2_cc0_ceiling_lamp_polyhaven_v1",
    });
    expect(nativePack.manifest.nativeRawModels).toEqual(
      expect.arrayContaining([
        "puzzle_console_color_sequence",
        "hp_l2_cc0_ceiling_lamp_polyhaven_v1",
        "puzzle_orb_free_red",
        "puzzle_orb_free_blue",
        "puzzle_orb_free_green",
      ]),
    );
    const nativeOrbInstances = nativePack.renderPlan.instances.filter((instance) => instance.id.startsWith("orb_pzc_"));
    expect(new Set(nativeOrbInstances.map((instance) => instance.modelKey))).toEqual(
      new Set(["puzzle_orb_free_red", "puzzle_orb_free_blue", "puzzle_orb_free_green"]),
    );
    expect(nativeOrbInstances.map((instance) => instance.position[1])).toEqual([0, 0, 0]);
    expect(nativePack.manifest.fallbackProxyModels).not.toEqual(
      expect.arrayContaining([
        "puzzle_console_color_sequence",
        "hp_l2_cc0_ceiling_lamp_polyhaven_v1",
        "puzzle_orb_free_red",
        "puzzle_orb_free_blue",
        "puzzle_orb_free_green",
      ]),
    );
  });

  it("deep-bakes Level 2 color puzzle machines while free-standing orbs use stable raw modelKeys", () => {
    const { project, level } = importAndCompile("level_02_residential_simulation");
    const cookedModels = new Map([
      ["puzzle_console_color_sequence", cookedTriangleModel("puzzle_console_color_sequence", [0.9, 1.4, 0.55])],
      ["puzzle_orb_free_red", cookedTriangleModel("puzzle_orb_free_red", [0.7, 1.5, 0.7])],
      ["puzzle_orb_free_blue", cookedTriangleModel("puzzle_orb_free_blue", [0.7, 1.5, 0.7])],
      ["puzzle_orb_free_green", cookedTriangleModel("puzzle_orb_free_green", [0.7, 1.5, 0.7])],
    ]);
    const deepPack = compileBuilderRuntimePack(level, project, {
      assetIndex: builderRuntimeAssetIndexForProject(level, project),
      cooked: { models: cookedModels, missing: [], geometryBytes: 10 * 3 * 4 * cookedModels.size, textureFallbackModels: [] },
    });

    expect(deepPack.renderPlan.instances.find((instance) => instance.id === "terminal_pz_level_02_family_exit_door_panel")).toMatchObject({
      modelKey: "puzzle_console_color_sequence",
    });
    const orbInstances = deepPack.renderPlan.instances.filter((instance) => instance.id.startsWith("orb_pzc_"));
    expect(orbInstances.length).toBeGreaterThanOrEqual(3);
    expect(new Set(orbInstances.map((instance) => instance.modelKey))).toEqual(
      new Set(["puzzle_orb_free_red", "puzzle_orb_free_blue", "puzzle_orb_free_green"]),
    );
    expect(new Set(orbInstances.map((instance) => instance.state?.colorKey))).toEqual(new Set(["red", "blue", "green"]));
    expect(orbInstances.map((instance) => instance.position[1])).toEqual([0, 0, 0]);
    expect(deepPack.manifest.fallbackProxyModels).not.toEqual(
      expect.arrayContaining(["puzzle_console_color_sequence", "puzzle_orb_free_red", "puzzle_orb_free_blue", "puzzle_orb_free_green"]),
    );
  });

  it("keeps the Level 3 official museum shell while deep-baking a painted photo floor override", () => {
    const sourceProject = builderProjectFromBuiltInLevel("level_03_human_museum");
    expect(sourceProject).not.toBeNull();
    const roomId = "level_03_tool_exhibit";
    const project: BuilderProject = {
      ...sourceProject!,
      rooms: sourceProject!.rooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              env: {
                ...room.env,
                surfaceOverrides: { ...room.env?.surfaceOverrides, floor: { presetId: "floor_photo_hex", authored: true } },
                floorPresetId: "floor_photo_hex",
                floorColor: undefined,
              },
            }
          : room,
      ),
    };

    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    const bakePlan = resolveBuilderBakePlan(level!, project);
    expect(bakePlan.rooms.find((room) => room.roomId === roomId)?.surfaceModelKeys).toMatchObject({
      floorModelKey: "room_floor_tile_museum",
      wallModelKey: "room_wall_panel_museum",
      ceilingModelKey: "room_ceiling_panel_museum",
    });

    const metadata = level!.authoringMetadata?.builderEnvironment as
      | { rooms?: Record<string, { surfaceOverrides?: { floor?: { authored?: boolean; presetId?: string } } }> }
      | undefined;
    expect(metadata?.rooms?.[roomId]?.surfaceOverrides?.floor?.presetId).toBe("floor_photo_hex");
    expect(metadata?.rooms?.[roomId]?.surfaceOverrides?.floor?.authored).toBe(true);

    const runtimePack = compileBuilderRuntimePack(level!, project);
    const floorMaterial = runtimePack.renderPlan.geometry?.materials?.find((material) => material.name === `floor:${roomId}`);
    const textureLayer = floorMaterial?.textures?.find((texture) => texture.semantic === "baseColor")?.layer;
    expect(textureLayer).toBeGreaterThan(0);
    const texture = runtimePack.renderPlan.geometry?.baseColorTextures?.find((entry) => entry.layer === textureLayer);
    expect(texture).toMatchObject({
      name: `surface:${roomId}:floor:floor_photo_hex`,
      mimeType: "image/webp",
    });
    expect(texture?.url).toContain("hex_tile_color");
  });

  it("preserves the museum's hidden prop interactions and five placed color orbs", () => {
    const { project, level } = importAndCompile("level_03_human_museum");
    const bakePlan = resolveBuilderBakePlan(level, project);
    const roomBakeById = new Map(bakePlan.rooms.map((room) => [room.roomId, room]));
    const interactionBakeById = new Map(bakePlan.interactions.map((interaction) => [interaction.interaction.id, interaction]));
    const targetBakeById = new Map(bakePlan.puzzleTargets.map((target) => [target.target.id, target]));

    const toolPuzzle = project.puzzles?.find((puzzle) => puzzle.id === "level_03_tool_calibration");
    expect(toolPuzzle?.sourceInteraction).toMatchObject({
      visualKey: "none",
      hostPropId: "level_03_tool_last_human_tool_vitrine",
    });
    expect(project.rooms.find((room) => room.id === "level_03_tool_exhibit")?.env).toMatchObject({
      surfaceKitId: "hp:human_museum_gallery_shell_v1",
      floorPresetId: "floor_photo_marble",
      wallPresetId: "wall_hp_museum_limestone_panel",
      ceilingPresetId: "ceiling_hp_museum_coffered_limestone",
      surfaceOverrides: {
        floor: { presetId: "floor_photo_marble" },
        wall: { presetId: "wall_hp_museum_limestone_panel" },
        ceiling: { presetId: "ceiling_hp_museum_coffered_limestone" },
      },
    });
    expect(roomBakeById.get("level_03_tool_exhibit")).toMatchObject({
      surfaceModelKeys: {
        floorModelKey: "room_floor_tile_museum",
        wallModelKey: "room_wall_panel_museum",
        ceilingModelKey: "room_ceiling_panel_museum",
      },
      ceilingVisible: true,
    });

    const colorPuzzle = project.puzzles?.find((puzzle) => puzzle.id === "builder_color_lock");
    const blueComponent = colorPuzzle?.components?.find((component) => component.sourceTarget?.id === "orb_blue");
    expect(colorPuzzle?.components?.map((component) => component.sourceTarget?.id).sort()).toEqual([
      "orb_blue",
      "orb_green",
      "orb_purple",
      "orb_red",
      "orb_yellow",
    ]);
    expect(blueComponent?.sourceTarget).toMatchObject({
      y: 1.15,
      anchorPropId: "level_03_orb_blue_pedestal",
      visualKey: "puzzle_orb_blue",
    });
    expect(blueComponent?.sourceActor).toMatchObject({
      id: "orb_blue",
      role: "orb:blue",
      kind: "target",
      roomId: "level_03_voice_exhibit",
      position: [14.5, 1.15, 1.5],
      colorKey: "blue",
      inputMode: "weapon_hit",
      hitbox: { shape: "sphere", radius: 0.72 },
      anchorPropId: "level_03_orb_blue_pedestal",
      targetId: "orb_blue",
    });

    const interactions = new Map(level.map?.interactions.map((interaction) => [interaction.id, interaction]) ?? []);
    expect(interactions.get("level_03_tool_case")).toMatchObject({
      visualKey: "none",
      anchorPropId: "level_03_tool_last_human_tool_vitrine",
    });
    expect(interactionBakeById.get("level_03_tool_case")).toMatchObject({
      hasPuzzleMachine: true,
      intent: { mode: "hosted_prop", bakeStandalone: false },
    });
    expect(interactions.get("story_level_03_tool_human_origin_wall_art")).toMatchObject({
      visualKey: "none",
      anchorPropId: "level_03_tool_human_origin_wall_art",
    });
    expect(interactionBakeById.get("story_level_03_tool_human_origin_wall_art")).toMatchObject({
      intent: { mode: "hosted_prop", bakeStandalone: false },
    });

    const compiledColorPuzzle = level.puzzles.find((puzzle) => puzzle.id === "builder_color_lock");
    expect(compiledColorPuzzle?.type).toBe("hit_sequence");
    if (compiledColorPuzzle?.type !== "hit_sequence") throw new Error("Expected museum color puzzle to stay hit_sequence.");
    expect(compiledColorPuzzle.targets.map((target) => target.id).sort()).toEqual([
      "orb_blue",
      "orb_green",
      "orb_purple",
      "orb_red",
      "orb_yellow",
    ]);
    expect(compiledColorPuzzle.targets.find((target) => target.id === "orb_blue")).toMatchObject({
      roomId: "level_03_voice_exhibit",
      position: [14.5, 1.15, 1.5],
      anchorPropId: "level_03_orb_blue_pedestal",
      visualKey: "puzzle_orb_blue",
    });
    expect(compiledColorPuzzle.actors?.find((actor) => actor.targetId === "orb_blue")).toMatchObject({
      id: "orb_blue",
      role: "orb:blue",
      kind: "target",
      roomId: "level_03_voice_exhibit",
      position: [14.5, 1.15, 1.5],
      colorKey: "blue",
      hitbox: { shape: "sphere", radius: 0.72 },
      anchorPropId: "level_03_orb_blue_pedestal",
      targetId: "orb_blue",
    });
    expect(targetBakeById.get("orb_blue")).toMatchObject({
      actor: {
        id: "orb_blue",
        roomId: "level_03_voice_exhibit",
        position: [14.5, 1.15, 1.5],
        targetId: "orb_blue",
      },
      visual: {
        colorKey: "blue",
        modelKey: "age_museum_puzzle_orb_blue",
      },
    });
    expect(modelKeyForPuzzleOrbTarget(compiledColorPuzzle.targets.find((target) => target.id === "orb_blue")!)).toBe("age_museum_puzzle_orb_blue");

    const movedBlueOrbProject: BuilderProject = {
      ...project,
      props: project.props.map((prop) =>
        prop.id === "level_03_orb_blue_pedestal"
          ? { ...prop, position: [13.5, 2.25], roomId: "level_03_voice_exhibit" }
          : prop,
      ),
      puzzles: project.puzzles?.map((puzzle) =>
        puzzle.id === "builder_color_lock"
          ? {
              ...puzzle,
              components: puzzle.components?.map((component) =>
                component.sourceTarget?.id === "orb_blue"
                  ? {
                      ...component,
                      position: [13.5, 2.25],
                      sourceActor: component.sourceActor ? { ...component.sourceActor, position: [14.5, 1.15, 1.5] } : component.sourceActor,
                    }
                  : component,
              ),
            }
          : puzzle,
      ),
    };
    const movedBlueOrbCompile = compileBuilderProjectToLevel(movedBlueOrbProject);
    expect(movedBlueOrbCompile.issues).toEqual([]);
    const movedBlueOrbPuzzle = movedBlueOrbCompile.level.puzzles.find((candidate) => candidate.id === "builder_color_lock");
    expect(movedBlueOrbPuzzle?.type).toBe("hit_sequence");
    if (movedBlueOrbPuzzle?.type !== "hit_sequence") throw new Error("Expected moved museum color puzzle to stay hit_sequence.");
    expect(movedBlueOrbPuzzle.targets.find((target) => target.id === "orb_blue")).toMatchObject({
      roomId: "level_03_voice_exhibit",
      position: [13.5, 1.15, 2.25],
      anchorPropId: "level_03_orb_blue_pedestal",
    });
    expect(movedBlueOrbPuzzle.actors?.find((actor) => actor.targetId === "orb_blue")).toMatchObject({
      roomId: "level_03_voice_exhibit",
      position: [13.5, 1.15, 2.25],
      anchorPropId: "level_03_orb_blue_pedestal",
    });

    const routePanel = interactions.get("route_route_z43akm_panel");
    expect(routePanel).toMatchObject({
      type: "switch",
      position: [9.35, 0, -15.65],
      visualKey: "direction_keypad_panel",
    });
    expect(routePanel?.consumesKeyItemId).toBeUndefined();
    const rightRoomVitrine = level.map?.props.find((prop) => prop.id === "prop_1ossov");
    expect(rightRoomVitrine).toBeDefined();
    expect(Math.hypot(routePanel!.position[0] - rightRoomVitrine!.position[0], routePanel!.position[2] - rightRoomVitrine!.position[2])).toBeGreaterThan(2.2);
    expect(modelKeyForInteraction(routePanel!)).toBe("builder_route_switch_console");
    const staleRouteProject = normalizeOfficialBuilderProject({
      ...project,
      routeSwitches: project.routeSwitches?.map((route) =>
        route.id === "route_z43akm"
          ? {
              ...route,
              position: [12.5, -11.5],
            }
          : route,
      ),
    });
    expect(staleRouteProject.routeSwitches?.find((route) => route.id === "route_z43akm")?.position).toEqual([9.35, -15.65]);

    expect(level.map?.keyItems.some((item) => item.id === "level_03_tool_chip")).toBe(false);
    expect(level.map?.doors.find((door) => door.id === "level_03_voice_door")?.lock).toMatchObject({
      type: "puzzle_complete",
      puzzleId: "level_03_tool_calibration",
    });

    const archiveWave = level.waves.find((wave) => wave.id === "wave_level_03_central_archive");
    expect(archiveWave?.reward).toBe("none");
    expect(archiveWave?.completionDialogueTrigger).toBe("level_03_curator_down_route");
    expect(
      level.events?.some(
        (event) =>
          event.trigger.type === "wave_completed" &&
          event.trigger.id === "wave_level_03_central_archive" &&
          event.actions.some(
            (action) =>
              action.type === "unlock_exit" || (action.type === "open_door" && action.doorId === "level_03_official_exit_door"),
          ),
      ),
    ).toBe(false);
    expect(archiveWave?.enemies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          archetype: "custodian_elite",
          tier: "boss",
          tierLabel: "策展主管",
        }),
      ]),
    );
    expect(level.bossPhases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "level_03_curator_half", actorId: "custodian_elite", tier: "boss" }),
      ]),
    );
    expect(level.enemyDeathBeats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ archetypeId: "custodian_elite" }),
      ]),
    );

    expect(level.map?.rooms.find((room) => room.id === "level_03_gallery_lobby")).toMatchObject({
      skinKey: "human_museum_gallery",
      floorMaterialKey: "level03_museum_floor_premium_stone",
      wallMaterialKey: "level03_museum_wall_black_gallery",
    });
    expect(level.map?.presentation).toMatchObject({
      roomKit: "hp:human_museum_gallery_v1",
      lightingPreset: "hp:human_museum_gallery_lighting_v1",
      shellKit: "hp:human_museum_gallery_shell_v1",
    });
    expect(level.map?.doors.find((door) => door.id === "level_03_archive_door")).toMatchObject({
      visualKey: "museum_gallery_door",
    });
    expect(level.map?.keyItems.some((item) => item.id === "key_level_03_official_exit_door")).toBe(false);
    expect(level.map?.doors.find((door) => door.id === "level_03_official_exit_door")?.lock).toMatchObject({
      type: "objective_complete",
      objectiveId: "obj_route_level_03_official_exit_door",
    });
    expect(interactionBakeById.get("level_03_official_exit_interaction")).toBeUndefined();
    expect(interactionBakeById.get("use_builder_exit")).toMatchObject({
      intent: {
        mode: "exit_trigger_only",
        bakeExitFloorPad: false,
        bakeExitPanel: false,
      },
      modelKey: null,
    });
    expect(level.objectiveChain?.find((objective) => objective.id === "obj_route_level_03_official_exit_door")).toMatchObject({
      type: "custom",
      completesWhen: {
        type: "switch_activated",
        id: "route_route_z43akm",
        optionId: "out_1_route_out_yf",
      },
    });
    expect(level.switches?.find((entry) => entry.id === "route_route_z43akm")?.states.find((state) => state.id === "out_1_route_out_yf")?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "complete_objective", objectiveId: "obj_route_level_03_official_exit_door" }),
        expect.objectContaining({ type: "unlock_door", doorId: "level_03_official_exit_door" }),
        expect.objectContaining({ type: "open_door", doorId: "level_03_official_exit_door" }),
      ]),
    );
    const routeOutputState = level.switches?.find((entry) => entry.id === "route_route_z43akm")?.states.find((state) => state.id === "out_1_route_out_yf");
    expect(routeOutputState?.requiredKeyItemId).toBe("route_route_z43akm_out_1_route_out_yf_key");
    expect(level.map?.keyItems.find((item) => item.id === routeOutputState?.requiredKeyItemId)).toMatchObject({
      roomId: "level_03_gallery_lobby",
      position: [-5.38, 0, 0.58],
      visualKey: "route_output_orb_1",
      materialKey: "terminal_cyan",
      requiredForDoorIds: [],
    });

    const assetIndex = builderRuntimeAssetIndexForProject(level, project);
    expect(assetIndex.map((entry) => entry.modelKey)).toEqual(
      expect.arrayContaining([
        "room_floor_tile_museum",
        "room_wall_panel_museum",
        "room_ceiling_panel_museum",
        "age_museum_puzzle_orb_blue",
        "age_museum_puzzle_orb_green",
        "age_museum_puzzle_orb_purple",
        "age_museum_puzzle_orb_red",
        "age_museum_puzzle_orb_yellow",
        "age_museum_gallery_door",
        "service_elevator_ascent_shaft_fx",
        "service_elevator_exit_stage",
        "service_elevator_interior_shell",
        "service_elevator_call_buttons",
        "builder_route_switch_console",
        "pickup_route_output_orb_1",
        "pickup_energy_cell_amber",
        "ability_protocol_breach_charge_v1",
      ]),
    );
    expect(assetIndex.find((entry) => entry.modelKey === "pickup_energy_cell_amber")?.roles).toEqual(expect.arrayContaining(["pickup"]));
    expect(assetIndex.find((entry) => entry.modelKey === "pickup_energy_cell_amber")?.roles).not.toContain("viewmodel");
    expect(assetIndex.find((entry) => entry.modelKey === "ability_protocol_breach_charge_v1")?.roles).toEqual(expect.arrayContaining(["viewmodel"]));
    expect(assetIndex.some((entry) => entry.modelKey === "ability_core_bomb_proxy")).toBe(false);

    const pack = compileBuilderRuntimePack(level, project, { assetIndex });
    const toolLightingProfile = pack.renderPlan.lightingProfiles?.find((profile) => profile.roomId === "level_03_tool_exhibit");
    expect(toolLightingProfile?.artist?.contrast).toBeGreaterThan(1.2);
    expect(toolLightingProfile?.algorithm?.wallGuard).toBeGreaterThan(0.8);
    expect(pack.diagnostics).toContain("官方光影调优已应用：level_03_human_museum");
    expect(pack.renderPlan.officialBuilderSurfaceBridge).toMatchObject({
      enabled: true,
      reason: "builder-runtime-pack-surfaces",
    });
    expect(pack.renderPlan.officialBuilderSurfaceBridge?.surfaceAssetKeys).toEqual(
      expect.arrayContaining(["builder:floor:level_03_gallery_lobby", "builder:walls:level_03_gallery_lobby", "builder:ceiling:level_03_gallery_lobby"]),
    );
    const lobbyScenario = pack.renderPlan.visibilityScenarios.find(
      (scenario) => scenario.currentRoomId === "level_03_gallery_lobby" && scenario.qualityTier === "high",
    );
    expect(lobbyScenario?.visibleRoomIds).toEqual(["level_03_gallery_lobby"]);
    expect(lobbyScenario?.selectedLights.map((light) => light.roomId).filter(Boolean)).not.toContain("level_03_tool_exhibit");
    const entryDoorLeaf = pack.renderPlan.geometry.assets.find((asset) => asset.modelKey === "builder:door-leaf:level_03_lobby_door");
    expect(entryDoorLeaf?.bounds?.size[0]).toBeGreaterThan(2.6);
    const entryWallMaterial = pack.renderPlan.geometry.materials.find((material) => material.name === "wall:level_03_entry_hall");
    expect(entryWallMaterial?.emissiveStrength).toBeGreaterThan(0.12);
    expect(materialTriangleCountsForAsset(pack, "builder:floor:level_03_entry_hall")).toEqual(new Map([["floor:level_03_entry_hall", 12]]));
    expect(materialTriangleCountsForAsset(pack, "builder:walls:level_03_entry_hall")).toEqual(new Map([["wall:level_03_entry_hall", 72]]));
    expect(materialTriangleCountsForAsset(pack, "builder:door-leaf:level_03_lobby_door")).toEqual(new Map([["door:leaf", 24]]));
    expect(materialTriangleCountsForAsset(pack, "builder:door-status:level_03_lobby_door").get("door:status-open")).toBe(12);
    const instanceIds = pack.renderPlan.instances.map((instance) => instance.id);
    expect(instanceIds).toContain("orb_orb_blue");
    expect(instanceIds).not.toContain("prop_builder_exit_elevator_button_panel");
    expect(instanceIds).not.toContain("prop_builder_exit_elevator_ceiling_light_front");
    expect(instanceIds).not.toContain("prop_builder_exit_elevator_ceiling_light_back");
    expect(instanceIds).not.toContain("exit_panel_level_03_official_exit_interaction");
    expect(instanceIds).not.toContain("exit_level_03_official_exit_interaction");
    expect(pack.renderPlan.lights.some((light) => light.id === "light_exit_level_03_official_exit_interaction" || light.type === "floor_glow" && light.semanticRole === "builder_exit")).toBe(false);
    expect(pack.renderPlan.lights.some((light) => light.id === "light_exit_button_level_03_official_exit_interaction" || light.semanticRole === "builder_exit_button")).toBe(true);
    expect(instanceIds).not.toContain("terminal_level_03_tool_case");
    expect(instanceIds).not.toContain("terminal_story_level_03_tool_human_origin_wall_art");

    const resourceByKey = new Map(pack.manifest.wgpuResources.map((entry) => [entry.modelKey, entry]));
    expect(resourceByKey.get("age_museum_puzzle_orb_blue")).toMatchObject({
      status: "proxy",
      geometryModelKey: "builder:orb:orb_blue",
    });
    expect(resourceByKey.get("builder_route_switch_console")).toMatchObject({
      status: "proxy",
      geometryModelKey: "builder:route:route_route_z43akm_panel",
    });
    expect(modelKeyForKeyVisual("route_output_orb_1")).toBe("pickup_route_output_orb_1");
    expect(pack.renderPlan.instances.find((instance) => instance.id === "key_route_route_z43akm_out_1_route_out_yf_key")).toMatchObject({
      role: "key_item",
      modelKey: "pickup_route_output_orb_1:route_output_orb_1",
      estimatedBounds: { halfSize: [0.23, 0.275, 0.23] },
    });
    const staleHostedProject = {
      ...project,
      puzzles: project.puzzles?.map((puzzle) =>
        puzzle.id === "level_03_tool_calibration"
          ? {
              ...puzzle,
              sourceInteraction: {
                ...puzzle.sourceInteraction,
                visualKey: "puzzle_console_circuit_grid",
                hostPropId: "level_03_tool_last_human_tool_vitrine",
              },
            }
          : puzzle,
      ),
    };
    const { level: staleHostedLevel } = compileBuilderProjectToLevel(staleHostedProject);
    expect(staleHostedLevel).not.toBeNull();
    const staleHostedPack = compileBuilderRuntimePack(staleHostedLevel!, staleHostedProject, {
      assetIndex: builderRuntimeAssetIndexForProject(staleHostedLevel!, staleHostedProject),
    });
    expect(staleHostedPack.renderPlan.instances.map((instance) => instance.id)).not.toContain("terminal_level_03_tool_case");
  });

  it("uses the authoritative service-elevator stage as the real exit room with split fallback props", () => {
    const project = createStarterProject();
    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();

    const exitInteraction = level!.map?.interactions.find((interaction) => interaction.type === "exit");
    const exitButton = level!.map?.props.find((prop) => prop.tags?.includes("button_panel"));
    const exitStage = level!.map?.props.find((prop) => prop.modelKey === "service_elevator_exit_stage");
    expect(exitInteraction).toBeDefined();
    expect(exitStage).toMatchObject({
      id: "builder_exit_elevator_exit_stage",
      tags: expect.arrayContaining(["exit_room_stage", officialExitRoomReferenceId]),
    });
    expect(exitButton).toMatchObject({
      id: "builder_exit_elevator_call_buttons",
      modelKey: "service_elevator_call_buttons",
    });
    expect(level!.map?.props.find((prop) => prop.id === "builder_exit_elevator_interior_shell")).toMatchObject({
      modelKey: "service_elevator_interior_shell",
    });

    const pack = compileBuilderRuntimePack(level!, project, {
      assetIndex: builderRuntimeAssetIndexForProject(level!, project),
    });
    const fastExitRoom = pack.renderPlan.rooms.find((room) => room.id === exitInteraction?.roomId);
    const fastButton = pack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_call_buttons");
    const fastShaft = pack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_ascent_shaft_fx");
    const fastShell = pack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_interior_shell");
    const fastStage = pack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_exit_stage");
    const instanceIds = pack.renderPlan.instances.map((instance) => instance.id);
    expect(fastExitRoom).toMatchObject({ skinKey: "service_elevator_hero" });
    expect(fastStage).toMatchObject({
      modelKey: "builder:prop:service_elevator_exit_stage",
      tags: expect.arrayContaining(["exit_room_stage", officialExitRoomReferenceId]),
      estimatedBounds: { halfSize: [3.15, 1.95, 2.5] },
    });
    expect(fastButton).toMatchObject({
      modelKey: "builder:prop:service_elevator_call_buttons",
      estimatedBounds: { halfSize: [0.41, 0.54, 0.08] },
    });
    expect(fastShell).toMatchObject({
      modelKey: "builder:prop:service_elevator_interior_shell",
      estimatedBounds: { halfSize: [3.05, 1.65, 2.5] },
    });
    expect(fastShaft).toMatchObject({
      modelKey: "builder:prop:service_elevator_ascent_shaft_fx",
      tags: expect.arrayContaining(["cinematic_reveal", "ascent_shaft_fx"]),
    });
    expect(instanceIds).not.toContain("prop_builder_exit_elevator_button_panel");
    expect(instanceIds.some((id) => /ceiling_light_(front|back)$/.test(id))).toBe(false);
    expect(instanceIds).not.toContain(`exit_${exitInteraction!.id}`);
    expect(instanceIds).not.toContain(`exit_panel_${exitInteraction!.id}`);
    expect(pack.renderPlan.lights.some((light) => light.id === `light_exit_${exitInteraction!.id}` || light.type === "floor_glow" && light.semanticRole === "builder_exit")).toBe(false);
    expect(pack.renderPlan.lights.some((light) => light.id === `light_exit_button_${exitInteraction!.id}` || light.semanticRole === "builder_exit_button")).toBe(true);

    const cookedModels = new Map([
      ["service_elevator_exit_stage", cookedTriangleModel("service_elevator_exit_stage", [6.3, 3.9, 5.0])],
      ["service_elevator_call_buttons", cookedTriangleModel("service_elevator_call_buttons", [0.82, 1.08, 0.16])],
      ["service_elevator_ascent_shaft_fx", cookedTriangleModel("service_elevator_ascent_shaft_fx", [6.2, 3.9, 4.2])],
      ["service_elevator_interior_shell", cookedTriangleModel("service_elevator_interior_shell", [6.1, 3.3, 5.0])],
      ["door_threshold_service_elevator", cookedTriangleModel("door_threshold_service_elevator", [4.5, 0.22, 0.74])],
    ]);
    const deepPack = compileBuilderRuntimePack(level!, project, {
      assetIndex: builderRuntimeAssetIndexForProject(level!, project),
      cooked: { models: cookedModels, missing: [], geometryBytes: 10 * 3 * 4 * cookedModels.size, textureFallbackModels: [] },
    });
    expect(deepPack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_exit_stage")).toMatchObject({
      modelKey: "service_elevator_exit_stage",
      estimatedBounds: { halfSize: [3.15, 1.95, 2.5] },
    });
    expect(deepPack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_call_buttons")).toMatchObject({
      modelKey: "service_elevator_call_buttons",
      estimatedBounds: { halfSize: [0.41, 0.54, 0.08] },
    });
    expect(deepPack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_interior_shell")).toMatchObject({
      modelKey: "service_elevator_interior_shell",
      estimatedBounds: { halfSize: [3.05, 1.65, 2.5] },
    });
    expect(deepPack.renderPlan.instances.find((instance) => instance.id === "prop_builder_exit_elevator_ascent_shaft_fx")).toMatchObject({
      modelKey: "service_elevator_ascent_shaft_fx",
      tags: expect.arrayContaining(["cinematic_reveal", "ascent_shaft_fx"]),
    });
    expect(deepPack.manifest.fallbackProxyModels).not.toEqual(
      expect.arrayContaining(["service_elevator_exit_stage", "service_elevator_call_buttons", "service_elevator_ascent_shaft_fx", "service_elevator_interior_shell"]),
    );
  });

  it("imports maintenance bay as native builder wave-gated coverage", () => {
    const { project, level } = importAndCompile("level_01_maintenance_bay");

    const importedElevatorDoor = project.doors.find((door) => door.id === "service_elevator_door");
    expect(importedElevatorDoor?.lockType).toBe("survive_wave");
    expect(importedElevatorDoor?.waveId).toBeUndefined();
    expect(importedElevatorDoor?.waveIds).toEqual(["first_contact", "wave_01", "wave_02", "elite_wave"]);
    expect(importedElevatorDoor?.sourceDoor?.lock).toMatchObject({
      type: "survive_wave",
      waveIds: ["first_contact", "wave_01", "wave_02", "elite_wave"],
    });
    expect(project.robots.find((robot) => robot.id === "robot_exit_chase_pressure_loop_enemy_1")).toBeUndefined();
    expect(project.robots.filter((robot) => robot.waveChain).map((robot) => robot.waveChain?.waveId)).toEqual(expect.arrayContaining(["first_contact", "wave_01", "wave_02", "elite_wave", "exit_chase"]));
    expect(project.sourceLevel?.mapInteractions).toBeUndefined();
    expect(project.sourceLevel?.puzzles).toBeUndefined();
    expect(project.sourceLevel?.objectiveChain).toBeUndefined();

    const elevatorDoor = level.map?.doors.find((door) => door.id === "service_elevator_door");
    expect(elevatorDoor).toMatchObject({
      position: [0, 0, -15.2],
      visualKey: "service_elevator_door",
      lock: { type: "survive_wave", waveIds: ["first_contact", "wave_01", "wave_02", "elite_wave"] },
    });

    const interactions = new Map(level.map?.interactions.map((interaction) => [interaction.id, interaction]) ?? []);
    expect(interactions.has("pickup_iron_rod")).toBe(false);
    expect(interactions.has("pickup_pistol")).toBe(false);
    expect(interactions.has("level_01_power_panel")).toBe(false);
    expect(interactions.has("use_service_elevator")).toBe(false);
    expect(interactions.get("use_builder_exit")).toMatchObject({
      type: "exit",
      opensDoorId: "service_elevator_door",
    });
    expect(level.puzzles).toEqual([]);
    expect(level.pickups.storyPickups).toEqual([]);
    expect(level.objectiveChain?.map((objective) => objective.id)).toEqual([
      "obj_collect_level_01_alcove_door",
      "obj_open_level_01_alcove_door",
      "obj_survive_service_elevator_door",
      "obj_open_service_elevator_door",
      "obj_reach_exit",
    ]);
    const firstContact = level.waves.find((wave) => wave.id === "first_contact");
    expect(firstContact?.trigger).toMatchObject({
      type: "room_entered",
      id: "maintenance_bay_floor",
      delay: 0.4,
    });
    expect(level.waves.find((wave) => wave.id === "wave_01")?.trigger).toBeUndefined();
    expect(level.waves.find((wave) => wave.id === "exit_chase_pressure_loop")).toMatchObject({
      nonBlocking: true,
      reward: "none",
    });
    expect(level.events?.some((event) => event.id.includes("exit_chase_pressure_loop_to_first_contact"))).toBe(false);
    expect(level.events?.find((event) => event.id === "builder_first_contact_complete")?.actions).toEqual([
      { type: "start_wave", waveId: "wave_01", delay: 0.45 },
    ]);
    expect(level.events?.find((event) => event.id === "builder_exit_chase_complete")?.actions).toEqual([
      { type: "start_wave", waveId: "exit_chase_pressure_loop", delay: 4 },
    ]);

    const directOfficialLevel = getBuiltInLevelConfig("level_01_maintenance_bay");
    expect(directOfficialLevel.waves.find((wave) => wave.id === "first_contact")?.trigger).toMatchObject({
      type: "room_entered",
      id: "maintenance_bay_floor",
    });
    expect(directOfficialLevel.events?.find((event) => event.id === "builder_first_contact_complete")?.actions).toEqual([
      { type: "start_wave", waveId: "wave_01", delay: 0.45 },
    ]);
  });

  it("exports a handcrafted museum surface kit back to official map presentation", () => {
    const project: BuilderProject = {
      schemaVersion: "hp.builder.v1",
      projectId: "proj_surface_bridge",
      title: "surface bridge",
      rooms: [
        {
          id: "room_gallery",
          label: "展厅",
          style: "museum",
          center: [0, 0],
          size: [6, 6],
          env: {
            surfaceKitId: "hp:human_museum_gallery_shell_v1",
            floorPresetId: "floor_photo_marble",
            wallPresetId: "wall_hp_museum_limestone_panel",
            ceilingPresetId: "ceiling_hp_museum_coffered_limestone",
          },
        },
        { id: "room_exit", label: "闭馆电梯", style: "exit", center: [6, 0], size: [6, 6] },
      ],
      doors: [{ id: "door_gallery_exit", fromRoomId: "room_gallery", toRoomId: "room_exit", lockType: "none" }],
      props: [],
      robots: [],
      exitRoomId: "room_exit",
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    expect(level?.map?.presentation).toMatchObject({
      roomKit: "hp:human_museum_gallery_v1",
      lightingPreset: "hp:human_museum_gallery_lighting_v1",
      shellKit: "hp:human_museum_gallery_shell_v1",
    });
    expect(level?.map?.rooms.find((room) => room.id === "room_gallery")).toMatchObject({
      skinKey: "human_museum_gallery",
      floorMaterialKey: "level03_museum_floor_premium_stone",
      wallMaterialKey: "level03_museum_wall_black_gallery",
    });
  });
});
