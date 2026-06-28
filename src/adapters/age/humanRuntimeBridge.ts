import {
  AGE_SCENE_FRAME_SCHEMA_VERSION,
  validateAgeSceneFrameRuntime,
  type AgeAdapterResult,
  type AgeAnimationStateRecord,
  type AgeAssetRegistry,
  type AgeContactRecord,
  type AgeDrawBatch,
  type AgeLightingFrame,
  type AgeMat4,
  type AgeParticleEmitterRecord,
  type AgePortalStateRecord,
  type AgeProjectileRecord,
  type AgeSceneFrame,
  type AgeSceneInstance,
  type AgeTuple3,
  type AgeViewport,
} from "@age/render-webgpu";
import type { GameWorld } from "../../game/core/GameWorld";

/**
 * Converts authoritative Human Protocol GameWorld frame state into a generic
 * AGE scene frame. This is the only adapter file that understands runtime
 * world state. Weapon/effect/pickup/enemy semantics are mapped to generic
 * kinds, colors, and roles here, before any engine code sees them.
 *
 * The bridge consumes a structural view of GameWorld so smoke tests can feed
 * it plain objects; HumanAgeWorldViewCheck (below) guarantees at compile time
 * that the real GameWorld satisfies the view.
 */

interface HumanVec3View {
  x: number;
  y: number;
  z: number;
}

export interface HumanAgeWorldView {
  frameIndex: number;
  level: {
    id: string;
    map?: { doors: readonly { id: string }[] };
  };
  player: { position: HumanVec3View };
  enemies: readonly {
    id: number;
    archetypeId: string;
    position: HumanVec3View;
    velocity: HumanVec3View;
    radius: number;
    rotationY: number;
    isAlive: boolean;
    spawnAge: number;
    hitReact: number;
    deathAge: number;
    visualScaleMultiplier: number;
    modelKey?: string;
  }[];
  pickups: readonly {
    id: number;
    type: string;
    position: HumanVec3View;
    age: number;
    collected: boolean;
  }[];
  projectiles: readonly {
    id: number;
    weaponId: string;
    position: HumanVec3View;
    direction: HumanVec3View;
    radius: number;
    age: number;
    lifetime: number;
    damage: number;
  }[];
  effects: readonly {
    id: number;
    type: string;
    position: HumanVec3View;
    direction: HumanVec3View;
    age: number;
    lifetime: number;
    intensity: number;
  }[];
  renderPerformance: { quality: { tier: "high" | "balanced" | "rescue" } };
  isDoorOpen(doorId: string): boolean;
}

type AssertWorldView<T extends HumanAgeWorldView> = T;
/** Compile-time proof that GameWorld satisfies the bridge's structural view. */
export type HumanAgeWorldViewCheck = AssertWorldView<GameWorld>;

export interface HumanAgeCameraView {
  viewMatrix: AgeMat4;
  projectionMatrix: AgeMat4;
  viewProjectionMatrix: AgeMat4;
  position: HumanVec3View;
}

export interface HumanAgeSceneFrameInput {
  world: HumanAgeWorldView;
  camera: HumanAgeCameraView;
  viewport: AgeViewport;
  deltaSeconds: number;
  elapsedSeconds: number;
  /** Static lighting frame from humanAgeBaseLightingFrame(); local lights appended upstream. */
  lighting?: AgeLightingFrame;
  /** Registry from registerHumanAgeAssets(); used to resolve dynamic geometry draw ranges. */
  assets?: AgeAssetRegistry;
}

const RAW_ENEMY_HIDE_DEATH_AGE = 1.05;
const PROXY_CUBE_VERTEX_COUNT = 36;

const HUMAN_WEAPON_VFX: Record<string, { kind: string; color: AgeTuple3 }> = {
  pulseRifle: { kind: "bolt", color: [0.45, 0.92, 1] },
  railLance: { kind: "beam", color: [1, 0.56, 0.82] },
  flakBurst: { kind: "burst", color: [1, 0.72, 0.35] },
};

const HUMAN_EFFECT_VFX: Record<string, { kind: string; color: AgeTuple3 }> = {
  muzzleFlash: { kind: "flash", color: [1, 0.85, 0.5] },
  hitSpark: { kind: "spark", color: [1, 0.7, 0.35] },
  dashBurst: { kind: "burst", color: [0.5, 0.85, 1] },
  bladeSlash: { kind: "slash", color: [0.9, 0.95, 1] },
  shockwave: { kind: "shockwave", color: [0.42, 0.92, 1] },
};

