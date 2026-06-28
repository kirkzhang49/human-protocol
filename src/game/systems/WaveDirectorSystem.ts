import { Vector3 } from "three";
import { enemyArchetypes, type EnemyArchetypeId } from "../config/enemyArchetypes";
import { localizedWavePresentation } from "../config/LevelLocalization";
import { spawnGroupById, waveById, wavePresentationById } from "../config/levelManifest";
import type {
  EnemySpawnDefinition,
  LevelDefinition,
  LevelRoomDefinition,
  SpawnGroupId,
  WaveDefinition,
  WaveReinforcementDefinition,
} from "../config/schema/levelConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { isRoomReachableThroughOpenDoors } from "../core/RoomReachability";
import type { EnemyState } from "../entities/EnemyState";

const spawnScratch = new Vector3();
const directionScratch = new Vector3();
const spawnCandidateScratch = new Vector3();
const spawnSightScratch = new Vector3();
const SPAWN_PLAYER_MIN_DISTANCE = 2.75;
const SPAWN_PLAYER_VIEW_DISTANCE = 5.4;
const SPAWN_PLAYER_VIEW_DOT = 0.68;

interface LivingEnemyCounts {
  eliteAliveInWave: boolean;
  waveArchetypes: Partial<Record<EnemyArchetypeId, number>>;
}

export class WaveDirectorSystem implements GameSystem {
  update(world: GameWorld, delta: number) {
    if (world.session.mode !== "playing") return;

    world.session.levelElapsed += delta;
    this.checkExit(world);
    if (world.session.mode !== "playing") return;

    if (world.level.requiresStoryPickupsBeforeWaves && (!world.session.hasRod || !world.session.hasPistol)) {
      world.session.waveStartDelay = world.level.pickups.storyPickups.find((pickup) => pickup.type === "pistol")?.waveStartDelayAfterCollect ?? 1.45;
      return;
    }

    if (world.session.activeWaveId) {
      world.session.activeWaveElapsed += delta;
      if (this.startPendingWave(world, delta, true)) return;
      const activeWave = waveById(world.level, world.session.activeWaveId);
      if (activeWave) {
        this.triggerCinematicBeats(world, activeWave);
        this.checkTimedExitChaseUnlock(world, activeWave);
        this.spawnReinforcements(world, activeWave);
      }
      this.checkWaveComplete(world);
      return;
    }

    if (this.startPendingWave(world, delta, false)) return;

    const nextWave = world.level.waves[world.session.waveIndex];
    if (!nextWave) return;
    if (nextWave.trigger) return;
    if (!canStartWaveInReachableRoom(world, nextWave)) return;

    world.session.waveStartDelay -= delta;
    if (world.session.waveStartDelay > 0) return;

    this.startWave(world, nextWave);
  }

  private startWave(world: GameWorld, wave: WaveDefinition) {
    const rawPresentation = wavePresentationById(world.level, wave.id);
    const presentation = rawPresentation ? localizedWavePresentation(world.level, rawPresentation, world.settings.language) : null;

    world.session.activeWaveId = wave.id;
    world.session.activeWaveElapsed = 0;
    world.session.reinforcementCounts = {};
    const waveIndex = world.level.waves.findIndex((candidate) => candidate.id === wave.id);
    if (waveIndex >= 0) {
      world.session.waveIndex = Math.max(world.session.waveIndex, waveIndex);
    }
    world.markWaveTriggered(wave.id);
    world.session.message = presentation?.startMessage ?? world.level.presentation.defaultWaveStartMessage;
    world.setSpawnWarning(presentation?.startWarning ?? fallbackWaveWarning(world.level, wave), presentation?.startWarningDuration ?? 2);

    if (presentation?.startDialogueTrigger) {
      world.queueDialogue(presentation.startDialogueTrigger);
    }
    world.emitConfiguredAudio(presentation?.startAudio);
    world.applyConfiguredCameraImpact(presentation?.startCamera);

    let waveSpawnSeedOffset = 0;
    for (const group of wave.enemies) {
      const spawnedCount = this.spawnGroup(world, wave, group, undefined, waveSpawnSeedOffset);
      waveSpawnSeedOffset += Math.max(spawnedCount, group.count);
    }
    world.enemySpawnSequence += Math.max(1, waveSpawnSeedOffset);
  }

