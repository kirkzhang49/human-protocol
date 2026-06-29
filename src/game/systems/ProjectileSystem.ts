import { Vector3 } from "three";
import { gameBalance } from "../config/gameBalance";
import { enemyArchetypes } from "../config/enemyArchetypes";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../core/RoomReachability";
import type { EnemyState } from "../entities/EnemyState";

export class ProjectileSystem implements GameSystem {
  private readonly spatialIndex = new ProjectileSpatialIndex();
  private readonly enemyHitPoint = new Vector3();
  private readonly enemyCenter = new Vector3();
  private readonly enemyClosestPoint = new Vector3();
  private readonly projectileSegment = new Vector3();
  private readonly projectilePointDelta = new Vector3();

  update(world: GameWorld, delta: number) {
    if (world.projectiles.length === 0) return;

    const limit = gameBalance.arenaHalfSize + 2;
    this.spatialIndex.rebuild(world);

    for (let index = world.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = world.projectiles[index];
      projectile.age += delta;
      projectile.previousPosition.copy(projectile.position);
      projectile.position.addScaledVector(projectile.velocity, delta);

      if (
        projectile.age >= projectile.lifetime ||
        Math.abs(projectile.position.x) > limit ||
        Math.abs(projectile.position.z) > limit ||
        this.hitObstacle(world, index) ||
        this.hitEnemy(world, index) ||
        this.hitPuzzleTarget(world, index)
      ) {
        world.projectiles.splice(index, 1);
      }
    }
  }

  private hitEnemy(world: GameWorld, projectileIndex: number) {
    const projectile = world.projectiles[projectileIndex];
    for (const enemy of this.spatialIndex.queryEnemies(projectile.position.x, projectile.position.z)) {
      if (projectile.hitEnemyIds.includes(enemy.id)) continue;
      this.enemyCenter.copy(enemy.position);
      this.enemyCenter.y += 1.25;
      this.closestPointOnProjectileSegment(projectile.previousPosition, projectile.position, this.enemyCenter);
      const dx = this.enemyClosestPoint.x - this.enemyCenter.x;
      const dy = this.enemyClosestPoint.y - this.enemyCenter.y;
      const dz = this.enemyClosestPoint.z - this.enemyCenter.z;
      const radius = enemy.radius + projectile.radius;
      if (dx * dx + dy * dy + dz * dz <= radius * radius) {
        this.enemyHitPoint.copy(this.enemyCenter);
        if (!world.hasProjectileLineOfSight(projectile.previousPosition, this.enemyHitPoint, projectile.radius)) {
          world.addEffect("hitSpark", projectile.position, projectile.direction, 0.22, 0.9);
          world.emitAudio("enemy_hit", { intensity: 0.55, position: projectile.position });
          return true;
        }
        projectile.hitEnemyIds.push(enemy.id);
        const archetype = enemyArchetypes[enemy.archetypeId];
        const shieldMultiplier = archetype.shielded && projectile.weaponId !== "flakBurst" ? 0.45 : 1;
        enemy.health = Math.max(0, enemy.health - projectile.damage * shieldMultiplier);
        world.markEnemyHit(enemy, projectile.direction, projectile.weaponId === "flakBurst" ? 1.2 : projectile.weaponId === "railLance" ? 0.92 : 0.78);
        const railExecuted =
          projectile.weaponId === "railLance" &&
          enemy.tier !== "boss" &&
          world.upgrades.railExecuteThreshold > 0 &&
          enemy.health > 0 &&
          enemy.health <= enemy.maxHealth * world.upgrades.railExecuteThreshold;
        if (railExecuted) {
          enemy.health = 0;
        }
        if (projectile.weaponId === "flakBurst") {
          enemy.velocity.addScaledVector(projectile.direction, 2.25 * world.upgrades.shockKnockbackMultiplier);
        }
        if (enemy.health <= 0) {
          world.killEnemy(enemy);
          if (projectile.weaponId === "pulseRifle" && world.upgrades.pulseKillHeatRefund > 0) {
            world.player.heat = Math.max(0, world.player.heat - world.upgrades.pulseKillHeatRefund);
          }
          world.addEffect("dashBurst", enemy.position, projectile.direction, 0.42, archetype.elite || enemy.tier !== "normal" ? 1.95 : 1.65);
          world.applyCameraImpact(archetype.elite || enemy.tier !== "normal" ? 0.28 : 0.16, archetype.elite || enemy.tier !== "normal" ? 1.35 : 0.75, 0.11, 0.1);
          world.emitAudio(archetype.audioKey, {
            intensity: archetype.elite ? 1.55 : enemy.archetypeId === "shield_tech" ? 1.15 : 1,
            position: enemy.position,
          });
        } else {
          const heavyTarget = archetype.elite || enemy.tier !== "normal" || enemy.archetypeId === "custodian_elite";
          const railCoreHit = projectile.weaponId === "railLance" && heavyTarget;
          const impactPosition = railCoreHit
            ? enemy.position.clone().addScaledVector(projectile.direction, -(enemy.radius + 0.16))
            : projectile.position;
          if (railCoreHit) impactPosition.y += enemy.tier === "boss" ? 1.38 : 1.08;
          world.addEffect(railCoreHit ? "coreSpark" : heavyTarget || shieldMultiplier < 1 ? "armorSpark" : "hitSpark", impactPosition, projectile.direction, railCoreHit ? 0.28 : 0.2, railCoreHit ? 2.05 : heavyTarget ? 1.48 : shieldMultiplier < 1 ? 1.35 : 1.22);
          if (railCoreHit) {
            const side = new Vector3(-projectile.direction.z, 0, projectile.direction.x);
            if (side.lengthSq() < 0.001) side.set(1, 0, 0);
            side.normalize();
            world.addEffect("coreSpark", impactPosition.clone().addScaledVector(side, 0.18), projectile.direction.clone().addScaledVector(side, 0.4).normalize(), 0.24, 1.74);
            world.addEffect("coreSpark", impactPosition.clone().addScaledVector(side, -0.18), projectile.direction.clone().addScaledVector(side, -0.4).normalize(), 0.24, 1.74);
          }
          if (projectile.weaponId === "railLance") {
            world.applyCameraImpact(railCoreHit ? 0.12 : shieldMultiplier < 1 ? 0.075 : 0.055, railCoreHit ? 0.38 : 0.18, railCoreHit ? 0.04 : 0.025, railCoreHit ? 0.06 : 0.045);
            if (railCoreHit) {
              world.applyCombatHitStop(0.042, 0.15);
            }
          }
          world.emitAudio("enemy_hit", {
            intensity: railCoreHit ? 1.32 : heavyTarget ? 1.18 : shieldMultiplier < 1 ? 0.9 : 1.08,
            position: projectile.position,
          });
        }
        if (projectile.weaponId === "flakBurst" && world.upgrades.shockRepairPing) {
          world.player.health = Math.min(world.player.maxHealth, world.player.health + world.upgrades.shockHealPerHit);
        }
        if (projectile.pierceRemaining > 0) {
          projectile.pierceRemaining -= 1;
          return false;
        }
        return true;
      }
    }
    return false;
  }