/** True while the raw renderer still draws a dead enemy's fade-out. */
export function humanEnemyRenderable(enemy: HumanAgeWorldView["enemies"][number]) {
  return enemy.isAlive || enemy.deathAge < RAW_ENEMY_HIDE_DEATH_AGE;
}

/**
 * Derived grounded-contact records for every renderable dynamic entity.
 * Shared by the runtime bridge and the raw renderer's AGE grounding path so
 * both see identical contact data. Source stays "derived" until GameWorld
 * tracks authoritative grounded state.
 */
export function humanAgeContactsFromWorld(world: HumanAgeWorldView): AgeContactRecord[] {
  const contacts: AgeContactRecord[] = [];
  for (const enemy of world.enemies) {
    if (!humanEnemyRenderable(enemy)) continue;
    const scale = Math.max(0.05, enemy.visualScaleMultiplier);
    const deathFade = enemy.isAlive ? 1 : Math.max(0, 1 - enemy.deathAge / RAW_ENEMY_HIDE_DEATH_AGE);
    contacts.push({
      id: `contact:enemy:${enemy.id}`,
      instanceId: `enemy:${enemy.id}`,
      position: [enemy.position.x, enemy.position.y + 0.02, enemy.position.z],
      halfExtents: [Math.max(0.4, enemy.radius * 1.8 * scale), Math.max(0.3, enemy.radius * 1.3 * scale)],
      strength: 0.26 * deathFade,
      grounded: true,
      source: "derived",
      kind: "character",
    });
  }
  for (const pickup of world.pickups) {
    if (pickup.collected) continue;
    contacts.push({
      id: `contact:pickup:${pickup.id}`,
      instanceId: `pickup:${pickup.id}`,
      position: [pickup.position.x, pickup.position.y + 0.018, pickup.position.z],
      halfExtents: [0.46, 0.34],
      strength: 0.16,
      grounded: true,
      source: "derived",
      kind: "pickup",
    });
  }
  return contacts;
}

export function createHumanAgeSceneFrame(input: HumanAgeSceneFrameInput): AgeAdapterResult<AgeSceneFrame> {
  const { world } = input;
  const warnings: string[] = [];
  const instances: AgeSceneInstance[] = [];
  const drawBatches: AgeDrawBatch[] = [];
  const contacts: AgeContactRecord[] = humanAgeContactsFromWorld(world);
  const animationStates: AgeAnimationStateRecord[] = [];

  for (const enemy of world.enemies) {
    if (!humanEnemyRenderable(enemy)) continue;
    const id = `enemy:${enemy.id}`;
    const meshId = enemy.modelKey ?? `proxy:enemy:${enemy.archetypeId}`;
    const scale = Math.max(0.05, enemy.visualScaleMultiplier);
    instances.push({
      id,
      meshId,
      materialRole: "character-body",
      transform: composeYawTransform(enemy.position, enemy.rotationY, scale),
      dynamic: true,
      lastTransformFrameIndex: world.frameIndex,
      tags: ["character"],
    });
    appendDynamicDrawBatch(drawBatches, id, meshId, instances.length - 1, input.assets);
    animationStates.push(humanEnemyAnimationState(id, enemy));
  }

  for (const pickup of world.pickups) {
    if (pickup.collected) continue;
    const id = `pickup:${pickup.id}`;
    const meshId = `proxy:pickup:${pickup.type}`;
    instances.push({
      id,
      meshId,
      materialRole: "pickup",
      transform: composeYawTransform(pickup.position, pickup.age * 0.9, 1),
      dynamic: true,
      lastTransformFrameIndex: world.frameIndex,
      tags: ["pickup"],
    });
    appendDynamicDrawBatch(drawBatches, id, meshId, instances.length - 1, input.assets);
  }

  const portalStates: AgePortalStateRecord[] = (world.level.map?.doors ?? []).map((door) => {
    const open = world.isDoorOpen(door.id);
    return { id: door.id, open, openProgress: open ? 1 : 0, kind: "door" };
  });
  if (!world.level.map) {
    warnings.push(`Level "${world.level.id}" has no map definition; no portal states bridged.`);
  }

  const projectiles: AgeProjectileRecord[] = world.projectiles.map((projectile) => {
    const vfx = HUMAN_WEAPON_VFX[projectile.weaponId] ?? { kind: "bolt", color: [1, 1, 1] as AgeTuple3 };
    return {
      id: `projectile:${projectile.id}`,
      position: tuple3(projectile.position),
      direction: tuple3(projectile.direction),
      radius: projectile.radius,
      ageSeconds: projectile.age,
      lifetimeSeconds: projectile.lifetime,
      color: vfx.color,
      power: Math.min(3, Math.max(0.2, projectile.damage / 10)),
      kind: vfx.kind,
    };
  });

  const particleEmitters: AgeParticleEmitterRecord[] = world.effects.map((effect) => {
    const vfx = HUMAN_EFFECT_VFX[effect.type] ?? { kind: "spark", color: [1, 0.9, 0.7] as AgeTuple3 };
    const life = Math.max(0, 1 - effect.age / Math.max(0.001, effect.lifetime));
    return {
      id: `effect:${effect.id}`,
      position: tuple3(effect.position),
      direction: tuple3(effect.direction),
      color: vfx.color,
      power: effect.intensity * life,
      radius: Math.max(0.12, effect.intensity * life * 0.55),
      kind: vfx.kind,
    };
  });

  const frame: AgeSceneFrame = {
    schemaVersion: AGE_SCENE_FRAME_SCHEMA_VERSION,
    timing: {
      frameIndex: world.frameIndex,
      deltaSeconds: input.deltaSeconds,
      elapsedSeconds: input.elapsedSeconds,
    },
    viewport: input.viewport,
    qualityTier: world.renderPerformance.quality.tier,
    camera: {
      viewMatrix: input.camera.viewMatrix,
      projectionMatrix: input.camera.projectionMatrix,
      viewProjectionMatrix: input.camera.viewProjectionMatrix,
      position: tuple3(input.camera.position),
    },
    lighting: input.lighting ?? fallbackLightingFrame(warnings),
    instances,
    drawBatches,
    projectiles,
    particleEmitters,
    contacts,
    portalStates,
    animationStates,
    metadata: {
      adapter: "human-protocol.runtime-bridge",
      levelId: world.level.id,
      staticInstanceSource: "age-render-plan",
      viewmodelOwner: "game-overlay",
    },
  };

  for (const diagnostic of validateAgeSceneFrameRuntime(frame)) {
    if (diagnostic.severity === "info") continue;
    warnings.push(`[${diagnostic.code}] ${diagnostic.message}`);
  }
  return { value: frame, warnings };
}

