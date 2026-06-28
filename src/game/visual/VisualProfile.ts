export type FallbackPrimitive = "box" | "sphere" | "cylinder" | "hybrid";

export interface VisualProfile {
  visualKey: string;
  modelKey?: string;
  textureAtlasKey?: string;
  materialKey: string;
  fallbackPrimitive: FallbackPrimitive;
  scale: number;
}

export const enemyVisualProfiles: Record<string, VisualProfile> = {
  repair_drone_basic: {
    visualKey: "repair_drone_basic",
    modelKey: "hp_enemy_repair_drone_horror",
    materialKey: "maintenance_red",
    fallbackPrimitive: "hybrid",
    scale: 0.55,
  },
  clamp_bot_side: {
    visualKey: "clamp_bot_side",
    modelKey: "hp_enemy_clamp_repair_horror",
    materialKey: "clamp_red",
    fallbackPrimitive: "hybrid",
    scale: 0.64,
  },
  shield_tech_front: {
    visualKey: "shield_tech_front",
    modelKey: "hp_enemy_shield_technician_horror",
    materialKey: "shield_blue",
    fallbackPrimitive: "hybrid",
    scale: 0.76,
  },
  signal_turret_floor: {
    visualKey: "signal_turret_floor",
    materialKey: "signal_cyan",
    fallbackPrimitive: "cylinder",
    scale: 0.72,
  },
  custodian_elite_placeholder: {
    visualKey: "custodian_elite_placeholder",
    modelKey: "hp_enemy_custodian_foreman_horror",
    materialKey: "custodian_gold_red",
    fallbackPrimitive: "hybrid",
    scale: 1.12,
  },
};

export const weaponVisualProfiles: Record<string, VisualProfile> = {
  weapon_pulse_rifle_viewmodel: {
    visualKey: "weapon_pulse_rifle_viewmodel",
    materialKey: "pulse_cyan_gunmetal",
    fallbackPrimitive: "hybrid",
    scale: 0.9,
  },
  weapon_rail_lance_viewmodel: {
    visualKey: "weapon_rail_lance_viewmodel",
    materialKey: "rail_gold_gunmetal",
    fallbackPrimitive: "hybrid",
    scale: 0.88,
  },
  weapon_shock_burst_viewmodel: {
    visualKey: "weapon_shock_burst_viewmodel",
    materialKey: "shock_red_gunmetal",
    fallbackPrimitive: "hybrid",
    scale: 0.88,
  },
};

export const sceneVisualProfiles: Record<string, VisualProfile> = {
  maintenance_floor_grid: {
    visualKey: "maintenance_floor_grid",
    materialKey: "cold_floor_grid",
    fallbackPrimitive: "box",
    scale: 1,
  },
  maintenance_crate: {
    visualKey: "maintenance_crate",
    materialKey: "dark_service_crate",
    fallbackPrimitive: "box",
    scale: 1,
  },
  service_elevator_exit: {
    visualKey: "service_elevator_exit",
    materialKey: "cyan_exit_pad",
    fallbackPrimitive: "cylinder",
    scale: 1,
  },
};
