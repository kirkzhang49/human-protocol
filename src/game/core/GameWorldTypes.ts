import { Vector2 } from "three";
import type { LevelObjectiveTriggerDefinition } from "../config/schema/levelConfig";
import type { WeaponId } from "../config/weaponConfig";

export interface TouchInputState {
  move: Vector2;
  lookDelta: Vector2;
  fire: boolean;
  sprint: boolean;
  dashPressed: boolean;
  interactPressed: boolean;
  shockPressed: boolean;
  switchWeaponPressed: boolean;
  selectedWeapon: WeaponId | null;
  requestedThreatTurnAngle: number | null;
}

export interface UpgradeModifiers {
  pulseFireRateMultiplier: number;
  pulseHeatMultiplier: number;
  pulseKillHeatRefund: number;
  railDamageMultiplier: number;
  railHeatMultiplier: number;
  railExtraLine: boolean;
  railPierceBonus: number;
  railExecuteThreshold: number;
  shockCooldownMultiplier: number;
  shockRepairPing: boolean;
  shockHealPerHit: number;
  shockKnockbackMultiplier: number;
  coreCellDamageMultiplier: number;
  coreCellKeepChance: number;
  bladeEnergyCostMultiplier: number;
  repairKitHealMultiplier: number;
  dashCooldownMultiplier: number;
  memoryEcho: boolean;
  moveSpeedMultiplier: number;
  turnAssistMultiplier: number;
  lowHealthAutoShock: boolean;
  lowHealthAutoShockUsed: boolean;
}

export interface ObjectiveEvent {
  type: LevelObjectiveTriggerDefinition["type"];
  id?: string;
  optionId?: string;
  value?: number;
}

export interface RuntimeDebugOptions {
  qaPlaythrough: boolean;
  noPlayerDamage: boolean;
  physicsMode: "legacy" | "rapier";
  physicsDualRun: boolean;
}
