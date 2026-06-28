import { describe, expect, it } from "vitest";
import { builderRobotCatalog } from "./BuilderAssetCatalog";
import { builderRobotPresetDefaults } from "./BuilderRobotPresets";
import { createStarterProject, type BuilderProject } from "./BuilderTypes";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import { builderRuntimeAssetIndexForProject } from "./runtime-pack/BuilderRuntimeAssetIndex";

describe("builder robot presets", () => {
  it("places the Level 5 reclamation mother boss with the official cooked model key", () => {
    const preset = builderRobotPresetDefaults("reclamation_mother_boss");
    const starter = createStarterProject();
    const project: BuilderProject = {
      ...starter,
      robots: [
        {
          id: "robot_reclamation_mother",
          label: "回收母体 Boss",
          roomId: "room_fight",
          ...preset,
          archetype: preset.archetype ?? "custodian_elite",
          count: preset.count ?? 1,
        },
      ],
      doors: starter.doors.map((door) =>
        door.id === "door_d" ? { ...door, lockType: "survive_wave", surviveRobotIds: ["robot_reclamation_mother"], surviveRobotId: "robot_reclamation_mother" } : door,
      ),
    };

    expect(builderRobotCatalog.find((entry) => entry.presetId === "reclamation_mother_boss")).toMatchObject({
      label: "回收母体 Boss",
      modelKey: "hp_enemy_reclamation_mother_final_horror",
    });
    expect(preset).toMatchObject({
      archetype: "custodian_elite",
      tier: "boss",
      combat: {
        visual: {
          modelKey: "hp_enemy_reclamation_mother_final_horror",
        },
      },
    });

    const { level, issues } = compileBuilderProjectToLevel(project);
    expect(issues).toEqual([]);
    expect(level).not.toBeNull();
    expect(level?.waves.flatMap((wave) => wave.enemies)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          archetype: "custodian_elite",
          tier: "boss",
          visual: expect.objectContaining({
            modelKey: "hp_enemy_reclamation_mother_final_horror",
          }),
        }),
      ]),
    );

    const assetIndex = builderRuntimeAssetIndexForProject(level!, project);
    expect(assetIndex.find((entry) => entry.modelKey === "hp_enemy_reclamation_mother_final_horror")).toMatchObject({
      kind: "enemy",
      nativeRawEligible: true,
      roles: expect.arrayContaining(["enemy"]),
    });
  });
});
