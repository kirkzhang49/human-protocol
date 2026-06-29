import { describe, expect, it } from "vitest";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import type { BuilderProject, BuilderWallDoorSwitch } from "./BuilderTypes";

function wallSwitch(id: string, roomId: string, doorId: string): BuilderWallDoorSwitch {
  return {
    id,
    label: "墙面门控把手",
    roomId,
    wallMount: { side: "north", offset: 0, height: 1.34, inset: 0.18 },
    mode: "state_cycle",
    initialStateId: "closed",
    oneShot: false,
    states: [
      { id: "closed", label: "关闭", closeDoorIds: [doorId] },
      { id: "open", label: "打开", openDoorIds: [doorId] },
    ],
  };
}

describe("builder objective chain", () => {
  it("keeps backtrack wall-switch doors out of the main objective chain", () => {
    const project: BuilderProject = {
      schemaVersion: "hp.builder.v1",
      projectId: "objective_backtrack_switch",
      title: "Objective Backtrack Switch",
      rooms: [
        { id: "spawn", label: "入口", style: "sterile", center: [0, 0], size: [8, 6] },
        { id: "hub", label: "中庭", style: "hazard", center: [0, -6], size: [8, 6] },
        { id: "platform", label: "内台", style: "maintenance", center: [0, -12], size: [8, 6] },
        { id: "exit", label: "撤离电梯", style: "exit", center: [0, -18], size: [8, 6] },
        { id: "side_switch", label: "墙控侧室", style: "maintenance", center: [-8, -12], size: [8, 6] },
        { id: "backtrack", label: "回接侧室", style: "maintenance", center: [8, 0], size: [8, 6] },
      ],
      doors: [
        { id: "door_hub", label: "中庭门", fromRoomId: "spawn", toRoomId: "hub", lockType: "switch_state", wallDoorSwitchId: "switch_hub", wallDoorSwitchStateId: "open" },
        { id: "door_platform", label: "内台门", fromRoomId: "hub", toRoomId: "platform", lockType: "none" },
        { id: "door_exit", label: "出口门", fromRoomId: "platform", toRoomId: "exit", lockType: "survive_wave" },
        { id: "door_side", label: "侧室门", fromRoomId: "side_switch", toRoomId: "platform", lockType: "puzzle_complete", puzzleKind: "circuit_grid", puzzleRoomId: "hub" },
        { id: "door_backtrack", label: "回接门", fromRoomId: "backtrack", toRoomId: "spawn", lockType: "switch_state", wallDoorSwitchId: "switch_backtrack", wallDoorSwitchStateId: "open" },
      ],
      props: [],
      pickups: [],
      robots: [{ id: "robot_exit", roomId: "platform", archetype: "repair_drone", count: 1 }],
      puzzles: [{ id: "pz_side", kind: "circuit_grid", linkedDoorId: "door_side", roomId: "hub", position: [0, -6], rotationY: 0 }],
      wallDoorSwitches: [
        wallSwitch("switch_hub", "spawn", "door_hub"),
        wallSwitch("switch_backtrack", "side_switch", "door_backtrack"),
      ],
      exitRoomId: "exit",
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    const objectiveIds = level?.objectiveChain?.map((objective) => objective.id) ?? [];
    expect(objectiveIds).not.toContain("obj_open_door_backtrack");
    expect(objectiveIds[0]).toBe("obj_open_door_hub");
  });
});
