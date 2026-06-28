import { describe, expect, it } from "vitest";
import { createStarterProject } from "./BuilderTypes";
import { builderWaveChainWithOrder } from "./BuilderWaveChainAuthoring";

describe("builderWaveChainWithOrder", () => {
  it("reuses existing wave ids only inside the robot's room", () => {
    const project = createStarterProject();
    project.robots = [
      {
        id: "hall_wave_one_a",
        roomId: "room_hall",
        archetype: "repair_drone",
        count: 1,
        waveChain: { waveId: "hall_wave_one", order: 1, label: "波次 1" },
      },
      {
        id: "hall_wave_one_b",
        roomId: "room_hall",
        archetype: "clamp_bot",
        count: 1,
      },
      {
        id: "fight_wave_one",
        roomId: "room_fight",
        archetype: "custodian_elite",
        count: 1,
      },
    ];

    const sameRoom = builderWaveChainWithOrder(project, project.robots[1], 1);
    const otherRoom = builderWaveChainWithOrder(project, project.robots[2], 1);

    expect(sameRoom).toMatchObject({ waveId: "hall_wave_one", order: 1, label: "波次 1" });
    expect(otherRoom.order).toBe(1);
    expect(otherRoom.waveId).not.toBe("hall_wave_one");
  });

  it("keeps the robot's own wave id when changing unrelated controls on the same wave", () => {
    const project = createStarterProject();
    project.robots = [
      {
        id: "fight_wave_one",
        roomId: "room_fight",
        archetype: "custodian_elite",
        count: 1,
        waveChain: { waveId: "fight_existing_wave", order: 1, label: "治疗剧场波次 1" },
      },
    ];

    expect(builderWaveChainWithOrder(project, project.robots[0], 1)).toMatchObject({
      waveId: "fight_existing_wave",
      order: 1,
      label: "治疗剧场波次 1",
    });
  });
});
