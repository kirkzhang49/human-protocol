import { officialRoomPresentationRegistry } from "../../game/config/RoomPresentationRegistry";
import type { LevelRoomDefinition, LevelMapPresentationConfig } from "../../game/config/schema/levelConfig";
import type { BuilderRoom, BuilderRoomEnv, BuilderRoomStyle } from "../BuilderTypes";

export type BuilderSurfaceKitId = string;

export interface BuilderSurfaceModelKeys {
  floorModelKey: string;
  wallModelKey: string;
  ceilingModelKey: string;
}

export interface BuilderSurfaceKitDefinition {
  id: BuilderSurfaceKitId;
  label: string;
  style: BuilderRoomStyle;
  floorPresetId: string;
  wallPresetId: string;
  ceilingPresetId: string;
  floorMaterialKey: string;
  wallMaterialKey: string;
  skinKey?: string;
  roomKitId?: string;
  shellKitId?: string;
  lightingPresetId?: string;
  surfaceModelKeys: BuilderSurfaceModelKeys;
}

const officialSurfaceKitOverrides: readonly Omit<BuilderSurfaceKitDefinition, "surfaceModelKeys">[] = [
  {
    id: "hp:industrial_panel_arena_shell_v4_image2_floor",
    label: "L1 维修舱金属套件",
    style: "maintenance",
    floorPresetId: "floor_level01_maintenance_image2_v1",
    wallPresetId: "wall_level01_maintenance_gunmetal_v1",
    ceilingPresetId: "ceiling_level01_maintenance_service_ribs_v1",
    floorMaterialKey: "maintenance_bay_wet_floor",
    wallMaterialKey: "maintenance_bay_glass_wall",
    skinKey: "maintenance_bay_hero",
    roomKitId: "hp:maintenance_combat_bay_v3_art_pass",
    shellKitId: "hp:industrial_panel_arena_shell_v4_image2_floor",
    lightingPresetId: "hp:cyan_lockdown_arena_v5_age_director",
  },
  {
    id: "hp:human_museum_gallery_shell_v1",
    label: "L3 人类博物馆石灰石展厅套件",
    style: "museum",
    floorPresetId: "floor_photo_marble",
    wallPresetId: "wall_hp_museum_limestone_panel",
    ceilingPresetId: "ceiling_hp_museum_coffered_limestone",
    floorMaterialKey: "level03_museum_floor_premium_stone",
    wallMaterialKey: "level03_museum_wall_black_gallery",
    skinKey: "human_museum_gallery",
    roomKitId: "hp:human_museum_gallery_v1",
    shellKitId: "hp:human_museum_gallery_shell_v1",
    lightingPresetId: "hp:human_museum_gallery_lighting_v1",
  },
  {
    id: "hp:residential_false_home_shell_v1",
    label: "L2 居住模拟假住宅套件",
    style: "residential",
    floorPresetId: "floor_level02_false_home_walnut_v1",
    wallPresetId: "wall_level02_false_home_plaster_v1",
    ceilingPresetId: "ceiling_level02_false_home_plaster_v1",
    floorMaterialKey: "residential_floor",
    wallMaterialKey: "residential_wall",
    skinKey: "residential_sim_dark",
    shellKitId: "hp:residential_false_home_shell_v1",
    lightingPresetId: "hp:residential_simulation_false_home_story_v1",
  },
  {
    id: "hp:memory_clinic_shell_v1",
    label: "L4 记忆诊所瓷板套件",
    style: "sterile",
    floorPresetId: "floor_memory_clinic_tile",
    wallPresetId: "wall_memory_clinic_panel",
    ceilingPresetId: "wall_memory_clinic_panel",
    floorMaterialKey: "memory_clinic_floor",
    wallMaterialKey: "memory_clinic_wall",
    skinKey: "memory_clinic_sterile",
    shellKitId: "hp:memory_clinic_shell_v1",
    lightingPresetId: "hp:memory_clinic_sterile_v1",
  },
  {
    id: "hp:reclamation_core_shell_v1",
    label: "L5 回收核心暗金属套件",
    style: "core",
    floorPresetId: "floor_reclamation_core_metal",
    wallPresetId: "wall_reclamation_core_panel",
    ceilingPresetId: "wall_reclamation_core_panel",
    floorMaterialKey: "reclamation_core_floor",
    wallMaterialKey: "reclamation_core_wall",
    skinKey: "reclamation_core_chamber",
    shellKitId: "hp:reclamation_core_shell_v1",
    lightingPresetId: "hp:reclamation_core_v1",
  },
  {
    id: "hp:reclamation_core_shell_v4_cc0",
    label: "L5 V4 回收核心程序化套件",
    style: "core",
    floorPresetId: "floor_level05_reclamation_cc0_metal_panel_v4",
    wallPresetId: "wall_level05_reclamation_cc0_graphite_panel_v4",
    ceilingPresetId: "ceiling_level05_reclamation_cc0_service_grid_v4",
    floorMaterialKey: "reclamation_core_floor",
    wallMaterialKey: "reclamation_core_wall",
    skinKey: "reclamation_core_chamber",
    shellKitId: "hp:reclamation_core_shell_v4_cc0",
    lightingPresetId: "hp:reclamation_core_v1",
  },
];

