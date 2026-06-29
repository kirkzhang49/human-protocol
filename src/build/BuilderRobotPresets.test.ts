import { describe, expect, it } from "vitest";
import { builderRobotCatalog } from "./BuilderAssetCatalog";
import { builderRobotPresetDefaults } from "./BuilderRobotPresets";
import { createStarterProject, type BuilderProject } from "./BuilderTypes";
import { compileBuilderProjectToLevel } from "./compileBuilderProjectToLevel";
import { builderRuntimeAssetIndexForProject } from "./runtime-pack/BuilderRuntimeAssetIndex";
import { validateLevelConfig } from "../game/config/ConfigValidator";

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
        damageMultiplier: expect.any(Number),
        visual: {
          modelKey: "hp_enemy_reclamation_mother_final_horror",
        },
      },
    });
    expect(preset.combat?.damageMultiplier).toBeGreaterThanOrEqual(1.54);
    expect(preset.combat?.visual?.scaleMultiplier).toBe(0.83);
    expect(3.05 * (preset.combat?.visual?.scaleMultiplier ?? 1)).toBeCloseTo(2.65 * 1.06 * 0.9, 2);

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
            scaleMultiplier: 0.83,
          }),
        }),
      ]),
    );
    expect(validateLevelConfig(level!, { authoringProfile: "generated" }).warnings.map((issue) => issue.code)).not.toContain("authoring.generated.enemy.scale_range");

    const assetIndex = builderRuntimeAssetIndexForProject(level!, project);
    expect(assetIndex.find((entry) => entry.modelKey === "hp_enemy_reclamation_mother_final_horror")).toMatchObject({
      kind: "enemy",
      nativeRawEligible: true,
      roles: expect.arrayContaining(["enemy"]),
    });
  });

  it("keeps curator and mother boss presets tuned above baseline damage", () => {
    expect(builderRobotPresetDefaults("museum_curator_boss").combat?.damageMultiplier).toBeGreaterThanOrEqual(1.28);
    expect(builderRobotPresetDefaults("reclamation_mother_boss").combat?.damageMultiplier).toBeGreaterThanOrEqual(1.54);
    expect(builderRobotPresetDefaults("reclamation_mother_boss").combat?.visual?.scaleMultiplier).toBe(0.83);
  });

  it("normalizes saved reclamation mother drafts that still carry the old oversized scale", () => {
    const preset = builderRobotPresetDefaults("reclamation_mother_boss");
    const starter = createStarterProject();
    const project: BuilderProject = {
      ...starter,
      robots: [
        {
          id: "robot_reclamation_mother_legacy",
          label: "回收母体 Boss",
          roomId: "room_fight",
          ...preset,
          archetype: preset.archetype ?? "custodian_elite",
          count: preset.count ?? 1,
          combat: {
            ...(preset.combat ?? {}),
            visual: {
              ...(preset.combat?.visual ?? {}),
              scaleMultiplier: 1,
            },
          },
        },
      ],
      doors: starter.doors.map((door) =>
        door.id === "door_d"
          ? {
              ...door,
              lockType: "survive_wave",
              surviveRobotIds: ["robot_reclamation_mother_legacy"],
              surviveRobotId: "robot_reclamation_mother_legacy",
            }
          : door,
      ),
    };

    const { level, issues } = compileBuilderProjectToLevel(project);

    expect(issues).toEqual([]);
    expect(level?.waves.flatMap((wave) => wave.enemies)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          visual: expect.objectContaining({
            modelKey: "hp_enemy_reclamation_mother_final_horror",
            scaleMultiplier: 0.83,
          }),
        }),
      ]),
    );
  });
});