  private spawnReinforcements(world: GameWorld, wave: WaveDefinition) {
    if (!wave.reinforcements) return;

    const counts = this.collectLivingEnemyCounts(world, wave.id);
    for (let index = 0; index < wave.reinforcements.length; index += 1) {
      const reinforcement = wave.reinforcements[index];
      const key = `${wave.id}-${index}`;
      const spawnedGroups = world.session.reinforcementCounts[key] ?? 0;
      if (!reinforcement.endless && spawnedGroups >= reinforcement.maxGroups) continue;
      if (world.session.activeWaveElapsed < reinforcement.startsAfter + spawnedGroups * reinforcement.every) continue;
      if (reinforcement.requiresEliteAlive && !counts.eliteAliveInWave) continue;

      const spawnedCount = this.spawnGroup(world, wave, reinforcement, counts);
      if (spawnedCount <= 0) continue;
      world.session.reinforcementCounts[key] = spawnedGroups + 1;
      world.enemySpawnSequence += spawnedCount;
      world.session.message = world.level.presentation.reinforcementMessage;
      if (shouldShowReinforcementWarning(world, reinforcement, spawnedCount)) {
        world.setSpawnWarning(reinforcementWarning(world.level, reinforcement), world.level.presentation.reinforcementWarningDuration);
      }
      world.emitAudio("elite_warning", { intensity: 0.72 });
    }
  }

  private checkTimedExitChaseUnlock(world: GameWorld, wave: WaveDefinition) {
    if (!wave.timedExitUnlockAfter || world.session.exitUnlocked || world.session.activeWaveElapsed < wave.timedExitUnlockAfter) return;
    world.unlockExit();
  }

  private triggerCinematicBeats(world: GameWorld, wave: WaveDefinition) {
    const elapsed = world.session.activeWaveElapsed;
    for (const beat of world.level.cinematicBeats) {
      if (beat.waveId !== wave.id) continue;
      this.runBeat(world, beat.id, elapsed, beat.triggerAt, () => {
        if (beat.dialogueTrigger) world.queueDialogue(beat.dialogueTrigger);
        if (beat.spawnWarning) world.setSpawnWarning(beat.spawnWarning, beat.spawnWarningDuration ?? 1.85);
        if (beat.rewardPulse) world.setRewardPulse(beat.rewardPulse, beat.rewardPulseDuration ?? 1.45);
        if (beat.tempoSurgeSec) {
          world.session.tempoSurgeRemaining = Math.max(world.session.tempoSurgeRemaining, beat.tempoSurgeSec);
        }
        world.applyConfiguredCameraImpact(beat.cameraImpact);
        world.addConfiguredEffects(beat.effects);
        world.emitConfiguredAudio(beat.audio);
      });
    }
  }

  private runBeat(world: GameWorld, key: string, elapsed: number, triggerAt: number, callback: () => void) {
    if (elapsed < triggerAt) return;
    if (world.session.cinematicBeatFlags[key]) return;
    world.session.cinematicBeatFlags[key] = true;
    callback();
  }

