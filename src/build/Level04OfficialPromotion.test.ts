import { describe, expect, it } from "vitest";
import level04OfficialBuilderDocumentJson from "../game/config/levels/level04-memory-clinic/level.official.builder.json";
import type { LevelDefinition } from "../game/config/schema/levelConfig";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import { level04MemoryClinic } from "../game/config/levels/level04-memory-clinic";
import { compileOfficialBuilderDocument } from "./official-builder/compileOfficialBuilderProjectToLevel";
import type { OfficialBuilderDocument } from "./official-builder/OfficialBuilderTypes";

describe("Level 4 official builder source", () => {
  it("promotes the current memory clinic build draft as the official builder source", () => {
    const document = level04OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument;
    const report = compileOfficialBuilderDocument(document);
    const compiled = compileBuilderProjectToLevel(document.project);

    expect(report.ok).toBe(true);
    expect(compiled.issues).toEqual([]);
    expect(compiled.level).not.toBeNull();
    expect(report.level).not.toBeNull();
    expect(report.level!.id).toBe("level_04_memory_clinic");
    expect(report.level!.title).toBe("记忆诊所");
    expect(report.level!.map.rooms).toHaveLength(8);
    expect(report.level!.waves).toHaveLength(6);
    expectMemoryClinicHoldRoomObjectiveOrder(compiled.level!);
    expectMemoryClinicHoldRoomObjectiveOrder(report.level!);

    const waitingRoomWaves = report.level!.waves.filter((wave) => wave.roomId === "level_04_waiting_room");
    expect(waitingRoomWaves.flatMap((wave) => wave.enemies).some((enemy) => enemy.archetype === "custodian_elite")).toBe(false);

    const bossWave = report.level!.waves.find((wave) => wave.id === "wave_yjxxy4");
    expect(bossWave).toMatchObject({
      roomId: "level_04_therapy_theater",
      trigger: { type: "room_entered", id: "level_04_therapy_theater", delay: 0.4 },
    });
    expect(bossWave?.enemies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          archetype: "custodian_elite",
          count: 1,
          healthMultiplier: 0.55,
        }),
        expect.objectContaining({
          archetype: "clamp_bot",
          count: 2,
        }),
      ]),
    );
  });

  it("reports the exact exported runtime config when the official source carries a runtime override", () => {
    const report = compileOfficialBuilderDocument(level04OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument);

    expect(report.ok).toBe(true);
    expect(report.level).toEqual(level04MemoryClinic);
  });

  it("loads the exported build draft as the official runtime Level 4 config", () => {
    expect(level04MemoryClinic).toMatchObject({
      id: "level_04_memory_clinic",
      title: "记忆诊所",
      authoringProfile: "internal",
    });
    expect(level04MemoryClinic.map.rooms).toHaveLength(8);
    expect(level04MemoryClinic.map.doors).toHaveLength(7);
    expect(level04MemoryClinic.map.props).toHaveLength(27);
    expect(level04MemoryClinic.waves.map((wave) => wave.id)).toEqual([
      "wave_level_04_waiting_room",
      "wave_0z51v9",
      "wave_yjxxy4",
      "wave_yjxxy4_pressure_loop",
      "wave_dw6lb3",
      "wave_dw6lb3_pressure_loop",
    ]);
    expect(level04MemoryClinic.waves.find((wave) => wave.id === "wave_yjxxy4")?.enemies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          archetype: "custodian_elite",
          count: 1,
          healthMultiplier: 0.55,
        }),
      ]),
    );
    expectMemoryClinicHoldRoomObjectiveOrder(level04MemoryClinic);
  });
});

function expectMemoryClinicHoldRoomObjectiveOrder(level: LevelDefinition) {
  const objectiveIds = level.objectiveChain?.map((objective) => objective.id) ?? [];
  expect(objectiveIds.indexOf("obj_open_level_04_waiting_door")).toBeLessThan(objectiveIds.indexOf("obj_survive_wave_level_04_waiting_room"));
  expect(objectiveIds.indexOf("obj_open_level_04_theater_door")).toBeLessThan(objectiveIds.indexOf("obj_survive_door_d42uh6"));
  expect(objectiveIds.indexOf("obj_survive_door_d42uh6")).toBeLessThan(objectiveIds.indexOf("obj_open_door_d42uh6"));
  expect(objectiveIds.indexOf("obj_open_door_d42uh6")).toBeLessThan(objectiveIds.indexOf("obj_survive_wave_dw6lb3"));
  expect(objectiveIds.indexOf("obj_survive_wave_dw6lb3")).toBeLessThan(objectiveIds.indexOf("obj_puzzle_level_04_exit_door"));
}
