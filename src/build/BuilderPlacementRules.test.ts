import { describe, expect, it } from "vitest";
import { propEntry } from "./BuilderAssetCatalog";
import { createStarterProject, type BuilderProject, type BuilderRoom } from "./BuilderTypes";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import {
  wallMountedPropPlacementForEntryFromPoint,
  wallMountedPropPlacementFromPoint,
  wallMountedPropRotationYFromPoint,
} from "./BuilderPlacementRules";

const room: BuilderRoom = {
  id: "room",
  label: "Wall Art Room",
  style: "museum",
  center: [0, 0],
  size: [10, 8],
};

function wallSpeakerProject(): BuilderProject {
  return {
    schemaVersion: "hp.builder.v1",
    projectId: "proj_wall_speaker_orientation",
    title: "Wall speaker orientation",
    rooms: [
      { id: "room_spawn", label: "入口消毒间", style: "sterile", center: [0, 0], size: [10, 8] },
      { id: "room_exit", label: "出口", style: "exit", center: [0, 6], size: [6, 4] },
    ],
    doors: [{ id: "door_exit", fromRoomId: "room_spawn", toRoomId: "room_exit", lockType: "none" }],
    props: [
      {
        id: "speaker_east_wall",
        modelKey: "hp_l4_cineclinic_rescue_speaker_panel",
        roomId: "room_spawn",
        position: [4.88, 0],
        rotationY: 0,
        scale: 1,
      },
    ],
    robots: [],
    exitRoomId: "room_exit",
  };
}

function frontVector(yaw: number): readonly [number, number] {
  return [Math.sin(yaw), Math.cos(yaw)];
}

describe("wall-mounted prop placement", () => {
  it("points the local +Z artwork face into the room when dropped on the east wall", () => {
    const placement = wallMountedPropPlacementFromPoint(room, 4.88, 0, { height: 1.46 });

    expect(placement).not.toBeNull();
    expect(placement?.yaw).toBeCloseTo(-Math.PI / 2);
    expect(placement?.position[1]).toBeCloseTo(1.46);
    expect(placement?.plan[0]).toBeLessThan(5);

    const [fx, fz] = frontVector(placement!.yaw);
    expect(fx * -1 + fz * 0).toBeGreaterThan(0.99);
  });

  it("does not rotate center-room wall props that are not actually near a wall", () => {
    expect(wallMountedPropRotationYFromPoint(room, 0, 0, 0.42)).toBeCloseTo(0.42);
  });

  it("uses wall asset face metadata so a -Z front panel faces into the room", () => {
    const placement = wallMountedPropPlacementForEntryFromPoint(room, 4.88, 0, {
      height: 1.34,
      sizeMeters: [1.24, 0.72, 0.12],
      wallMountFace: "-z",
    });

    expect(placement).not.toBeNull();
    expect(placement?.yaw).toBeCloseTo(Math.PI / 2);
    expect(placement?.plan[0]).toBeCloseTo(4.635);

    const localNegativeZFront: readonly [number, number] = [-Math.sin(placement!.yaw), -Math.cos(placement!.yaw)];
    expect(localNegativeZFront[0] * -1 + localNegativeZFront[1] * 0).toBeGreaterThan(0.99);
  });

  it("snaps catalog wall art to the nearest visible wall surface instead of burying it in the wall slab", () => {
    const placement = wallMountedPropPlacementForEntryFromPoint(room, 3, 0, {
      height: 1.42,
      sizeMeters: [1.25, 1.25, 0.08],
    });

    expect(placement).not.toBeNull();
    expect(placement?.plan[0]).toBeCloseTo(4.655);
    expect(placement?.plan[1]).toBeCloseTo(0);
    expect(placement?.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it("uses the exact nearest wall segment instead of another wall with the same side", () => {
    const notchedRoom: BuilderRoom = {
      id: "notched",
      label: "Notched Room",
      style: "museum",
      center: [0, 0],
      size: [12, 8],
      shape: {
        kind: "polygon",
        points: [
          [-6, -4],
          [6, -4],
          [6, -1],
          [2, -1],
          [2, 4],
          [-6, 4],
        ],
      },
    };

    const placement = wallMountedPropPlacementForEntryFromPoint(notchedRoom, 5.7, -2, {
      height: 1.42,
      sizeMeters: [1.25, 1.25, 0.08],
    });

    expect(placement).not.toBeNull();
    expect(placement?.plan[0]).toBeCloseTo(5.805);
    expect(placement?.plan[1]).toBeCloseTo(-2);
    expect(placement?.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it("records the rescue speaker as a -Z-front wall asset", () => {
    const speaker = propEntry("hp_l4_cineclinic_rescue_speaker_panel");

    expect(speaker?.mount).toBe("wall");
    expect((speaker as { wallMountFace?: string } | null)?.wallMountFace).toBe("-z");
  });

  it("compiles -Z-front wall props with their face into the room and back near the wall", () => {
    const { level, issues } = compileBuilderProjectToLevel(wallSpeakerProject());

    expect(issues).toEqual([]);
    const prop = level?.map.props.find((candidate) => candidate.id === "speaker_east_wall");
    expect(prop?.rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(prop?.position[0]).toBeCloseTo(4.635);
    expect(prop?.position[2]).toBeCloseTo(0);
  });

  it("compiles plain route output doors as route-locked doors", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      routeSwitches: [
        {
          id: "route_plain",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_archive",
          position: [1, 3],
          rotationY: 0,
          outputs: [
            {
              id: "out_plain",
              kind: "open_door",
              doorId: "door_b",
              keyRoomId: "room_archive",
              keyPosition: [-9, 3],
            },
          ],
        },
      ],
    };

    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    const door = level?.map?.doors.find((candidate) => candidate.id === "door_b");
    expect(door).toMatchObject({
      defaultState: "locked",
      autoOpenOnApproach: false,
      lock: {
        type: "environment_state",
        environmentStateId: "route_lock_door_b",
      },
    });
    expect(level?.environmentStates?.some((state) => state.id === "route_lock_door_b")).toBe(true);
    const routeState = level?.switches?.find((entry) => entry.id === "route_route_plain")?.states.find((state) => state.id === "out_1_out_plain");
    expect(routeState?.actions).toEqual(expect.arrayContaining([
      { type: "unlock_door", doorId: "door_b" },
      { type: "open_door", doorId: "door_b" },
    ]));
  });
});
