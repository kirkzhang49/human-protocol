import { describe, expect, it } from "vitest";
import { propEntry } from "./BuilderAssetCatalog";
import { createStarterProject, type BuilderDoor, type BuilderProject, type BuilderRoom, type BuilderWallDoorSwitch } from "./BuilderTypes";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import { applyToggleDoorOwnership, MAX_WALL_DOOR_SWITCHES_PER_LEVEL, MAX_WALL_DOOR_SWITCH_STATES } from "./BuilderWallDoorSwitches";
import {
  pickAt,
  roomPickModifierActive,
  routeOutputKeyPosition,
  wallDoorSwitchDraftPlacementFromPoint,
  wallMountedPropPlacementForEntryFromPoint,
  wallMountedPropPlacementFromPoint,
  wallMountedPropRotationYFromPoint,
} from "./BuilderPlacementRules";
import { projectWithAnchoredPuzzleComponentsForProp, projectWithHostedRouteSwitchProp } from "./BuilderPuzzlePlacement";

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

function wallDoorSwitchForDoor(id: string, doorId: string, offset: number, states = 2): BuilderWallDoorSwitch {
  return {
    id,
    label: `墙面门控 ${id}`,
    roomId: "room_hall",
    wallMount: { side: "north", offset, height: 1.34, inset: 0.18 },
    mode: "state_cycle",
    initialStateId: "state_1",
    oneShot: false,
    states: Array.from({ length: states }, (_, index) => ({
      id: `state_${index + 1}`,
      label: `状态 ${index + 1}`,
      ...(index % 2 === 0 ? { closeDoorIds: [doorId] } : { openDoorIds: [doorId] }),
    })),
  };
}

function extraDoor(id: string): BuilderDoor {
  return {
    id,
    label: id,
    fromRoomId: "room_hall",
    toRoomId: "room_archive",
    lockType: "none",
  };
}