const surfaceKitOverridesById = new Map(officialSurfaceKitOverrides.map((kit) => [kit.id, kit]));

export function builderSurfaceKitForId(id: string | undefined | null): BuilderSurfaceKitDefinition | null {
  if (!id) return null;
  const shell = officialRoomPresentationRegistry.shellKits[id];
  if (!shell) return null;
  const override = surfaceKitOverridesById.get(id);
  const family = shellFamilyFromModelKeys(shell.floorModelKey, shell.wallModelKey, shell.ceilingModelKey);
  return {
    id,
    label: override?.label ?? id,
    style: override?.style ?? family.style,
    floorPresetId: override?.floorPresetId ?? family.floorPresetId,
    wallPresetId: override?.wallPresetId ?? family.wallPresetId,
    ceilingPresetId: override?.ceilingPresetId ?? family.ceilingPresetId,
    floorMaterialKey: override?.floorMaterialKey ?? family.floorMaterialKey,
    wallMaterialKey: override?.wallMaterialKey ?? family.wallMaterialKey,
    ...(override?.skinKey ? { skinKey: override.skinKey } : {}),
    ...(override?.roomKitId ? { roomKitId: override.roomKitId } : {}),
    shellKitId: override?.shellKitId ?? id,
    ...(override?.lightingPresetId ? { lightingPresetId: override.lightingPresetId } : {}),
    surfaceModelKeys: {
      floorModelKey: shell.floorModelKey,
      wallModelKey: shell.wallModelKey,
      ceilingModelKey: shell.ceilingModelKey,
    },
  };
}

export function builderSurfaceKitForPresentation(presentation: LevelMapPresentationConfig | undefined): BuilderSurfaceKitDefinition | null {
  const roomKit = presentation?.roomKit ? officialRoomPresentationRegistry.roomKits[presentation.roomKit] : null;
  const overrides = { ...(roomKit?.overrides ?? {}), ...(presentation?.overrides ?? {}) };
  return builderSurfaceKitForId(presentation?.shellKit ?? overrides.shellKit ?? roomKit?.shellKit);
}

export function builderSurfaceKitForRoom(room: Pick<BuilderRoom, "env" | "sourceRoom" | "style">): BuilderSurfaceKitDefinition | null {
  return (
    builderSurfaceKitForId(room.env?.surfaceKitId) ??
    builderSurfaceKitForOfficialFields(room.sourceRoom?.skinKey, room.sourceRoom?.floorMaterialKey, room.sourceRoom?.wallMaterialKey) ??
    builderSurfaceKitForPresetPair(room.env?.floorPresetId, room.env?.wallPresetId, room.env?.ceilingPresetId)
  );
}

export function builderSurfaceModelKeysForRoom(room: Pick<BuilderRoom, "env" | "sourceRoom" | "style">): BuilderSurfaceModelKeys | null {
  return builderSurfaceKitForRoom(room)?.surfaceModelKeys ?? null;
}

export function builderRoomEnvFromOfficialRoom(
  room: LevelRoomDefinition,
  presentation?: LevelMapPresentationConfig,
): BuilderRoomEnv | undefined {
  if (isServiceElevatorRoom(room)) {
    const ceilingHeight = clamp(roundMeter(room.bounds.size[1] * 0.84), 2.8, 3.6);
    return {
      floorPresetId: "floor_dark_rubber",
      wallPresetId: "wall_dark_metal_panel",
      ceilingPresetId: "wall_dark_metal_panel",
      ceilingVisible: room.geometry?.renderCeiling !== false && room.geometry?.renderFloor !== false,
      wallHeight: ceilingHeight,
      ceilingHeight,
    };
  }

  const kit =
    builderSurfaceKitForOfficialFields(room.skinKey, room.floorMaterialKey, room.wallMaterialKey) ??
    builderSurfaceKitForPresentation(presentation);
  if (!kit && !room.wallMaterialKey?.includes("service_elevator_metal")) return undefined;
  const ceilingHeight = clamp(roundMeter(room.bounds.size[1] * 0.84), 2.8, 3.6);
  if (!kit) {
    return {
      floorPresetId: "floor_dark_rubber",
      wallPresetId: "wall_dark_metal_panel",
      ceilingPresetId: "wall_dark_metal_panel",
      ceilingVisible: room.geometry?.renderCeiling !== false && room.geometry?.renderWalls !== false,
      wallHeight: ceilingHeight,
      ceilingHeight,
    };
  }
  return {
    surfaceKitId: kit.id,
    floorPresetId: kit.floorPresetId,
    wallPresetId: kit.wallPresetId,
    ceilingPresetId: kit.ceilingPresetId,
    ceilingVisible: room.geometry?.renderCeiling !== false && room.geometry?.renderWalls !== false,
    wallHeight: ceilingHeight,
    ceilingHeight,
  };
}