  private checkWaveComplete(world: GameWorld) {
    const waveId = world.session.activeWaveId;
    if (!waveId) return;

    const wave = waveById(world.level, waveId);
    if (wave?.timedExitUnlockAfter) return;

    const hasAliveEnemy = world.enemies.some((enemy) => enemy.waveId === waveId && enemy.isAlive);
    if (hasAliveEnemy && !this.canCompleteAfterEliteDefeat(world, wave)) return;

    if (wave && this.hasPendingReinforcements(world, wave)) return;
    world.session.activeWaveId = null;
    const completedWaveIndex = world.level.waves.findIndex((candidate) => candidate.id === waveId);
    world.session.waveIndex = Math.max(world.session.waveIndex, completedWaveIndex >= 0 ? completedWaveIndex + 1 : world.session.waveIndex + 1);
    world.session.waveStartDelay = world.level.waves[world.session.waveIndex]?.startDelay ?? 0;

    if (wave?.completionDialogueTrigger) {
      world.queueDialogue(wave.completionDialogueTrigger);
    }
    world.markWaveCompleted(waveId);

    if (wave?.reward === "upgrade") {
      world.openUpgrade();
      return;
    }

    if (wave?.reward === "open_exit") {
      world.unlockExit();
    }
  }

  private spawnGroup(
    world: GameWorld,
    wave: WaveDefinition,
    group: EnemySpawnDefinition,
    counts?: LivingEnemyCounts,
    spawnSeedOffset = 0,
  ) {
    const spawnCount = spawnCountForGroup(group, counts);
    if (spawnCount <= 0) return 0;
    const spawnRoomId = spawnRoomIdForGroup(world.level, wave, group);

    for (let index = 0; index < spawnCount; index += 1) {
      const position = spawnPosition(world.level, group.from, index, spawnCount, spawnScratch, world.enemySpawnSequence + spawnSeedOffset + index);
      clampPositionToWaveRoom(world.level, spawnRoomId, position, spawnRadiusForGroup(group));
      moveSpawnAwayFromPlayer(world, spawnRoomId, position, spawnRadiusForGroup(group), world.enemySpawnSequence + spawnSeedOffset + index);
      const dx = world.player.position.x - position.x;
      const dz = world.player.position.z - position.z;
      const rotationY = Math.atan2(dx, dz);
      world.spawnEnemy(group.archetype, wave.id, position, rotationY, group, { spawnRoomId });
    }
    if (counts) {
      counts.waveArchetypes[group.archetype] = (counts.waveArchetypes[group.archetype] ?? 0) + spawnCount;
    }
    const effectPosition = spawnPosition(
      world.level,
      group.from,
      Math.floor(spawnCount / 2),
      Math.max(spawnCount, 1),
      spawnScratch,
      world.enemySpawnSequence + spawnSeedOffset + spawnCount,
    );
    clampPositionToWaveRoom(world.level, spawnRoomId, effectPosition, spawnRadiusForGroup(group));
    moveSpawnAwayFromPlayer(world, spawnRoomId, effectPosition, spawnRadiusForGroup(group), world.enemySpawnSequence + spawnSeedOffset + spawnCount);
    directionScratch.copy(world.player.position).sub(effectPosition).setY(0);
    if (directionScratch.lengthSq() < 0.01) directionScratch.set(0, 0, 1);
    world.addEffect("dashBurst", effectPosition, directionScratch, 0.34, 1 + Math.min(spawnCount, 5) * 0.16);
    if (spawnCount >= 3) {
      world.triggerRenderSurge(0.72 + Math.min(4, spawnCount) * 0.12);
      world.applyCameraImpact(0.18 + Math.min(5, spawnCount) * 0.035, 0.9, 0.08, 0.18);
    }
    return spawnCount;
  }

