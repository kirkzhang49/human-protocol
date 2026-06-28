import type { OfficialBuilderDocument } from "../../../../build/official-builder/OfficialBuilderTypes";
import { validateLevelConfig } from "../../ConfigValidator";
import type { LevelDefinition } from "../../schema/levelConfig";
import { campaignEconomy, campaignPickupRules, campaignRevive, officialExitElevatorCinematic, sharedCampaignRoutes } from "../../shared/campaignDefaults";
import { requireOfficialBuilderLevel } from "../officialBuilderRuntime";
import level02OfficialBuilderDocumentJson from "./level.official.builder.json";
import { level02Map } from "./map";
import { level02Events, level02Objectives } from "./objectives";
import { level02Puzzles } from "./puzzles";
import { level02Articles, level02Dialogues } from "./story";
import { level02BossPhases, level02CinematicBeats, level02CombatLimits, level02EnemyDeathBeats, level02EnvironmentStates, level02SpawnGroups, level02Waves } from "./waves";
import { level02Presentation } from "./presentation";

export const legacyLevel02ResidentialSimulation: LevelDefinition = {
  id: "level_02_residential_simulation",
  title: "居住模拟间",
  spawnPoint: [0, 0, 14.6],
  initialInventory: {
    hasRod: true,
    hasPistol: true,
    equipWeapon: "pulseRifle",
  },
  initialWaveStartDelay: 0,
  requiresStoryPickupsBeforeWaves: false,
  exit: {
    id: "residential_exit",
    position: [0, 0, -11.05],
    radius: 2.6,
    unlockedLabel: "出口电梯",
    distanceLabel: "出口电梯",
    unlockMessage: "出口电梯打开。穿过客厅尽头的门。",
    unlockDialogueTrigger: "level_02_light_sequence_done",
    unlockWarning: {
      label: "出口电梯已开",
      detail: "穿过客厅尽头的门",
    },
    cinematic: officialExitElevatorCinematic({
      enterPosition: [0, 0, -11.35],
      faceYaw: 0,
      doorId: "level_02_family_exit_door",
      message: "出口电梯正在接管关卡切换。",
    }),
    transitionMessage: "电梯门合拢，住宅声场停止。",
    transitionDialogueTrigger: "exit_entered",
    victoryMessage: "居住记录：对象会回头寻找家。",
  },
  map: level02Map,
  puzzles: level02Puzzles,
  objectiveChain: level02Objectives,
  articles: level02Articles,
  waves: level02Waves,
  events: level02Events,
  environmentStates: level02EnvironmentStates,
  bossPhases: level02BossPhases,
  campaignRoutes: sharedCampaignRoutes,
  dialogues: level02Dialogues,
  spawnGroups: level02SpawnGroups,
  cinematicBeats: level02CinematicBeats,
  pickups: {
    ...campaignPickupRules,
    maxActiveDynamicPickups: 6,
    dynamicLifetimeSec: 60,
    storyPickups: [],
    drops: {
      ...campaignPickupRules.drops,
      repairKit: {
        ...campaignPickupRules.drops.repairKit,
        activeDropLimit: 1,
        baseChance: 0.012,
        eliteChance: 0.4,
      },
      coreCell: {
        ...campaignPickupRules.drops.coreCell,
        activeDropLimit: 1,
        eliteChance: 0.64,
      },
    },
  },
  economy: {
    ...campaignEconomy,
    curatedUpgradeRolls: [
      ["core_plating", "dash_shorter_cd", "field_medicine", "pulse_coolant_feed", "rail_overcharge"],
    ],
    memoryFragments: {
      ...campaignEconomy.memoryFragments,
      byArchetype: {
        ...campaignEconomy.memoryFragments.byArchetype,
        custodian_elite: 22,
      },
    },
  },
  revive: {
    ...campaignRevive,
    message: "你从客厅地板上醒来。门禁还在闪。",
  },
  combatLimits: level02CombatLimits,
  enemyDeathBeats: level02EnemyDeathBeats,
  presentation: level02Presentation,
};

export const level02ResidentialSimulation = requireOfficialBuilderLevel(
  level02OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  "Level 2",
);
export const level02ResidentialSimulationValidationReport = validateLevelConfig(level02ResidentialSimulation);
export const legacyLevel02ResidentialSimulationValidationReport = validateLevelConfig(legacyLevel02ResidentialSimulation);
