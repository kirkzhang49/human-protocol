import { describe, expect, it } from "vitest";
import { createStarterProject } from "./BuilderTypes";
import { builderWaveDoorOptions } from "./BuilderDoorRelations";

describe("builderWaveDoorOptions", () => {
  it("keeps same-order wave options scoped by room for survive-wave door authoring", () => {
    const project = createStarterProject();
    project.robots = [
      {
        id: "hall_wave_one",
        roomId: "room_hall",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "hall_wave_one", order: 1, label: "候诊室波次 1" },
      },
      {
        id: "fight_wave_one",
        roomId: "room_fight",
        archetype: "custodian_elite",
        count: 1,
        waveChain: { waveId: "fight_wave_one", order: 1, label: "治疗剧场波次 1" },
      },
    ];

    expect(builderWaveDoorOptions(project)).toEqual([
      expect.objectContaining({ roomId: "room_hall", order: 1, waveId: "hall_wave_one", robotIds: ["hall_wave_one"] }),
      expect.objectContaining({ roomId: "room_fight", order: 1, waveId: "fight_wave_one", robotIds: ["fight_wave_one"] }),
    ]);
    expect(builderWaveDoorOptions(project, "room_fight")).toEqual([
      expect.objectContaining({ roomId: "room_fight", order: 1, waveId: "fight_wave_one", robotIds: ["fight_wave_one"] }),
    ]);
  });
});