  private startPendingWave(world: GameWorld, delta: number, allowInterrupt: boolean) {
    if (world.session.pendingWaveStarts.length === 0) return false;

    for (const pending of world.session.pendingWaveStarts) {
      pending.remaining -= delta;
    }

    const readyIndex = world.session.pendingWaveStarts.findIndex((pending) => {
      if (pending.remaining > 0) return false;
      const wave = waveById(world.level, pending.waveId);
      if (!wave) return true;
      if (!canStartWaveInReachableRoom(world, wave)) return false;
      if (!world.session.activeWaveId) return true;
      const activeWave = waveById(world.level, world.session.activeWaveId);
      return allowInterrupt && (Boolean(wave.interruptsActiveWave) || Boolean(activeWave?.nonBlocking));
    });
    if (readyIndex < 0) return false;

    const [pending] = world.session.pendingWaveStarts.splice(readyIndex, 1);
    if (
      !pending.repeat &&
      (world.session.mapProgress.triggeredWaveIds.includes(pending.waveId) ||
        world.session.mapProgress.completedWaveIds.includes(pending.waveId))
    ) {
      return false;
    }

    const wave = waveById(world.level, pending.waveId);
    if (!wave) return false;
    this.startWave(world, wave);
    return true;
  }

  private hasLivingElite(world: GameWorld, waveId: string) {
    return world.enemies.some(
      (enemy) => enemy.waveId === waveId && enemy.isAlive && isEliteEnemy(world, enemy),
    );
  }

  private collectLivingEnemyCounts(world: GameWorld, waveId: string): LivingEnemyCounts {
    const counts: LivingEnemyCounts = {
      eliteAliveInWave: false,
      waveArchetypes: {},
    };

    for (const enemy of world.enemies) {
      if (!enemy.isAlive) continue;
      if (enemy.waveId !== waveId) continue;

      counts.waveArchetypes[enemy.archetypeId] = (counts.waveArchetypes[enemy.archetypeId] ?? 0) + 1;
      if (isEliteEnemy(world, enemy)) counts.eliteAliveInWave = true;
    }

    return counts;
  }

  private hasPendingReinforcements(world: GameWorld, wave: WaveDefinition) {
    if (!wave.reinforcements) return false;
    if (wave.completeWhenEliteDefeated && this.hasDefeatedElite(world, wave.id) && !this.hasLivingElite(world, wave.id)) return false;

    return wave.reinforcements.some((reinforcement, index) => {
      const key = `${wave.id}-${index}`;
      const spawnedGroups = world.session.reinforcementCounts[key] ?? 0;
      if (reinforcement.endless) return false;
      if (spawnedGroups >= reinforcement.maxGroups) return false;
      if (reinforcement.requiresEliteAlive && !this.hasLivingElite(world, wave.id)) return false;
      return true;
    });
  }

  private canCompleteAfterEliteDefeat(world: GameWorld, wave: WaveDefinition | null | undefined) {
    if (!wave?.completeWhenEliteDefeated) return false;
    if (this.hasLivingElite(world, wave.id)) return false;
    return this.hasDefeatedElite(world, wave.id);
  }

  private hasDefeatedElite(world: GameWorld, waveId: string) {
    return world.enemies.some(
      (enemy) => enemy.waveId === waveId && !enemy.isAlive && isEliteEnemy(world, enemy),
    );
  }

  private checkExit(world: GameWorld) {
    if (!exitEntryDoorOpen(world)) return;
    if (!playerIsInExitRoom(world)) return;

    const exit = world.level.exit;
    const dx = world.player.position.x - exit.position[0];
    const dz = world.player.position.z - exit.position[2];
    if (dx * dx + dz * dz <= exit.radius * exit.radius) {
      if (!world.session.exitUnlocked) world.unlockExit();
      world.activateExit("proximity");
    }
  }

}

function exitEntryDoorOpen(world: GameWorld) {
  const doorId = exitEntryDoorId(world);
  return !doorId || world.isDoorOpen(doorId);
}

function exitEntryDoorId(world: GameWorld) {
  const interaction = world.level.map?.interactions.find((candidate) => candidate.type === "exit");
  return world.level.exit.cinematic?.doorId ?? interaction?.opensDoorId ?? null;
}

function playerIsInExitRoom(world: GameWorld) {
  const exitRoomId = world.level.map?.interactions.find((candidate) => candidate.type === "exit")?.roomId;
  return !exitRoomId || world.session.mapProgress.currentRoomId === exitRoomId;
}

