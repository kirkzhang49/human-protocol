import type {
  CampaignRouteDefinition,
  CombatLimitConfig,
  LevelEconomyConfig,
  LevelExitCinematicDefinition,
  LevelPresentationConfig,
  PickupRulesConfig,
  ReviveConfig,
  SpawnGroupDefinition,
} from "../schema/levelConfig";

export const sharedCampaignRoutes: readonly CampaignRouteDefinition[] = [
  {
    id: "human_layer",
    label: "人类层",
    detail: "保留痛觉、恐惧、家庭与自我叙事。",
    color: "#7ff2ff",
  },
  {
    id: "repair_logic",
    label: "维修逻辑",
    detail: "接受身体的自动维修判断。",
    color: "#ffd36d",
  },
  {
    id: "unknown_signal",
    label: "未知频道",
    detail: "跟随非系统广播和隐藏档案。",
    color: "#ff6a52",
  },
];

export const armedInventory = {
  hasRod: true,
  hasPistol: true,
  coreCells: 1,
  equipWeapon: "pulseRifle" as const,
};

export const standardCombatLimits: CombatLimitConfig = {
  smallEnemyArchetypes: ["repair_drone", "clamp_bot"],
  eliteArchetypeId: "custodian_elite",
  smallEnemyDamageMultiplier: 1.3,
};

export const campaignSpawnGroups: readonly SpawnGroupDefinition[] = [
  { id: "front", label: "前方舱门", layout: "front" },
  { id: "front_arc", label: "前方舱门", layout: "front_arc" },
  { id: "side_rear", label: "侧后方夹击", layout: "side_rear" },
  { id: "front_gate", label: "正门重型单位", layout: "front_gate" },
  { id: "turret_rail", label: "左右轨道炮台", layout: "turret_rail" },
  { id: "around_ring", label: "四周通道", layout: "around_ring" },
  { id: "rear_ring", label: "后方追击队", layout: "rear_ring" },
];

export function officialExitElevatorCinematic(
  config: Pick<LevelExitCinematicDefinition, "enterPosition" | "doorId" | "message" | "faceYaw"> &
    Partial<
      Pick<
        LevelExitCinematicDefinition,
        | "lookAtPosition"
        | "lookAtPropId"
        | "doorOpenTime"
        | "doorCloseTime"
        | "buttonPressTime"
        | "buttonPressDuration"
        | "ascentStartTime"
        | "ascentDuration"
        | "whiteOutTime"
        | "duration"
        | "walkInDuration"
      >
    >,
): LevelExitCinematicDefinition {
  return {
    type: "elevator_walk_in",
    duration: 9.65,
    walkInDuration: 1.55,
    doorOpenTime: 0.08,
    doorCloseTime: 2.15,
    buttonPressTime: 3.25,
    buttonPressDuration: 1.15,
    ascentStartTime: 3.55,
    ascentDuration: 4.8,
    whiteOutTime: 8.35,
    ...config,
  };
}

export const campaignPickupRules: PickupRulesConfig = {
  maxActiveDynamicPickups: 3,
  dynamicLifetimeSec: 22,
  storyPickups: [],
  collectRadii: {
    coreCell: 2.45,
    repairKit: 2.25,
    ironRod: 1.65,
    pistol: 1.65,
    breachMissile: 1.85,
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
      eliteChance: 0.22,
      baseChance: 0.012,
      archetypeChanceBonus: {
        clamp_bot: 0.02,
      },
      missingHealthThreshold: 0.34,
      missingHealthBonus: 0.03,
      lowHealthBonuses: [
        { healthRatioAtMost: 0.4, bonus: 0.09 },
        { healthRatioAtMost: 0.24, bonus: 0.16 },
      ],
      lowHealthPity: [
        { healthRatioAtMost: 0.22, kills: 4 },
        { healthRatioAtMost: 0.32, kills: 7 },
      ],
    },
  },
};

export const demoPickupRules: PickupRulesConfig = {
  ...campaignPickupRules,
  maxActiveDynamicPickups: 6,
  dynamicLifetimeSec: 62,
  storyPickups: [],
  drops: {
    ...campaignPickupRules.drops,
    repairKit: {
      ...campaignPickupRules.drops.repairKit,
      activeDropLimit: 1,
      baseChance: 0.01,
      eliteChance: 0.26,
    },
    coreCell: {
      ...campaignPickupRules.drops.coreCell,
      activeDropLimit: 1,
      eliteChance: 0.58,
    },
  },
};

export const campaignEconomy: LevelEconomyConfig = {
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
};

export const campaignRevive: ReviveConfig = {
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
};

export const campaignPresentationBase: LevelPresentationConfig = {
  defaultWaveStartMessage: "敌对单位正在部署。",
  reinforcementMessage: "增援单位已部署。",
  waveLabels: {},
  objectives: {
    upgrade: { title: "选一种活法", detail: "只能选一项", progressLabel: "升级上线", progressText: "选 1 个" },
    preRod: { title: "捡起铁棒", detail: "别空手" },
    prePistol: { title: "捡起手枪", detail: "拿到枪，门会锁" },
    default: { title: "继续前进", detail: "目标还没完成" },
    exitUnlocked: { title: "进入出口", detail: "别清场", progressLabel: "撤离", progressText: "冲" },
  },
  flow: {
    title: {
      system: "异常生命信号",
      heading: "人类协议",
      body: "你醒在一段不该有人的协议里。",
      signalStrip: ["生命体征", "门禁", "无线电噪声"],
      startButton: "开始",
    },
    death: {
      system: "急救失败",
      heading: "你倒下了",
      itchSuffix: "itch 版本无广告。",
      reviveOfferPrefix: "醒来后有几秒肾上腺素爆发。",
      cacheReadyText: "补给已备好。",
      reviveButtonRewarded: "看广告急救",
      reviveButtonLocal: "急救",
      restartButton: "重开本关",
      restartAfterReviveUsedButton: "重新开始",
    },
    transition: {
      system: "出口",
      heading: "继续下行",
    },
    victory: {
      system: "档案片段",
      heading: "记录完成",
      body: "门合上了，下一层仍在亮。",
      doubleMemoryButton: "看广告 x2 积分",
      doubleMemoryClaimedButton: "x2 积分已领取",
      replayButton: "再来一次",
    },
  },
  waves: [],
  spawnSourceLabels: {
    front: "前方入口",
    front_arc: "前方入口",
    side_rear: "侧后方夹击",
    front_gate: "正门重型单位",
    turret_rail: "左右轨道炮台",
    around_ring: "四周通道",
    rear_ring: "后方追击队",
  },
  reinforcementWarningDuration: 1.45,
  environmentPressure: {
    title: 0.16,
    death: 0.95,
    idle: 0.24,
    exitUnlocked: 0.84,
    byWave: {},
  },
};
