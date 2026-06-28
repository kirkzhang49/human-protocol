import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Texture,
  Vector3,
} from "three";
import { enemyModelAssets, modelKeyForEnemy, type EnemyModelKey } from "../../assets/enemyModelAssets";
import { bossPoseTuningForEnemy, bossVisualProfileForEnemy } from "../../game/config/bossVisualProfiles";
import { enemyArchetypes } from "../../game/config/enemyArchetypes";
import type { GameWorld } from "../../game/core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../../game/core/RoomReachability";
import { recordHumanProtocolPerfEvent, setHumanProtocolDetailedSmallEnemies } from "../../game/core/RenderSpikeRecorder";
import type { EnemyState } from "../../game/entities/EnemyState";
import { enemyPremiumLightingPalette } from "../../game/visual/EnemyLightingPalette";
import { enemyVisualProfiles } from "../../game/visual/VisualProfile";
import { type First90Textures, useFirst90Textures } from "../art/First90Textures";
import { EnemyModelInstance } from "./EnemyModelInstance";

interface EnemyRobotRendererProps {
  world: GameWorld;
}

export function EnemyRobotRenderer({ world }: EnemyRobotRendererProps) {
  const [spawnSequence, setSpawnSequence] = useState(world.enemySpawnSequence);
  const [detailedSmallEnemyIds, setDetailedSmallEnemyIds] = useState(() => selectDetailedSmallEnemyIds(world));
  const detailSelectionHoldUntilRef = useRef(0);
  const lastDetailQualityTierRef = useRef(world.renderPerformance.quality.tier);
  const artTextures = useFirst90Textures();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (world.enemySpawnSequence !== spawnSequence) {
        setSpawnSequence(world.enemySpawnSequence);
      }
      setDetailedSmallEnemyIds((current) => {
        const qualityTier = world.renderPerformance.quality.tier;
        const now = performance.now();
        if (qualityTier !== lastDetailQualityTierRef.current) {
          lastDetailQualityTierRef.current = qualityTier;
          detailSelectionHoldUntilRef.current = now + DETAIL_SELECTION_TIER_HOLD_MS;
          const reconciled = reconcileHeldDetailedSmallEnemyIds(world, current);
          if (sameEntityIds(current, reconciled)) return current;
          recordHumanProtocolPerfEvent(world, "enemy_detail_swap", detailedSelectionDelta(current, reconciled));
          return reconciled;
        }
        if (now < detailSelectionHoldUntilRef.current && current.length > 0) {
          const reconciled = reconcileHeldDetailedSmallEnemyIds(world, current);
          if (sameEntityIds(current, reconciled)) return current;
          recordHumanProtocolPerfEvent(world, "enemy_detail_swap", detailedSelectionDelta(current, reconciled));
          return reconciled;
        }

        const next = selectDetailedSmallEnemyIds(world, current);
        if (sameEntityIds(current, next)) return current;
        detailSelectionHoldUntilRef.current = now + DETAIL_SELECTION_SWAP_HOLD_MS;
        recordHumanProtocolPerfEvent(world, "enemy_detail_swap", detailedSelectionDelta(current, next));
        return next;
      });
    }, DETAIL_SELECTION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [spawnSequence, world]);

  useEffect(() => {
    setHumanProtocolDetailedSmallEnemies(world, detailedSmallEnemyIds);
  }, [detailedSmallEnemyIds, world]);

  const detailedSmallEnemyIdSet = useMemo(() => new Set(detailedSmallEnemyIds), [detailedSmallEnemyIds]);
  const detailedEnemies = useMemo(() => {
    const enemies: EnemyState[] = [];
    for (const enemy of world.enemies) {
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
      if (!isEnemyKeptMounted(enemy)) continue;
      if (isInstancedSmallEnemy(enemy) && !detailedSmallEnemyIdSet.has(enemy.id)) continue;
      enemies.push(enemy);
    }
    return enemies;
  }, [detailedSmallEnemyIdSet, spawnSequence, world]);

  return (
    <group>
      <EnemyModelWarmupSet world={world} />
      <InstancedSmallEnemySet kind="repair_drone" world={world} artTextures={artTextures} detailedEnemyIds={detailedSmallEnemyIdSet} />
      <InstancedSmallEnemySet kind="clamp_bot" world={world} artTextures={artTextures} detailedEnemyIds={detailedSmallEnemyIdSet} />
      <SmallEnemyLockMarker world={world} detailedEnemyIds={detailedSmallEnemyIdSet} />
      {detailedEnemies.map((enemy) => (
        <EnemyRobot key={enemy.id} enemy={enemy} artTextures={artTextures} world={world} />
      ))}
    </group>
  );
}

const enemyModelWarmupAssets = Object.values(enemyModelAssets) as Array<{
  modelKey: EnemyModelKey;
  warmupTargetHeight: number;
}>;

function EnemyModelWarmupSet({ world }: { world: GameWorld }) {
  const [active, setActive] = useState(() => !world.renderWarmupComplete);

  useEffect(() => {
    setActive(true);
    const timeout = window.setTimeout(() => setActive(false), 900);
    return () => window.clearTimeout(timeout);
  }, [world]);

  if (!active) return null;

  return (
    <group position={[0, -180, 0]}>
      {enemyModelWarmupAssets.map((asset, index) => (
        <group key={asset.modelKey} position={[index * 3.2, 0, 0]}>
          <EnemyModelInstance
            modelKey={asset.modelKey}
            targetHeight={asset.warmupTargetHeight}
            castShadow={false}
            receiveShadow={false}
            animationName="idle"
          />
        </group>
      ))}
    </group>
  );
}

type InstancedSmallEnemyKind = "repair_drone" | "clamp_bot";
type InstancedMaterialKey =
  | "body"
  | "armor"
  | "barrel"
  | "core"
  | "warning"
  | "blueGlow"
  | "decalMain"
  | "decalStrip"
  | "decalLimb"
  | "decalHazard"
  | "decalSmall";
type InstancedGeometryKind = "box" | "sphere" | "cylinder" | "cone" | "plane";

interface InstancedEnemyPart {
  key: string;
  geometry: InstancedGeometryKind;
  args: readonly number[];
  material: InstancedMaterialKey;
  offset: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotation?: readonly [number, number, number];
}

interface InstancedEnemyRenderEntry {
  enemy: EnemyState;
  deathProgress: number;
  moveAmount: number;
  attackKick: number;
  hitKick: number;
  damagePulse: number;
  damageGlow: number;
  visualScale: number;
}

const INSTANCED_SMALL_ENEMY_CAPACITY = 64;
const DETAILED_SMALL_ENEMY_LIMIT = 7;
const DETAILED_SMALL_ENEMY_LIMIT_WITH_ELITE = 5;
const DETAILED_SMALL_ENEMY_DISTANCE_SQ = 14 * 14;
const DETAILED_SMALL_ENEMY_VIEW_SQ = 18 * 18;
const DETAILED_SMALL_ENEMY_NEAR_SQ = 7 * 7;
const DETAILED_SMALL_ENEMY_VERY_NEAR_SQ = 4.5 * 4.5;
const DETAILED_SMALL_ENEMY_STICKY_SCORE = 7600;
const DETAILED_SMALL_ENEMY_PREWARM_AVERAGE_MS = 22;
const DETAILED_SMALL_ENEMY_PREWARM_P95_MS = 30;
const DETAIL_SELECTION_INTERVAL_MS = 420;
const DETAIL_SELECTION_SWAP_HOLD_MS = 950;
const DETAIL_SELECTION_TIER_HOLD_MS = 700;
const ENEMY_RENDER_HIDE_AGE = 1.05;
const Y_AXIS = new Vector3(0, 1, 0);
const DETAIL_SCORE_VECTOR = new Vector3();

function isInstancedSmallEnemy(enemy: EnemyState) {
  return enemy.tier === "normal" && (enemy.archetypeId === "repair_drone" || enemy.archetypeId === "clamp_bot");
}

