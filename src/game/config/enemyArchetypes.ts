export type EnemyArchetypeId =
  | "repair_drone"
  | "clamp_bot"
  | "shield_tech"
  | "signal_turret"
  | "custodian_elite";

export interface EnemyArchetype {
  id: EnemyArchetypeId;
  displayName: string;
  maxHealth: number;
  radius: number;
  moveSpeed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  threatWeight: number;
  visualKey: string;
  audioKey: string;
  shielded?: boolean;
  elite?: boolean;
}

export const enemyArchetypes: Record<EnemyArchetypeId, EnemyArchetype> = {
  repair_drone: {
    id: "repair_drone",
    displayName: "维修无人机",
    maxHealth: 150,
    radius: 0.58,
    moveSpeed: 2.35,
    damage: 1.45,
    attackRange: 3.2,
    attackCooldown: 1.65,
    threatWeight: 0.8,
    visualKey: "repair_drone_basic",
    audioKey: "enemy_repair_drone",
  },
  clamp_bot: {
    id: "clamp_bot",
    displayName: "夹击机器人",
    maxHealth: 180,
    radius: 0.72,
    moveSpeed: 2.65,
    damage: 2.08,
    attackRange: 2.9,
    attackCooldown: 1.45,
    threatWeight: 1.15,
    visualKey: "clamp_bot_side",
    audioKey: "enemy_clamp_bot",
  },
  shield_tech: {
    id: "shield_tech",
    displayName: "护盾技师",
    maxHealth: 220,
    radius: 0.68,
    moveSpeed: 1.75,
    damage: 2.08,
    attackRange: 3.4,
    attackCooldown: 1.8,
    threatWeight: 1.1,
    visualKey: "shield_tech_front",
    audioKey: "enemy_shield_tech",
    shielded: true,
  },
  signal_turret: {
    id: "signal_turret",
    displayName: "信标炮台",
    maxHealth: 140,
    radius: 0.64,
    moveSpeed: 0,
    damage: 1.51,
    attackRange: 8,
    attackCooldown: 3,
    threatWeight: 1.25,
    visualKey: "signal_turret_floor",
    audioKey: "enemy_signal_turret",
  },
  custodian_elite: {
    id: "custodian_elite",
    displayName: "维修主管",
    maxHealth: 3780,
    radius: 1.05,
    moveSpeed: 1.3,
    damage: 8.57,
    attackRange: 3.2,
    attackCooldown: 1.55,
    threatWeight: 2.2,
    visualKey: "custodian_elite_placeholder",
    audioKey: "enemy_custodian_elite",
    elite: true,
  },
};

export const enemyArchetypeVisualScaleMultipliers: Partial<Record<EnemyArchetypeId, number>> = {
  repair_drone: 1.2,
};
