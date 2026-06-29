import { Vector3 } from "three";
import { enemyArchetypes } from "../config/enemyArchetypes";
import { movementBoundsForLevel } from "../config/MapMovementBounds";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../core/RoomReachability";
import type { EnemyState } from "../entities/EnemyState";
import { clamp, resolveCircleAabb, resolveCircleObb } from "../core/math";
import { reconcilePlanarVelocityWithKinematicResult } from "./KinematicMovement";

const HEAVY_ATTACK_STRIKE_ANIMATION_OFFSET = 0.24;
const ENEMY_LINE_OF_SIGHT_RADIUS = 0.12;

export class EnemyAISystem implements GameSystem {
  private readonly toPlayer = new Vector3();
  private readonly desired = new Vector3();
  private readonly tangent = new Vector3();
  private readonly obstacleDelta = new Vector3();
  private readonly separation = new Vector3();
  private readonly spacingDelta = new Vector3();
  private readonly moveDelta = new Vector3();
  private readonly sightStart = new Vector3();
  private readonly sightTarget = new Vector3();

  update(world: GameWorld, delta: number) {
    if (world.session.mode !== "playing") return;

    this.tryLowHealthProtocol(world);

    for (const enemy of world.enemies) {
      if (!enemy.isAlive) continue;
      const archetype = enemyArchetypes[enemy.archetypeId];
      const moveSpeed = archetype.moveSpeed * enemy.moveSpeedMultiplier;
      const attackRange = archetype.attackRange * enemy.attackRangeMultiplier;
      enemy.spawnAge += delta;
      enemy.damageFlash = Math.max(0, enemy.damageFlash - delta * 4);
      enemy.attackCooldownRemaining = Math.max(0, enemy.attackCooldownRemaining - delta);
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) {
        enemy.attackWindupRemaining = 0;
        enemy.attackWindupTotal = 0;
        enemy.velocity.multiplyScalar(Math.exp(-8 * delta));
        continue;
      }

      this.toPlayer.copy(world.player.position).sub(enemy.position).setY(0);
      const distance = Math.max(0.001, this.toPlayer.length());
      const directionToPlayer = this.toPlayer.multiplyScalar(1 / distance);
      const canSeePlayer = this.canSeePlayer(world, enemy, distance);
      const canTrackPlayer = canSeePlayer || this.canTrackPlayerAroundNavigationObstacles(world, enemy, distance);
      if (canTrackPlayer) {
        enemy.rotationY = Math.atan2(directionToPlayer.x, directionToPlayer.z);
      }
      enemy.staggerCharge = Math.max(0, enemy.staggerCharge - delta * (isHeavyThreat(enemy, world) ? 0.48 : 1.4));
      enemy.staggerRemaining = Math.max(0, enemy.staggerRemaining - delta);
      if (enemy.staggerRemaining > 0) {
        enemy.attackWindupRemaining = 0;
        enemy.attackWindupTotal = 0;
        enemy.attackCooldownRemaining = Math.max(enemy.attackCooldownRemaining, 0.22);
        enemy.velocity.multiplyScalar(Math.exp(-12 * delta));
        if (!this.moveWithPhysics(world, enemy, delta)) {
          enemy.position.addScaledVector(enemy.velocity, delta);
          this.resolveArena(world, enemy);
        }
        this.resolveEnemySpacing(world, enemy);
        this.resolveArena(world, enemy);
        world.tryTriggerBossPhases(enemy);
        continue;
      }

      if (enemy.archetypeId !== "signal_turret" && canTrackPlayer && distance > attackRange * 0.82) {
        this.desired.copy(directionToPlayer);
        if (enemy.archetypeId === "clamp_bot") {
          const side = enemy.id % 2 === 0 ? 1 : -1;
          this.tangent.set(directionToPlayer.z * side, 0, -directionToPlayer.x * side);
          this.desired.addScaledVector(this.tangent, 0.45).normalize();
        }
        this.separationFromEnemies(world, enemy);
        if (this.separation.lengthSq() > 0.0001) {
          this.desired.addScaledVector(this.separation, separationSteerWeight(enemy)).normalize();
        }
        this.steerAroundNavigationObstacles(world, enemy, directionToPlayer);
        enemy.velocity.lerp(this.desired.multiplyScalar(moveSpeed), 1 - Math.exp(-5 * delta));
      } else {
        enemy.velocity.multiplyScalar(Math.exp(-5 * delta));
        if (enemy.archetypeId !== "signal_turret") {
          this.applySeparationDrift(world, enemy, moveSpeed, delta);
        }
      }

      if (!this.moveWithPhysics(world, enemy, delta)) {
        enemy.position.addScaledVector(enemy.velocity, delta);
        this.resolveArena(world, enemy);
      }
      this.resolveEnemySpacing(world, enemy);
      this.resolveArena(world, enemy);
      this.attackPlayer(world, enemy, distance, canSeePlayer, delta);

      world.tryTriggerBossPhases(enemy);
    }
  }

  private attackPlayer(world: GameWorld, enemy: EnemyState, distance: number, canSeePlayer: boolean, delta: number) {
    if (!enemy.isAlive) return;
    const archetype = enemyArchetypes[enemy.archetypeId];
    const attackRange = archetype.attackRange * enemy.attackRangeMultiplier;
    const attackCooldown = archetype.attackCooldown * enemy.attackCooldownMultiplier;
    const heavyThreat = isHeavyThreat(enemy, world);

    if (enemy.attackWindupRemaining > 0) {
      enemy.velocity.multiplyScalar(Math.exp(-8 * delta));
      enemy.attackWindupRemaining = Math.max(0, enemy.attackWindupRemaining - delta);
      if (enemy.attackWindupRemaining > 0) return;

      if (canSeePlayer && distance <= attackRange * 1.08) {
        this.resolveAttackHit(world, enemy, archetype.damage * enemy.damageMultiplier, heavyThreat);
      } else {
        enemy.attackCooldownRemaining = Math.max(enemy.attackCooldownRemaining, heavyThreat ? 0.42 : 0.2);
        world.addEffect("dashBurst", enemy.position, this.toPlayer.copy(world.player.position).sub(enemy.position).setY(0).normalize(), 0.18, 0.7);
      }
      return;
    }

    if (!canSeePlayer) return;
    if (distance > attackRange || enemy.attackCooldownRemaining > 0) return;

    if (heavyThreat) {
      enemy.attackWindupTotal = heavyThreatWindupSeconds(enemy);
      enemy.attackWindupRemaining = enemy.attackWindupTotal;
      enemy.velocity.multiplyScalar(0.08);
      enemy.damageFlash = Math.max(enemy.damageFlash, 0.34);
      const warningDirection = this.toPlayer.copy(world.player.position).sub(enemy.position).setY(0);
      if (warningDirection.lengthSq() < 0.001) {
        warningDirection.set(Math.sin(enemy.rotationY), 0, Math.cos(enemy.rotationY));
      }
      warningDirection.normalize();
      world.addEffect("dangerTelegraph", enemy.position, warningDirection, enemy.attackWindupTotal + 0.2, attackRange * (enemy.tier === "boss" ? 1.08 : 0.88));
      world.addEffect("shockwave", enemy.position, warningDirection, 0.34, enemy.tier === "boss" ? 1.35 : 1.15);
      const warningCore = enemy.position.clone().addScaledVector(warningDirection, -0.1);
      warningCore.y += enemy.tier === "boss" ? 1.48 : 1.14;
      world.addEffect("armorSpark", warningCore, warningDirection.clone().multiplyScalar(-1), enemy.tier === "boss" ? 0.32 : 0.24, enemy.tier === "boss" ? 1.9 : 1.42);
      if (enemy.tier === "boss") {
        world.applyCameraImpact(0.08, 0.34, 0.035, 0.08);
      }
      world.emitAudio("elite_warning", { intensity: enemy.tier === "boss" ? 0.86 : 0.68, position: enemy.position });
      return;
    }

    this.resolveAttackHit(world, enemy, archetype.damage * enemy.damageMultiplier, heavyThreat);
  }

  private resolveAttackHit(world: GameWorld, enemy: EnemyState, baseDamage: number, heavyThreat: boolean) {
    const archetype = enemyArchetypes[enemy.archetypeId];
    const attackCooldown = archetype.attackCooldown * enemy.attackCooldownMultiplier;
    enemy.attackCooldownRemaining = heavyThreat
      ? Math.max(0, attackCooldown - HEAVY_ATTACK_STRIKE_ANIMATION_OFFSET)
      : attackCooldown;
    enemy.attackWindupRemaining = 0;
    enemy.attackWindupTotal = 0;
    world.player.health = Math.max(0, world.player.health - baseDamage * world.incomingDamageMultiplier());
    if (heavyThreat) {
      world.applyCameraImpact(0.86, 4.4, 0.48, 0.34);
      world.player.damageFlash = Math.max(world.player.damageFlash, 1);
    } else {
      world.applyCameraImpact(0.38, 1.6, 0.18, 0.16);
      world.player.damageFlash = Math.max(world.player.damageFlash, 0.72);
    }
    this.toPlayer.copy(world.player.position).sub(enemy.position).setY(0).normalize();
    world.addEffect("hitSpark", world.player.position, this.toPlayer, 0.16, 1.1);
    world.emitAudio("player_hit", {
      intensity: enemy.archetypeId === "custodian_elite" || enemy.tier === "leader" || enemy.tier === "boss" ? 1.35 : 0.9,
      position: enemy.position,
    });
  }

  private tryLowHealthProtocol(world: GameWorld) {
    if (
      !world.upgrades.lowHealthAutoShock ||
      world.upgrades.lowHealthAutoShockUsed ||
      world.player.health > world.player.maxHealth * 0.28
    ) {
      return;
    }

    world.upgrades.lowHealthAutoShockUsed = true;
    world.triggerEmergencyUltimateBlast();
  }

  private resolveArena(world: GameWorld, enemy: EnemyState) {
    const position = enemy.position;
    const radius = enemy.radius;
    const bounds = movementBoundsForLevel(world.level, radius);
    position.x = clamp(position.x, bounds.minX, bounds.maxX);
    position.z = clamp(position.z, bounds.minZ, bounds.maxZ);

    this.moveDelta.set(0, 0, 0);
    const result = world.moveKinematicCircleWithPhysics({
      id: `enemy:${enemy.id}:recovery`,
      position,
      radius,
      height: enemyCollisionHeight(enemy),
      desiredTranslation: this.moveDelta,
      filter: enemyPhysicsObstacleBlocks,
    });
    if (result) {
      position.copy(result.position);
      return;
    }

    for (const obstacle of world.syncObstacleIndex().queryCircle(position.x, position.z, radius)) {
      if (obstacle.enemyNavigation === "soft" || obstacle.enemyNavigation === "ignore") continue;
      if (obstacle.yaw) {
        resolveCircleObb(position, radius, obstacle.position, obstacle.halfSize, obstacle.yaw);
      } else {
        resolveCircleAabb(position, radius, obstacle.position, obstacle.halfSize);
      }
    }
  }

  private moveWithPhysics(world: GameWorld, enemy: EnemyState, delta: number) {
    const bounds = movementBoundsForLevel(world.level, enemy.radius);
    this.moveDelta.copy(enemy.velocity).multiplyScalar(delta);
    const targetX = clamp(enemy.position.x + this.moveDelta.x, bounds.minX, bounds.maxX);
    const targetZ = clamp(enemy.position.z + this.moveDelta.z, bounds.minZ, bounds.maxZ);
    this.moveDelta.x = targetX - enemy.position.x;
    this.moveDelta.z = targetZ - enemy.position.z;
    const result = world.moveKinematicCircleWithPhysics({
      id: `enemy:${enemy.id}`,
      position: enemy.position,
      radius: enemy.radius,
      height: enemyCollisionHeight(enemy),
      desiredTranslation: this.moveDelta,
      filter: enemyPhysicsObstacleBlocks,
    });
    if (!result) return false;
    enemy.position.copy(result.position);
    reconcilePlanarVelocityWithKinematicResult(enemy.velocity, this.moveDelta, result, delta);
    return true;
  }

  private steerAroundNavigationObstacles(world: GameWorld, enemy: EnemyState, directionToPlayer: Vector3) {
    const probeDistance = Math.max(0.9, Math.min(1.8, enemy.radius + 0.95));
    const probeX = enemy.position.x + directionToPlayer.x * probeDistance;
    const probeZ = enemy.position.z + directionToPlayer.z * probeDistance;
    const probeRadius = enemy.radius + 0.55;
    let signedPressure = 0;

    for (const obstacle of world.syncObstacleIndex().queryCircle(probeX, probeZ, probeRadius + 1.4)) {
      if (obstacle.enemyNavigation === "ignore") continue;
      const dx = obstacle.position.x - probeX;
      const dz = obstacle.position.z - probeZ;
      const reachX = obstacle.halfSize.x + probeRadius;
      const reachZ = obstacle.halfSize.z + probeRadius;
      if (Math.abs(dx) > reachX || Math.abs(dz) > reachZ) continue;

      this.obstacleDelta.copy(obstacle.position).sub(enemy.position).setY(0);
      const cross = directionToPlayer.x * this.obstacleDelta.z - directionToPlayer.z * this.obstacleDelta.x;
      const side = Math.abs(cross) < 0.08 ? deterministicObstacleSide(enemy, obstacle.id) : cross >= 0 ? 1 : -1;
      const normalizedOverlap = 1 - Math.max(Math.abs(dx) / Math.max(0.001, reachX), Math.abs(dz) / Math.max(0.001, reachZ));
      const obstacleWeight = obstacle.enemyNavigation === "soft" ? 1 : 1.35;
      signedPressure += side * obstacleWeight * Math.max(0.05, normalizedOverlap);
    }

    if (Math.abs(signedPressure) <= 0.001) return;
    const side = signedPressure > 0 ? 1 : -1;
    this.tangent.set(directionToPlayer.z * side, 0, -directionToPlayer.x * side);
    this.desired.addScaledVector(this.tangent, Math.min(1.2, 0.55 + Math.abs(signedPressure) * softObstacleSteerWeight(enemy))).normalize();
  }

  private canSeePlayer(world: GameWorld, enemy: EnemyState, distance: number) {
    if (distance > enemyVisionRange(enemy, world)) return false;
    this.sightStart.copy(enemy.position);
    this.sightStart.y += enemy.tier === "boss" ? 1.35 : enemy.tier === "leader" ? 1.05 : 0.82;
    this.sightTarget.copy(world.player.position);
    this.sightTarget.y += 1.05;
    return world.hasLineOfSight(this.sightStart, this.sightTarget, ENEMY_LINE_OF_SIGHT_RADIUS);
  }

  private canTrackPlayerAroundNavigationObstacles(world: GameWorld, enemy: EnemyState, distance: number) {
    if (distance > enemyVisionRange(enemy, world)) return false;
    this.sightStart.copy(enemy.position);
    this.sightStart.y += enemy.tier === "boss" ? 1.35 : enemy.tier === "leader" ? 1.05 : 0.82;
    this.sightTarget.copy(world.player.position);
    this.sightTarget.y += 1.05;
    return world.hasEnemyNavigationLineOfSight(this.sightStart, this.sightTarget, ENEMY_LINE_OF_SIGHT_RADIUS);
  }

  private applySeparationDrift(world: GameWorld, enemy: EnemyState, moveSpeed: number, delta: number) {
    this.separationFromEnemies(world, enemy);
    if (this.separation.lengthSq() <= 0.0001) return;
    const drift = moveSpeed * 0.44 * (1 - Math.exp(-6 * delta));
    enemy.velocity.addScaledVector(this.separation, drift);
  }

  private separationFromEnemies(world: GameWorld, enemy: EnemyState) {
    this.separation.set(0, 0, 0);
    for (const other of world.enemies) {
      if (other === enemy || !other.isAlive) continue;
      this.spacingDelta.copy(enemy.position).sub(other.position).setY(0);
      let distanceSq = this.spacingDelta.lengthSq();
      if (distanceSq < 0.0001) {
        const angle = deterministicSeparationAngle(enemy, other);
        this.spacingDelta.set(Math.cos(angle), 0, Math.sin(angle));
        distanceSq = 0.0001;
      }
      const distance = Math.sqrt(distanceSq);
      const range = enemy.radius + other.radius + enemySeparationPadding(enemy, other) + 0.8;
      if (distance >= range) continue;
      this.spacingDelta.multiplyScalar(1 / distance);
      const pressure = (range - distance) / range;
      this.separation.addScaledVector(this.spacingDelta, pressure * pressure);
    }
    const lengthSq = this.separation.lengthSq();
    if (lengthSq > 1) this.separation.multiplyScalar(1 / Math.sqrt(lengthSq));
    return this.separation;
  }

  private resolveEnemySpacing(world: GameWorld, enemy: EnemyState) {
    for (const other of world.enemies) {
      if (other === enemy || !other.isAlive) continue;
      this.spacingDelta.copy(enemy.position).sub(other.position).setY(0);
      let distanceSq = this.spacingDelta.lengthSq();
      if (distanceSq < 0.0001) {
        const angle = deterministicSeparationAngle(enemy, other);
        this.spacingDelta.set(Math.cos(angle), 0, Math.sin(angle));
        distanceSq = 0.0001;
      }
      const distance = Math.sqrt(distanceSq);
      const minimum = enemy.radius + other.radius + enemySeparationPadding(enemy, other);
      if (distance >= minimum) continue;
      this.spacingDelta.multiplyScalar(1 / distance);
      const push = Math.min(0.18, (minimum - distance) * enemySpacingResolveWeight(enemy, other));
      enemy.position.addScaledVector(this.spacingDelta, push);
      enemy.velocity.addScaledVector(this.spacingDelta, push * 4.5);
    }
  }
}