function selectDetailedSmallEnemyIds(world: GameWorld, currentDetailedIds: readonly number[] = []) {
  const selectedIds: number[] = [];
  const selectedScores: number[] = [];
  const prewarmIds: number[] = [];
  const allowDormantPrewarmDetail = shouldKeepDormantSmallEnemyPrewarmDetail(world);
  const qualityLimit = world.renderPerformance.quality.detailedSmallEnemyLimit;
  const maxDetailLimit = Math.max(1, Math.min(DETAILED_SMALL_ENEMY_LIMIT, qualityLimit));
  let hasEliteThreat = false;

  for (const enemy of world.enemies) {
    if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
    if ((enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss") && enemy.isAlive) {
      hasEliteThreat = true;
    }
    if (!isInstancedSmallEnemy(enemy)) continue;
    if (!enemy.isAlive && enemy.deathAge >= 0.92) {
      if (allowDormantPrewarmDetail && enemy.prewarmSlot && prewarmIds.length < maxDetailLimit) {
        prewarmIds.push(enemy.id);
      }
      continue;
    }

    const distanceSq = enemy.position.distanceToSquared(world.player.position);
    let score = -distanceSq;
    DETAIL_SCORE_VECTOR.copy(enemy.position).sub(world.player.position).setY(0);
    if (distanceSq < DETAILED_SMALL_ENEMY_VIEW_SQ && DETAIL_SCORE_VECTOR.lengthSq() > 0.001) {
      const viewDot = DETAIL_SCORE_VECTOR.normalize().dot(world.player.aimDirection);
      if (viewDot > 0.5) score += 1400 * viewDot;
    }
    if (distanceSq < DETAILED_SMALL_ENEMY_DISTANCE_SQ) score += 2200;
    if (distanceSq < DETAILED_SMALL_ENEMY_NEAR_SQ) score += 4600;
    if (distanceSq < DETAILED_SMALL_ENEMY_VERY_NEAR_SQ) score += 9200;
    if (currentDetailedIds.includes(enemy.id)) score += DETAILED_SMALL_ENEMY_STICKY_SCORE;
    if (enemy.id === world.combatAssist.lockedEnemyId) score += 10000;
    if (!enemy.isAlive) score += 8000;
    if (enemy.damageFlash > 0.02 || enemy.hitReact > 0.12) score += 5000;
    insertDetailedEnemyCandidate(selectedIds, selectedScores, enemy.id, score, maxDetailLimit);
  }

  const detailLimit = detailedSmallEnemyLimit(world, hasEliteThreat);
  if (selectedIds.length > detailLimit) {
    selectedIds.length = detailLimit;
    selectedScores.length = detailLimit;
  }
  for (const id of prewarmIds) {
    if (selectedIds.length >= detailLimit) break;
    if (!selectedIds.includes(id)) selectedIds.push(id);
  }
  return selectedIds;
}

function reconcileHeldDetailedSmallEnemyIds(world: GameWorld, currentDetailedIds: readonly number[]): number[] {
  const retained: number[] = [];
  const retainedSet = new Set(currentDetailedIds);
  let hasEliteThreat = false;

  for (const enemy of world.enemies) {
    if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
    if ((enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss") && enemy.isAlive) {
      hasEliteThreat = true;
    }
    if (!retainedSet.has(enemy.id)) continue;
    if (!isInstancedSmallEnemy(enemy)) continue;
    if (!isDetailedSmallEnemyRetainable(world, enemy)) continue;
    retained.push(enemy.id);
  }

  const detailLimit = detailedSmallEnemyLimit(world, hasEliteThreat);
  if (retained.length <= detailLimit && sameEntityIds(currentDetailedIds, retained)) return retained;
  return selectDetailedSmallEnemyIds(world, retained);
}

function detailedSmallEnemyLimit(world: GameWorld, hasEliteThreat: boolean) {
  const qualityLimit = world.renderPerformance.quality.detailedSmallEnemyLimit;
  const baseLimit = hasEliteThreat ? DETAILED_SMALL_ENEMY_LIMIT_WITH_ELITE : DETAILED_SMALL_ENEMY_LIMIT;
  return Math.max(1, Math.min(baseLimit, qualityLimit));
}

function isDetailedSmallEnemyRetainable(world: GameWorld, enemy: EnemyState) {
  if (enemy.isAlive || enemy.deathAge < ENEMY_RENDER_HIDE_AGE) return true;
  return Boolean(enemy.prewarmSlot) && shouldKeepDormantSmallEnemyPrewarmDetail(world);
}

function shouldKeepDormantSmallEnemyPrewarmDetail(world: GameWorld) {
  if (!world.renderWarmupComplete) return true;
  const performance = world.renderPerformance;
  return (
    performance.quality.tier === "high" &&
    performance.averageFrameMs < DETAILED_SMALL_ENEMY_PREWARM_AVERAGE_MS &&
    performance.frameTimeP95 < DETAILED_SMALL_ENEMY_PREWARM_P95_MS
  );
}

function sameEntityIds(left: readonly number[], right: readonly number[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!right.includes(left[index])) return false;
  }
  return true;
}

function detailedSelectionDelta(previous: readonly number[], next: readonly number[]) {
  const added: number[] = [];
  const removed: number[] = [];
  for (const id of next) {
    if (!previous.includes(id)) added.push(id);
  }
  for (const id of previous) {
    if (!next.includes(id)) removed.push(id);
  }
  return {
    fromCount: previous.length,
    toCount: next.length,
    added,
    removed,
  };
}

function insertDetailedEnemyCandidate(
  selectedIds: number[],
  selectedScores: number[],
  id: number,
  score: number,
  limit: number,
) {
  let insertAt = selectedScores.length;
  while (insertAt > 0 && score > selectedScores[insertAt - 1]) {
    insertAt -= 1;
  }
  if (insertAt >= limit) return;
  selectedIds.splice(insertAt, 0, id);
  selectedScores.splice(insertAt, 0, score);
  if (selectedIds.length > limit) {
    selectedIds.length = limit;
    selectedScores.length = limit;
  }
}

function isEnemyKeptMounted(enemy: EnemyState) {
  return enemy.isAlive || enemy.deathAge < ENEMY_RENDER_HIDE_AGE || Boolean(enemy.prewarmSlot);
}

function InstancedSmallEnemySet({
  kind,
  world,
  artTextures,
  detailedEnemyIds,
}: {
  kind: InstancedSmallEnemyKind;
  world: GameWorld;
  artTextures: First90Textures;
  detailedEnemyIds: ReadonlySet<number>;
}) {
  const materials = useInstancedEnemyMaterials(kind, artTextures);
  const parts = useMemo(() => instancedPartsFor(kind), [kind]);
  const enemyListRef = useInstancedSmallEnemyRenderList(kind, world, detailedEnemyIds);

  return (
    <group>
      {parts.map((part) => (
        <InstancedEnemyPartMesh
          key={part.key}
          part={part}
          kind={kind}
          material={materials[part.material]}
          world={world}
          enemyListRef={enemyListRef}
        />
      ))}
    </group>
  );
}

function useInstancedSmallEnemyRenderList(
  kind: InstancedSmallEnemyKind,
  world: GameWorld,
  detailedEnemyIds: ReadonlySet<number>,
) {
  const enemyListRef = useRef<InstancedEnemyRenderEntry[]>([]);
  const entryPoolRef = useRef<InstancedEnemyRenderEntry[]>(
    Array.from({ length: INSTANCED_SMALL_ENEMY_CAPACITY }, createInstancedEnemyRenderEntry),
  );
  const archetype = enemyArchetypes[kind];
  const rootScale = enemyVisualProfiles[archetype.visualKey]?.scale ?? 0.6;

  useFrame(() => {
    const entries = enemyListRef.current;
    entries.length = 0;

    for (const enemy of world.enemies) {
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
      if (enemy.archetypeId !== kind) continue;
      if (detailedEnemyIds.has(enemy.id)) continue;
      if (!enemy.isAlive && enemy.deathAge >= 0.92) continue;

      const deathProgress = enemy.isAlive ? 0 : Math.min(1, enemy.deathAge / 0.92);
      const entry = entryPoolRef.current[entries.length];
      entry.enemy = enemy;
      entry.deathProgress = deathProgress;
      entry.moveAmount = clamp01(enemy.velocity.length() / Math.max(0.1, archetype.moveSpeed));
      entry.attackKick = attackKickFor(enemy, archetype.attackCooldown);
      entry.hitKick = enemy.hitReact;
      entry.damagePulse = enemy.damageFlash;
      entry.damageGlow = 1 - enemy.health / enemy.maxHealth;
      entry.visualScale = rootScale * (1 + enemy.hitReact * 0.035 - deathProgress * 0.32);
      entries.push(entry);

      if (entries.length >= INSTANCED_SMALL_ENEMY_CAPACITY) break;
    }
  }, -50);

  return enemyListRef;
}

function createInstancedEnemyRenderEntry(): InstancedEnemyRenderEntry {
  return {
    enemy: null as unknown as EnemyState,
    deathProgress: 0,
    moveAmount: 0,
    attackKick: 0,
    hitKick: 0,
    damagePulse: 0,
    damageGlow: 0,
    visualScale: 1,
  };
}

function InstancedEnemyPartMesh({
  kind,
  part,
  material,
  world,
  enemyListRef,
}: {
  kind: InstancedSmallEnemyKind;
  part: InstancedEnemyPart;
  material: MeshStandardMaterial | MeshBasicMaterial;
  world: GameWorld;
  enemyListRef: MutableRefObject<InstancedEnemyRenderEntry[]>;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const colorUsageReadyRef = useRef(false);
  const colorState = useMemo(createInstancedColorState, []);
  const dummy = useMemo(() => new Object3D(), []);
  const localOffset = useMemo(() => new Vector3(), []);
  const worldOffset = useMemo(() => new Vector3(), []);
  const deathOffset = useMemo(() => new Vector3(), []);
  const instanceTint = useMemo(() => new Color(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    let colorBufferDirty = !mesh.instanceColor;

    let instanceIndex = 0;
    for (const entry of enemyListRef.current) {
      const { enemy, deathProgress, moveAmount, attackKick, hitKick, damagePulse, damageGlow, visualScale } = entry;

      localOffset.set(
        part.offset[0] * visualScale,
        part.offset[1] * visualScale,
        part.offset[2] * visualScale,
      );
      worldOffset.copy(localOffset).applyAxisAngle(Y_AXIS, enemy.rotationY);
      dummy.position.copy(enemy.position).add(worldOffset);
      if (deathProgress > 0) {
        instancedDeathScatter(kind, part.key, deathProgress, visualScale, deathOffset);
        deathOffset.applyAxisAngle(Y_AXIS, enemy.rotationY);
        dummy.position.add(deathOffset);
      }
      dummy.position.addScaledVector(enemy.lastHitDirection, enemy.hitReact * 0.12 + deathProgress * 0.34);
      dummy.position.y +=
        Math.sin(clock.elapsedTime * 2 + enemy.id) * 0.018 +
        Math.abs(Math.sin(enemy.spawnAge * 8.8 + enemy.id * 0.53)) * moveAmount * 0.03 +
        attackKick * 0.035 +
        instancedDeathLift(kind, deathProgress);
      const deathRotation = instancedDeathRotation(kind, part.key, enemy.id, deathProgress);
      dummy.rotation.set(
        (part.rotation?.[0] ?? 0) + deathRotation[0],
        enemy.rotationY + (part.rotation?.[1] ?? 0) + deathRotation[1],
        (part.rotation?.[2] ?? 0) + enemy.lastHitDirection.x * deathProgress * 0.22 + deathRotation[2],
      );
      dummy.scale.set(
        part.scale[0] * visualScale,
        part.scale[1] * visualScale,
        part.scale[2] * visualScale,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(instanceIndex, dummy.matrix);

      const colorKey = instancedSmallEnemyColorKey(kind, part.material, hitKick, damagePulse, deathProgress, damageGlow);
      if (colorBufferDirty || colorState.enemyIds[instanceIndex] !== enemy.id || colorState.colorKeys[instanceIndex] !== colorKey) {
        setInstancedSmallEnemyTint(instanceTint, kind, part.material, hitKick, damagePulse, deathProgress, damageGlow);
        mesh.setColorAt(instanceIndex, instanceTint);
        colorState.enemyIds[instanceIndex] = enemy.id;
        colorState.colorKeys[instanceIndex] = colorKey;
        colorBufferDirty = true;
      }
      instanceIndex += 1;
    }

    for (let staleIndex = instanceIndex; staleIndex < colorState.liveCount; staleIndex += 1) {
      colorState.enemyIds[staleIndex] = -1;
      colorState.colorKeys[staleIndex] = -1;
    }
    colorState.liveCount = instanceIndex;
    mesh.count = instanceIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      if (!colorUsageReadyRef.current) {
        mesh.instanceColor.setUsage(DynamicDrawUsage);
        colorUsageReadyRef.current = true;
        colorBufferDirty = true;
      }
      if (colorBufferDirty) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, INSTANCED_SMALL_ENEMY_CAPACITY]}
      matrixAutoUpdate={false}
      frustumCulled={false}
    >
      <InstancedPartGeometry part={part} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

function createInstancedColorState() {
  return {
    enemyIds: new Int32Array(INSTANCED_SMALL_ENEMY_CAPACITY).fill(-1),
    colorKeys: new Int32Array(INSTANCED_SMALL_ENEMY_CAPACITY).fill(-1),
    liveCount: 0,
  };
}

function InstancedPartGeometry({ part }: { part: InstancedEnemyPart }) {
  if (part.geometry === "plane") return <planeGeometry args={part.args as [number, number]} />;
  if (part.geometry === "sphere") return <sphereGeometry args={part.args as [number, number, number]} />;
  if (part.geometry === "cylinder") return <cylinderGeometry args={part.args as [number, number, number, number]} />;
  if (part.geometry === "cone") return <coneGeometry args={part.args as [number, number, number]} />;
  return <boxGeometry args={part.args as [number, number, number]} />;
}

function instancedDeathScatter(
  kind: InstancedSmallEnemyKind,
  partKey: string,
  deathProgress: number,
  visualScale: number,
  out: Vector3,
) {
  const ease = deathProgress * deathProgress;
  out.set(0, 0, 0);

  if (kind === "repair_drone") {
    const side = partKey.includes("left") ? -1 : partKey.includes("right") ? 1 : 0;
    const pod = partKey.includes("pod") ? 1 : 0;
    const head = partKey.includes("head") || partKey.includes("eye") ? 1 : 0;
    out.set(side * (0.2 + pod * 0.24), head * 0.16, 0.08 + pod * 0.12).multiplyScalar(ease * visualScale);
    return;
  }

  const side = partKey.includes("left") ? -1 : partKey.includes("right") ? 1 : 0;
  const arm = partKey.includes("arm") ? 1 : 0;
  const track = partKey.includes("track") ? 1 : 0;
  const crest = partKey.includes("crest") || partKey.includes("hazard") ? 1 : 0;
  out
    .set(side * (0.18 + arm * 0.36 + track * 0.12), crest * 0.12 - track * 0.14, arm * 0.22 + crest * 0.1)
    .multiplyScalar(ease * visualScale);
}

function instancedDeathLift(kind: InstancedSmallEnemyKind, deathProgress: number) {
  if (deathProgress <= 0) return 0;
  if (kind === "repair_drone") {
    return Math.sin(deathProgress * Math.PI) * 0.24 - deathProgress * 0.42;
  }
  return -deathProgress * 0.28;
}

function instancedDeathRotation(
  kind: InstancedSmallEnemyKind,
  partKey: string,
  enemyId: number,
  deathProgress: number,
): [number, number, number] {
  if (deathProgress <= 0) return [0, 0, 0];
  const ease = deathProgress * deathProgress;
  const side = partKey.includes("left") ? -1 : partKey.includes("right") ? 1 : enemyId % 2 === 0 ? -1 : 1;

  if (kind === "repair_drone") {
    const loosePart = partKey.includes("pod") || partKey.includes("head") || partKey.includes("eye");
    return [
      ease * (0.55 + (loosePart ? 0.5 : 0.2)),
      side * ease * (loosePart ? 1.55 : 0.75),
      side * ease * (0.75 + (loosePart ? 0.7 : 0.2)),
    ];
  }

  const arm = partKey.includes("arm");
  const track = partKey.includes("track");
  return [
    -ease * (0.18 + (track ? 0.34 : 0)),
    side * ease * (arm ? 0.52 : 0.12),
    side * ease * (0.5 + (arm ? 0.72 : 0.2)),
  ];
}

function instancedSmallEnemyColorKey(
  kind: InstancedSmallEnemyKind,
  materialKey: InstancedMaterialKey,
  hitKick: number,
  damagePulse: number,
  deathProgress: number,
  damageGlow: number,
) {
  const materialBucket = instancedMaterialBucket(materialKey);
  const kindBucket = kind === "repair_drone" ? 0 : 1;
  if (deathProgress > 0) {
    return 100000 + kindBucket * 10000 + materialBucket * 100 + Math.round(deathProgress * 48);
  }

  const hit = Math.min(1, Math.max(hitKick, damagePulse * 0.55));
  if (hit > 0.02) {
    return 200000 + kindBucket * 10000 + materialBucket * 100 + Math.round(hit * 48);
  }

  if (materialKey === "core" || materialKey === "blueGlow") {
    return 300000 + kindBucket * 10000 + materialBucket * 100 + Math.round(Math.max(0, damageGlow) * 32);
  }
  return 400000 + kindBucket * 10000 + materialBucket * 100 + Math.round(Math.max(0, damageGlow) * 20);
}

function instancedMaterialBucket(materialKey: InstancedMaterialKey) {
  if (materialKey === "body") return 1;
  if (materialKey === "armor") return 2;
  if (materialKey === "barrel") return 3;
  if (materialKey === "core") return 4;
  if (materialKey === "warning") return 5;
  if (materialKey === "blueGlow") return 6;
  if (materialKey === "decalMain") return 7;
  if (materialKey === "decalStrip") return 8;
  if (materialKey === "decalLimb") return 9;
  if (materialKey === "decalHazard") return 10;
  return 11;
}

function setInstancedSmallEnemyTint(
  out: Color,
  kind: InstancedSmallEnemyKind,
  materialKey: InstancedMaterialKey,
  hitKick: number,
  damagePulse: number,
  deathProgress: number,
  damageGlow: number,
) {
  if (deathProgress > 0) {
    const ash = 1 - deathProgress;
    if (kind === "repair_drone") {
      out.setRGB(0.46 + ash * 0.54, 0.5 + ash * 0.5, 0.48 + ash * 0.5);
      return;
    }
    out.setRGB(0.42 + ash * 0.58, 0.36 + ash * 0.48, 0.34 + ash * 0.46);
    return;
  }

  const hit = Math.min(1, Math.max(hitKick, damagePulse * 0.55));
  const worn = Math.min(0.22, Math.max(0, damageGlow) * 0.18);
  if (hit > 0.02) {
    if (materialKey === "core" || materialKey === "blueGlow") {
      out.setRGB(1 + hit * 0.55, 1 + hit * 0.8, 1 + hit * 1.1);
      return;
    }
    if (kind === "clamp_bot" || materialKey === "warning" || materialKey === "decalHazard") {
      out.setRGB(1 + hit * 0.45, 0.78 + hit * 0.5, 0.68 + hit * 0.28);
      return;
    }
    out.setRGB(1 + hit * 0.35, 1 + hit * 0.4, 1 + hit * 0.62);
    return;
  }

  if (materialKey === "core" || materialKey === "blueGlow") {
    out.setRGB(1 + damageGlow * 0.18, 1 + damageGlow * 0.24, 1 + damageGlow * 0.32);
    return;
  }
  out.setRGB(1 - worn, 1 - worn * 0.7, 1 - worn * 0.55);
}

function SmallEnemyLockMarker({
  world,
  detailedEnemyIds,
}: {
  world: GameWorld;
  detailedEnemyIds: ReadonlySet<number>;
}) {
  const markerRef = useRef<Group>(null);
  const materials = useEnemyMaterials();

  useFrame(({ clock }) => {
    const marker = markerRef.current;
    if (!marker) return;
    const locked = world.enemies.find(
      (enemy) =>
        enemy.id === world.combatAssist.lockedEnemyId &&
        enemy.isAlive &&
        isEnemyVisibleToPlayerRoom(world, enemy) &&
        isInstancedSmallEnemy(enemy) &&
        !detailedEnemyIds.has(enemy.id),
    );
    if (!locked) {
      marker.visible = false;
      return;
    }

    const scale = enemyVisualProfiles[enemyArchetypes[locked.archetypeId].visualKey]?.scale ?? 0.6;
    const pulse = 0.82 + Math.sin(clock.elapsedTime * 10) * 0.06;
    marker.visible = true;
    marker.position.copy(locked.position);
    marker.position.y += 1.46 * scale;
    marker.position.z += 0.47 * scale;
    marker.rotation.y = locked.rotationY;
    marker.scale.setScalar(pulse);
  });

  return <LockMarker markerRef={markerRef} materials={materials} />;
}

function instancedPartsFor(kind: InstancedSmallEnemyKind): readonly InstancedEnemyPart[] {
  if (kind === "repair_drone") {
    return [
      {
        key: "drone-body",
        geometry: "box",
        args: [1, 1, 1],
        material: "body",
        offset: [0, 1.28, 0],
        scale: [0.96, 0.54, 0.5],
      },
      {
        key: "drone-core",
        geometry: "sphere",
        args: [1, 12, 8],
        material: "core",
        offset: [0, 1.29, 0.34],
        scale: [0.16, 0.16, 0.16],
      },
      {
        key: "drone-left-pod",
        geometry: "sphere",
        args: [1, 10, 6],
        material: "armor",
        offset: [-0.62, 1.22, -0.03],
        scale: [0.25, 0.19, 0.25],
      },
      {
        key: "drone-right-pod",
        geometry: "sphere",
        args: [1, 10, 6],
        material: "armor",
        offset: [0.62, 1.22, -0.03],
        scale: [0.25, 0.19, 0.25],
      },
      {
        key: "drone-head",
        geometry: "box",
        args: [1, 1, 1],
        material: "body",
        offset: [0, 1.78, 0.01],
        scale: [0.46, 0.22, 0.28],
      },
      {
        key: "drone-eye",
        geometry: "box",
        args: [1, 1, 1],
        material: "blueGlow",
        offset: [0, 1.8, 0.17],
        scale: [0.3, 0.06, 0.04],
      },
      {
        key: "drone-body-decal",
        geometry: "plane",
        args: [1, 1],
        material: "decalMain",
        offset: [0, 1.28, 0.31],
        scale: [0.72, 0.34, 1],
      },
      {
        key: "drone-scan-strip",
        geometry: "plane",
        args: [1, 1],
        material: "decalStrip",
        offset: [0, 1.54, 0.31],
        scale: [0.86, 0.09, 1],
      },
      {
        key: "drone-head-decal",
        geometry: "plane",
        args: [1, 1],
        material: "decalSmall",
        offset: [0, 1.81, 0.2],
        scale: [0.34, 0.1, 1],
      },
      {
        key: "drone-left-pod-decal",
        geometry: "plane",
        args: [1, 1],
        material: "decalLimb",
        offset: [-0.62, 1.22, 0.23],
        scale: [0.26, 0.24, 1],
      },
      {
        key: "drone-right-pod-decal",
        geometry: "plane",
        args: [1, 1],
        material: "decalLimb",
        offset: [0.62, 1.22, 0.23],
        scale: [0.26, 0.24, 1],
      },
    ];
  }

  return [
    {
      key: "clamp-body",
      geometry: "box",
      args: [1, 1, 1],
      material: "body",
      offset: [0, 1.14, 0],
      scale: [1.18, 0.64, 0.58],
    },
    {
      key: "clamp-crest",
      geometry: "box",
      args: [1, 1, 1],
      material: "armor",
      offset: [0, 1.43, 0.18],
      scale: [1.42, 0.26, 0.3],
    },
    {
      key: "clamp-core",
      geometry: "sphere",
      args: [1, 12, 8],
      material: "core",
      offset: [0, 1.16, 0.34],
      scale: [0.16, 0.16, 0.16],
    },
    {
      key: "clamp-left-arm",
      geometry: "box",
      args: [1, 1, 1],
      material: "warning",
      offset: [-0.92, 1.02, 0.34],
      scale: [0.18, 0.52, 0.18],
      rotation: [0, -0.35, -0.28],
    },
    {
      key: "clamp-right-arm",
      geometry: "box",
      args: [1, 1, 1],
      material: "warning",
      offset: [0.92, 1.02, 0.34],
      scale: [0.18, 0.52, 0.18],
      rotation: [0, 0.35, 0.28],
    },
    {
      key: "clamp-left-track",
      geometry: "box",
      args: [1, 1, 1],
      material: "barrel",
      offset: [-0.34, 0.28, -0.08],
      scale: [0.5, 0.14, 0.66],
    },
    {
      key: "clamp-right-track",
      geometry: "box",
      args: [1, 1, 1],
      material: "barrel",
      offset: [0.34, 0.28, -0.08],
      scale: [0.5, 0.14, 0.66],
    },
    {
      key: "clamp-body-decal",
      geometry: "plane",
      args: [1, 1],
      material: "decalMain",
      offset: [0, 1.14, 0.37],
      scale: [0.82, 0.44, 1],
    },
    {
      key: "clamp-hazard-decal",
      geometry: "plane",
      args: [1, 1],
      material: "decalHazard",
      offset: [0, 1.43, 0.34],
      scale: [0.86, 0.16, 1],
    },
    {
      key: "clamp-core-label",
      geometry: "plane",
      args: [1, 1],
      material: "decalSmall",
      offset: [0, 1.63, 0.23],
      scale: [0.34, 0.12, 1],
    },
    {
      key: "clamp-left-arm-decal",
      geometry: "plane",
      args: [1, 1],
      material: "decalLimb",
      offset: [-0.92, 1.02, 0.45],
      scale: [0.18, 0.36, 1],
      rotation: [0, -0.35, -0.28],
    },
    {
      key: "clamp-right-arm-decal",
      geometry: "plane",
      args: [1, 1],
      material: "decalLimb",
      offset: [0.92, 1.02, 0.45],
      scale: [0.18, 0.36, 1],
      rotation: [0, 0.35, 0.28],
    },
  ];
}

function useInstancedEnemyMaterials(kind: InstancedSmallEnemyKind, artTextures: First90Textures) {
  const atlas = kind === "clamp_bot" ? artTextures.clampBotAtlas : artTextures.repairDroneAtlas;

  const materials = useMemo(() => {
    const bodyColorValue = kind === "clamp_bot" ? "#827f76" : enemyPremiumLightingPalette.body;
    const armorColorValue = kind === "clamp_bot" ? enemyPremiumLightingPalette.dark : enemyPremiumLightingPalette.armor;
    const decalMaterial = (region: AtlasRegion, opacity: number) =>
      new MeshBasicMaterial({
        map: sharedAtlasRegionTexture(atlas, region),
        transparent: true,
        opacity,
        toneMapped: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        side: DoubleSide,
        vertexColors: true,
      });
    const materials: Record<InstancedMaterialKey, MeshStandardMaterial | MeshBasicMaterial> = {
      body: new MeshStandardMaterial({
        color: bodyColorValue,
        map: atlas,
        metalness: 0.76,
        roughness: 0.34,
        vertexColors: true,
      }),
      armor: new MeshStandardMaterial({
        color: armorColorValue,
        map: atlas,
        metalness: 0.78,
        roughness: 0.3,
        vertexColors: true,
      }),
      barrel: new MeshStandardMaterial({ color: enemyPremiumLightingPalette.barrel, metalness: 0.88, roughness: 0.24, vertexColors: true }),
      core: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.core,
        emissive: enemyPremiumLightingPalette.coreEmissive,
        emissiveIntensity: 1.28,
        metalness: 0.18,
        roughness: 0.16,
        toneMapped: false,
        vertexColors: true,
      }),
      warning: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.warning,
        emissive: enemyPremiumLightingPalette.warningEmissive,
        emissiveIntensity: 0.34,
        metalness: 0.62,
        roughness: 0.26,
        toneMapped: false,
        vertexColors: true,
      }),
      blueGlow: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.core,
        emissive: enemyPremiumLightingPalette.coreEmissive,
        emissiveIntensity: 1.08,
        metalness: 0.18,
        roughness: 0.18,
        toneMapped: false,
        vertexColors: true,
      }),
      decalMain: decalMaterial("main", kind === "clamp_bot" ? 0.86 : 0.9),
      decalStrip: decalMaterial("strip", 0.94),
      decalLimb: decalMaterial("limb", kind === "clamp_bot" ? 0.82 : 0.78),
      decalHazard: decalMaterial("hazard", 0.38),
      decalSmall: decalMaterial("small", 0.92),
    };

    return materials;
  }, [atlas, kind]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, [materials]);

  return materials;
}