function isServiceElevatorRoom(room: LevelRoomDefinition) {
  const text = `${room.skinKey ?? ""} ${room.floorMaterialKey ?? ""} ${room.wallMaterialKey ?? ""} ${room.aesthetic?.style ?? ""}`.toLowerCase();
  return text.includes("service_elevator_metal") || room.aesthetic?.style === "exit";
}

export function officialSurfaceFieldsForBuilderRoom(room: BuilderRoom) {
  const kit = builderSurfaceKitForRoom(room);
  const floorMaterialKey = officialFloorMaterialKeyForPreset(room.env?.floorPresetId) ?? kit?.floorMaterialKey;
  const wallMaterialKey = officialWallMaterialKeyForPreset(room.env?.wallPresetId) ?? kit?.wallMaterialKey;
  if (!kit && (!floorMaterialKey || !wallMaterialKey)) return null;
  const style = kit?.style ?? room.style;
  const aestheticStyle = style === "core" ? "hazard" : style;
  return {
    ...(kit?.skinKey ? { skinKey: kit.skinKey } : {}),
    floorMaterialKey: floorMaterialKey ?? "residential_floor",
    wallMaterialKey: wallMaterialKey ?? "residential_wall",
    aesthetic: { style: aestheticStyle, detail: "high" as const },
  };
}

export function builderMapPresentationForProject(rooms: readonly BuilderRoom[]): LevelMapPresentationConfig | undefined {
  const nonExitRooms = rooms.filter((room) => room.style !== "exit");
  if (nonExitRooms.length === 0) return undefined;
  const first = builderSurfaceKitForRoom(nonExitRooms[0]);
  if (!first || !roomPresetsResolveToSurfaceKit(nonExitRooms[0], first)) return undefined;
  if (!first?.roomKitId && !first?.shellKitId) return undefined;
  if (!nonExitRooms.every((room) => {
    const kit = builderSurfaceKitForRoom(room);
    return kit?.id === first.id && roomPresetsResolveToSurfaceKit(room, kit);
  })) return undefined;
  return {
    ...(first.roomKitId ? { roomKit: first.roomKitId } : {}),
    ...(first.lightingPresetId ? { lightingPreset: first.lightingPresetId } : {}),
    ...(first.shellKitId ? { shellKit: first.shellKitId } : {}),
  };
}

function roomUsesSurfaceKitDefaults(room: Pick<BuilderRoom, "env">, kit: BuilderSurfaceKitDefinition) {
  return (
    (!room.env?.floorPresetId || room.env.floorPresetId === kit.floorPresetId) &&
    (!room.env?.wallPresetId || room.env.wallPresetId === kit.wallPresetId) &&
    (!room.env?.ceilingPresetId || room.env.ceilingPresetId === kit.ceilingPresetId)
  );
}

function roomPresetsResolveToSurfaceKit(room: Pick<BuilderRoom, "env">, kit: BuilderSurfaceKitDefinition) {
  if (roomUsesSurfaceKitDefaults(room, kit)) return true;
  return builderSurfaceKitForPresetPair(room.env?.floorPresetId, room.env?.wallPresetId, room.env?.ceilingPresetId)?.id === kit.id;
}

