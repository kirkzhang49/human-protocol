import { Vector3 } from "three";
import { movementBoundsForLevel } from "../config/MapMovementBounds";
import { playerConfig } from "../config/playerConfig";
import type { GameSystem } from "../core/GameLoop";
import type { GameWorld } from "../core/GameWorld";
import { clamp, damp, resolveCircleAabb, resolveCircleObb } from "../core/math";

export class PlayerMovementSystem implements GameSystem {
  private readonly moveDirection = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();

  update(world: GameWorld, delta: number) {
    if (world.session.mode !== "playing") return;

    const player = world.player;
    player.dashCooldownRemaining = Math.max(0, player.dashCooldownRemaining - delta);

    this.forward.set(Math.sin(player.rotationY), 0, -Math.cos(player.rotationY));
    this.right.set(Math.cos(player.rotationY), 0, Math.sin(player.rotationY));
    this.moveDirection
      .copy(this.right)
      .multiplyScalar(world.input.move.x)
      .addScaledVector(this.forward, -world.input.move.y);
    const wantsMove = this.moveDirection.lengthSq() > 0.0001;
    if (wantsMove) {
      this.moveDirection.normalize();
    }

    if (world.input.dashPressed && this.canDash(world)) {
      this.startDash(world);
    }

    if (player.dashTimeRemaining > 0) {
      this.updateDash(player, delta);
    } else {
      this.updateWalk(world, delta, wantsMove);
    }

    player.position.addScaledVector(player.velocity, delta);
    this.resolveArena(world);
    player.movementAmount = clamp(player.velocity.length() / (playerConfig.moveSpeed * 1.6), 0, 1);
    player.isMoving = player.movementAmount > 0.05;
  }

  private canDash(world: GameWorld) {
    const player = world.player;
    return (
      player.dashCooldownRemaining <= 0 &&
      player.dashTimeRemaining <= 0 &&
      player.energy >= playerConfig.dashEnergyCost
    );
  }

  private startDash(world: GameWorld) {
    const player = world.player;
    const hasMoveDirection = this.moveDirection.lengthSq() > 0.001;
    player.dashDirection.copy(hasMoveDirection ? this.moveDirection : this.forward);
    player.dashTimeRemaining = playerConfig.dashDuration;
    player.dashCooldownRemaining = world.dashCooldownDuration();
    player.energy = Math.max(0, player.energy - playerConfig.dashEnergyCost);
    player.isDashing = true;
    player.dashSequence += 1;
    player.velocity
      .copy(player.dashDirection)
      .multiplyScalar(playerConfig.dashDistance / playerConfig.dashDuration);
    world.camera.shake = Math.max(world.camera.shake, 0.42);
    world.camera.shakeSeed += 1;
    world.addEffect("dashBurst", player.position, player.dashDirection, 0.28, 1.25);
  }

  private updateDash(player: GameWorld["player"], delta: number) {
    player.dashTimeRemaining = Math.max(0, player.dashTimeRemaining - delta);
    player.velocity
      .copy(player.dashDirection)
      .multiplyScalar(playerConfig.dashDistance / playerConfig.dashDuration);
    if (player.dashTimeRemaining <= 0) {
      player.isDashing = false;
      player.velocity.multiplyScalar(0.36);
    }
  }

  private updateWalk(world: GameWorld, delta: number, wantsMove: boolean) {
    const player = world.player;
    const canSprint = world.input.sprint && wantsMove && player.energy > 1;
    player.isSprinting = canSprint;
    const tempoMultiplier = world.session.tempoSurgeRemaining > 0 ? 1.08 : 1;
    const speed =
      playerConfig.moveSpeed * world.upgrades.moveSpeedMultiplier * tempoMultiplier * (canSprint ? playerConfig.sprintMultiplier : 1);
    const targetSpeed = wantsMove ? speed : 0;
    const targetVelocity = this.moveDirection.multiplyScalar(targetSpeed);
    player.velocity.lerp(targetVelocity, 1 - Math.exp(-playerConfig.acceleration * delta));

    if (canSprint) {
      player.energy = Math.max(0, player.energy - playerConfig.sprintEnergyPerSecond * delta);
    } else {
      player.energy = Math.min(
        player.maxEnergy,
        player.energy + playerConfig.energyRegenPerSecond * delta,
      );
    }
  }

  private resolveArena(world: GameWorld) {
    const player = world.player;
    const bounds = movementBoundsForLevel(world.level, playerConfig.radius);
    player.position.x = clamp(player.position.x, bounds.minX, bounds.maxX);
    player.position.z = clamp(player.position.z, bounds.minZ, bounds.maxZ);

    for (const obstacle of world.syncObstacleIndex().queryCircle(player.position.x, player.position.z, playerConfig.radius)) {
      if (obstacle.yaw) {
        resolveCircleObb(player.position, playerConfig.radius, obstacle.position, obstacle.halfSize, obstacle.yaw);
      } else {
        resolveCircleAabb(player.position, playerConfig.radius, obstacle.position, obstacle.halfSize);
      }
    }
  }
}
