import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { GameWorld } from "../core/GameWorld";
import type { PhysicsKinematicCircleMove } from "../physics/PhysicsWorldAdapter";
import { EnemyAISystem } from "./EnemyAISystem";
import { PlayerMovementSystem } from "./PlayerMovementSystem";

describe("Rapier kinematic movement reconciliation", () => {
  it("damps player velocity to the physics-resolved translation when blocked", () => {
    const world = createPlayingWorld();
    world.input.move.set(0, -1);
    world.moveKinematicCircleWithPhysics = vi.fn((move: PhysicsKinematicCircleMove) => ({
      position: move.position.clone(),
      translation: new Vector3(0, 0, 0),
      blocked: true,
    }));

    new PlayerMovementSystem().update(world, 0.1);

    const move = vi.mocked(world.moveKinematicCircleWithPhysics).mock.calls[0]?.[0];
    expect(move?.desiredTranslation.length()).toBeGreaterThan(0);
    expect(world.player.velocity.length()).toBeLessThan(0.01);
    expect(world.player.movementAmount).toBeLessThan(0.05);
  });

  it("damps player velocity that points back into a legacy recovery correction", () => {
    const world = createPlayingWorld();
    world.player.position.set(0.42, 0, 0);
    world.input.move.set(-1, 0);
    world.obstacles.push({
      id: "legacy_player_recovery_wall",
      visualKey: "test_wall",
      position: new Vector3(0, 0.5, 0),
      halfSize: new Vector3(0.5, 0.5, 0.5),
    });
    world.markObstacleIndexDirty();
    world.moveKinematicCircleWithPhysics = vi.fn(() => null);

    new PlayerMovementSystem().update(world, 0.1);

    expect(world.player.position.x).toBeGreaterThan(0.5);
    expect(world.player.velocity.x).toBeGreaterThanOrEqual(-0.01);
  });

  it("keeps fallback dash movement from tunneling through thin blockers", () => {
    const world = createPlayingWorld();
    world.player.position.set(0, 0, 0);
    world.player.dashTimeRemaining = 0.2;
    world.player.dashDirection.set(1, 0, 0);
    world.player.velocity.set(0, 0, 0);
    world.obstacles.push({
      id: "thin_dash_blocker",
      visualKey: "test_door",
      position: new Vector3(1.2, 0.5, 0),
      halfSize: new Vector3(0.05, 0.5, 2),
    });
    world.markObstacleIndexDirty();
    world.moveKinematicCircleWithPhysics = vi.fn(() => null);

    new PlayerMovementSystem().update(world, 0.1);

    expect(world.player.position.x).toBeLessThan(0.55);
  });

  it("damps enemy velocity to the physics-resolved translation when blocked", () => {
    const world = createPlayingWorld();
    const enemy = world.spawnEnemy("repair_drone", "blocked_enemy", new Vector3(0, 0, -2.5), 0);
    enemy.velocity.set(0, 0, -2);
    enemy.staggerRemaining = 0.2;
    world.moveKinematicCircleWithPhysics = vi.fn((move: PhysicsKinematicCircleMove) => ({
      position: move.position.clone(),
      translation: new Vector3(0, 0, 0),
      blocked: true,
    }));

    new EnemyAISystem().update(world, 0.1);

    expect(world.moveKinematicCircleWithPhysics).toHaveBeenCalled();
    expect(enemy.velocity.length()).toBeLessThan(0.01);
  });

  it("damps enemy velocity that points back into a physics recovery correction", () => {
    const world = createPlayingWorld();
    const enemy = world.spawnEnemy("repair_drone", "recovered_enemy", new Vector3(0, 0, -2.5), 0);
    enemy.velocity.set(-2, 0, 0);
    enemy.staggerRemaining = 0.2;
    world.moveKinematicCircleWithPhysics = vi.fn((move: PhysicsKinematicCircleMove) => {
      if (move.id.endsWith(":recovery")) {
        const corrected = move.position.clone().add(new Vector3(0.15, 0, 0));
        return {
          position: corrected,
          translation: corrected.clone().sub(move.position),
          blocked: true,
        };
      }
      return {
        position: move.position.clone().add(move.desiredTranslation),
        translation: move.desiredTranslation.clone(),
        blocked: false,
      };
    });

    new EnemyAISystem().update(world, 0.1);

    expect(enemy.position.x).toBeGreaterThan(0);
    expect(enemy.velocity.x).toBeGreaterThanOrEqual(-0.01);
  });

  it("keeps boss spacing pushes stable when physics recovery moves it off a wall", () => {
    const world = createPlayingWorld();
    const boss = world.spawnEnemy("custodian_elite", "wall_pinned_boss", new Vector3(0, 0, -2.5), 0, { tier: "boss" });
    const blocker = world.spawnEnemy("repair_drone", "boss_spacing_pressure", new Vector3(0.68, 0, -2.5), 0);
    boss.velocity.set(-2.4, 0, 0);
    boss.staggerRemaining = 0.2;
    blocker.velocity.set(0, 0, 0);

    const moves: PhysicsKinematicCircleMove[] = [];
    world.moveKinematicCircleWithPhysics = vi.fn((move: PhysicsKinematicCircleMove) => {
      moves.push({
        ...move,
        position: move.position.clone(),
        desiredTranslation: move.desiredTranslation.clone(),
      });
      if (move.id === `enemy:${boss.id}:recovery`) {
        const corrected = move.position.clone().add(new Vector3(0.22, 0, 0));
        return {
          position: corrected,
          translation: corrected.clone().sub(move.position),
          blocked: true,
        };
      }
      return {
        position: move.position.clone().add(move.desiredTranslation),
        translation: move.desiredTranslation.clone(),
        blocked: false,
      };
    });

    new EnemyAISystem().update(world, 0.1);

    const bossRecoveryMove = moves.find((move) => move.id === `enemy:${boss.id}:recovery`);
    expect(bossRecoveryMove?.height).toBeGreaterThan(2.5);
    expect(boss.position.x).toBeGreaterThan(-0.1);
    expect(boss.velocity.x).toBeGreaterThanOrEqual(-0.01);
  });

  it("damps enemy velocity that points back into a legacy recovery correction", () => {
    const world = createPlayingWorld();
    const enemy = world.spawnEnemy("repair_drone", "legacy_recovered_enemy", new Vector3(0.42, 0, -2.5), 0);
    enemy.velocity.set(-2, 0, 0);
    enemy.staggerRemaining = 0.2;
    world.obstacles.push({
      id: "legacy_recovery_wall",
      visualKey: "test_wall",
      position: new Vector3(0, 0.5, -2.5),
      halfSize: new Vector3(0.5, 0.5, 0.5),
    });
    world.markObstacleIndexDirty();
    world.moveKinematicCircleWithPhysics = vi.fn(() => null);

    new EnemyAISystem().update(world, 0.1);

    expect(enemy.position.x).toBeGreaterThan(0.5);
    expect(enemy.velocity.x).toBeGreaterThanOrEqual(-0.01);
  });

  it("keeps fallback enemy knockback from tunneling through thin blockers", () => {
    const world = createPlayingWorld();
    const enemy = world.spawnEnemy("repair_drone", "fallback_knockback_enemy", new Vector3(0, 0, -2.5), 0);
    enemy.velocity.set(28, 0, 0);
    enemy.staggerRemaining = 0.2;
    world.obstacles.push({
      id: "thin_enemy_blocker",
      visualKey: "test_door",
      position: new Vector3(0.65, 0.5, -2.5),
      halfSize: new Vector3(0.05, 0.5, 2),
    });
    world.markObstacleIndexDirty();
    world.moveKinematicCircleWithPhysics = vi.fn(() => null);

    new EnemyAISystem().update(world, 0.1);

    expect(enemy.position.x).toBeLessThan(0.3);
  });
});

function createPlayingWorld() {
  const world = new GameWorld();
  world.session.mode = "playing";
  world.session.mapProgress.currentRoomId = world.level.map?.rooms[0]?.id ?? null;
  world.player.position.set(0, 0, 0);
  world.player.rotationY = 0;
  world.player.energy = world.player.maxEnergy;
  world.obstacles.length = 0;
  world.markObstacleIndexDirty();
  for (const enemy of world.enemies) {
    enemy.isAlive = false;
    enemy.deathAge = 99;
  }
  return world;
}
