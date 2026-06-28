import type { OfficialBuilderDocument } from "../../../../build/official-builder/OfficialBuilderTypes";
import { validateLevelConfig } from "../../ConfigValidator";
import type { LevelDefinition } from "../../schema/levelConfig";
import { officialExitElevatorCinematic, sharedCampaignRoutes } from "../../shared/campaignDefaults";
import { requireOfficialBuilderLevel } from "../officialBuilderRuntime";
import level01OfficialBuilderDocumentJson from "./level.official.builder.json";
import { level01Map } from "./map";
import { level01Events, level01Objectives } from "./objectives";
import { level01Articles, level01Dialogues } from "./story";
import { level01BossPhases, level01CinematicBeats, level01CombatLimits, level01EnemyDeathBeats, level01EnvironmentStates, level01SpawnGroups, level01Waves } from "./waves";
import { level01Presentation } from "./presentation";

export const legacyLevel01MaintenanceBay: LevelDefinition = {
  id: "level_01_maintenance_bay",
  title: "维修舱",
  spawnPoint: [0, 0, 8],
  initialInventory: {
    hasRod: true,
    hasPistol: true,
    equipWeapon: "railLance",
  },
  initialWaveStartDelay: 1.1,
  requiresStoryPickupsBeforeWaves: false,
  exit: {
    id: "service_elevator",
    position: [0, 0, -16.3],
    radius: 2.1,
    unlockedLabel: "维修电梯",
    distanceLabel: "维修电梯",
    unlockMessage: "维修电梯已解锁。",
    unlockDialogueTrigger: "exit_unlocked",
    unlockWarning: {
      label: "门已开",
      detail: "镜头已转向维修电梯：冲进去",
    },
    cinematic: officialExitElevatorCinematic({
      enterPosition: [0, 0, -16.45],
      faceYaw: 0,
      doorId: "service_elevator_door",
      message: "维修电梯正在接管关卡切换。",
    }),
    transitionMessage: "电梯没有上行。它把你送向更深处，广播里忽然混进柔和的人声。",
    transitionDialogueTrigger: "exit_entered",
    victoryMessage: "档案残缺：有一段记录被涂黑了。",
  },
  map: level01Map,
  objectiveChain: level01Objectives,
  puzzles: [],
  articles: level01Articles,
  waves: level01Waves,
  events: level01Events,
  environmentStates: level01EnvironmentStates,
  bossPhases: level01BossPhases,
  campaignRoutes: sharedCampaignRoutes,
  dialogues: level01Dialogues,
  spawnGroups: level01SpawnGroups,
  cinematicBeats: level01CinematicBeats,
  pickups: {
    maxActiveDynamicPickups: 3,
    dynamicLifetimeSec: 22,
    storyPickups: [],
    collectRadii: {
      coreCell: 2.45,
      repairKit: 2.25,
      ironRod: 1.65,
      pistol: 1.65,
    },
    repairKit: {
      minMissingHealthToCollect: 3,
      healAmount: 24,
      rewardLabel: "拾取修复箱",
    },
    coreCell: {
      maxHeld: 1,
      pickupLabel: "拾取应急电池",
      pickupDetailPrefix: "物品",
      useLabel: "应急电池释放",
      useDetail: "一次性清场冲击",
      preservedLabel: "电池余电",
      preservedDetail: "这枚电池没有完全耗尽",
      upgradeInsertedLabel: "应急电池装入",
      emptyUseReward: {
        label: "没有应急电池",
        detail: "电池很少，留给被包围时",
        rarity: "common",
      },
    },
    drops: {
      coreCell: {
        activeDropLimit: 1,
        pityKills: 18,
        minKillsForPity: 16,
        eliteChance: 0.72,
        archetypeChances: {
          clamp_bot: { minKills: 12, chance: 0.07 },
          repair_drone: { minKills: 16, chance: 0.018 },
        },
      },
      repairKit: {
        activeDropLimit: 1,
        minMissingHealth: 14,
        eliteChance: 0.28,
        baseChance: 0.02,
        archetypeChanceBonus: {
          clamp_bot: 0.035,
        },
        missingHealthThreshold: 0.34,
        missingHealthBonus: 0.045,
        lowHealthBonuses: [
          { healthRatioAtMost: 0.42, bonus: 0.16 },
          { healthRatioAtMost: 0.26, bonus: 0.28 },
        ],
        lowHealthPity: [
          { healthRatioAtMost: 0.24, kills: 2 },
          { healthRatioAtMost: 0.34, kills: 4 },
        ],
      },
    },
  },
  economy: {
    memoryFragments: {
      default: 1,
      byArchetype: {
        custodian_elite: 18,
        signal_turret: 3,
        clamp_bot: 2,
      },
    },
    killStreakWindowSec: 3.8,
    memoryCacheMilestones: [
      { amount: 10, label: "体力恢复", reward: "energy", rarity: "rare" },
      { amount: 28, label: "呼吸变稳", reward: "heat", rarity: "rare" },
      { amount: 52, label: "生命上限恢复", reward: "health", rarity: "epic" },
    ],
    curatedUpgradeRolls: [
      [
        "pulse_faster_cycle",
        "pulse_coolant_feed",
        "rail_overcharge",
        "core_plating",
        "servo_stride",
        "wide_target_cone",
        "thermal_buffer",
        "dash_shorter_cd",
        "field_medicine",
      ],
      [
        "shock_repair_ping",
        "shock_shorter_cd",
        "core_cell_damage",
        "core_cell_preserve",
        "pulse_chain_mark",
        "rail_double_line",
        "last_human_protocol",
        "dash_shorter_cd",
        "field_medicine",
      ],
    ],
    tempoSurge: {
      eliteDuration: 6.5,
      normalThreshold: 5,
      tier2Threshold: 10,
      tier1Duration: 4.4,
      tier2Duration: 5.8,
      tier1HeatRefund: 7,
      tier2HeatRefund: 12,
      tier1EnergyRefund: 7,
      tier2EnergyRefund: 12,
    },
  },
  revive: {
    maxRevives: 1,
    hpRatio: 0.7,
    memoryFragments: 12,
    reviveSurgeSec: 9.5,
    tempoSurgeSec: 5.5,
    blastRadius: 6.5,
    blastDamage: 80,
    blastKnockback: 6,
    rewardPulse: {
      label: "第二口气",
      detail: "+线索 + 短暂爆发",
      rarity: "story",
    },
    rewardPulseDuration: 2.4,
    message: "你又醒了。几秒内全身发热。",
  },
  combatLimits: level01CombatLimits,
  enemyDeathBeats: level01EnemyDeathBeats,
  presentation: level01Presentation,
};

export const level01MaintenanceBay = requireOfficialBuilderLevel(
  level01OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  "Level 1",
);
export const level01MaintenanceBayValidationReport = validateLevelConfig(level01MaintenanceBay);
export const legacyLevel01MaintenanceBayValidationReport = validateLevelConfig(legacyLevel01MaintenanceBay);
