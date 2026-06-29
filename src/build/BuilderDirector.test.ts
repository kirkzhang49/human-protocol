import { describe, expect, it } from "vitest";
import { repairProject } from "./BuilderDirector";
import { routeOutputKeyPosition } from "./BuilderPlacementRules";
import { createStarterProject, type BuilderProject } from "./BuilderTypes";

describe("repairProject", () => {
  it("resets remote route output authorization orbs next to their route switch", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      routeSwitches: [
        {
          id: "route_deadlock",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_hall",
          position: [2, 3],
          rotationY: 0,
          outputs: [
            {
              id: "out_exit",
              kind: "open_door",
              doorId: "door_d",
              keyRoomId: "room_exit",
              keyPosition: [0, -11.5],
            },
          ],
        },
      ],
    };

    const repaired = repairProject(project);
    const route = repaired.project.routeSwitches?.[0];
    const output = route?.outputs[0];

    expect(repaired.fixes.some((fix) => fix.includes("路由输出授权球"))).toBe(true);
    expect(output?.keyRoomId).toBeUndefined();
    expect(output?.keyPosition).toBeUndefined();
    expect(route && output ? routeOutputKeyPosition(repaired.project, route, output, 0) : null).toEqual([1.45, 2.35]);
  });
});
