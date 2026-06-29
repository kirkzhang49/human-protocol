import { Vector3 } from "three";
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
});