function EnemyRobot({
  enemy,
  artTextures,
  world,
}: {
  enemy: EnemyState;
  artTextures: First90Textures;
  world: GameWorld;
}) {
  const rootRef = useRef<Group>(null);
  const lockRef = useRef<Group>(null);
  const torsoRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const detailRef = useRef<Group>(null);
  const warmupInvisibleRef = useRef<boolean | null>(null);
  const shadowEnabledRef = useRef<boolean | null>(null);
  const modelAnimationNameRef = useRef("idle");
  const materials = useEnemyMaterials();
  const archetype = enemyArchetypes[enemy.archetypeId];
  const visualProfile = enemyVisualProfiles[archetype.visualKey];
  const scale = (visualProfile?.scale ?? 0.75) * enemy.visualScaleMultiplier;
  const enemyModelKey = modelKeyForEnemy(enemy);
  const renderScale = enemyModelKey ? enemy.visualScaleMultiplier : scale;
  const atlasTexture = enemyAtlasTexture(enemy, artTextures);

  useEffect(() => {
    materials.body.map = atlasTexture;
    materials.armor.map = atlasTexture;
    materials.body.needsUpdate = true;
    materials.armor.needsUpdate = true;
    return () => {
      materials.body.map = null;
      materials.armor.map = null;
      materials.body.needsUpdate = true;
      materials.armor.needsUpdate = true;
    };
  }, [atlasTexture, materials]);

  useFrame(({ clock }) => {
    if (!rootRef.current) return;
    const deathProgress = enemy.isAlive ? 0 : Math.min(1, enemy.deathAge / 0.62);
    // EnemyState is mutated by the game loop, so GLB animation state must be refreshed per frame instead of frozen as a React prop.
    if (enemyModelKey) modelAnimationNameRef.current = enemyModelAnimationName(enemy, archetype);
    const warmupInvisible = Boolean(enemy.prewarmSlot && !enemy.isAlive && !world.renderWarmupComplete);
    if (enemyModelKey) {
      setEnemyObjectWarmupState(rootRef.current, warmupInvisible, warmupInvisibleRef);
    } else {
      setEnemyMaterialWarmupState(materials, warmupInvisible, warmupInvisibleRef);
    }
    setRobotShadowState(
      rootRef.current,
      (enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss") && enemy.isAlive && !warmupInvisible,
      shadowEnabledRef,
    );

    if (warmupInvisible) {
      rootRef.current.visible = true;
      rootRef.current.position.copy(world.player.position).addScaledVector(world.player.aimDirection, 4);
      rootRef.current.position.y += 0.2;
      rootRef.current.rotation.set(0, world.player.rotationY, 0);
      rootRef.current.scale.setScalar(renderScale);
      setGroupVisible(lockRef.current, false);
      setGroupVisible(detailRef.current, false);
      return;
    }

    rootRef.current.visible = enemy.isAlive || deathProgress < 1;
    const bossProfile = bossVisualProfileForEnemy(world.level.id, enemy);
    const largeHitTarget = Boolean(bossProfile) || enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss";
    const poseTuning = bossProfile ? bossPoseTuningForEnemy(world.level.id, enemy) : null;
    const bossPoseScale = poseTuning?.staggerPoseMultiplier ?? (enemy.tier === "boss" ? 1.22 : enemy.tier === "leader" ? 1.1 : 1);
    const staggerScale = poseTuning ? 1 : bossPoseScale;
    const hitReactVisual = enemy.hitReact * (largeHitTarget ? (poseTuning?.hitReactMultiplier ?? (enemy.tier === "boss" ? 1.78 : 1.56)) : 1);
    const staggerPose = largeHitTarget ? staggerPoseAmount(enemy) : 0;
    rootRef.current.position.copy(enemy.position);
    rootRef.current.position.addScaledVector(
      enemy.lastHitDirection,
      hitReactVisual * (poseTuning?.rootHitPush ?? 0.24) + staggerPose * (poseTuning?.rootStaggerPush ?? 0.28) * staggerScale + deathProgress * 0.42,
    );
    const hasBakedEnemyModel = Boolean(enemyModelKey);
    const idleRootBob = hasBakedEnemyModel ? (enemy.archetypeId === "repair_drone" ? 0.006 : 0.002) : 0.025;
    rootRef.current.position.y += enemyModelAltitude(enemy) + Math.sin(clock.elapsedTime * 2 + enemy.id) * idleRootBob;
    rootRef.current.rotation.y = enemy.rotationY;
    const moveAmount = clamp01(enemy.velocity.length() / Math.max(0.1, archetype.moveSpeed * enemy.moveSpeedMultiplier));
    const stride = Math.sin(enemy.spawnAge * 8.8 + enemy.id * 0.53) * moveAmount;
    const stepLift = Math.abs(stride) * 0.06;
    const attackKick = attackKickFor(enemy, archetype.attackCooldown * enemy.attackCooldownMultiplier);
    const hitKick = hitReactVisual;
    const damagePulse = Math.max(enemy.damageFlash, enemy.hitReact);
    rootRef.current.position.y +=
      (hasBakedEnemyModel ? 0 : stepLift) +
      attackKick * (hasBakedEnemyModel ? 0.018 : 0.06) +
      hitKick * (poseTuning?.verticalHitLift ?? (hasBakedEnemyModel ? 0.038 : 0.09)) +
      staggerPose * (poseTuning?.verticalStaggerLift ?? (hasBakedEnemyModel ? 0.08 : 0.14)) * staggerScale +
      deathProgress * (hasBakedEnemyModel ? 0.18 : 0.34);
    rootRef.current.scale.setScalar(
      renderScale *
        (1 + hitKick * (poseTuning?.scaleHit ?? (hasBakedEnemyModel ? 0.024 : 0.052)) + staggerPose * (poseTuning?.scaleStagger ?? 0.018) - deathProgress * 0.42),
    );
    rootRef.current.rotation.x =
      deathProgress * (hasBakedEnemyModel ? 0.12 : 0.26) -
      staggerPose * (poseTuning?.pitchStagger ?? (hasBakedEnemyModel ? 0.1 : 0.18)) * staggerScale -
      hitKick * (largeHitTarget ? 0.022 : 0);
    rootRef.current.rotation.z =
      enemy.lastHitDirection.x * deathProgress * (hasBakedEnemyModel ? 0.18 : 0.36) +
      hitKick * (hasBakedEnemyModel ? 0.018 : 0.044) +
      enemy.lastHitDirection.x * staggerPose * (poseTuning?.rollStagger ?? (hasBakedEnemyModel ? 0.16 : 0.28)) * staggerScale;
    const damageGlow = 1 - enemy.health / enemy.maxHealth;
    const woundedPose = clamp01((damageGlow - 0.34) / 0.34);
    const coreColor = enemy.coreColor || enemyPremiumLightingPalette.core;
    const warningColor = enemy.warningColor || enemyPremiumLightingPalette.warning;
    materials.core.color.set(coreColor);
    materials.core.emissive.set(coreColor);
    materials.coreGlass.color.set(coreColor);
    materials.coreGlass.emissive.set(coreColor);
    materials.blueGlow.color.set(coreColor);
    materials.blueGlow.emissive.set(coreColor);
    materials.warning.color.set(warningColor);
    materials.warning.emissive.set(warningColor);
    materials.core.emissiveIntensity = (1.8 + damageGlow * 2.2 + enemy.damageFlash * 4 + deathProgress * 2.5) * enemy.lightIntensityMultiplier;
    materials.warning.emissiveIntensity = (0.42 + attackKick * 1.25 + damagePulse * 0.72 + hitKick * 0.56) * enemy.lightIntensityMultiplier;
    materials.armor.color.set(enemy.armorColor || materialColor(visualProfile?.materialKey));
    materials.body.color.set(enemy.bodyColor || bodyColor(visualProfile?.materialKey));
    if (isInstancedSmallEnemy(enemy)) {
      rootRef.current.position.addScaledVector(enemy.lastHitDirection, woundedPose * 0.05);
      rootRef.current.rotation.z += enemy.lastHitDirection.x * woundedPose * 0.08;
      rootRef.current.rotation.x += woundedPose * 0.04;
      materials.core.emissiveIntensity += woundedPose * 1.4;
      materials.warning.emissiveIntensity += woundedPose * 1.1;
    }

    if (hasBakedEnemyModel) {
      if (torsoRef.current) {
        torsoRef.current.position.set(0, -staggerPose * (poseTuning?.torsoDip ?? 0.035) * staggerScale, 0);
        torsoRef.current.rotation.x = -hitKick * 0.055 - staggerPose * (poseTuning?.torsoPitch ?? 0.12) * staggerScale;
        torsoRef.current.rotation.z = hitKick * 0.028 + enemy.lastHitDirection.x * staggerPose * (poseTuning?.torsoRoll ?? 0.2) * staggerScale;
      }
      return;
    }

    if (torsoRef.current) {
      torsoRef.current.rotation.x =
        -moveAmount * 0.06 + attackKick * 0.1 - hitKick * 0.18 - staggerPose * 0.14 * bossPoseScale + woundedPose * 0.08 + deathProgress * 0.34;
      torsoRef.current.rotation.z =
        stride * 0.025 + hitKick * 0.22 + enemy.lastHitDirection.x * staggerPose * 0.18 * bossPoseScale + woundedPose * enemy.lastHitDirection.x * 0.16 + deathProgress * enemy.lastHitDirection.x * 0.4;
    }
    if (headRef.current) {
      headRef.current.rotation.x = -attackKick * 0.16 - hitKick * 0.28 - staggerPose * 0.18 * bossPoseScale;
      headRef.current.rotation.y =
        Math.sin(enemy.spawnAge * 2.8 + enemy.id) * 0.08 * moveAmount + hitKick * 0.28 + staggerPose * 0.14 * bossPoseScale + woundedPose * 0.18;
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = stride * 0.26 - attackKick * 0.78;
      leftArmRef.current.rotation.z = -0.1 - attackKick * 0.24 - woundedPose * 0.14;
      leftArmRef.current.position.z = attackKick * 0.22 + woundedPose * 0.08;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -stride * 0.26 - attackKick * 0.78;
      rightArmRef.current.rotation.z = 0.1 + attackKick * 0.24 + woundedPose * 0.14;
      rightArmRef.current.position.z = attackKick * 0.22 + woundedPose * 0.08;
    }
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = -stride * 0.42;
      leftLegRef.current.position.y = Math.max(0, stride) * 0.08;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = stride * 0.42;
      rightLegRef.current.position.y = Math.max(0, -stride) * 0.08;
    }

    if (lockRef.current) {
      const locked = world.combatAssist.lockedEnemyId === enemy.id;
      const pulse = 1 + Math.sin(clock.elapsedTime * 10) * 0.08;
      lockRef.current.visible = locked;
      lockRef.current.scale.setScalar(pulse);
    }

    const lockedForDetail = world.combatAssist.lockedEnemyId === enemy.id;
    const distanceSq = enemy.position.distanceToSquared(world.player.position);
    const detailDistanceSq = enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss" ? 24 * 24 : 10.5 * 10.5;
    const highDetail = !enemy.isAlive || lockedForDetail || enemy.damageFlash > 0.04 || distanceSq < detailDistanceSq;
    setGroupVisible(headRef.current, highDetail);
    setGroupVisible(leftArmRef.current, highDetail);
    setGroupVisible(rightArmRef.current, highDetail);
    setGroupVisible(leftLegRef.current, highDetail || enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss");
    setGroupVisible(rightLegRef.current, highDetail || enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss");

    if (detailRef.current) {
      detailRef.current.visible = highDetail;
    }
  });

  if (enemy.archetypeId === "signal_turret") {
    return (
      <group ref={rootRef} scale={[scale, scale, scale]}>
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.56, 0.72, 0.28, 16]} />
          <primitive object={materials.body} attach="material" />
        </mesh>
        <RoundedBox args={[0.72, 0.42, 0.72]} position={[0, 0.74, 0]} radius={0.05} material={materials.armor} castShadow receiveShadow />
        <RoundedBox args={[0.2, 0.2, 1.12]} position={[0, 0.84, 0.58]} radius={0.035} material={materials.barrel} castShadow receiveShadow />
        <mesh position={[0, 0.86, 1.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.2, 12]} />
          <primitive object={materials.blueGlow} attach="material" />
        </mesh>
        <ArtBadge texture={artTextures.maintenancePanels} position={[0, 0.76, 0.375]} scale={[0.52, 0.34, 1]} />
        <mesh position={[0, 1.08, 0.08]} scale={[0.12, 0.08, 0.92]}>
          <boxGeometry args={[1, 1, 1]} />
          <primitive object={materials.blueGlow} attach="material" />
        </mesh>
      </group>
    );
  }

  if (enemyModelKey) {
    const targetHeight = enemyModelTargetHeight(enemy);
    return (
      <group ref={rootRef} scale={[renderScale, renderScale, renderScale]}>
        <group ref={torsoRef}>
          <EnemyModelInstance
            modelKey={enemyModelKey}
            targetHeight={targetHeight}
            rotation={[0, enemyModelYaw(enemyModelKey), 0]}
            animationNameRef={modelAnimationNameRef}
          />
        </group>
      </group>
    );
  }

  if (enemy.archetypeId === "repair_drone") {
    return (
      <group ref={rootRef} scale={[scale, scale, scale]}>
        <group ref={torsoRef}>
          <RoundedBox args={[0.96, 0.54, 0.5]} position={[0, 1.28, 0]} radius={0.055} material={materials.body} castShadow receiveShadow />
          <mesh position={[0, 1.28, 0.03]} scale={[0.56, 0.3, 0.34]} castShadow receiveShadow>
            <sphereGeometry args={[1, 14, 8]} />
            <primitive object={materials.body} attach="material" />
          </mesh>
          <RoundedBox args={[0.42, 0.3, 0.42]} position={[-0.62, 1.22, -0.02]} radius={0.05} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[0.42, 0.3, 0.42]} position={[0.62, 1.22, -0.02]} radius={0.05} material={materials.armor} castShadow receiveShadow />
          <mesh position={[-0.62, 1.22, -0.03]} scale={[0.25, 0.19, 0.25]} castShadow receiveShadow>
            <sphereGeometry args={[1, 10, 6]} />
            <primitive object={materials.armor} attach="material" />
          </mesh>
          <mesh position={[0.62, 1.22, -0.03]} scale={[0.25, 0.19, 0.25]} castShadow receiveShadow>
            <sphereGeometry args={[1, 10, 6]} />
            <primitive object={materials.armor} attach="material" />
          </mesh>
          <RoundedBox args={[0.72, 0.12, 0.18]} position={[0, 1.54, 0.2]} radius={0.024} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[1.06, 0.05, 0.06]} position={[0, 1.05, 0.28]} radius={0.014} material={materials.barrel} />
          <RoundedBox args={[0.14, 0.08, 0.18]} position={[-0.82, 1.24, 0.18]} radius={0.018} material={materials.blueGlow} />
          <RoundedBox args={[0.14, 0.08, 0.18]} position={[0.82, 1.24, 0.18]} radius={0.018} material={materials.blueGlow} />
          <mesh position={[0, 1.29, 0.34]}>
            <sphereGeometry args={[0.16, 12, 8]} />
            <primitive object={materials.core} attach="material" />
          </mesh>
          <mesh position={[-0.62, 0.96, -0.08]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.16, 0.44, 10]} />
            <primitive object={materials.nozzle} attach="material" />
          </mesh>
          <mesh position={[0.62, 0.96, -0.08]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.16, 0.44, 10]} />
            <primitive object={materials.nozzle} attach="material" />
          </mesh>
        </group>
        <LockMarker markerRef={lockRef} materials={materials} />
        <EnemyTierDetail enemy={enemy} materials={materials} />
        <group ref={detailRef}>
          <EnemyDecalSet enemy={enemy} artTextures={artTextures} />
        </group>
        <group ref={headRef} position={[0, 1.78, 0.01]}>
          <RoundedBox args={[0.46, 0.22, 0.28]} radius={0.035} material={materials.body} castShadow receiveShadow />
          <RoundedBox args={[0.3, 0.06, 0.04]} position={[0, 0.02, 0.16]} radius={0.014} material={materials.blueGlow} />
        </group>
        <group ref={leftArmRef} position={[-0.72, 1.12, 0]}>
          <RoundedBox args={[0.08, 0.48, 0.08]} rotation={[0.1, 0, -0.34]} radius={0.018} material={materials.barrel} castShadow />
          <RoundedBox args={[0.06, 0.2, 0.06]} position={[-0.12, -0.32, 0.08]} radius={0.014} material={materials.blueGlow} />
        </group>
        <group ref={rightArmRef} position={[0.72, 1.12, 0]}>
          <RoundedBox args={[0.08, 0.48, 0.08]} rotation={[0.1, 0, 0.34]} radius={0.018} material={materials.barrel} castShadow />
          <RoundedBox args={[0.06, 0.2, 0.06]} position={[0.12, -0.32, 0.08]} radius={0.014} material={materials.blueGlow} />
        </group>
      </group>
    );
  }

  if (enemy.archetypeId === "custodian_elite") {
    return (
      <group ref={rootRef} scale={[scale, scale, scale]}>
        <group ref={torsoRef}>
          <RoundedBox args={[1.58, 0.56, 0.76]} position={[0, 1.1, 0]} radius={0.075} material={materials.body} castShadow receiveShadow />
          <RoundedBox args={[1.18, 0.34, 0.42]} position={[0, 1.54, 0.06]} radius={0.055} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[1.82, 0.18, 0.54]} position={[0, 0.72, 0.06]} radius={0.045} material={materials.barrel} castShadow receiveShadow />
          <mesh position={[0, 1.34, 0.52]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.32, 0.38, 0.12, 20]} />
            <primitive object={materials.core} attach="material" />
          </mesh>
          <mesh position={[0, 1.34, 0.59]}>
            <cylinderGeometry args={[0.19, 0.23, 0.1, 16]} />
            <primitive object={materials.coreGlass} attach="material" />
          </mesh>
          <RoundedBox args={[0.9, 0.055, 0.08]} position={[0, 1.34, 0.65]} radius={0.012} material={materials.barrel} />
          <RoundedBox args={[0.055, 0.62, 0.08]} position={[-0.38, 1.34, 0.65]} radius={0.012} material={materials.barrel} />
          <RoundedBox args={[0.055, 0.62, 0.08]} position={[0.38, 1.34, 0.65]} radius={0.012} material={materials.barrel} />
          <mesh position={[-0.72, 1.06, 0.02]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.74, 12]} />
            <primitive object={materials.barrel} attach="material" />
          </mesh>
          <mesh position={[0.72, 1.06, 0.02]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.14, 0.14, 0.74, 12]} />
            <primitive object={materials.barrel} attach="material" />
          </mesh>
          <RoundedBox args={[1.28, 0.08, 0.12]} position={[0, 1.82, 0.38]} radius={0.02} material={materials.warning} castShadow />
        </group>
        <LockMarker markerRef={lockRef} materials={materials} />
        <EnemyTierDetail enemy={enemy} materials={materials} />
        <group ref={detailRef}>
          <EnemyDecalSet enemy={enemy} artTextures={artTextures} />
        </group>
        <group ref={headRef} position={[0, 2, 0.04]}>
          <RoundedBox args={[0.64, 0.24, 0.38]} radius={0.04} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[0.34, 0.055, 0.045]} position={[0, 0.02, 0.22]} radius={0.014} material={materials.blueGlow} />
        </group>
        <group ref={leftArmRef} position={[-0.94, 1.42, 0.08]}>
          <RoundedBox args={[0.2, 0.86, 0.2]} rotation={[0.18, 0, -0.28]} radius={0.04} material={materials.barrel} castShadow />
          <RoundedBox args={[0.16, 0.5, 0.16]} position={[-0.18, -0.56, 0.26]} rotation={[0.38, 0.18, -0.42]} radius={0.028} material={materials.armor} castShadow />
          <RoundedBox args={[0.1, 0.34, 0.1]} position={[-0.28, -0.86, 0.46]} rotation={[0.24, 0.16, -0.58]} radius={0.02} material={materials.warning} />
        </group>
        <group ref={rightArmRef} position={[0.94, 1.42, 0.08]}>
          <RoundedBox args={[0.2, 0.86, 0.2]} rotation={[0.18, 0, 0.28]} radius={0.04} material={materials.barrel} castShadow />
          <RoundedBox args={[0.16, 0.5, 0.16]} position={[0.18, -0.56, 0.26]} rotation={[0.38, -0.18, 0.42]} radius={0.028} material={materials.armor} castShadow />
          <RoundedBox args={[0.1, 0.34, 0.1]} position={[0.28, -0.86, 0.46]} rotation={[0.24, -0.16, 0.58]} radius={0.02} material={materials.warning} />
        </group>
        <group ref={leftLegRef} position={[-0.48, 0.48, 0]}>
          <RoundedBox args={[0.62, 0.26, 0.72]} radius={0.045} material={materials.barrel} castShadow receiveShadow />
          <mesh position={[0, -0.02, 0.34]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.16, 12]} />
            <primitive object={materials.armor} attach="material" />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.48, 0.48, 0]}>
          <RoundedBox args={[0.62, 0.26, 0.72]} radius={0.045} material={materials.barrel} castShadow receiveShadow />
          <mesh position={[0, -0.02, 0.34]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.16, 12]} />
            <primitive object={materials.armor} attach="material" />
          </mesh>
        </group>
        <EnemyClassDetail enemy={enemy} materials={materials} />
      </group>
    );
  }

  if (enemy.archetypeId === "clamp_bot") {
    return (
      <group ref={rootRef} scale={[scale, scale, scale]}>
        <group ref={torsoRef}>
          <RoundedBox args={[1.18, 0.64, 0.58]} position={[0, 1.14, 0]} radius={0.05} material={materials.body} castShadow receiveShadow />
          <mesh position={[0, 1.13, 0.02]} scale={[0.68, 0.36, 0.34]} castShadow receiveShadow>
            <sphereGeometry args={[1, 14, 8]} />
            <primitive object={materials.body} attach="material" />
          </mesh>
          <RoundedBox args={[1.42, 0.26, 0.3]} position={[0, 1.43, 0.18]} radius={0.035} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[0.96, 0.18, 0.22]} position={[0, 0.82, 0.2]} radius={0.028} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[1.28, 0.08, 0.08]} position={[0, 1.02, 0.34]} radius={0.018} material={materials.barrel} />
          <RoundedBox args={[0.22, 0.14, 0.16]} position={[-0.48, 1.5, 0.36]} radius={0.018} material={materials.warning} />
          <RoundedBox args={[0.22, 0.14, 0.16]} position={[0.48, 1.5, 0.36]} radius={0.018} material={materials.warning} />
          <mesh position={[0, 1.16, 0.34]}>
            <sphereGeometry args={[0.16, 12, 8]} />
            <primitive object={materials.core} attach="material" />
          </mesh>
        </group>
        <LockMarker markerRef={lockRef} materials={materials} />
        <EnemyTierDetail enemy={enemy} materials={materials} />
        <group ref={detailRef}>
          <EnemyDecalSet enemy={enemy} artTextures={artTextures} />
        </group>
        <group ref={headRef} position={[0, 1.74, -0.02]}>
          <RoundedBox args={[0.52, 0.2, 0.32]} radius={0.035} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[0.32, 0.05, 0.04]} position={[0, 0.02, 0.18]} radius={0.012} material={materials.warning} />
        </group>
        <group ref={leftArmRef} position={[-0.78, 1.28, 0]}>
          <RoundedBox args={[0.28, 0.72, 0.26]} rotation={[0.1, 0, -0.18]} radius={0.034} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[0.14, 0.46, 0.16]} position={[-0.18, -0.48, 0.24]} rotation={[-0.18, 0.2, -0.32]} radius={0.022} material={materials.warning} castShadow />
          <RoundedBox args={[0.14, 0.46, 0.16]} position={[0.02, -0.52, 0.26]} rotation={[0.18, -0.1, 0.18]} radius={0.022} material={materials.barrel} castShadow />
        </group>
        <group ref={rightArmRef} position={[0.78, 1.28, 0]}>
          <RoundedBox args={[0.28, 0.72, 0.26]} rotation={[0.1, 0, 0.18]} radius={0.034} material={materials.armor} castShadow receiveShadow />
          <RoundedBox args={[0.14, 0.46, 0.16]} position={[0.18, -0.48, 0.24]} rotation={[-0.18, -0.2, 0.32]} radius={0.022} material={materials.warning} castShadow />
          <RoundedBox args={[0.14, 0.46, 0.16]} position={[-0.02, -0.52, 0.26]} rotation={[0.18, 0.1, -0.18]} radius={0.022} material={materials.barrel} castShadow />
        </group>
        <group ref={leftLegRef} position={[-0.34, 0.54, 0]}>
          <RoundedBox args={[0.36, 0.42, 0.42]} radius={0.035} material={materials.body} castShadow receiveShadow />
          <RoundedBox args={[0.5, 0.14, 0.66]} position={[0, -0.28, -0.08]} radius={0.03} material={materials.barrel} castShadow receiveShadow />
        </group>
        <group ref={rightLegRef} position={[0.34, 0.54, 0]}>
          <RoundedBox args={[0.36, 0.42, 0.42]} radius={0.035} material={materials.body} castShadow receiveShadow />
          <RoundedBox args={[0.5, 0.14, 0.66]} position={[0, -0.28, -0.08]} radius={0.03} material={materials.barrel} castShadow receiveShadow />
        </group>
        <EnemyClassDetail enemy={enemy} materials={materials} />
      </group>
    );
  }

  return (
    <group ref={rootRef} scale={[scale, scale, scale]}>
      <group ref={torsoRef}>
        <RoundedBox args={[0.88, 0.96, 0.52]} position={[0, 1.45, 0]} radius={0.045} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[1.06, 0.34, 0.24]} position={[0, 1.68, 0.18]} radius={0.035} material={materials.armor} castShadow receiveShadow />
        <RoundedBox args={[0.74, 0.16, 0.18]} position={[0, 1.08, 0.22]} radius={0.026} material={materials.armor} castShadow receiveShadow />
        <mesh position={[0, 1.46, 0.31]}>
          <sphereGeometry args={[0.18, 12, 8]} />
          <primitive object={materials.core} attach="material" />
        </mesh>
      </group>
      <LockMarker markerRef={lockRef} materials={materials} />
      <EnemyTierDetail enemy={enemy} materials={materials} />
      <group ref={detailRef}>
        <EnemyDecalSet enemy={enemy} artTextures={artTextures} />
      </group>
      <group ref={headRef} position={[0, 2.1, -0.02]}>
        <RoundedBox args={[0.44, 0.26, 0.36]} radius={0.035} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[0.26, 0.045, 0.035]} position={[0, 0.03, 0.2]} radius={0.012} material={materials.blueGlow} />
      </group>
      <group ref={leftArmRef} position={[-0.62, 1.74, 0]}>
        <RoundedBox args={[0.68, 0.26, 0.48]} radius={0.04} material={materials.armor} castShadow receiveShadow />
        <RoundedBox args={[0.22, 0.62, 0.28]} position={[-0.1, -0.48, -0.04]} radius={0.035} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[0.16, 0.32, 0.2]} position={[-0.12, -0.86, 0.16]} radius={0.03} material={materials.armor} castShadow receiveShadow />
        <RoundedBox args={[0.08, 0.08, 0.34]} position={[-0.1, -0.38, 0.28]} radius={0.02} material={materials.blueGlow} />
        <RoundedBox args={[0.06, 0.22, 0.36]} position={[-0.2, -1.02, 0.28]} rotation={[0.18, 0.1, -0.18]} radius={0.018} material={materials.warning} />
      </group>
      <group ref={rightArmRef} position={[0.62, 1.74, 0]}>
        <RoundedBox args={[0.68, 0.26, 0.48]} radius={0.04} material={materials.armor} castShadow receiveShadow />
        <RoundedBox args={[0.22, 0.62, 0.28]} position={[0.1, -0.48, -0.04]} radius={0.035} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[0.16, 0.32, 0.2]} position={[0.12, -0.86, 0.16]} radius={0.03} material={materials.armor} castShadow receiveShadow />
        <RoundedBox args={[0.08, 0.08, 0.34]} position={[0.1, -0.38, 0.28]} radius={0.02} material={materials.blueGlow} />
        <RoundedBox args={[0.06, 0.22, 0.36]} position={[0.2, -1.02, 0.28]} rotation={[0.18, -0.1, 0.18]} radius={0.018} material={materials.warning} />
      </group>
      <group ref={leftLegRef} position={[-0.28, 0.72, 0]}>
        <RoundedBox args={[0.28, 0.72, 0.34]} radius={0.035} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[0.44, 0.18, 0.62]} position={[0, -0.5, -0.08]} radius={0.035} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[0.12, 0.05, 0.36]} position={[0, -0.42, 0.28]} radius={0.016} material={materials.blueGlow} />
      </group>
      <group ref={rightLegRef} position={[0.28, 0.72, 0]}>
        <RoundedBox args={[0.28, 0.72, 0.34]} radius={0.035} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[0.44, 0.18, 0.62]} position={[0, -0.5, -0.08]} radius={0.035} material={materials.body} castShadow receiveShadow />
        <RoundedBox args={[0.12, 0.05, 0.36]} position={[0, -0.42, 0.28]} radius={0.016} material={materials.blueGlow} />
      </group>
      <EnemyClassDetail enemy={enemy} materials={materials} />
    </group>
  );
}

