import { Vector3 } from "three";
import { enemyArchetypes } from "../config/enemyArchetypes";
import { playerConfig } from "../config/playerConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { isEnemyVisibleToPlayerRoom } from "../core/RoomReachability";
import { clamp, damp, dampAngle, wrapAngle } from "../core/math";

export class MobileAssistSystem implements GameSystem {
  private readonly toEnemy = new Vector3();
  private readonly flatForward = new Vector3();
  private readonly flatRight = new Vector3();

  update(world: GameWorld, delta: number) {
    const assist = world.combatAssist;
    const player = world.player;

    assist.reorientCooldown = Math.max(0, assist.reorientCooldown - delta);

    if (world.session.mode === "playing") {
      this.applyRequestedReorient(world);
      this.updateReorient(world, delta);
      player.cameraPitch = damp(player.cameraPitch, -0.02, 1.5, delta);
    }

    this.refreshAimDirection(world);
    this.updateTargetLock(world, delta);
    this.updateThreatRing(world);
  }

  private applyRequestedReorient(world: GameWorld) {
    const requested = world.touchInput.requestedThreatTurnAngle;
    const assist = world.combatAssist;
    if (requested === null || assist.reorientCooldown > 0) return;

    assist.reorientTargetYaw = world.player.rotationY + requested;
    assist.reorientCooldown = 0.5 / world.upgrades.turnAssistMultiplier;
    world.emitAudio("assist_reorient", { intensity: 0.9 });
  }

  private updateReorient(world: GameWorld, delta: number) {
    const targetYaw = world.combatAssist.reorientTargetYaw;
    if (targetYaw === null) return;

    const player = world.player;
    const speed = 9 * world.upgrades.turnAssistMultiplier;
    player.rotationY = dampAngle(player.rotationY, targetYaw, speed, delta);
    player.targetRotationY = player.rotationY;
    if (Math.abs(wrapAngle(targetYaw - player.rotationY)) < 0.025) {
      world.combatAssist.reorientTargetYaw = null;
    }
  }

  private updateTargetLock(world: GameWorld, delta: number) {
    const player = world.player;
    const assist = world.combatAssist;
    const cone = (assist.targetConeDegrees * Math.PI) / 180;
    let bestScore = 0;
    let bestEnemyId: number | null = null;

    for (const enemy of world.enemies) {
      if (!enemy.isAlive) continue;
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
      this.toEnemy.copy(enemy.position).sub(player.position);
      this.toEnemy.y += 1.2 - playerConfig.cockpitHeight;
      const distance = this.toEnemy.length();
      if (distance > assist.targetDistance || distance <= 0.001) continue;

      const angle = Math.acos(clamp(this.toEnemy.normalize().dot(player.aimDirection), -1, 1));
      if (angle > cone) continue;
      if (!world.hasLineOfSight(player.position, enemy.position, 0.08)) continue;

      const angleScore = 1 - angle / cone;
      const distanceScore = 1 - distance / assist.targetDistance;
      const threatScore = (enemyArchetypes[enemy.archetypeId].threatWeight * enemy.threatWeightMultiplier) / 2.4;
      const score = angleScore * 0.55 + distanceScore * 0.25 + threatScore * 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestEnemyId = enemy.id;
      }
    }

    assist.lockedEnemyId = bestEnemyId;
    assist.lockedStrength = bestEnemyId === null ? damp(assist.lockedStrength, 0, 12, delta) : bestScore;
  }

  private updateThreatRing(world: GameWorld) {
    const player = world.player;
    const segments = world.combatAssist.threatSegments;
    for (const segment of segments) {
      segment.intensity = 0;
      segment.angle = (segment.index - 4) * (Math.PI / 4);
    }

    this.flatForward.set(Math.sin(player.rotationY), 0, -Math.cos(player.rotationY));
    this.flatRight.set(Math.cos(player.rotationY), 0, Math.sin(player.rotationY));

    for (const enemy of world.enemies) {
      if (!enemy.isAlive) continue;
      if (!isEnemyVisibleToPlayerRoom(world, enemy)) continue;
      this.toEnemy.copy(enemy.position).sub(player.position).setY(0);
      const distance = Math.max(0.001, this.toEnemy.length());
      this.toEnemy.normalize();

      const localX = this.toEnemy.dot(this.flatRight);
      const localZ = this.toEnemy.dot(this.flatForward);
      const relativeAngle = Math.atan2(localX, localZ);
      const index = clamp(Math.round(relativeAngle / (Math.PI / 4)) + 4, 0, 7);
      const archetype = enemyArchetypes[enemy.archetypeId];
      const closeThreat = clamp(1 - distance / 16, 0, 1);
      const intensity = clamp(closeThreat * archetype.threatWeight * enemy.threatWeightMultiplier, 0, 1);
      segments[index].intensity = Math.max(segments[index].intensity, intensity);
      segments[index].angle = relativeAngle;
    }
  }

  private refreshAimDirection(world: GameWorld) {
    const player = world.player;
    player.cameraPitch = clamp(player.cameraPitch, playerConfig.minPitch, playerConfig.maxPitch);
    const cosPitch = Math.cos(player.cameraPitch);
    player.aimDirection.set(
      Math.sin(player.rotationY) * cosPitch,
      Math.sin(player.cameraPitch),
      -Math.cos(player.rotationY) * cosPitch,
    );
    player.aimPoint.copy(player.position).addScaledVector(player.aimDirection, 24);
  }
}
