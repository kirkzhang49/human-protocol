import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameWorld } from "../core/GameWorld";
import type { PhysicsKinematicCircleMove } from "../physics/PhysicsWorldAdapter";
import { EnemyAISystem } from "./EnemyAISystem";
import { PlayerMovementSystem } from "./PlayerMovementSystem";

describe("Rapier kinematic movement reconciliation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("keeps player dash moving through a Rapier-passable doorframe", async () => {
    const world = await createRapierPlayingWorld();
    world.obstacles.push(
      {
        id: "rapier_passable_left_post",
        visualKey: "test_door",
        position: new Vector3(-0.91, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      },
      {
        id: "rapier_passable_right_post",
        visualKey: "test_door",
        position: new Vector3(0.91, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      },
    );
    world.markObstacleIndexDirty();
    world.player.dashTimeRemaining = 0.2;
    world.player.dashDirection.set(0, 0, -1);

    new PlayerMovementSystem().update(world, 0.06);

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(2);
    expect(world.player.position.z).toBeLessThan(-1.35);
    expect(world.player.velocity.z).toBeLessThan(-1);
  });

  it("blocks player dash at an undersized Rapier doorframe", async () => {
    const world = await createRapierPlayingWorld();
    world.obstacles.push(
      {
        id: "rapier_tight_left_post",
        visualKey: "test_door",
        position: new Vector3(-0.8, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      },
      {
        id: "rapier_tight_right_post",
        visualKey: "test_door",
        position: new Vector3(0.8, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      },
    );
    world.markObstacleIndexDirty();
    world.player.dashTimeRemaining = 0.2;
    world.player.dashDirection.set(0, 0, -1);

    new PlayerMovementSystem().update(world, 0.06);

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(2);
    expect(world.player.position.z).toBeGreaterThan(-0.7);
    expect(world.player.velocity.length()).toBeLessThan(0.1);
    expect(world.player.dashTimeRemaining).toBe(0);
    expect(world.player.isDashing).toBe(false);
  });

  it("blocks player dash on opt-in dynamic props and nudges them", async () => {
    const world = await createRapierPlayingWorld();
    const prop = world.spawnDynamicProp({
      id: "rapier_dash_dynamic_crate",
      modelKey: "test_crate",
      position: new Vector3(1.55, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(prop).not.toBeNull();
    expect(world.physicsDebugSnapshot().dynamicBodyCount).toBe(1);
    const propStartX = prop!.position.x;
    world.player.dashTimeRemaining = 0.2;
    world.player.dashDirection.set(1, 0, 0);

    new PlayerMovementSystem().update(world, 0.06);
    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(world.player.position.x).toBeLessThan(0.85);
    expect(world.player.velocity.length()).toBeLessThan(0.1);
    expect(world.player.dashTimeRemaining).toBe(0);
    expect(world.player.isDashing).toBe(false);
    expect(prop!.position.x).toBeGreaterThan(propStartX + 0.01);
    expect(prop!.position.y).toBeCloseTo(0.35, 4);
  });

  it("keeps player dash sliding along rotated Rapier furniture", async () => {
    const world = await createRapierPlayingWorld();
    world.player.position.set(-1, 0, -0.65);
    world.obstacles.push({
      id: "rapier_rotated_display_case",
      visualKey: "test_display_case",
      position: new Vector3(0.15, 0.75, -0.25),
      halfSize: new Vector3(0.24, 0.75, 1),
      yaw: Math.PI / 4,
    });
    world.markObstacleIndexDirty();
    world.player.dashTimeRemaining = 0.2;
    world.player.dashDirection.set(0.97, 0, 0.24).normalize();

    new PlayerMovementSystem().update(world, 0.06);

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(1);
    expect(world.player.position.x).toBeGreaterThan(-0.95);
    expect(world.player.velocity.x).toBeGreaterThan(0.5);
  });

  it("keeps real Rapier player walking stable through a narrow rotated-furniture lane", async () => {
    const world = await createRapierPlayingWorld();
    world.player.position.set(0, 0, 0);
    world.input.move.set(0, -1);
    world.obstacles.push(
      {
        id: "rapier_narrow_lane_left_wall",
        visualKey: "test_wall",
        position: new Vector3(-1.05, 0.75, -1.8),
        halfSize: new Vector3(0.12, 0.75, 2.4),
      },
      {
        id: "rapier_narrow_lane_right_wall",
        visualKey: "test_wall",
        position: new Vector3(1.65, 0.75, -1.8),
        halfSize: new Vector3(0.12, 0.75, 2.4),
      },
      {
        id: "rapier_narrow_lane_rotated_furniture",
        visualKey: "test_rotated_console",
        position: new Vector3(1.42, 0.62, -2.05),
        halfSize: new Vector3(0.16, 0.62, 0.75),
        yaw: Math.PI / 5,
      },
    );
    world.markObstacleIndexDirty();

    let maxStep = 0;
    const previous = world.player.position.clone();
    for (let frame = 0; frame < 72; frame += 1) {
      new PlayerMovementSystem().update(world, 1 / 60);
      maxStep = Math.max(maxStep, world.player.position.distanceTo(previous));
      previous.copy(world.player.position);
    }

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(3);
    expect(Number.isFinite(world.player.position.x)).toBe(true);
    expect(Number.isFinite(world.player.position.z)).toBe(true);
    expect(maxStep).toBeLessThan(0.16);
    expect(world.player.position.z).toBeLessThan(-2.2);
    expect(Math.abs(world.player.position.x)).toBeLessThan(0.48);
    expect(world.player.velocity.length()).toBeLessThan(6.2);
  });

  it("keeps real Rapier player walking along large rotated furniture without wedging", async () => {
    const world = await createRapierPlayingWorld();
    const start = new Vector3(-1.75, 0, 1.35);
    const inputDirection = new Vector3(1, 0, -1).normalize();
    world.player.position.copy(start);
    world.input.move.set(1, -1);
    world.obstacles.push({
      id: "rapier_large_rotated_furniture_walk_slide",
      visualKey: "test_large_sofa",
      position: new Vector3(0.05, 0.68, -0.95),
      halfSize: new Vector3(0.42, 0.68, 1.75),
      yaw: -Math.PI / 4,
    });
    world.markObstacleIndexDirty();

    let maxStep = 0;
    let stalledFrames = 0;
    const previous = world.player.position.clone();
    for (let frame = 0; frame < 96; frame += 1) {
      new PlayerMovementSystem().update(world, 1 / 60);
      const step = world.player.position.distanceTo(previous);
      maxStep = Math.max(maxStep, step);
      if (step < 0.006 && world.player.velocity.length() > 1.2) stalledFrames += 1;
      previous.copy(world.player.position);
    }

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(1);
    expect(Number.isFinite(world.player.position.x)).toBe(true);
    expect(Number.isFinite(world.player.position.z)).toBe(true);
    expect(maxStep).toBeLessThan(0.16);
    expect(stalledFrames).toBeLessThan(18);
    expect(world.player.position.clone().sub(start).dot(inputDirection)).toBeGreaterThan(0.42);
    expect(world.player.velocity.length()).toBeLessThan(6.2);
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

  it("lets real Rapier enemy movement pass soft navigation obstacles", async () => {
    const world = await createRapierPlayingWorld();
    const enemy = world.spawnEnemy("repair_drone", "rapier_soft_enemy", new Vector3(0, 0, -2.5), 0);
    enemy.velocity.set(80, 0, 0);
    enemy.staggerRemaining = 0.2;
    world.obstacles.push({
      id: "rapier_soft_navigation_prop",
      visualKey: "test_soft_prop",
      position: new Vector3(0.55, 0.5, -2.5),
      halfSize: new Vector3(0.25, 0.5, 0.65),
      enemyNavigation: "soft",
    });
    world.markObstacleIndexDirty();

    new EnemyAISystem().update(world, 0.1);

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(1);
    expect(enemy.position.x).toBeGreaterThan(0.9);
  });

  it("stops real Rapier enemy movement on solid furniture after ignored soft zones", async () => {
    const world = await createRapierPlayingWorld();
    const enemy = world.spawnEnemy("repair_drone", "rapier_solid_enemy", new Vector3(0, 0, -2.5), 0);
    enemy.velocity.set(80, 0, 0);
    enemy.staggerRemaining = 0.2;
    world.obstacles.push(
      {
        id: "rapier_ignored_soft_navigation_prop",
        visualKey: "test_soft_prop",
        position: new Vector3(0.55, 0.5, -2.5),
        halfSize: new Vector3(0.25, 0.5, 0.65),
        enemyNavigation: "soft",
      },
      {
        id: "rapier_solid_navigation_prop",
        visualKey: "test_solid_prop",
        position: new Vector3(1.45, 0.5, -2.5),
        halfSize: new Vector3(0.25, 0.5, 0.65),
      },
    );
    world.markObstacleIndexDirty();

    new EnemyAISystem().update(world, 0.1);

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(2);
    expect(enemy.position.x).toBeGreaterThan(0.45);
    expect(enemy.position.x).toBeLessThan(1.2);
  });

  it("recovers real Rapier boss movement off walls without preserving inward velocity", async () => {
    const world = await createRapierPlayingWorld();
    const boss = world.spawnEnemy("custodian_elite", "rapier_recovered_boss", new Vector3(0.42, 0, -2.5), 0, { tier: "boss" });
    boss.velocity.set(-2.4, 0, 0);
    boss.staggerRemaining = 0.2;
    world.obstacles.push({
      id: "rapier_boss_recovery_wall",
      visualKey: "test_wall",
      position: new Vector3(0, 0.75, -2.5),
      halfSize: new Vector3(0.5, 0.75, 0.5),
    });
    world.markObstacleIndexDirty();

    new EnemyAISystem().update(world, 0.1);

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(1);
    expect(boss.position.x).toBeGreaterThan(0.9);
    expect(boss.velocity.x).toBeGreaterThanOrEqual(-0.01);
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

  it("keeps boss recovery stable across repeated door-edge spacing pressure", () => {
    const world = createPlayingWorld();
    const boss = world.spawnEnemy("custodian_elite", "door_edge_boss", new Vector3(0, 0, -2.5), 0, { tier: "boss" });
    const pressure = world.spawnEnemy("repair_drone", "door_edge_pressure", new Vector3(0.68, 0, -2.5), 0);
    boss.velocity.set(-2.4, 0, 0);
    boss.staggerRemaining = 1.4;
    pressure.velocity.set(0, 0, 0);
    pressure.staggerRemaining = 1.4;

    world.moveKinematicCircleWithPhysics = vi.fn((move: PhysicsKinematicCircleMove) => {
      if (move.id === `enemy:${boss.id}:recovery`) {
        const corrected = move.position.clone().add(new Vector3(0.18, 0, 0));
        return {
          position: corrected,
          translation: corrected.clone().sub(move.position),
          blocked: true,
        };
      }
      if (move.id === `enemy:${boss.id}` && move.desiredTranslation.x < 0) {
        return {
          position: move.position.clone(),
          translation: new Vector3(0, 0, 0),
          blocked: true,
        };
      }
      return {
        position: move.position.clone().add(move.desiredTranslation),
        translation: move.desiredTranslation.clone(),
        blocked: false,
      };
    });

    let maxSpeed = 0;
    let maxStep = 0;
    const previous = boss.position.clone();
    for (let frame = 0; frame < 36; frame += 1) {
      new EnemyAISystem().update(world, 1 / 60);
      maxSpeed = Math.max(maxSpeed, boss.velocity.length());
      maxStep = Math.max(maxStep, boss.position.distanceTo(previous));
      previous.copy(boss.position);
    }

    expect(Number.isFinite(boss.position.x)).toBe(true);
    expect(Number.isFinite(boss.velocity.x)).toBe(true);
    expect(maxStep).toBeLessThan(0.28);
    expect(maxSpeed).toBeLessThan(3.1);
    expect(boss.velocity.x).toBeGreaterThanOrEqual(-0.01);
  });

  it("keeps real Rapier leader chasing along large rotated furniture without wedging", async () => {
    const world = await createRapierPlayingWorld();
    world.player.position.set(0.2, 0, -2.9);
    const leader = world.spawnEnemy("custodian_elite", "rapier_leader_rotated_furniture_chase", new Vector3(-2.1, 0, 1.65), 0, {
      tier: "leader",
      radiusMultiplier: 0.9,
      moveSpeedMultiplier: 1.05,
      attackRangeMultiplier: 0.82,
    });
    world.obstacles.push({
      id: "rapier_leader_chase_rotated_furniture",
      visualKey: "room_residential_sofa_long",
      position: new Vector3(-0.45, 0.62, -0.65),
      halfSize: new Vector3(0.46, 0.62, 1.55),
      yaw: -Math.PI / 5,
    });
    world.markObstacleIndexDirty();

    const ai = new EnemyAISystem();
    const startDistance = leader.position.distanceTo(world.player.position);
    let maxStep = 0;
    let stalledFrames = 0;
    const previous = leader.position.clone();
    for (let frame = 0; frame < 120; frame += 1) {
      ai.update(world, 1 / 60);
      const step = leader.position.distanceTo(previous);
      maxStep = Math.max(maxStep, step);
      if (step < 0.005 && leader.velocity.length() > 0.8) stalledFrames += 1;
      previous.copy(leader.position);
    }

    expect(world.physicsDebugSnapshot().staticColliderCount).toBe(1);
    expect(Number.isFinite(leader.position.x)).toBe(true);
    expect(Number.isFinite(leader.position.z)).toBe(true);
    expect(maxStep).toBeLessThan(0.18);
    expect(stalledFrames).toBeLessThan(22);
    expect(leader.position.distanceTo(world.player.position)).toBeLessThan(startDistance - 0.75);
    expect(leader.velocity.length()).toBeLessThan(5.6);
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

async function createRapierPlayingWorld() {
  vi.stubGlobal("window", {
    ...globalThis,
    location: {
      search: "?physics=rapier",
      hostname: "localhost",
    },
  });
  const world = createPlayingWorld();
  await world.physics.init();
  return world;
}
