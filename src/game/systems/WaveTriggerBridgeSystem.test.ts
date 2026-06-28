import { describe, expect, it } from "vitest";
import { WaveTriggerBridgeSystem } from "./WaveTriggerBridgeSystem";

describe("WaveTriggerBridgeSystem", () => {
  it("does not queue room-entered waves for rooms behind closed doors", () => {
    const queuedWaveIds: string[] = [];
    const world = {
      session: {
        mode: "playing",
        activeWaveId: null,
        mapProgress: {
          currentRoomId: "entry_room",
          triggeredWaveIds: [],
          completedWaveIds: [],
          openedDoorIds: [],
        },
      },
      level: {
        map: {
          rooms: [
            { id: "entry_room", bounds: { center: [0, 0, 0], size: [6, 4, 6] } },
            { id: "clinic_room", bounds: { center: [8, 0, 0], size: [6, 4, 6] } },
          ],
          doors: [{ id: "door_entry_clinic", fromRoomId: "entry_room", toRoomId: "clinic_room" }],
        },
        waves: [
          {
            id: "clinic_wave_one",
            startDelay: 0,
            roomId: "clinic_room",
            trigger: { type: "room_entered", id: "clinic_room", delay: 0 },
            enemies: [],
            reward: "none",
          },
        ],
      },
      isDoorOpen: () => false,
      consumeObjectiveEvents: () => [{ type: "room_entered", id: "clinic_room" }],
      queueWaveStart(waveId: string) {
        queuedWaveIds.push(waveId);
        return true;
      },
    };

    new WaveTriggerBridgeSystem().update(world as any);

    expect(queuedWaveIds).toEqual([]);
  });
});