function spawnPosition(level: LevelDefinition, group: SpawnGroupId, index: number, total: number, target: Vector3, seed = 0) {
  const definition = spawnGroupById(level, group);
  const layout = definition?.layout ?? group;
  const center = definition?.center ?? [0, 0, 0];
  const baseX = center[0];
  const baseY = center[1];
  const baseZ = center[2];
  const radius = definition?.radius;
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const spread = (t - 0.5) * (definition?.spread ?? 14);
  const wave = Math.sin(index * 1.7) * 1.2;

  if (definition?.positions?.length) {
    const slot = positiveModulo(Math.floor(seed), definition.positions.length);
    const point = definition.positions[slot];
    const jitter = total <= 1 ? 0 : (positiveModulo(Math.floor(seed), 5) - 2) * 0.16;
    return target.set(point[0] + jitter, point[1], point[2] - jitter);
  }

  if (layout === "front") {
    return target.set(baseX + spread * 0.2, baseY, baseZ - 9.5 - index * 0.2);
  }

  if (layout === "front_arc") {
    return target.set(baseX + spread, baseY, baseZ - 12.5 + wave);
  }

  if (layout === "side_rear") {
    const side = index % 2 === 0 ? -1 : 1;
    return target.set(baseX + side * (9.5 + (index % 3)), baseY, baseZ + 5.5 + Math.floor(index / 2) * 2.2);
  }

  if (layout === "front_gate") {
    return target.set(baseX, baseY, baseZ - 14);
  }

  if (layout === "turret_rail") {
    const side = index % 2 === 0 ? -1 : 1;
    return target.set(baseX + side * 7.8, baseY, baseZ - 6 - Math.floor(index / 2) * 4);
  }

  if (layout === "around_ring") {
    const angle = (index / Math.max(1, total)) * Math.PI * 2 + (seed % 9) * 0.7;
    const ringRadius = radius ?? 13.6 + (seed % 3) * 0.55;
    return target.set(baseX + Math.sin(angle) * ringRadius, baseY, baseZ + Math.cos(angle) * ringRadius);
  }

  if (layout === "rear_ring") {
    const side = index % 2 === 0 ? -1 : 1;
    const laneOffset = ((seed + index) % 3) * 1.15;
    return target.set(baseX + side * (6.2 + laneOffset), baseY, baseZ + 11.4 + Math.floor(index / 2) * 1.8);
  }

  return target.set(baseX + spread * 0.65, baseY, baseZ - 10.5);
}

function explicitWaveRoomId(wave: WaveDefinition) {
  if (wave.roomId) return wave.roomId;
  if (wave.trigger?.type === "room_entered") return wave.trigger.id;
  return undefined;
}

function spawnRoomIdForGroup(level: LevelDefinition, wave: WaveDefinition, group: EnemySpawnDefinition | WaveReinforcementDefinition) {
  const explicitRoomId = explicitWaveRoomId(wave);
  if (explicitRoomId) return explicitRoomId;
  return inferBuilderRoomIdFromSpawnGroup(level, group.from);
}

function waveRoomIdsForStart(level: LevelDefinition, wave: WaveDefinition) {
  const explicitRoomId = explicitWaveRoomId(wave);
  if (explicitRoomId) return [explicitRoomId];
  const roomIds = new Set<string>();
  for (const spawn of wave.enemies) {
    const inferred = inferBuilderRoomIdFromSpawnGroup(level, spawn.from);
    if (inferred) roomIds.add(inferred);
  }
  for (const reinforcement of wave.reinforcements ?? []) {
    const inferred = inferBuilderRoomIdFromSpawnGroup(level, reinforcement.from);
    if (inferred) roomIds.add(inferred);
  }
  return [...roomIds];
}

function canStartWaveInReachableRoom(world: GameWorld, wave: WaveDefinition) {
  const roomIds = waveRoomIdsForStart(world.level, wave);
  return roomIds.length === 0 || roomIds.every((roomId) => isRoomReachableThroughOpenDoors(world, roomId));
}

