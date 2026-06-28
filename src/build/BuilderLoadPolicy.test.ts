import { describe, expect, it } from "vitest";
import { builderProjectFromBuiltInLevel } from "./BuilderLevelImport";
import { normalizeBuilderProjectForBoot } from "./BuilderLoadPolicy";
import type { BuilderProject } from "./BuilderTypes";

describe("normalizeBuilderProjectForBoot", () => {
  it("does not let the official blueprint repopulate robots in a normal build draft", () => {
    const project = builderProjectFromBuiltInLevel("level_04_memory_clinic");
    expect(project).not.toBeNull();

    const draftAfterDeletingRobots: BuilderProject = {
      ...project!,
      robots: [],
    };

    expect(normalizeBuilderProjectForBoot(draftAfterDeletingRobots, { officialImport: false }).robots).toEqual([]);
  });

  it("still refreshes from the official blueprint for an explicit official import", () => {
    const project = builderProjectFromBuiltInLevel("level_04_memory_clinic");
    expect(project).not.toBeNull();

    const draftAfterDeletingRobots: BuilderProject = {
      ...project!,
      robots: [],
    };

    expect(normalizeBuilderProjectForBoot(draftAfterDeletingRobots, { officialImport: true }).robots.length).toBeGreaterThan(0);
  });

  it("removes compiled wave echo robots from a normal build draft without deleting authored robots", () => {
    const project = minimalProject({
      robots: [
        {
          id: "robot_authored",
          roomId: "room_a",
          archetype: "repair_drone",
          count: 2,
          waveChain: { waveId: "wave_l7kjqk", order: 1, label: "波次 1" },
        },
        {
          id: "robot_wave_l7kjqk_room_a_enemy_1",
          roomId: "room_a",
          archetype: "repair_drone",
          count: 2,
          wave: { id: "wave_l7kjqk_room_a", role: "enemy" },
        },
        {
          id: "robot_wave_l7kjqk_room_a_pressure_loop_enemy_1",
          roomId: "room_a",
          archetype: "repair_drone",
          count: 1,
          wave: { id: "wave_l7kjqk_room_a_pressure_loop", role: "enemy", nonBlocking: true },
        },
      ],
      doors: [
        {
          id: "door_a",
          fromRoomId: "room_a",
          toRoomId: "room_b",
          lockType: "survive_wave",
          surviveRobotIds: ["robot_authored", "robot_wave_l7kjqk_room_a_enemy_1"],
          waveIds: ["wave_l7kjqk", "wave_l7kjqk_room_a"],
        },
      ],
    });

    const normalized = normalizeBuilderProjectForBoot(project, { officialImport: false });

    expect(normalized.robots.map((robot) => robot.id)).toEqual(["robot_authored"]);
    expect(normalized.doors[0]).toMatchObject({
      surviveRobotIds: ["robot_authored"],
      waveIds: ["wave_l7kjqk"],
    });
  });

  it("removes compiled wave echo robots even after all authored robots were deleted", () => {
    const project = minimalProject({
      robots: [
        {
          id: "robot_wave_l7kjqk_room_a_enemy_1",
          roomId: "room_a",
          archetype: "repair_drone",
          count: 2,
          wave: { id: "wave_l7kjqk_room_a", role: "enemy" },
        },
      ],
    });

    expect(normalizeBuilderProjectForBoot(project, { officialImport: false }).robots).toEqual([]);
  });

  it("keeps non-echo source robots in normal build drafts", () => {
    const project = minimalProject({
      robots: [
        {
          id: "robot_level_04_waiting_room_enemy_1",
          roomId: "room_a",
          archetype: "clamp_bot",
          count: 2,
          wave: { id: "level_04_waiting_room", role: "enemy" },
        },
      ],
    });

    expect(normalizeBuilderProjectForBoot(project, { officialImport: false }).robots.map((robot) => robot.id)).toEqual([
      "robot_level_04_waiting_room_enemy_1",
    ]);
  });
});

function minimalProject(overrides: Partial<BuilderProject>): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: "project_test",
    title: "测试草稿",
    rooms: [
      { id: "room_a", label: "房间 A", style: "maintenance", center: [0, 0], size: [6, 6] },
      { id: "room_b", label: "房间 B", style: "maintenance", center: [0, -6], size: [6, 6] },
    ],
    doors: [{ id: "door_a", fromRoomId: "room_a", toRoomId: "room_b", lockType: "none" }],
    props: [],
    pickups: [],
    robots: [],
    exitRoomId: "room_b",
    ...overrides,
  };
}