type AtlasRegion = "main" | "core" | "strip" | "limb" | "hazard" | "small";

const atlasRegions: Record<AtlasRegion, { offset: [number, number]; repeat: [number, number] }> = {
  main: { offset: [0, 0.54], repeat: [0.46, 0.42] },
  core: { offset: [0.02, 0.24], repeat: [0.48, 0.26] },
  strip: { offset: [0.02, 0.02], repeat: [0.9, 0.08] },
  limb: { offset: [0.5, 0.48], repeat: [0.34, 0.34] },
  hazard: { offset: [0.58, 0.08], repeat: [0.34, 0.22] },
  small: { offset: [0.64, 0.66], repeat: [0.22, 0.22] },
};

function DecalPlate({
  texture,
  region,
  position,
  scale,
  rotation = [0, 0, 0],
  opacity = 0.96,
}: {
  texture: Texture;
  region: AtlasRegion;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  opacity?: number;
}) {
  const decalTexture = useMemo(() => {
    return sharedAtlasRegionTexture(texture, region);
  }, [region, texture]);

  return (
    <mesh position={position} rotation={rotation} scale={scale} renderOrder={8}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={decalTexture}
        transparent={opacity < 0.999}
        opacity={opacity}
        toneMapped={false}
        depthWrite={opacity >= 0.999}
        polygonOffset
        polygonOffsetFactor={-3}
        side={DoubleSide}
      />
    </mesh>
  );
}

