import type { GameLanguage } from "../core/GameSettings";
import type { UpgradeDefinition } from "./upgradePool";

const englishUpgrades: Record<string, Partial<Pick<UpgradeDefinition, "title" | "role" | "description">>> = {
  pulse_faster_cycle: {
    title: "Arm Strength",
    role: "Body upgrade",
    description: "Iron rod swing speed +18%, with slightly lower stamina cost. Best for close pressure.",
  },
  pulse_coolant_feed: {
    title: "Efficient Swing",
    role: "Body upgrade",
    description: "Iron rod stamina cost drops hard. If stamina stays up, melee rhythm stays alive.",
  },
  pulse_chain_mark: {
    title: "Fight Instinct",
    role: "Melee route",
    description: "Rod kills restore stamina and widen close-range assist. More enemies means more reason to push forward.",
  },
  rail_overcharge: {
    title: "Fast Reload",
    role: "Pistol route",
    description: "Reload much faster and pistol damage +18%. Good for backing up while picking off heavy units.",
  },
  rail_double_line: {
    title: "Steady Breath",
    role: "Pistol route",
    description: "Your breathing steadies: the pistol fires a second parallel round for shield breaks and distant units.",
  },
  shock_shorter_cd: {
    title: "Quick Cell Load",
    role: "Item skill",
    description: "Gain 1 emergency cell now. Item recovery -18%, giving you one button to clear space when surrounded.",
  },
  shock_repair_ping: {
    title: "First-Aid Cell",
    role: "Item skill",
    description: "Emergency cell hits restore health and push nearby robots farther back.",
  },
  core_cell_damage: {
    title: "High-Voltage Cell",
    role: "Item burst",
    description: "Emergency cell damage +28% and harder knockback. Save it for when being surrounded matters.",
  },
  core_cell_preserve: {
    title: "Residual Charge",
    role: "Item burst",
    description: "After using an emergency cell, 26% chance it is not fully consumed. Enables later cell builds.",
  },
  shock_memory_echo: {
    title: "Strange Echo",
    role: "Story prototype",
    description: "When using an emergency cell, the broadcast briefly reveals what it really wanted to say.",
  },
  core_plating: {
    title: "Heart Reinforced",
    role: "Survival route",
    description: "Your heartbeat feels heavier: max health +30 and immediately restore a chunk.",
  },
  servo_stride: {
    title: "Survival Stride",
    role: "Movement route",
    description: "Your legs finally listen: movement speed +10%, easier to escape flanks and rush exits.",
  },
  turn_assist: {
    title: "Turn Assist",
    role: "Mobile friendly",
    description: "Threat-turn speed +15%. Tapping the red arc gets you back on target faster.",
  },
  wide_target_cone: {
    title: "Wide Lock Cone",
    role: "Aim assist",
    description: "Auto-lock cone +4 degrees. Aim less, move more.",
  },
  thermal_buffer: {
    title: "Deep Breath",
    role: "Stamina route",
    description: "Stamina max +16 and rod cost slightly lower. Good for rod swings plus dash.",
  },
  dash_shorter_cd: {
    title: "Short Dash",
    role: "Movement route",
    description: "Dash cooldown -28%. Easier to break out when flanked from the side or rear.",
  },
  field_medicine: {
    title: "Field Medicine",
    role: "Survival route",
    description: "Med-kit recovery +35%. Low-health drops become more valuable and forgiving.",
  },
  last_human_protocol: {
    title: "Residual Reflex",
    role: "Counter-kill safety",
    description: "At low health, automatically trigger one emergency burst and create a counter-kill window.",
  },
};

export function localizedUpgrade(upgrade: UpgradeDefinition, language: GameLanguage): UpgradeDefinition {
  if (language !== "en") return upgrade;
  return { ...upgrade, ...englishUpgrades[upgrade.id] };
}

export function localizedUpgradeRarity(rarity: UpgradeDefinition["rarity"], language: GameLanguage) {
  if (language === "en") return rarity;
  if (rarity === "Prototype") return "原型";
  if (rarity === "Epic") return "史诗";
  if (rarity === "Rare") return "稀有";
  return "普通";
}
