import { describe, expect, it } from "vitest";
import { RoomDirectorSystem } from "./RoomDirectorSystem";

describe("RoomDirectorSystem", () => {
  it("does not switch to the nearest locked-room side while the boundary door is closed", () => {
    let currentRoomId = "entry_room";
    const world = {
      session: {
        mode: "playing",
        mapProgress: {
          currentRoomId,
        },
      },
      player: { position: { x: 3.2, z: 0 } },
      level: {
        map: {
          rooms: [
            { id: "entry_room", label: "入口", mood: "quiet", bounds: { center: [0, 0, 0], size: [4, 4, 4] } },
            { id: "clinic_room", label: "诊室", mood: "combat", bounds: { center: [6, 0, 0], size: [4, 4, 4] } },
          ],
          doors: [{ id: "door_entry_clinic", fromRoomId: "entry_room", toRoomId: "clinic_room" }],
        },
      },
      isDoorOpen: () => false,
      setCurrentRoom(roomId: string | null) {
        if (roomId) {
          currentRoomId = roomId;
          this.session.mapProgress.currentRoomId = roomId;
        }
      },
      revealRoomClue: () => false,
      setSpawnWarning: () => undefined,
      applyCameraImpact: () => undefined,
    };

    new RoomDirectorSystem().update(world as any);

    expect(currentRoomId).toBe("entry_room");
  });
});
