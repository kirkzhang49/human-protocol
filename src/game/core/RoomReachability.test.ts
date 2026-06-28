import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createEnemyRobot } from "../entities/createEnemyRobot";
import { isEnemyVisibleToPlayerRoom, isRoomReachableThroughOpenDoors } from "./RoomReachability";

describe("RoomReachability", () => {
  it("treats rooms behind closed doors as unreachable for combat visibility", () => {
    const world = createReachabilityWorld([]);

    expect(isRoomReachableThroughOpenDoors(world as any, "clinic_room")).toBe(false);
  });

  it("does not treat target rooms as reachable before the current room is known", () => {
    const world = createReachabilityWorld([]);
    world.session.mapProgress.currentRoomId = null;

    expect(isRoomReachableThroughOpenDoors(world as any, "clinic_room")).toBe(false);
  });

  it("follows opened door chains for combat visibility", () => {
    const world = createReachabilityWorld(["door_entry_clinic", "door_clinic_far"]);

    expect(isRoomReachableThroughOpenDoors(world as any, "far_room")).toBe(true);
  });

  it("hides enemies whose spawn room is behind a closed door", () => {
    const world = createReachabilityWorld([]);
    const enemy = createEnemyRobot(1, "repair_drone", "clinic_wave", new Vector3(8, 0, 0), 0, undefined, {
      spawnRoomId: "clinic_room",
    });

    expect(isEnemyVisibleToPlayerRoom(world as any, enemy)).toBe(false);
  });

  it("shows enemies after their spawn room is connected by open doors", () => {
    const world = createReachabilityWorld(["door_entry_clinic"]);
    const enemy = createEnemyRobot(1, "repair_drone", "clinic_wave", new Vector3(8, 0, 0), 0, undefined, {
      spawnRoomId: "clinic_room",
    });

    expect(isEnemyVisibleToPlayerRoom(world as any, enemy)).toBe(true);
  });

  it("keeps legacy enemies without spawnRoomId visible", () => {
    const world = createReachabilityWorld([]);
    const enemy = createEnemyRobot(1, "repair_drone", "legacy_wave", new Vector3(8, 0, 0), 0);

    expect(isEnemyVisibleToPlayerRoom(world as any, enemy)).toBe(true);
  });

  it("allows focused door reveals to show the revealed room", () => {
    const world = createReachabilityWorld([], {
      activeFocusReveal: { kind: "door", targetId: "door_entry_clinic", roomId: "clinic_room" },
    });
    const enemy = createEnemyRobot(1, "repair_drone", "clinic_wave", new Vector3(8, 0, 0), 0, undefined, {
      spawnRoomId: "clinic_room",
    });

    expect(isEnemyVisibleToPlayerRoom(world as any, enemy)).toBe(true);
  });
});

function createReachabilityWorld(openDoorIds: string[], sessionOverrides: Record<string, unknown> = {}) {
  return {
    isDoorOpen: (doorId: string) => openDoorIds.includes(doorId),
    session: {
      activeFocusReveal: null,
      ...sessionOverrides,
      mapProgress: {
        currentRoomId: "entry_room",
        openedDoorIds: openDoorIds,
      },
    },
    level: {
      map: {
        rooms: [
          { id: "entry_room", bounds: { center: [0, 0, 0], size: [6, 4, 6] } },
          { id: "clinic_room", bounds: { center: [8, 0, 0], size: [6, 4, 6] } },
          { id: "far_room", bounds: { center: [16, 0, 0], size: [6, 4, 6] } },
        ],
        doors: [
          { id: "door_entry_clinic", fromRoomId: "entry_room", toRoomId: "clinic_room" },
          { id: "door_clinic_far", fromRoomId: "clinic_room", toRoomId: "far_room" },
        ],
      },
    },
  };
}