function humanEnemyAnimationState(
  instanceId: string,
  enemy: HumanAgeWorldView["enemies"][number],
): AgeAnimationStateRecord {
  if (!enemy.isAlive) {
    return { instanceId, action: "death", timeSeconds: enemy.deathAge, loop: false, modelKey: enemy.modelKey };
  }
  if (enemy.hitReact > 0.05) {
    return { instanceId, action: "hit", timeSeconds: enemy.hitReact, loop: false, modelKey: enemy.modelKey };
  }
  const speed = Math.hypot(enemy.velocity.x, enemy.velocity.z);
  if (speed > 0.3) {
    return { instanceId, action: "move", timeSeconds: enemy.spawnAge, loop: true, modelKey: enemy.modelKey };
  }
  return { instanceId, action: "idle", timeSeconds: enemy.spawnAge, loop: true, modelKey: enemy.modelKey };
}

function appendDynamicDrawBatch(
  drawBatches: AgeDrawBatch[],
  id: string,
  meshId: string,
  instanceOffset: number,
  assets: AgeAssetRegistry | undefined,
) {
  const geometry = assets?.resolveGeometry(meshId);
  if (geometry && geometry.status === "ready" && geometry.vertexCount > 0) {
    drawBatches.push({
      id,
      vertexBufferId: "geometry",
      geometryId: geometry.id,
      vertexOffset: geometry.vertexOffset,
      vertexCount: geometry.vertexCount,
      instanceOffset,
      instanceCount: 1,
      castsShadow: true,
    });
    return;
  }
  drawBatches.push({
    id,
    vertexBufferId: "proxy",
    vertexOffset: 0,
    vertexCount: PROXY_CUBE_VERTEX_COUNT,
    instanceOffset,
    instanceCount: 1,
    castsShadow: true,
  });
}

function fallbackLightingFrame(warnings: string[]): AgeLightingFrame {
  warnings.push("No lighting frame provided; using neutral fallback ambient. Pass humanAgeBaseLightingFrame(plan) for parity.");
  return {
    ambient: { color: [0.16, 0.24, 0.28], intensity: 0.28 },
    localLights: [],
  };
}

function tuple3(value: HumanVec3View): AgeTuple3 {
  return [value.x, value.y, value.z];
}

/** Column-major TRS matrix with yaw-only rotation and uniform scale. */
function composeYawTransform(position: HumanVec3View, yaw: number, scale: number): number[] {
  const c = Math.cos(yaw) * scale;
  const s = Math.sin(yaw) * scale;
  return [
    c, 0, -s, 0,
    0, scale, 0, 0,
    s, 0, c, 0,
    position.x, position.y, position.z, 1,
  ];
}
