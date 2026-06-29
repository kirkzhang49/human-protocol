import { Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
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
