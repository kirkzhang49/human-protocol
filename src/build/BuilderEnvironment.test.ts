import { describe, expect, it } from "vitest";
import {
  builderCeilingPresets,
  builderFloorPresets,
  builderWallPresets,
  roomSurfaceTextureOverride,
} from "./BuilderEnvironment";
import type { BuilderRoom } from "./BuilderTypes";

const level04MemoryClinicSurfaceIds = {
  floor: "floor_level04_memory_clinic_lab_image2_tileable_v4",
  wall: "wall_level04_memory_clinic_lab_image2_tileable_v4",
  ceiling: "ceiling_level04_memory_clinic_lab_image2_tileable_v4",
} as const;

function memoryClinicRoom(): BuilderRoom {
  return {
    id: "room_memory_clinic",
    label: "记忆诊所",
    style: "sterile",
    center: [0, 0],
    size: [6, 6],
    env: {
      floorPresetId: level04MemoryClinicSurfaceIds.floor,
      wallPresetId: level04MemoryClinicSurfaceIds.wall,
      ceilingPresetId: level04MemoryClinicSurfaceIds.ceiling,
    },
  };
}

describe("BuilderEnvironment Image2 Level 4 surface presets", () => {
  it("exposes wall, floor and ceiling presets in the build material catalog", () => {
    expect(builderFloorPresets.some((preset) => preset.id === level04MemoryClinicSurfaceIds.floor)).toBe(true);
    expect(builderWallPresets.some((preset) => preset.id === level04MemoryClinicSurfaceIds.wall)).toBe(true);
    expect(builderCeilingPresets.some((preset) => preset.id === level04MemoryClinicSurfaceIds.ceiling)).toBe(true);
  });

  it("feeds the Image2 textures into builder playtest surface overrides", () => {
    const room = memoryClinicRoom();

    const floor = roomSurfaceTextureOverride(room, "floor");
    const wall = roomSurfaceTextureOverride(room, "wall");
    const ceiling = roomSurfaceTextureOverride(room, "ceiling");

    expect(floor?.preset.id).toBe(level04MemoryClinicSurfaceIds.floor);
    expect(wall?.preset.id).toBe(level04MemoryClinicSurfaceIds.wall);
    expect(ceiling?.preset.id).toBe(level04MemoryClinicSurfaceIds.ceiling);
    expect(floor?.albedoUrl).toContain("level04_memory_clinic_floor_image2_tileable_v4_color");
    expect(wall?.albedoUrl).toContain("level04_memory_clinic_wall_image2_tileable_v4_color");
    expect(ceiling?.albedoUrl).toContain("level04_memory_clinic_ceiling_image2_tileable_v4_color");
  });
});
