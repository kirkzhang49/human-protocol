import type { GameWorld } from "../../game/core/GameWorld";
import { pickupVisualIntentForType, type VisualVec3 } from "../../game/visual/PickupVisualIntent";
import { clamp } from "./RawWebGpuMath";
import type { RawPlanGeometryAsset, RawPlanInstance, Tuple3, Tuple4 } from "./RawWebGpuTypes";

export interface PickupGeometryDefinition {
  modelKey: string;
  localYOffset: number;
  scale: number | Tuple3;
  rotation?: Tuple3;
  localOffset?: Tuple3;
}

export function planShadowFor(instance: RawPlanInstance) {
  if (!shouldPlanInstanceCastCheapShadow(instance)) return null;
  const halfSize = instance.estimatedBounds.halfSize;
  const center = instance.estimatedBounds.center;
  const footprint = halfSize[0] * halfSize[2] * 4;
  if (footprint < 0.035) return null;

  const role = instance.role;
  const height = halfSize[1] * 2;
  const lowCase = role === "prop" && height <= 1.08 && footprint > 0.42;
  const tallMuseumProp = role === "prop" && height > 1.08;
  const isGlassLike = /glass|case|display|booth|window|archive|exhibit/i.test(`${instance.modelKey}:${instance.id}:${role}`);
  const isDoor = role === "door_leaf" || role === "door_panel";
  const isPickup = role === "key_item" || role.startsWith("pickup_");
  const isInteraction = role.startsWith("interaction_");
  const receiverY = center[1] - halfSize[1];
  const heightFade = clamp(height / 2.4, 0.18, 1.0);
  const contactLift = clamp(receiverY, -0.06, 0.12);
  const castX = clamp(height * (tallMuseumProp ? 0.075 : lowCase ? 0.040 : 0.105), 0.018, 0.24);
  const castZ = -clamp(height * (lowCase || isGlassLike ? 0.036 : 0.072), 0.016, 0.18);
  const baseOpacity =
    role === "pillar"
      ? 0.30
      : isDoor
        ? 0.26
        : isPickup
          ? 0.22
          : isInteraction
            ? 0.20
            : tallMuseumProp
              ? 0.28
              : lowCase
                ? 0.18
                : 0.22;
  const materialSoftness = isGlassLike ? 0.94 : isPickup ? 0.72 : isDoor ? 0.96 : 1.0;
  const shadowOpacity = clamp(baseOpacity * (0.90 + heightFade * 0.42) * materialSoftness, 0.10, 0.42);
  const footprintX = halfSize[0] * (lowCase ? 2.86 : isDoor ? 2.04 : 2.28);
  const footprintZ = halfSize[2] * (lowCase ? 2.68 : isDoor ? 1.62 : 2.02);
  const heightSpread = height * (lowCase ? 0.050 : tallMuseumProp ? 0.085 : 0.065);
  return {
    x: center[0] + castX,
    y: receiverY + 0.018 + Math.max(0, contactLift) * 0.12,
    z: center[2] + castZ,
    sizeX: clamp(footprintX + heightSpread + 0.20, isPickup ? 0.30 : 0.44, 4.9),
    sizeZ: clamp(footprintZ + heightSpread * 0.72 + 0.18, isPickup ? 0.24 : 0.34, 4.1),
    opacity: shadowOpacity,
  };
}

export function shouldPlanInstanceCastCheapShadow(instance: RawPlanInstance) {
  if (instance.role === "floor" || instance.role === "wall" || instance.role === "ceiling" || instance.role === "wall_wash_light_mesh") return false;
  if (instance.role === "pillar" || instance.role === "door_leaf" || instance.role === "door_panel" || instance.role === "key_item") return true;
  if (instance.role.startsWith("interaction_") || instance.role.startsWith("pickup_")) return true;
  return instance.role === "prop";
}

export function pickupGeometryForType(type: GameWorld["pickups"][number]["type"]): PickupGeometryDefinition | null {
  const intent = pickupVisualIntentForType(type);
  if (!intent) return null;
  return {
    modelKey: intent.modelKey,
    localYOffset: intent.raw.localYOffset,
    scale: scalarOrTuple3(intent.raw.scale),
    rotation: tuple3(intent.raw.rotation),
    localOffset: tuple3(intent.raw.localOffset),
  };
}

function scalarOrTuple3(value: number | VisualVec3): number | Tuple3 {
  return typeof value === "number" ? value : tuple3(value);
}

function tuple3(value: VisualVec3): Tuple3;
function tuple3(value: VisualVec3 | undefined): Tuple3 | undefined;
function tuple3(value: VisualVec3 | undefined) {
  return value ? [value[0], value[1], value[2]] : undefined;
}

