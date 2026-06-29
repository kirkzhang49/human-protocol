import type { BuilderRobotGroup, BuilderRobotPresetId } from "./BuilderTypes";

const RECLAMATION_MOTHER_BOSS_MODEL_KEY = "hp_enemy_reclamation_mother_final_horror";
const RECLAMATION_MOTHER_BOSS_SCALE_MULTIPLIER = 0.83;

export function builderRobotPresetDefaults(presetId: BuilderRobotPresetId): Partial<BuilderRobotGroup> {
  if (presetId === "museum_curator_boss") {
    return {
      presetId,
      archetype: "shield_tech",
      count: 1,
      tier: "leader",
      combat: {
        tierLabel: "策展主管",
        healthMultiplier: 6.63,
        damageMultiplier: 1.28,
        visual: {
          modelKey: "hp_enemy_shield_technician_horror",
          coreColor: "#ff6a52",
          warningColor: "#ffd36d",
          textureAtlasKey: "custodian_boss",
          scaleMultiplier: 0.94,
          lightIntensityMultiplier: 1.35,
        },
      },
    };
  }
  if (presetId === "reclamation_mother_boss") {
    return {
      presetId,
      archetype: "custodian_elite",
      count: 1,
      tier: "boss",
      combat: {
        tierLabel: "回收母体",
        healthMultiplier: 9.2,
        damageMultiplier: 1.54,
        attackCooldownMultiplier: 0.86,
        attackRangeMultiplier: 1.22,
        radiusMultiplier: 1.18,
        threatWeightMultiplier: 2.2,
        visual: {
          modelKey: RECLAMATION_MOTHER_BOSS_MODEL_KEY,
          coreColor: "#68d4ff",
          warningColor: "#7bdfff",
          textureAtlasKey: "custodian_boss",
          scaleMultiplier: RECLAMATION_MOTHER_BOSS_SCALE_MULTIPLIER,
          lightIntensityMultiplier: 1.55,
        },
      },
    };
  }
  return {};
}

export function isBuilderRobotPresetId(value: unknown): value is BuilderRobotPresetId {
  return value === "museum_curator_boss" || value === "reclamation_mother_boss";
}

export function isMuseumCuratorBossRobot(robot: Pick<BuilderRobotGroup, "presetId" | "combat">) {
  return robot.presetId === "museum_curator_boss" || robot.combat?.tierLabel === "策展主管";
}

export function isReclamationMotherBossRobot(robot: Pick<BuilderRobotGroup, "presetId" | "combat">) {
  return (
    robot.presetId === "reclamation_mother_boss" ||
    robot.combat?.tierLabel === "回收母体" ||
    robot.combat?.visual?.modelKey === RECLAMATION_MOTHER_BOSS_MODEL_KEY
  );
}

export function isBuilderRobotPresetActive(robot: Pick<BuilderRobotGroup, "presetId" | "combat">, presetId: BuilderRobotPresetId) {
  if (robot.presetId === presetId) return true;
  if (presetId === "museum_curator_boss") return isMuseumCuratorBossRobot(robot);
  return presetId === "reclamation_mother_boss" && isReclamationMotherBossRobot(robot);
}

export function normalizedBuilderRobotCombat(robot: Pick<BuilderRobotGroup, "presetId" | "combat">): BuilderRobotGroup["combat"] {
  if (!isReclamationMotherBossRobot(robot)) return robot.combat;
  const defaultCombat = builderRobotPresetDefaults("reclamation_mother_boss").combat;
  return {
    ...(defaultCombat ?? {}),
    ...(robot.combat ?? {}),
    visual: {
      ...(defaultCombat?.visual ?? {}),
      ...(robot.combat?.visual ?? {}),
      scaleMultiplier: RECLAMATION_MOTHER_BOSS_SCALE_MULTIPLIER,
    },
  };
}