function inferBuilderRoomIdFromSpawnGroup(level: LevelDefinition, groupId: SpawnGroupId) {
  if (groupId.startsWith("sg_")) {
    const roomId = groupId.slice(3);
    if (level.map?.rooms.some((room) => room.id === roomId)) return roomId;
  }
  return inferRoomIdFromSpawnGroupPosition(level, groupId);
}

function inferRoomIdFromSpawnGroupPosition(level: LevelDefinition, groupId: SpawnGroupId) {
  const definition = spawnGroupById(level, groupId);
  const point = definition?.center ?? definition?.positions?.[0];
  if (!point) return undefined;
  return roomIdForPoint(level, point[0], point[2]);
}

function roomIdForPoint(level: LevelDefinition, x: number, z: number) {
  return level.map?.rooms.find((room) => pointInsideRoomBounds(room, x, z))?.id;
}

function pointInsideRoomBounds(room: LevelRoomDefinition, x: number, z: number) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  return x >= cx - sx / 2 && x <= cx + sx / 2 && z >= cz - sz / 2 && z <= cz + sz / 2;
}

function spawnRadiusForGroup(group: EnemySpawnDefinition) {
  const archetype = enemyArchetypes[group.archetype];
  return Math.max(0.2, (archetype?.radius ?? 0.5) * (group.radiusMultiplier ?? 1));
}

function clampPositionToWaveRoom(level: LevelDefinition, roomId: string | undefined, position: Vector3, radius: number) {
  if (!roomId) return;
  const room = level.map?.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return;
  clampPositionToRoomBounds(position, room, radius + 0.75);
}

function clampPositionToRoomBounds(position: Vector3, room: LevelRoomDefinition, margin: number) {
  const [cx, , cz] = room.bounds.center;
  const [sx, , sz] = room.bounds.size;
  const halfX = Math.max(0.2, sx / 2 - margin);
  const halfZ = Math.max(0.2, sz / 2 - margin);
  position.x = clampValue(position.x, cx - halfX, cx + halfX);
  position.z = clampValue(position.z, cz - halfZ, cz + halfZ);

  if (room.bounds.shape && !pointInsideRoomShape(position, room)) {
    position.x = cx;
    position.z = cz;
  }
}

function moveSpawnAwayFromPlayer(world: GameWorld, roomId: string | undefined, position: Vector3, radius: number, seed: number) {
  if (!isSpawnUnsafeForPlayer(world, position)) return;
  const room = roomId ? world.level.map?.rooms.find((candidate) => candidate.id === roomId) : undefined;
  const minimumDistance = SPAWN_PLAYER_MIN_DISTANCE + radius + 0.35;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const angle = seed * 1.618 + attempt * 2.399963229728653;
    const distance = minimumDistance + (attempt % 4) * 0.72;
    spawnCandidateScratch.set(
      world.player.position.x + Math.cos(angle) * distance,
      position.y,
      world.player.position.z + Math.sin(angle) * distance,
    );
    if (room) clampPositionToRoomBounds(spawnCandidateScratch, room, radius + 0.75);
    if (!isSpawnUnsafeForPlayer(world, spawnCandidateScratch)) {
      position.copy(spawnCandidateScratch);
      return;
    }
  }

  directionScratch.copy(position).sub(world.player.position).setY(0);
  if (directionScratch.lengthSq() < 0.01) {
    directionScratch.copy(world.player.aimDirection).setY(0).multiplyScalar(-1);
  }
  if (directionScratch.lengthSq() < 0.01) directionScratch.set(-1, 0, 0);
  directionScratch.normalize();
  position.copy(world.player.position).addScaledVector(directionScratch, minimumDistance);
  position.y = spawnCandidateScratch.y;
  if (room) clampPositionToRoomBounds(position, room, radius + 0.75);
}

