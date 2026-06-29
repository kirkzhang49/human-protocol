import { Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_DYNAMIC_PROPS_PER_LEVEL } from "../config/DynamicPropPolicy";
import { resolvePropCollisionProxy } from "../config/MapGeometry";
import { level01MaintenanceBay } from "../config/levels/level01-maintenance-bay";
import { level02ResidentialSimulation } from "../config/levels/level02-residential-simulation";
import { GameWorld } from "../core/GameWorld";
import { createProjectile } from "../entities/createProjectile";
import { PhysicsSystem } from "../systems/PhysicsSystem";
import { ProjectileSystem } from "../systems/ProjectileSystem";

describe("GameWorld dynamic prop physics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("syncs opt-in dynamic props through Rapier snapshots", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const prop = world.spawnDynamicProp({
      id: "loose-crate",
      modelKey: "test_crate",
      position: new Vector3(0, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(prop).not.toBeNull();
    expect(world.physicsDebugSnapshot()).toMatchObject({
      dynamicBodyCount: 1,
    });
    expect(world.applyDynamicPropImpulse("loose-crate", new Vector3(2.4, 0, 0))).toBe(true);

    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(prop?.position.x).toBeGreaterThan(0.01);
    expect(prop?.position.y).toBeCloseTo(0.35, 4);
  });

  it("rejects duplicate dynamic prop ids before they reach Rapier body sync", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const first = world.spawnDynamicProp({
      id: "duplicate-crate",
      modelKey: "test_crate",
      position: new Vector3(0, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });
    const duplicate = world.spawnDynamicProp({
      id: "duplicate-crate",
      modelKey: "test_crate",
      position: new Vector3(2, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(first).not.toBeNull();
    expect(duplicate).toBeNull();
    expect(world.dynamicProps.map((prop) => prop.id)).toEqual(["duplicate-crate"]);
    expect(world.physicsDebugSnapshot().dynamicBodyCount).toBe(1);
  });

  it("caps runtime dynamic props before they expand Rapier body count", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const spawned = Array.from({ length: MAX_DYNAMIC_PROPS_PER_LEVEL }, (_, index) =>
      world.spawnDynamicProp({
        id: `runtime-cap-crate-${index}`,
        modelKey: "test_crate",
        position: new Vector3(index * 1.2, 0.35, 0),
        halfSize: new Vector3(0.35, 0.35, 0.35),
        mass: 1,
      }),
    );
    const overflow = world.spawnDynamicProp({
      id: "runtime-cap-overflow-crate",
      modelKey: "test_crate",
      position: new Vector3(99, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(spawned.every(Boolean)).toBe(true);
    expect(overflow).toBeNull();
    expect(world.dynamicProps).toHaveLength(MAX_DYNAMIC_PROPS_PER_LEVEL);
    expect(world.physicsDebugSnapshot().dynamicBodyCount).toBe(MAX_DYNAMIC_PROPS_PER_LEVEL);
  });

  it("keeps player and filtered enemy kinematic movement from passing through opt-in dynamic props", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    world.obstacles.push({
      id: "existing_static_wall",
      visualKey: "test_wall",
      position: new Vector3(-5, 0.5, -5),
      halfSize: new Vector3(0.5, 0.5, 0.5),
    });
    world.syncPhysicsStaticObstacles();
    const start = new Vector3(64, 0, 64);
    world.spawnDynamicProp({
      id: "kinematic-blocking-crate",
      modelKey: "test_crate",
      position: new Vector3(start.x + 0.9, 0.35, start.z),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });
    expect(world.physicsDebugSnapshot().dynamicBodyCount).toBe(1);
    world.physics.step(1 / 120);

    const playerMove = world.moveKinematicCircleWithPhysics({
      id: "player",
      position: start,
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(1.6, 0, 0),
    });
    const moved = world.moveKinematicCircleWithPhysics({
      id: "enemy:dynamic-prop-blocker",
      position: start,
      radius: 0.3,
      height: 1.3,
      desiredTranslation: new Vector3(1.6, 0, 0),
      filter: (obstacle) => obstacle.enemyNavigation !== "soft" && obstacle.enemyNavigation !== "ignore",
    });

    expect(playerMove?.blocked).toBe(true);
    expect((playerMove?.position.x ?? start.x) - start.x).toBeLessThan(0.45);
    expect(moved?.blocked).toBe(true);
    expect((moved?.position.x ?? start.x) - start.x).toBeLessThan(0.45);
  });

  it("nudges opt-in dynamic props when kinematic characters press into them", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const prop = world.spawnDynamicProp({
      id: "player-nudged-crate",
      modelKey: "test_crate",
      position: new Vector3(0.9, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });
    world.physics.step(1 / 120);

    const moved = world.moveKinematicCircleWithPhysics({
      id: "player",
      position: new Vector3(0, 0, 0),
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(1.6, 0, 0),
    });
    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(moved?.blocked).toBe(true);
    expect(prop?.position.x).toBeGreaterThan(0.91);
    expect(prop?.position.y).toBeCloseTo(0.35, 4);
  });

  it("pushes opt-in dynamic props away from combat shock origins", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const prop = world.spawnDynamicProp({
      id: "shock-crate",
      modelKey: "test_crate",
      position: new Vector3(0.7, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(world.applyDynamicPropImpulseFromPoint(new Vector3(0, 0.35, 0), 2, 3)).toBe(1);
    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(prop?.position.x).toBeGreaterThan(0.72);
    expect(prop?.position.y).toBeCloseTo(0.35, 4);
  });

  it("pushes opt-in dynamic props even when the combat shock starts at their center", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const prop = world.spawnDynamicProp({
      id: "center-shock-crate",
      modelKey: "test_crate",
      position: new Vector3(0, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(world.applyDynamicPropImpulseFromPoint(new Vector3(0, 0.35, 0), 2, 3)).toBe(1);
    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(prop?.position.distanceTo(new Vector3(0, 0.35, 0))).toBeGreaterThan(0.01);
    expect(prop?.position.y).toBeCloseTo(0.35, 4);
  });

  it("pushes opt-in dynamic props when an ultimate blast detonates", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    world.player.position.set(0, 0, 0);
    const prop = world.spawnDynamicProp({
      id: "ultimate-crate",
      modelKey: "test_crate",
      position: new Vector3(1, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    world.triggerEmergencyUltimateBlast();
    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(prop?.position.x).toBeGreaterThan(1.02);
    expect(prop?.position.y).toBeCloseTo(0.35, 4);
  });

  it("does not push opt-in dynamic props behind blast-blocking walls", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const prop = world.spawnDynamicProp({
      id: "blast-hidden-crate",
      modelKey: "test_crate",
      position: new Vector3(1.2, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });
    world.obstacles.push({
      id: "blast-blocking-wall",
      visualKey: "test_wall",
      position: new Vector3(0.55, 0.8, 0),
      halfSize: new Vector3(0.08, 0.8, 2),
    });
    world.markObstacleIndexDirty();
    world.syncPhysicsStaticObstacles();

    expect(world.applyDynamicPropImpulseFromPoint(new Vector3(0, 0.35, 0), 2, 3)).toBe(0);
    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(prop?.position.x).toBeCloseTo(1.2, 4);
    expect(prop?.position.y).toBeCloseTo(0.35, 4);
  });

  it("pushes opt-in dynamic props brushed by pistol projectiles", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const prop = world.spawnDynamicProp({
      id: "pistol-brushed-crate",
      modelKey: "test_crate",
      position: new Vector3(0.18, 0.35, -0.48),
      halfSize: new Vector3(0.32, 0.35, 0.32),
      mass: 1,
    });
    world.addProjectile(createProjectile(999, world.player.id, "railLance", new Vector3(0, 1.2, 0), new Vector3(0, 0, -1)));

    new ProjectileSystem().update(world, 1 / 60);
    world.physics.step(1 / 30);
    world.syncDynamicPropsFromPhysics(1 / 30);

    expect(prop?.position.z).toBeLessThan(-0.49);
    expect(prop?.position.y).toBeCloseTo(0.35, 4);
  });

  it("despawns old sleeping dynamic props while preserving awake props", () => {
    const world = new GameWorld();
    const sleeping = world.spawnDynamicProp({
      id: "sleeping-crate",
      modelKey: "test_crate",
      position: new Vector3(0, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });
    const awake = world.spawnDynamicProp({
      id: "awake-crate",
      modelKey: "test_crate",
      position: new Vector3(1, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });
    const rotation = new Quaternion();

    expect(sleeping).not.toBeNull();
    expect(awake).not.toBeNull();
    world.physics.dynamicBodySnapshots = vi.fn(() => [
      {
        id: "sleeping-crate",
        position: sleeping!.position,
        rotation,
        sleeping: true,
      },
      {
        id: "awake-crate",
        position: awake!.position,
        rotation,
        sleeping: false,
      },
    ]);

    world.syncDynamicPropsFromPhysics(16);

    expect(world.dynamicProps.map((prop) => prop.id)).toEqual(["awake-crate"]);
  });

  it("despawns old dynamic props even when physics snapshots are unavailable", () => {
    const world = new GameWorld();
    const prop = world.spawnDynamicProp({
      id: "legacy-expiring-crate",
      modelKey: "test_crate",
      position: new Vector3(0, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(prop).not.toBeNull();
    world.physics.dynamicBodySnapshots = vi.fn(() => []);

    world.syncDynamicPropsFromPhysics(46);

    expect(world.dynamicProps).toHaveLength(0);
  });

  it("removes Rapier bodies when old dynamic props despawn", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    const prop = world.spawnDynamicProp({
      id: "rapier-expiring-crate",
      modelKey: "test_crate",
      position: new Vector3(0, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(prop).not.toBeNull();
    expect(world.physicsDebugSnapshot().dynamicBodyCount).toBe(1);

    world.syncDynamicPropsFromPhysics(46);

    expect(world.dynamicProps).toHaveLength(0);
    expect(world.physicsDebugSnapshot().dynamicBodyCount).toBe(0);
    expect(world.applyDynamicPropImpulse("rapier-expiring-crate", new Vector3(2, 0, 0))).toBe(false);
  });

  it("despawns old dynamic props through PhysicsSystem even before physics is ready", () => {
    const world = new GameWorld();
    const prop = world.spawnDynamicProp({
      id: "not-ready-expiring-crate",
      modelKey: "test_crate",
      position: new Vector3(0, 0.35, 0),
      halfSize: new Vector3(0.35, 0.35, 0.35),
      mass: 1,
    });

    expect(prop).not.toBeNull();
    world.physics.dynamicBodySnapshots = vi.fn(() => []);

    new PhysicsSystem().update(world, 46);

    expect(world.dynamicProps).toHaveLength(0);
  });

  it("spawns only explicitly tagged map props as dynamic props on level reset", () => {
    const world = new GameWorld();
    if (!world.level.map) throw new Error("Expected default test level to include map geometry.");
    world.level = {
      ...world.level,
      map: {
        ...world.level.map,
        props: [
          {
            id: "dynamic_loose_crate",
            roomId: world.level.map.rooms[0].id,
            modelKey: "room_locker_low",
            position: [1, 0.35, 2],
            rotation: [0, Math.PI / 4, 0],
            scale: [1, 1, 1],
            collider: { halfSize: [0.32, 0.35, 0.28] },
            tags: ["dynamic_prop"],
          },
          {
            id: "static_locker",
            roomId: world.level.map.rooms[0].id,
            modelKey: "room_locker_low",
            position: [3, 0.35, 2],
            collider: { halfSize: [0.32, 0.35, 0.28] },
          },
        ],
      },
    };

    (world as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");

    expect(world.dynamicProps).toHaveLength(1);
    expect(world.dynamicProps[0]).toMatchObject({
      id: "dynamic_loose_crate",
      modelKey: "room_locker_low",
      roomId: world.level.map.rooms[0].id,
      mass: 1,
    });
    expect(world.dynamicProps[0].position.toArray()).toEqual([1, 0.35, 2]);
    expect(world.dynamicProps[0].halfSize.toArray()).toEqual([0.32, 0.35, 0.28]);
    expect(world.dynamicProps[0].yaw).toBeCloseTo(Math.PI / 4);
  });

  it("spawns only curated official campaign props as dynamic props on level reset", () => {
    const level01World = new GameWorld();
    level01World.level = level01MaintenanceBay;
    (level01World as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");

    expect(level01World.dynamicProps.map((prop) => prop.id)).toEqual(["prop_hhup5a"]);
    expect(level01World.dynamicProps[0]).toMatchObject({
      modelKey: "room_crate_stack",
      roomId: "maintenance_bay_floor",
    });
    expect(level01World.dynamicProps[0].halfSize.toArray()).toEqual([0.45, 0.45, 0.36]);

    const level02World = new GameWorld();
    level02World.level = level02ResidentialSimulation;
    (level02World as unknown as { resetLevel(mode: "playing"): void }).resetLevel("playing");

    expect(level02World.dynamicProps.map((prop) => prop.id)).toEqual(["prop_vq1oiy"]);
    expect(level02World.dynamicProps[0]).toMatchObject({
      modelKey: "hp_l2_cc0_ottoman_polyhaven_v1",
      roomId: "level_02_living_room",
    });
    expect(level02World.dynamicProps[0].halfSize.toArray()).toEqual([0.326, 0.23, 0.2355]);
  });

  it("does not mirror dynamic map props as static collision proxies", () => {
    expect(
      resolvePropCollisionProxy({
        id: "dynamic_loose_crate",
        roomId: "room_test",
        modelKey: "room_locker_low",
        position: [0, 0.35, 0],
        collider: { halfSize: [0.32, 0.35, 0.28] },
        tags: ["dynamic_prop"],
      }),
    ).toBeNull();
  });
});