const decalTextureCache = new WeakMap<Texture, Map<AtlasRegion, Texture>>();

function sharedAtlasRegionTexture(texture: Texture, region: AtlasRegion) {
  let regionMap = decalTextureCache.get(texture);
  if (!regionMap) {
    regionMap = new Map<AtlasRegion, Texture>();
    decalTextureCache.set(texture, regionMap);
  }

  const cached = regionMap.get(region);
  if (cached) return cached;

  const regionConfig = atlasRegions[region];
  const clone = texture.clone();
  clone.offset.set(regionConfig.offset[0], regionConfig.offset[1]);
  clone.repeat.set(regionConfig.repeat[0], regionConfig.repeat[1]);
  clone.colorSpace = texture.colorSpace;
  clone.wrapS = texture.wrapS;
  clone.wrapT = texture.wrapT;
  clone.anisotropy = texture.anisotropy;
  clone.needsUpdate = true;
  regionMap.set(region, clone);
  return clone;
}

function EnemyDecalSet({ enemy, artTextures }: { enemy: EnemyState; artTextures: First90Textures }) {
  const atlas = enemyAtlasTexture(enemy, artTextures);

  if (enemy.archetypeId === "custodian_elite") {
    return (
      <>
        <DecalPlate texture={atlas} region="core" position={[0, 1.34, 0.605]} scale={[0.78, 0.58, 1]} opacity={1} />
        <DecalPlate texture={atlas} region="main" position={[0, 1.56, 0.285]} scale={[1.08, 0.38, 1]} opacity={1} />
        <DecalPlate texture={atlas} region="hazard" position={[0, 0.78, 0.34]} scale={[0.92, 0.2, 1]} opacity={0.42} />
        <DecalPlate texture={atlas} region="limb" position={[-0.88, 1.22, 0.35]} scale={[0.34, 0.62, 1]} opacity={0.94} />
        <DecalPlate texture={atlas} region="limb" position={[0.88, 1.22, 0.35]} scale={[0.34, 0.62, 1]} opacity={0.94} />
        <DecalPlate texture={atlas} region="strip" position={[0, 2.02, 0.24]} scale={[0.62, 0.08, 1]} opacity={1} />
      </>
    );
  }

  if (enemy.archetypeId === "clamp_bot") {
    return (
      <>
        <DecalPlate texture={atlas} region="main" position={[0, 1.12, 0.345]} scale={[0.82, 0.54, 1]} opacity={0.9} />
        <DecalPlate texture={atlas} region="hazard" position={[0, 1.43, 0.345]} scale={[0.86, 0.18, 1]} opacity={0.38} />
        <DecalPlate texture={atlas} region="limb" position={[-0.33, 0.52, 0.2]} scale={[0.28, 0.54, 1]} opacity={0.82} />
        <DecalPlate texture={atlas} region="limb" position={[0.33, 0.52, 0.2]} scale={[0.28, 0.54, 1]} opacity={0.82} />
        <DecalPlate texture={atlas} region="small" position={[0, 1.75, 0.17]} scale={[0.36, 0.12, 1]} opacity={0.9} />
      </>
    );
  }

  if (enemy.archetypeId === "repair_drone") {
    return (
      <>
        <DecalPlate texture={atlas} region="main" position={[0, 1.27, 0.31]} scale={[0.78, 0.42, 1]} opacity={0.9} />
        <DecalPlate texture={atlas} region="strip" position={[0, 1.54, 0.31]} scale={[0.86, 0.1, 1]} opacity={0.94} />
        <DecalPlate texture={atlas} region="small" position={[0, 1.79, 0.16]} scale={[0.36, 0.12, 1]} opacity={0.94} />
        <DecalPlate texture={atlas} region="limb" position={[-0.62, 1.22, 0.22]} scale={[0.28, 0.28, 1]} opacity={0.78} />
        <DecalPlate texture={atlas} region="limb" position={[0.62, 1.22, 0.22]} scale={[0.28, 0.28, 1]} opacity={0.78} />
      </>
    );
  }

  if (enemy.archetypeId === "shield_tech") {
    return (
      <>
        <DecalPlate texture={atlas} region="core" position={[0, 1.14, 0.315]} scale={[0.72, 0.58, 1]} opacity={0.86} />
        <DecalPlate texture={atlas} region="strip" position={[0, 1.72, 0.315]} scale={[0.92, 0.13, 1]} opacity={0.92} />
        <DecalPlate texture={atlas} region="small" position={[0, 2.11, 0.19]} scale={[0.32, 0.12, 1]} opacity={0.9} />
      </>
    );
  }

  return (
    <>
      <DecalPlate texture={atlas} region="main" position={[0, 1.12, 0.315]} scale={[0.7, 0.58, 1]} opacity={0.88} />
      <DecalPlate texture={atlas} region="strip" position={[0, 1.71, 0.315]} scale={[0.96, 0.14, 1]} opacity={0.94} />
      <DecalPlate texture={atlas} region="small" position={[0, 2.11, 0.19]} scale={[0.34, 0.13, 1]} opacity={0.94} />
      <DecalPlate texture={atlas} region="limb" position={[-0.28, 0.52, 0.2]} scale={[0.28, 0.54, 1]} opacity={0.78} />
      <DecalPlate texture={atlas} region="limb" position={[0.28, 0.52, 0.2]} scale={[0.28, 0.54, 1]} opacity={0.78} />
    </>
  );
}