function isSpawnUnsafeForPlayer(world: GameWorld, position: Vector3) {
  directionScratch.copy(position).sub(world.player.position).setY(0);
  const distanceSq = directionScratch.lengthSq();
  if (distanceSq < SPAWN_PLAYER_MIN_DISTANCE * SPAWN_PLAYER_MIN_DISTANCE) return true;
  if (distanceSq > SPAWN_PLAYER_VIEW_DISTANCE * SPAWN_PLAYER_VIEW_DISTANCE) return false;
  if (distanceSq < 0.01) return true;
  const viewDot = directionScratch.normalize().dot(world.player.aimDirection);
  if (viewDot <= SPAWN_PLAYER_VIEW_DOT) return false;
  spawnSightScratch.copy(position);
  spawnSightScratch.y += 0.8;
  return world.hasLineOfSight(world.player.position, spawnSightScratch, 0.08);
}

function pointInsideRoomShape(position: Vector3, room: LevelRoomDefinition) {
  const shape = room.bounds.shape;
  if (!shape) return true;
  const [cx, , cz] = room.bounds.center;
  const x = position.x - cx;
  const z = position.z - cz;
  let inside = false;
  const points = shape.points;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, zi] = points[index];
    const [xj, zj] = points[previous];
    const denom = zj - zi;
    if (Math.abs(denom) < 0.0001) continue;
    const intersects = (zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / denom + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function positiveModulo(value: number, modulus: number) {
  return ((value % modulus) + modulus) % modulus;
}

function fallbackWaveWarning(level: LevelDefinition, wave: WaveDefinition) {
  return { label: "封锁部署", detail: sourceSummary(level, wave.enemies.map((group) => group.from)) };
}

function reinforcementWarning(level: LevelDefinition, reinforcement: WaveReinforcementDefinition) {
  return {
    label: sourceLabel(level, reinforcement.from),
    detail: `${enemyLabel(reinforcement.archetype)}靠近`,
  };
}

function shouldShowReinforcementWarning(world: GameWorld, reinforcement: WaveReinforcementDefinition, spawnedCount: number) {
  return (
    spawnedCount >= 2 ||
    reinforcement.archetype === "clamp_bot" ||
    reinforcement.from === "side_rear" ||
    reinforcement.from === "rear_ring" ||
    !isSmallSpawn(world, reinforcement)
  );
}

function sourceSummary(level: LevelDefinition, groups: SpawnGroupId[]) {
  return [...new Set(groups)].map((group) => sourceLabel(level, group)).join(" / ");
}

function sourceLabel(level: LevelDefinition, group: SpawnGroupId) {
  return level.presentation.spawnSourceLabels[group] ?? spawnGroupById(level, group)?.label ?? "未知来源";
}

function enemyLabel(archetype: EnemyArchetypeId) {
  return enemyArchetypes[archetype]?.displayName ?? "维修单位";
}

function isSmallEnemy(world: GameWorld, archetype: EnemyArchetypeId) {
  return world.level.combatLimits.smallEnemyArchetypes.includes(archetype);
}

function isSmallSpawn(world: GameWorld, group: EnemySpawnDefinition) {
  return isSmallEnemy(world, group.archetype) && (!group.tier || group.tier === "normal");
}

function spawnCountForGroup(group: EnemySpawnDefinition, counts?: LivingEnemyCounts) {
  if (!counts) return group.count;
  const maxAlive = "maxAlive" in group && typeof group.maxAlive === "number" ? group.maxAlive : undefined;
  if (typeof maxAlive !== "number") return group.count;
  const alive = counts.waveArchetypes[group.archetype] ?? 0;
  return Math.max(0, Math.min(group.count, maxAlive - alive));
}

function isEliteEnemy(world: GameWorld, enemy: EnemyState) {
  return enemy.archetypeId === world.level.combatLimits.eliteArchetypeId || enemy.tier === "elite" || enemy.tier === "leader" || enemy.tier === "boss";
}