export function enemyTintFor(enemy: GameWorld["enemies"][number]): Tuple4 {
  const windup = rawEnemyAttackWindupProgress(enemy);
  const stagger = rawEnemyStaggerProgress(enemy);
  const flash = clamp(Math.max(enemy.damageFlash, enemy.hitReact * 0.74, windup * 0.55, stagger * 0.92), 0, 1);
  const wounded = clamp(1 - enemy.health / Math.max(0.001, enemy.maxHealth), 0, 1);
  const alpha = 0.075 + flash * 0.34 + wounded * 0.08;
  const configuredTint = configuredEnemyTint(enemy);
  if (configuredTint) {
    const warmth = enemy.tier === "leader" || enemy.tier === "boss" || enemy.textureAtlasKey === "custodian_boss" ? 0.08 : 0.04;
    return [
      configuredTint[0] + flash * 0.18,
      configuredTint[1] + flash * 0.11 + warmth,
      configuredTint[2] + flash * 0.08,
      alpha + warmth,
    ];
  }

  if (enemy.archetypeId === "repair_drone") {
    return [0.94 + flash * 0.22, 1.08 + flash * 0.1, 1.12 + flash * 0.08, alpha];
  }
  if (enemy.archetypeId === "shield_tech") {
    return [0.9 + flash * 0.22, 1.03 + flash * 0.12, 1.18 + flash * 0.08, alpha + 0.04];
  }
  if (enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss") {
    return [1.04 + flash * 0.18, 0.96 + flash * 0.1, 0.84 + flash * 0.06, alpha + 0.06];
  }
  if (enemy.archetypeId === "clamp_bot") {
    return [1.04 + flash * 0.18, 0.98 + flash * 0.08, 0.9 + flash * 0.05, alpha + 0.02];
  }
  return [1.0 + flash * 0.16, 1.02 + flash * 0.08, 1.02 + flash * 0.06, alpha];
}

function configuredEnemyTint(enemy: GameWorld["enemies"][number]): Tuple3 | null {
  const core = colorStringToRgb(enemy.coreColor);
  const warning = colorStringToRgb(enemy.warningColor);
  if (!core && !warning) return null;
  const fallback = enemy.archetypeId === "shield_tech" ? ([0.48, 0.96, 0.98] as Tuple3) : ([0.72, 0.92, 0.9] as Tuple3);
  const coreRgb = core ?? fallback;
  const warningRgb = warning ?? coreRgb;
  const warningWeight = enemy.tier === "leader" || enemy.tier === "boss" || enemy.textureAtlasKey === "custodian_boss" ? 0.42 : 0.18;
  return [
    coreRgb[0] * (1 - warningWeight) + warningRgb[0] * warningWeight,
    coreRgb[1] * (1 - warningWeight) + warningRgb[1] * warningWeight,
    coreRgb[2] * (1 - warningWeight) + warningRgb[2] * warningWeight,
  ];
}

function colorStringToRgb(color: string | undefined): Tuple3 | null {
  const match = /^#?([0-9a-f]{6})$/iu.exec(color ?? "");
  if (!match) return null;
  const value = match[1];
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

export function rawEnemyAttackKick(enemy: GameWorld["enemies"][number], cooldown: number) {
  const stagger = rawEnemyStaggerProgress(enemy);
  if (stagger > 0) return Math.sin(stagger * Math.PI) * (enemy.tier === "boss" ? 0.86 : 0.68);
  const windup = rawEnemyAttackWindupProgress(enemy);
  if (windup > 0) return Math.sin(windup * Math.PI * 0.5) * 0.88;
  const attackWindow = 0.5;
  const sinceAttack = cooldown - enemy.attackCooldownRemaining;
  if (sinceAttack < 0 || sinceAttack > attackWindow) return 0;
  return Math.sin((sinceAttack / attackWindow) * Math.PI);
}

function rawEnemyAttackWindupProgress(enemy: GameWorld["enemies"][number]) {
  if (enemy.attackWindupTotal <= 0 || enemy.attackWindupRemaining <= 0) return 0;
  return clamp(1 - enemy.attackWindupRemaining / enemy.attackWindupTotal, 0, 1);
}

function rawEnemyStaggerProgress(enemy: GameWorld["enemies"][number]) {
  if (enemy.staggerTotal <= 0 || enemy.staggerRemaining <= 0) return 0;
  return clamp(1 - enemy.staggerRemaining / enemy.staggerTotal, 0, 1);
}

export function canUseRigidNodePalette(geometry: Pick<RawPlanGeometryAsset, "rigidSkin" | "nodeChunks">) {
  const rigidSkin = geometry.rigidSkin;
  if (rigidSkin?.mode !== "rigid-node-palette" || rigidSkin.jointCount <= 0) return false;
  const chunks = geometry.nodeChunks ?? [];
  const inverseBindByNode = new Map<number, number[]>();
  for (const chunk of chunks) {
    const nodeIndex = chunk.nodeIndex;
    if (nodeIndex === null || nodeIndex < 0 || nodeIndex >= rigidSkin.jointCount) return false;
    if (chunk.inverseBindMatrix.length !== 16) return false;
    const previous = inverseBindByNode.get(nodeIndex);
    if (previous && !matrixAlmostEqual(previous, chunk.inverseBindMatrix)) return false;
    inverseBindByNode.set(nodeIndex, chunk.inverseBindMatrix);
  }
  return true;
}

function matrixAlmostEqual(a: number[], b: number[]) {
  for (let index = 0; index < 16; index += 1) {
    if (Math.abs((a[index] ?? 0) - (b[index] ?? 0)) > 0.00001) return false;
  }
  return true;
}