describe("wall-mounted prop placement", () => {
  it("treats Command/Ctrl as the explicit room-pick modifier", () => {
    expect(roomPickModifierActive({ metaKey: true })).toBe(true);
    expect(roomPickModifierActive({ ctrlKey: true })).toBe(true);
    expect(roomPickModifierActive({ metaKey: false, ctrlKey: false })).toBe(false);
    expect(roomPickModifierActive({})).toBe(false);
  });

  it("does not pick room floors unless room picking is explicitly enabled", () => {
    const project: BuilderProject = {
      schemaVersion: "hp.builder.v1",
      projectId: "room-pick-mode",
      title: "Room pick mode",
      rooms: [{ id: "room_a", label: "Room A", style: "museum", center: [0, 0], size: [10, 8] }],
      doors: [],
      props: [],
      robots: [],
      exitRoomId: "room_a",
    };

    expect(pickAt(project, 0, 0, () => null, [])).toBeNull();
    expect(pickAt(project, 0, 0, () => null, [], { includeRooms: true })).toEqual({ kind: "room", id: "room_a" });
  });

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

  it("allows placing wall door switches only near a real wall", () => {
    const placement = wallDoorSwitchDraftPlacementFromPoint(room, 4.88, 0);

    expect(placement).not.toBeNull();
    expect(placement?.wallMount).toMatchObject({ side: "east" });
    expect(placement?.wallMount.height).toBeCloseTo(1.34);
    expect(placement?.wallMount.inset).toBeCloseTo(0.18);
    expect(placement?.placement.plan[0]).toBeCloseTo(4.82);
    expect(placement?.placement.plan[1]).toBeCloseTo(0);

    expect(wallDoorSwitchDraftPlacementFromPoint(room, 0, 0)).toBeNull();
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

  it("keeps a survive-wave door lock when a wall door switch is added as a mechanism controller", () => {
    const starter = createStarterProject();
    const project: BuilderProject = {
      ...starter,
      doors: starter.doors.map((door) =>
        door.id === "door_d"
          ? { ...door, lockType: "survive_wave", surviveRobotIds: ["guard_robot"], surviveRobotId: "guard_robot" }
          : door,
      ),
      robots: [{ id: "guard_robot", roomId: "room_fight", archetype: "repair_drone", count: 1 }],
      wallDoorSwitches: [wallDoorSwitchForDoor("wall_guard", "door_d", 0)],
    };

    const controlled = applyToggleDoorOwnership(project, "wall_guard", "door_d");
    const builderDoor = controlled.doors.find((door) => door.id === "door_d");

    expect(builderDoor).toMatchObject({
      lockType: "survive_wave",
      surviveRobotIds: ["guard_robot"],
      surviveRobotId: "guard_robot",
    });

    const { level, issues } = compileBuilderProjectToLevel(controlled);

    expect(issues).toEqual([]);
    expect(level?.map.doors.find((door) => door.id === "door_d")?.lock).toMatchObject({ type: "survive_wave" });
    const openState = level?.switches?.find((entry) => entry.id === "door_switch_wall_guard")?.states.find((state) => state.id === "state_2_open");
    expect(openState?.actions).toEqual(expect.arrayContaining([{ type: "open_door", doorId: "door_d", respectLock: true }]));
    expect(openState?.actions).not.toEqual(expect.arrayContaining([{ type: "unlock_door", doorId: "door_d" }]));
  });

  it("routes locked doors through mechanism control without replacing their progression lock", () => {
    const starter = createStarterProject();
    const project: BuilderProject = {
      ...starter,
      doors: starter.doors.map((door) =>
        door.id === "door_d"
          ? { ...door, lockType: "survive_wave", surviveRobotIds: ["guard_robot"], surviveRobotId: "guard_robot" }
          : door,
      ),
      robots: [{ id: "guard_robot", roomId: "room_fight", archetype: "repair_drone", count: 1 }],
      routeSwitches: [
        {
          id: "route_guard",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_archive",
          position: [1, 3],
          rotationY: 0,
          outputs: [
            {
              id: "out_guard",
              kind: "open_door",
              doorId: "door_d",
              keyRoomId: "room_archive",
              keyPosition: [-9, 3],
            },
          ],
        },
      ],
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    expect(level?.map.doors.find((door) => door.id === "door_d")?.lock).toMatchObject({ type: "survive_wave" });
    const routeState = level?.switches?.find((entry) => entry.id === "route_route_guard")?.states.find((state) => state.id === "out_1_out_guard");
    expect(routeState?.actions).toEqual(expect.arrayContaining([{ type: "open_door", doorId: "door_d", respectLock: true }]));
    expect(routeState?.actions).not.toEqual(expect.arrayContaining([{ type: "unlock_door", doorId: "door_d" }]));
  });

  it("allows six wall door switches per level and flags the seventh", () => {
    const starter = createStarterProject();
    const doors = [...starter.doors, extraDoor("door_e"), extraDoor("door_f"), extraDoor("door_g")];
    const sixSwitches = doors.slice(0, MAX_WALL_DOOR_SWITCHES_PER_LEVEL).map((door, index) =>
      wallDoorSwitchForDoor(`wall_${index + 1}`, door.id, -0.9 + index * 0.3),
    );

    const accepted = compileBuilderProjectToLevel({
      ...starter,
      doors,
      wallDoorSwitches: sixSwitches,
    });

    expect(accepted.issues).toEqual([]);
    expect(accepted.level?.switches?.filter((entry) => entry.id.startsWith("door_switch_wall_"))).toHaveLength(MAX_WALL_DOOR_SWITCHES_PER_LEVEL);

    const rejected = compileBuilderProjectToLevel({
      ...starter,
      doors,
      wallDoorSwitches: [...sixSwitches, wallDoorSwitchForDoor("wall_7", "door_g", 0.9)],
    });

    expect(rejected.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wallDoorSwitches",
          message: expect.stringContaining(`最多 ${MAX_WALL_DOOR_SWITCHES_PER_LEVEL} 个`),
        }),
      ]),
    );
  });

  it("allows six states on one wall door switch and flags the seventh", () => {
    const starter = createStarterProject();
    const accepted = compileBuilderProjectToLevel({
      ...starter,
      wallDoorSwitches: [wallDoorSwitchForDoor("wall_state_cycle", "door_b", 0, MAX_WALL_DOOR_SWITCH_STATES)],
    });

    expect(accepted.issues).toEqual([]);
    expect(accepted.level?.switches?.find((entry) => entry.id === "door_switch_wall_state_cycle")?.states).toHaveLength(MAX_WALL_DOOR_SWITCH_STATES);

    const rejected = compileBuilderProjectToLevel({
      ...starter,
      wallDoorSwitches: [wallDoorSwitchForDoor("wall_state_cycle", "door_b", 0, MAX_WALL_DOOR_SWITCH_STATES + 1)],
    });

    expect(rejected.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wallDoorSwitches.wall_state_cycle.states",
          message: expect.stringContaining(`最多支持 ${MAX_WALL_DOOR_SWITCH_STATES} 个状态`),
        }),
      ]),
    );
  });

  it("compiles hosted route switches as hidden hotspots on furniture", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      routeSwitches: [
        {
          id: "route_hosted",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_archive",
          hostPropId: "prop_e",
          position: [-3.4, 5.6],
          rotationY: Math.PI / 2,
          outputs: [
            {
              id: "out_hosted",
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
    const interaction = level?.map?.interactions.find((candidate) => candidate.id === "route_route_hosted_panel");
    expect(interaction).toMatchObject({
      type: "switch",
      roomId: "room_hall",
      position: [-3.4, 0, 5.6],
      yaw: Math.PI / 2,
      visualKey: "none",
      anchorPropId: "prop_e",
    });
    expect(level?.switches?.find((entry) => entry.id === "route_route_hosted")).toMatchObject({
      interactionId: "route_route_hosted_panel",
      presentation: {
        kind: "route_console",
        modelKey: "builder_route_switch_console",
      },
    });
  });

  it("compiles route puzzle outputs as gated puzzle reveals with a paced focus shot", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      doors: createStarterProject().doors.map((door) =>
        door.id === "door_b" ? { ...door, lockType: "puzzle_complete" as const } : door,
      ),
      puzzles: [
        {
          id: "route_revealed_puzzle",
          kind: "circuit_grid",
          linkedDoorId: "door_b",
          roomId: "room_hall",
          position: [1, 2],
          rotationY: 0,
        },
      ],
      routeSwitches: [
        {
          id: "route_puzzle_reveal",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_hall",
          position: [2, 3],
          rotationY: 0,
          outputs: [
            {
              id: "out_puzzle",
              kind: "reveal_puzzle",
              puzzleId: "route_revealed_puzzle",
            },
          ],
        },
      ],
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    const routeState = level?.switches?.find((entry) => entry.id === "route_route_puzzle_reveal")?.states.find((state) => state.id === "out_1_out_puzzle");
    expect(routeState?.actions).toEqual(
      expect.arrayContaining([
        { type: "focus_reveal", reveal: { kind: "puzzle", cameraMode: "door_front", durationSec: 3.4 } },
      ]),
    );
    const interaction = level?.map?.interactions.find((candidate) => candidate.id === "pz_door_b_panel");
    expect(interaction?.requiresSwitchState).toEqual({ switchId: "route_route_puzzle_reveal", stateId: "out_1_out_puzzle" });
  });

  it("compiles route robot outputs with a three-second spawn focus reveal", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      doors: createStarterProject().doors.map((door) => ({ ...door, lockType: "none" as const })),
      robots: [
        {
          id: "route_room_elite",
          label: "回收精英",
          roomId: "room_archive",
          archetype: "custodian_elite",
          count: 1,
          position: [-7, 2],
          tier: "elite",
        },
      ],
      routeSwitches: [
        {
          id: "route_robot_reveal",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_hall",
          position: [2, 3],
          rotationY: 0,
          outputs: [
            {
              id: "out_robots",
              kind: "start_robots",
              robotRoomId: "room_archive",
            },
          ],
        },
      ],
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    const routeState = level?.switches?.find((entry) => entry.id === "route_route_robot_reveal")?.states.find((state) => state.id === "out_1_out_robots");
    expect(routeState?.actions).toEqual(
      expect.arrayContaining([
        { type: "start_wave", waveId: "wave_room_archive", immediate: true },
        { type: "focus_reveal", reveal: { kind: "robot", roomId: "room_archive", cameraMode: "door_front", durationSec: 3 } },
      ]),
    );
  });

  it("compiles regular route robot outputs with a two-second monster focus reveal", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      doors: createStarterProject().doors.map((door) => ({ ...door, lockType: "none" as const })),
      robots: [
        {
          id: "route_room_add",
          label: "回收助手",
          roomId: "room_archive",
          archetype: "repair_drone",
          count: 2,
          position: [-7, 2],
        },
      ],
      routeSwitches: [
        {
          id: "route_robot_reveal",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_hall",
          position: [2, 3],
          rotationY: 0,
          outputs: [
            {
              id: "out_robots",
              kind: "start_robots",
              robotRoomId: "room_archive",
            },
          ],
        },
      ],
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    const routeState = level?.switches?.find((entry) => entry.id === "route_route_robot_reveal")?.states.find((state) => state.id === "out_1_out_robots");
    expect(routeState?.actions).toEqual(
      expect.arrayContaining([
        { type: "start_wave", waveId: "wave_room_archive", immediate: true },
        { type: "focus_reveal", reveal: { kind: "robot", roomId: "room_archive", cameraMode: "door_front", durationSec: 2 } },
      ]),
    );
  });

  it("defaults route output authorization orbs near the route console", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      routeSwitches: [
        {
          id: "route_nearby_orbs",
          label: "管制路由台",
          roomId: "room_hall",
          keyRoomId: "room_hall",
          position: [2, 3],
          rotationY: 0,
          outputs: [
            { id: "out_a", kind: "open_door", doorId: "door_b" },
            { id: "out_b", kind: "open_door", doorId: "door_b" },
            { id: "out_c", kind: "open_door", doorId: "door_b" },
          ],
        },
      ],
    };
    const route = project.routeSwitches![0];

    expect(route.outputs.map((output, index) => routeOutputKeyPosition(project, route, output, index))).toEqual([
      [1.45, 2.35],
      [2.55, 2.35],
      [1.45, 3.45],
    ]);
  });

  it("moves hosted puzzle interactions and route switches with their furniture", () => {
    const project: BuilderProject = {
      ...createStarterProject(),
      props: [
        {
          id: "prop_console",
          modelKey: "room_museum_voice_archive_case",
          roomId: "room_hall",
          position: [4, 5],
          rotationY: Math.PI / 4,
          scale: 1,
        },
      ],
      puzzles: [
        {
          id: "puzzle_hosted",
          kind: "circuit_grid",
          linkedDoorId: "door_b",
          roomId: "room_archive",
          position: [-4, -5],
          rotationY: 0,
          sourceInteraction: {
            type: "terminal",
            hostPropId: "prop_console",
          },
        },
      ],
      routeSwitches: [
        {
          id: "route_hosted_move",
          label: "管制路由台",
          roomId: "room_archive",
          keyRoomId: "room_archive",
          hostPropId: "prop_console",
          position: [-4, -5],
          rotationY: 0,
          outputs: [
            {
              id: "out_manual",
              kind: "open_door",
              doorId: "door_b",
              keyRoomId: "room_archive",
              keyPosition: [-3, -4],
            },
          ],
        },
      ],
    };

    const moved = projectWithAnchoredPuzzleComponentsForProp(project, "prop_console");

    expect(moved.puzzles?.find((puzzle) => puzzle.id === "puzzle_hosted")).toMatchObject({
      roomId: "room_hall",
      position: [4, 5],
      rotationY: Math.PI / 4,
    });
    expect(moved.routeSwitches?.find((route) => route.id === "route_hosted_move")).toMatchObject({
      roomId: "room_hall",
      position: [4, 5],
      rotationY: Math.PI / 4,
    });
    expect(moved.routeSwitches?.find((route) => route.id === "route_hosted_move")?.outputs[0]).toMatchObject({
      keyPosition: [-3, -4],
    });

    const draggedHost = { ...project.props[0], roomId: "room_fight", position: [2, -6] as [number, number], rotationY: Math.PI / 2 };
    const dragged = projectWithHostedRouteSwitchProp(project, "route_hosted_move", draggedHost);

    expect(dragged.props.find((prop) => prop.id === "prop_console")).toMatchObject({
      roomId: "room_fight",
      position: [2, -6],
      rotationY: Math.PI / 2,
    });
    expect(dragged.routeSwitches?.find((route) => route.id === "route_hosted_move")).toMatchObject({
      roomId: "room_fight",
      position: [2, -6],
      rotationY: Math.PI / 2,
    });
    expect(dragged.routeSwitches?.find((route) => route.id === "route_hosted_move")?.outputs[0]).toMatchObject({
      keyPosition: [-3, -4],
    });
  });
});