  private closestPointOnProjectileSegment(start: Vector3, end: Vector3, point: Vector3) {
    this.projectileSegment.copy(end).sub(start);
    const lengthSq = this.projectileSegment.lengthSq();
    if (lengthSq <= 0.000001) {
      this.enemyClosestPoint.copy(end);
      return this.enemyClosestPoint;
    }
    const t = Math.max(0, Math.min(1, this.projectilePointDelta.copy(point).sub(start).dot(this.projectileSegment) / lengthSq));
    this.enemyClosestPoint.copy(start).addScaledVector(this.projectileSegment, t);
    return this.enemyClosestPoint;
  }

  private hitPuzzleTarget(world: GameWorld, projectileIndex: number) {
    const projectile = world.projectiles[projectileIndex];
    if (!projectile.canHitPuzzleTargets) return false;
    if (!world.hitPuzzleTargetAt(projectile.position, projectile.radius, projectile.weaponId, projectile.direction)) return false;
    return true;
  }

  private hitObstacle(world: GameWorld, projectileIndex: number) {
    const projectile = world.projectiles[projectileIndex];
    if (world.isProjectileSegmentBlockedByObstacle(projectile.previousPosition, projectile.position, projectile.radius)) {
      world.addEffect("hitSpark", projectile.position, projectile.direction, 0.22, 1);
      world.emitAudio("enemy_hit", { intensity: 0.55, position: projectile.position });
      return true;
    }
    return false;
  }
}

class ProjectileSpatialIndex {
  private readonly cellSize = 4;
  private readonly cellKeyOffset = 32768;
  private readonly cellKeyStride = 65536;
  private readonly enemyCells = new Map<number, EnemyState[]>();
  private readonly freeEnemyBuckets: EnemyState[][] = [];
  private readonly enemyQuerySet = new Set<EnemyState>();

  rebuild(world: GameWorld) {
    for (const bucket of this.enemyCells.values()) {
      bucket.length = 0;
      this.freeEnemyBuckets.push(bucket);
    }
    this.enemyCells.clear();

    for (const enemy of world.enemies) {
      if (!enemy.isAlive) continue;
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
      this.pushEnemy(this.cellKeyFor(enemy.position.x, enemy.position.z), enemy);
    }
  }

  queryEnemies(x: number, z: number) {
    this.enemyQuerySet.clear();
    const centerX = this.cellCoord(x);
    const centerZ = this.cellCoord(z);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const enemies = this.enemyCells.get(this.cellKey(centerX + dx, centerZ + dz));
        if (!enemies) continue;
        for (const enemy of enemies) this.enemyQuerySet.add(enemy);
      }
    }
    return this.enemyQuerySet;
  }

  private pushEnemy(key: number, enemy: EnemyState) {
    const bucket = this.enemyCells.get(key);
    if (bucket) bucket.push(enemy);
    else {
      const nextBucket = this.freeEnemyBuckets.pop() ?? [];
      nextBucket.push(enemy);
      this.enemyCells.set(key, nextBucket);
    }
  }

  private cellKeyFor(x: number, z: number) {
    return this.cellKey(this.cellCoord(x), this.cellCoord(z));
  }

  private cellCoord(value: number) {
    return Math.floor(value / this.cellSize);
  }

  private cellKey(x: number, z: number) {
    return (x + this.cellKeyOffset) * this.cellKeyStride + (z + this.cellKeyOffset);
  }
}