function officialFloorMaterialKeyForPreset(presetId: string | undefined) {
  switch (presetId) {
    case "floor_level03_museum_premium_stone_shell":
    case "floor_photo_marble":
    case "floor_museum_stone":
    case "floor_cc0_gallery_stone":
      return "level03_museum_floor_premium_stone";
    case "floor_maintenance_metal":
    case "floor_level01_maintenance_image2_v1":
      return "maintenance_bay_wet_floor";
    case "floor_level02_false_home_walnut_v1":
    case "floor_residential_wood":
    case "floor_photo_wood":
    case "floor_walnut_parquet":
      return "residential_floor";
    case "floor_memory_clinic_tile":
    case "floor_level04_memory_clinic_lab_image2_tileable_v4":
    case "floor_sterile_tile":
      return "memory_clinic_floor";
    case "floor_reclamation_core_metal":
    case "floor_level05_reclamation_cc0_metal_panel_v4":
    case "floor_lab_tile_dark":
      return "reclamation_core_floor";
    default:
      return undefined;
  }
}

function officialWallMaterialKeyForPreset(presetId: string | undefined) {
  switch (presetId) {
    case "wall_level03_museum_black_gallery_shell":
    case "wall_hp_museum_black_display":
    case "wall_hp_museum_limestone_panel":
    case "wall_museum_stone":
      return "level03_museum_wall_black_gallery";
    case "wall_maintenance_metal":
    case "wall_level01_maintenance_gunmetal_v1":
      return "maintenance_bay_glass_wall";
    case "wall_level02_false_home_plaster_v1":
    case "wall_residential_wood":
    case "wall_gallery_warm":
      return "residential_wall";
    case "wall_memory_clinic_panel":
    case "wall_level04_memory_clinic_lab_image2_tileable_v4":
    case "wall_sterile_panel":
      return "memory_clinic_wall";
    case "wall_reclamation_core_panel":
    case "wall_level05_reclamation_cc0_graphite_panel_v4":
    case "wall_dark_metal_panel":
      return "reclamation_core_wall";
    default:
      return undefined;
  }
}

function builderSurfaceKitForOfficialFields(skinKey?: string, floorMaterialKey?: string, wallMaterialKey?: string) {
  const text = `${skinKey ?? ""} ${floorMaterialKey ?? ""} ${wallMaterialKey ?? ""}`.toLowerCase();
  if (text.includes("maintenance_bay") || text.includes("maintenance_service")) {
    return builderSurfaceKitForId("hp:industrial_panel_arena_shell_v4_image2_floor");
  }
  if (
    text.includes("human_museum_gallery") ||
    text.includes("museum_floor") ||
    text.includes("museum_wall") ||
    text.includes("level03_museum_floor") ||
    text.includes("level03_museum_wall")
  ) {
    return builderSurfaceKitForId("hp:human_museum_gallery_shell_v1");
  }
  if (text.includes("residential_floor") || text.includes("residential_wall")) {
    return builderSurfaceKitForId("hp:residential_false_home_shell_v1");
  }
  if (text.includes("memory_clinic")) {
    return builderSurfaceKitForId("hp:memory_clinic_shell_v1");
  }
  if (text.includes("reclamation_core")) {
    return builderSurfaceKitForId("hp:reclamation_core_shell_v1");
  }
  return null;
}

