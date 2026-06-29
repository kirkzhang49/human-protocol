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
