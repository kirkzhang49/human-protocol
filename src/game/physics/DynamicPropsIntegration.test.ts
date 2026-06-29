import { Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameWorld } from "../core/GameWorld";

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
});