function builderSurfaceKitForPresetPair(floorPresetId?: string, wallPresetId?: string, ceilingPresetId?: string) {
  if (
    floorPresetId === "floor_maintenance_metal" &&
    wallPresetId === "wall_maintenance_metal" &&
    (!ceilingPresetId || ceilingPresetId === "wall_maintenance_metal")
  ) {
    return builderSurfaceKitForId("hp:industrial_panel_arena_shell_v4_image2_floor");
  }
  if (
    floorPresetId === "floor_level01_maintenance_image2_v1" &&
    wallPresetId === "wall_level01_maintenance_gunmetal_v1" &&
    (!ceilingPresetId || ceilingPresetId === "ceiling_level01_maintenance_service_ribs_v1")
  ) {
    return builderSurfaceKitForId("hp:industrial_panel_arena_shell_v4_image2_floor");
  }
  if (floorPresetId === "floor_museum_stone" && wallPresetId === "wall_museum_stone" && (!ceilingPresetId || ceilingPresetId === "wall_museum_stone")) {
    return builderSurfaceKitForId("hp:human_museum_gallery_shell_v1");
  }
  if (
    floorPresetId === "floor_level03_museum_premium_stone_shell" &&
    wallPresetId === "wall_level03_museum_black_gallery_shell" &&
    (!ceilingPresetId || ceilingPresetId === "ceiling_level03_museum_warm_panel_shell")
  ) {
    return builderSurfaceKitForId("hp:human_museum_gallery_shell_v1");
  }
  if (
    floorPresetId === "floor_photo_marble" &&
    wallPresetId === "wall_hp_museum_limestone_panel" &&
    (!ceilingPresetId || ceilingPresetId === "ceiling_hp_museum_coffered_limestone")
  ) {
    return builderSurfaceKitForId("hp:human_museum_gallery_shell_v1");
  }
  if (
    (floorPresetId === "floor_residential_wood" && wallPresetId === "wall_residential_wood") ||
    (floorPresetId === "floor_level02_false_home_walnut_v1" &&
      wallPresetId === "wall_level02_false_home_plaster_v1" &&
      (!ceilingPresetId || ceilingPresetId === "ceiling_level02_false_home_plaster_v1"))
  ) {
    return builderSurfaceKitForId("hp:residential_false_home_shell_v1");
  }
  const usesLegacyMemoryClinicPair =
    ((floorPresetId === "floor_memory_clinic_tile" && wallPresetId === "wall_memory_clinic_panel") ||
      (floorPresetId === "floor_sterile_tile" && wallPresetId === "wall_sterile_panel")) &&
    (!ceilingPresetId || ceilingPresetId === wallPresetId);
  const usesImage2MemoryClinicPair =
    floorPresetId === "floor_level04_memory_clinic_lab_image2_tileable_v4" &&
    wallPresetId === "wall_level04_memory_clinic_lab_image2_tileable_v4" &&
    (!ceilingPresetId || ceilingPresetId === "ceiling_level04_memory_clinic_lab_image2_tileable_v4");
  if (usesLegacyMemoryClinicPair || usesImage2MemoryClinicPair) {
    return builderSurfaceKitForId("hp:memory_clinic_shell_v1");
  }
  if (
    floorPresetId === "floor_level05_reclamation_cc0_metal_panel_v4" &&
    wallPresetId === "wall_level05_reclamation_cc0_graphite_panel_v4" &&
    (!ceilingPresetId || ceilingPresetId === "ceiling_level05_reclamation_cc0_service_grid_v4")
  ) {
    return builderSurfaceKitForId("hp:reclamation_core_shell_v4_cc0");
  }
  if (
    ((floorPresetId === "floor_reclamation_core_metal" && wallPresetId === "wall_reclamation_core_panel") ||
      (floorPresetId === "floor_lab_tile_dark" && wallPresetId === "wall_dark_metal_panel")) &&
    (!ceilingPresetId || ceilingPresetId === wallPresetId)
  ) {
    return builderSurfaceKitForId("hp:reclamation_core_shell_v1");
  }
  return null;
}

function shellFamilyFromModelKeys(floorModelKey: string, wallModelKey: string, ceilingModelKey: string) {
  const text = `${floorModelKey} ${wallModelKey} ${ceilingModelKey}`.toLowerCase();
  if (text.includes("museum")) {
    return {
      style: "museum" as const,
      floorPresetId: "floor_photo_marble",
      wallPresetId: "wall_hp_museum_limestone_panel",
      ceilingPresetId: "ceiling_hp_museum_coffered_limestone",
      floorMaterialKey: "level03_museum_floor_premium_stone",
      wallMaterialKey: "level03_museum_wall_black_gallery",
    };
  }
  if (text.includes("residential")) {
    return {
      style: "residential" as const,
      floorPresetId: "floor_level02_false_home_walnut_v1",
      wallPresetId: "wall_level02_false_home_plaster_v1",
      ceilingPresetId: "ceiling_level02_false_home_plaster_v1",
      floorMaterialKey: "residential_floor",
      wallMaterialKey: "residential_wall",
    };
  }
  if (text.includes("clinic")) {
    return {
      style: "sterile" as const,
      floorPresetId: "floor_memory_clinic_tile",
      wallPresetId: "wall_memory_clinic_panel",
      ceilingPresetId: "wall_memory_clinic_panel",
      floorMaterialKey: "memory_clinic_floor",
      wallMaterialKey: "memory_clinic_wall",
    };
  }
  if (text.includes("core")) {
    return {
      style: "core" as const,
      floorPresetId: "floor_reclamation_core_metal",
      wallPresetId: "wall_reclamation_core_panel",
      ceilingPresetId: "wall_reclamation_core_panel",
      floorMaterialKey: "reclamation_core_floor",
      wallMaterialKey: "reclamation_core_wall",
    };
  }
  return {
    style: "maintenance" as const,
    floorPresetId: "floor_level01_maintenance_image2_v1",
    wallPresetId: "wall_level01_maintenance_gunmetal_v1",
    ceilingPresetId: "ceiling_level01_maintenance_service_ribs_v1",
    floorMaterialKey: "maintenance_bay_wet_floor",
    wallMaterialKey: "maintenance_bay_glass_wall",
  };
}

function roundMeter(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