function enemyPhysicsObstacleBlocks(obstacle: { enemyNavigation?: "solid" | "soft" | "ignore" }) {
  return obstacle.enemyNavigation !== "soft" && obstacle.enemyNavigation !== "ignore";
}

function enemyCollisionHeight(enemy: EnemyState) {
  const tierHeight = enemy.tier === "boss" ? 2.55 : enemy.tier === "leader" ? 1.95 : 1.45;
  return Math.max(enemy.radius * 2.15, tierHeight * Math.max(0.85, enemy.visualScaleMultiplier));
}

function isHeavyThreat(enemy: EnemyState, world: GameWorld) {
  return (
    enemy.archetypeId === "custodian_elite" ||
    enemy.archetypeId === world.level.combatLimits.eliteArchetypeId ||
    enemy.tier === "leader" ||
    enemy.tier === "boss"
  );
}

function heavyThreatWindupSeconds(enemy: EnemyState) {
  if (enemy.tier === "boss") return 0.52;
  if (enemy.tier === "leader") return 0.46;
  return 0.42;
}

function enemyVisionRange(enemy: EnemyState, world: GameWorld) {
  if (enemy.tier === "boss") return 24;
  if (enemy.tier === "leader" || enemy.archetypeId === "custodian_elite" || enemy.archetypeId === world.level.combatLimits.eliteArchetypeId) return 21;
  if (enemy.archetypeId === "signal_turret") return 18;
  if (enemy.archetypeId === "clamp_bot") return 17.5;
  return 16;
}