function ArtBadge({
  texture,
  position,
  scale,
}: {
  texture: Texture;
  position: [number, number, number];
  scale: [number, number, number];
}) {
  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent opacity={0.72} toneMapped={false} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

function LockMarker({
  markerRef,
  materials,
}: {
  markerRef: RefObject<Group>;
  materials: ReturnType<typeof useEnemyMaterials>;
}) {
  return (
    <group ref={markerRef} visible={false} position={[0, 1.46, 0.47]}>
      <RoundedBox args={[0.96, 0.06, 0.045]} position={[0, 0.42, 0]} radius={0.012} material={materials.scannerRail} />
      <RoundedBox args={[0.96, 0.06, 0.045]} position={[0, -0.42, 0]} radius={0.012} material={materials.scannerRail} />
      <LockCorner position={[-0.52, 0.32, 0]} rotationZ={0} materials={materials} />
      <LockCorner position={[0.52, 0.32, 0]} rotationZ={Math.PI / 2} materials={materials} />
      <LockCorner position={[0.52, -0.32, 0]} rotationZ={Math.PI} materials={materials} />
      <LockCorner position={[-0.52, -0.32, 0]} rotationZ={-Math.PI / 2} materials={materials} />
      <RoundedBox args={[0.12, 0.12, 0.05]} position={[0, 0, 0.01]} radius={0.018} material={materials.blueGlow} />
    </group>
  );
}

function LockCorner({
  position,
  rotationZ,
  materials,
}: {
  position: [number, number, number];
  rotationZ: number;
  materials: ReturnType<typeof useEnemyMaterials>;
}) {
  return (
    <group position={position} rotation={[0, 0, rotationZ]}>
      <RoundedBox args={[0.26, 0.055, 0.05]} position={[0.11, 0, 0]} radius={0.012} material={materials.blueGlow} />
      <RoundedBox args={[0.055, 0.26, 0.05]} position={[0, -0.11, 0]} radius={0.012} material={materials.blueGlow} />
      <RoundedBox args={[0.09, 0.09, 0.045]} position={[0.02, -0.02, -0.01]} radius={0.014} material={materials.barrel} />
    </group>
  );
}

function EnemyTierDetail({
  enemy,
  materials,
}: {
  enemy: EnemyState;
  materials: ReturnType<typeof useEnemyMaterials>;
}) {
  if (enemy.tier === "normal") return null;

  const isBoss = enemy.tier === "boss";
  const isLeader = enemy.tier === "leader";
  const width = isBoss ? 1.28 : isLeader ? 1.06 : 0.78;
  const y = enemy.archetypeId === "custodian_elite" ? 2.22 : 2.02;
  return (
    <group position={[0, y, 0.1]}>
      <RoundedBox args={[width, 0.08, 0.14]} position={[0, 0, 0.18]} radius={0.018} material={materials.warning} castShadow />
      <RoundedBox args={[0.18, 0.16, 0.08]} position={[-width * 0.42, 0.08, 0.22]} radius={0.024} material={materials.core} castShadow />
      <RoundedBox args={[0.18, 0.16, 0.08]} position={[width * 0.42, 0.08, 0.22]} radius={0.024} material={materials.core} castShadow />
      {(isLeader || isBoss) ? (
        <>
          <RoundedBox args={[0.12, 0.34, 0.1]} position={[-width * 0.52, -0.12, 0.14]} rotation={[0.1, 0, -0.18]} radius={0.018} material={materials.armor} castShadow />
          <RoundedBox args={[0.12, 0.34, 0.1]} position={[width * 0.52, -0.12, 0.14]} rotation={[0.1, 0, 0.18]} radius={0.018} material={materials.armor} castShadow />
        </>
      ) : null}
      {isBoss ? (
        <RoundedBox args={[0.42, 0.1, 0.16]} position={[0, 0.18, 0.24]} radius={0.022} material={materials.coreGlass} castShadow />
      ) : null}
    </group>
  );
}

function EnemyClassDetail({
  enemy,
  materials,
}: {
  enemy: EnemyState;
  materials: ReturnType<typeof useEnemyMaterials>;
}) {
  if (enemy.archetypeId === "repair_drone") {
    return (
      <>
        <mesh position={[0, 0.24, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.24, 0.32, 12]} />
          <primitive object={materials.nozzle} attach="material" />
        </mesh>
        <RoundedBox args={[0.12, 0.42, 0.12]} position={[-0.5, 0.95, 0.32]} radius={0.025} material={materials.blueGlow} />
        <RoundedBox args={[0.12, 0.42, 0.12]} position={[0.5, 0.95, 0.32]} radius={0.025} material={materials.blueGlow} />
      </>
    );
  }

  if (enemy.archetypeId === "clamp_bot") {
    return (
      <>
        <RoundedBox args={[0.18, 0.52, 0.18]} position={[-0.92, 1.06, 0.34]} rotation={[0, -0.35, -0.28]} radius={0.03} material={materials.warning} />
        <RoundedBox args={[0.18, 0.52, 0.18]} position={[0.92, 1.06, 0.34]} rotation={[0, 0.35, 0.28]} radius={0.03} material={materials.warning} />
        <RoundedBox args={[0.16, 0.1, 0.46]} position={[-0.97, 0.78, 0.56]} rotation={[-0.2, 0.35, 0.2]} radius={0.025} material={materials.barrel} />
        <RoundedBox args={[0.16, 0.1, 0.46]} position={[0.97, 0.78, 0.56]} rotation={[-0.2, -0.35, -0.2]} radius={0.025} material={materials.barrel} />
      </>
    );
  }

  if (enemy.archetypeId === "shield_tech") {
    return (
      <group position={[0, 1.42, 0.62]}>
        <RoundedBox args={[0.34, 0.78, 0.08]} position={[0, 0, 0.04]} radius={0.028} material={materials.shieldPlate} castShadow />
        <RoundedBox args={[0.22, 0.7, 0.08]} position={[-0.36, -0.02, 0]} rotation={[0, 0, 0.16]} radius={0.026} material={materials.shieldPlate} castShadow />
        <RoundedBox args={[0.22, 0.7, 0.08]} position={[0.36, -0.02, 0]} rotation={[0, 0, -0.16]} radius={0.026} material={materials.shieldPlate} castShadow />
        <RoundedBox args={[0.06, 0.66, 0.035]} position={[0, 0, 0.1]} radius={0.012} material={materials.blueGlow} />
        <RoundedBox args={[0.04, 0.46, 0.035]} position={[-0.36, -0.02, 0.08]} rotation={[0, 0, 0.16]} radius={0.01} material={materials.blueGlow} />
        <RoundedBox args={[0.04, 0.46, 0.035]} position={[0.36, -0.02, 0.08]} rotation={[0, 0, -0.16]} radius={0.01} material={materials.blueGlow} />
      </group>
    );
  }

  if (enemy.archetypeId === "custodian_elite") {
    return (
      <>
        <RoundedBox args={[1.32, 0.22, 0.52]} position={[0, 0.38, -0.08]} radius={0.045} material={materials.barrel} castShadow receiveShadow />
        <RoundedBox args={[1.54, 0.14, 0.18]} position={[0, 0.48, 0.44]} radius={0.035} material={materials.warning} castShadow receiveShadow />
        <RoundedBox args={[0.18, 0.92, 0.18]} position={[-0.82, 1.36, 0.36]} rotation={[0.22, 0, -0.18]} radius={0.028} material={materials.barrel} castShadow />
        <RoundedBox args={[0.18, 0.92, 0.18]} position={[0.82, 1.36, 0.36]} rotation={[0.22, 0, 0.18]} radius={0.028} material={materials.barrel} castShadow />
        <RoundedBox args={[0.18, 0.48, 0.18]} position={[-1.02, 0.95, 0.54]} rotation={[0.35, 0.12, -0.36]} radius={0.026} material={materials.armor} castShadow />
        <RoundedBox args={[0.18, 0.48, 0.18]} position={[1.02, 0.95, 0.54]} rotation={[0.35, -0.12, 0.36]} radius={0.026} material={materials.armor} castShadow />
        <RoundedBox args={[0.12, 0.32, 0.1]} position={[-1.1, 0.7, 0.66]} rotation={[0.08, 0.2, -0.62]} radius={0.02} material={materials.warning} />
        <RoundedBox args={[0.12, 0.32, 0.1]} position={[1.1, 0.7, 0.66]} rotation={[0.08, -0.2, 0.62]} radius={0.02} material={materials.warning} />
        <RoundedBox args={[0.64, 0.08, 0.1]} position={[0, 1.38, 0.72]} radius={0.016} material={materials.barrel} />
        <RoundedBox args={[0.08, 0.44, 0.1]} position={[-0.28, 1.38, 0.72]} radius={0.016} material={materials.barrel} />
        <RoundedBox args={[0.08, 0.44, 0.1]} position={[0.28, 1.38, 0.72]} radius={0.016} material={materials.barrel} />
        <RoundedBox args={[0.34, 0.28, 0.08]} position={[0, 1.38, 0.78]} radius={0.028} material={materials.coreGlass} />
        <mesh position={[-0.45, 1.95, 0.42]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <primitive object={materials.warning} attach="material" />
        </mesh>
        <mesh position={[0.45, 1.95, 0.42]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <primitive object={materials.warning} attach="material" />
        </mesh>
      </>
    );
  }

  return null;
}

function enemyModelTargetHeight(enemy: EnemyState) {
  if (enemy.archetypeId === "repair_drone") return 1.32;
  if (enemy.archetypeId === "clamp_bot") return 1.42;
  if (enemy.archetypeId === "shield_tech") return 1.62;
  if (enemy.tier === "boss" && enemy.textureAtlasKey === "custodian_boss") return 3.05;
  if (enemy.archetypeId === "custodian_elite" || enemy.tier === "boss") return 2.65;
  if (enemy.tier === "leader") return 2.15;
  return 1.48;
}

function enemyModelAltitude(enemy: EnemyState) {
  if (enemy.archetypeId === "repair_drone") return enemy.isAlive ? 0.62 : 0.08;
  return 0;
}

function enemyModelYaw(_modelKey: NonNullable<ReturnType<typeof modelKeyForEnemy>>) {
  return 0;
}

function enemyModelAnimationName(enemy: EnemyState, archetype: (typeof enemyArchetypes)[EnemyState["archetypeId"]]) {
  if (!enemy.isAlive) return "death";
  if (enemy.spawnAge < 0.44) return "spawn_boot";
  if (enemy.staggerRemaining > 0) return "stagger";
  if (enemy.attackWindupRemaining > 0) return "attack_windup";
  const cooldown = archetype.attackCooldown * enemy.attackCooldownMultiplier;
  const sinceAttack = cooldown - enemy.attackCooldownRemaining;
  if (sinceAttack >= 0 && sinceAttack < 0.24) return "attack_windup";
  if (sinceAttack >= 0.24 && sinceAttack < 0.58) return "attack_strike";
  if (sinceAttack >= 0.58 && sinceAttack < 0.98) return "attack_recover";
  if (enemy.velocity.lengthSq() > 0.04) return "move";
  return "idle";
}

type EnemyObjectMaterial = Material & {
  colorWrite: boolean;
  depthWrite: boolean;
  transparent: boolean;
  opacity: number;
  needsUpdate: boolean;
};

function materialColor(materialKey?: string) {
  if (materialKey === "shield_blue") return enemyPremiumLightingPalette.shield;
  if (materialKey === "clamp_red") return enemyPremiumLightingPalette.dark;
  if (materialKey === "signal_cyan") return "#1d3940";
  if (materialKey === "custodian_gold_red") return enemyPremiumLightingPalette.armor;
  return enemyPremiumLightingPalette.body;
}

function bodyColor(materialKey?: string) {
  if (materialKey === "shield_blue") return "#98aaa4";
  if (materialKey === "clamp_red") return "#827f76";
  if (materialKey === "signal_cyan") return "#203238";
  if (materialKey === "custodian_gold_red") return enemyPremiumLightingPalette.body;
  return enemyPremiumLightingPalette.body;
}

function attackKickFor(enemy: EnemyState, cooldown: number) {
  const stagger = staggerProgress(enemy);
  if (stagger > 0) return Math.sin(stagger * Math.PI) * (enemy.tier === "boss" ? 0.86 : 0.68);
  const windup = attackWindupProgress(enemy);
  if (windup > 0) return Math.sin(windup * Math.PI * 0.5) * 0.88;
  const attackWindow = 0.5;
  const sinceAttack = cooldown - enemy.attackCooldownRemaining;
  if (sinceAttack < 0 || sinceAttack > attackWindow) return 0;
  return Math.sin((sinceAttack / attackWindow) * Math.PI);
}

function attackWindupProgress(enemy: EnemyState) {
  if (enemy.attackWindupTotal <= 0 || enemy.attackWindupRemaining <= 0) return 0;
  return clamp01(1 - enemy.attackWindupRemaining / enemy.attackWindupTotal);
}

function staggerProgress(enemy: EnemyState) {
  if (enemy.staggerTotal <= 0 || enemy.staggerRemaining <= 0) return 0;
  return clamp01(1 - enemy.staggerRemaining / enemy.staggerTotal);
}

function staggerPoseAmount(enemy: EnemyState) {
  if (enemy.staggerTotal <= 0 || enemy.staggerRemaining <= 0) return 0;
  const progress = clamp01(1 - enemy.staggerRemaining / enemy.staggerTotal);
  return Math.sin(progress * Math.PI) * (enemy.tier === "boss" ? 1.18 : 0.92);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function setGroupVisible(group: Group | null, visible: boolean) {
  if (group) group.visible = visible;
}

function setEnemyMaterialWarmupState(
  materials: ReturnType<typeof useEnemyMaterials>,
  invisible: boolean,
  stateRef: MutableRefObject<boolean | null>,
) {
  if (stateRef.current === invisible) return;
  stateRef.current = invisible;
  for (const material of Object.values(materials)) {
    material.colorWrite = !invisible;
    material.depthWrite = !invisible;
    material.transparent = invisible;
    material.opacity = invisible ? 0 : 1;
    material.needsUpdate = true;
  }
}

function setEnemyObjectWarmupState(
  root: Group,
  invisible: boolean,
  stateRef: MutableRefObject<boolean | null>,
) {
  if (stateRef.current === invisible) return;
  stateRef.current = invisible;
  root.traverse((object) => {
    const mesh = object as { material?: Material | Material[] };
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const writable = material as EnemyObjectMaterial;
      writable.colorWrite = !invisible;
      writable.depthWrite = !invisible;
      writable.transparent = invisible;
      writable.opacity = invisible ? 0 : 1;
      writable.needsUpdate = true;
    }
  });
}

function setRobotShadowState(
  root: Group,
  enabled: boolean,
  stateRef: MutableRefObject<boolean | null>,
) {
  if (stateRef.current === enabled) return;
  stateRef.current = enabled;
  root.traverse((object) => {
    const shadowObject = object as { castShadow?: boolean; receiveShadow?: boolean };
    if (typeof shadowObject.castShadow === "boolean") shadowObject.castShadow = enabled;
    if (typeof shadowObject.receiveShadow === "boolean") shadowObject.receiveShadow = enabled;
  });
}

function enemyAtlasTexture(enemy: EnemyState, artTextures: First90Textures) {
  if (enemy.textureAtlasKey === "custodian_boss") return artTextures.custodianBossAtlas;
  if (enemy.textureAtlasKey === "clamp_bot") return artTextures.clampBotAtlas;
  return artTextures.repairDroneAtlas;
}

function useEnemyMaterials() {
  return useMemo(
    () => ({
      body: new MeshStandardMaterial({ color: enemyPremiumLightingPalette.body, metalness: 0.84, roughness: 0.26 }),
      armor: new MeshStandardMaterial({ color: enemyPremiumLightingPalette.armor, metalness: 0.82, roughness: 0.24 }),
      barrel: new MeshStandardMaterial({ color: enemyPremiumLightingPalette.barrel, metalness: 0.9, roughness: 0.22 }),
      nozzle: new MeshStandardMaterial({
        color: "#1b2a2d",
        emissive: "#0b3f46",
        emissiveIntensity: 0.34,
        metalness: 0.72,
        roughness: 0.26,
      }),
      core: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.core,
        emissive: enemyPremiumLightingPalette.coreEmissive,
        emissiveIntensity: 1.28,
        metalness: 0.18,
        roughness: 0.15,
        toneMapped: false,
      }),
      coreGlass: new MeshStandardMaterial({
        color: "#8ff4ff",
        emissive: enemyPremiumLightingPalette.coreEmissive,
        emissiveIntensity: 0.95,
        metalness: 0.08,
        roughness: 0.18,
        toneMapped: false,
      }),
      blueGlow: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.core,
        emissive: enemyPremiumLightingPalette.coreEmissive,
        emissiveIntensity: 1,
        metalness: 0.2,
        roughness: 0.18,
        toneMapped: false,
      }),
      scannerRail: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.scannerRail,
        emissive: enemyPremiumLightingPalette.coreEmissive,
        emissiveIntensity: 0.46,
        metalness: 0.44,
        roughness: 0.22,
        toneMapped: false,
      }),
      shieldPlate: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.shield,
        emissive: enemyPremiumLightingPalette.shieldEmissive,
        emissiveIntensity: 0.34,
        metalness: 0.68,
        roughness: 0.24,
      }),
      warning: new MeshStandardMaterial({
        color: enemyPremiumLightingPalette.warning,
        emissive: enemyPremiumLightingPalette.warningEmissive,
        emissiveIntensity: 0.32,
        metalness: 0.62,
        roughness: 0.25,
        toneMapped: false,
      }),
    }),
    [],
  );
}