function enemySeparationPadding(enemy: EnemyState, other: EnemyState) {
  if (enemy.tier === "normal" && other.tier === "normal") return 0.46;
  if (enemy.tier === "normal" || other.tier === "normal") return 0.34;
  return 0.22;
}

function separationSteerWeight(enemy: EnemyState) {
  if (enemy.tier === "normal") return 1.25;
  if (enemy.tier === "leader") return 0.72;
  if (enemy.tier === "boss") return 0.45;
  return 0.9;
}

function softObstacleSteerWeight(enemy: EnemyState) {
  if (enemy.tier === "normal") return 1.05;
  if (enemy.tier === "leader") return 0.8;
  if (enemy.tier === "boss") return 0.62;
  return 0.9;
}

function enemySpacingResolveWeight(enemy: EnemyState, other: EnemyState) {
  if (enemy.tier === "normal" && other.tier !== "normal") return 0.72;
  if (enemy.tier !== "normal" && other.tier === "normal") return 0.34;
  return 0.5;
}

function deterministicSeparationAngle(enemy: EnemyState, other: EnemyState) {
  return (((enemy.id * 37 + other.id * 17) % 360) * Math.PI) / 180;
}

function deterministicObstacleSide(enemy: EnemyState, obstacleId: string) {
  let hash = enemy.id * 131;
  for (let index = 0; index < obstacleId.length; index += 1) {
    hash = Math.imul(hash ^ obstacleId.charCodeAt(index), 16777619);
  }
  return hash % 2 === 0 ? 1 : -1;
}
