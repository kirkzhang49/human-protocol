import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameWorld } from "../core/GameWorld";

describe("GameWorld Rapier physics parity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes segment queries through Rapier with legacy dual-run accounting", async () => {
    vi.stubGlobal("window", {
      ...globalThis,
      location: {
        search: "?physics=rapier&physicsDual=1",
        hostname: "localhost",
      },
    });

    const world = new GameWorld();
    await world.physics.init();
    world.obstacles.push({
      id: "rotated-test-wall",
      visualKey: "test_wall",
      position: new Vector3(0, 0.75, 0),
      halfSize: new Vector3(0.25, 0.75, 1.25),
      yaw: Math.PI / 6,
    });
    world.markObstacleIndexDirty();

    expect(
      world.isProjectileSegmentBlockedByObstacle(
        new Vector3(-2, 0.75, 0),
        new Vector3(2, 0.75, 0),
        0.05,
      ),
    ).toBe(true);

    expect(world.physicsDebugSnapshot()).toMatchObject({
      mode: "rapier",
      ready: true,
      staticColliderCount: 1,
      querySamples: 1,
      queryMismatches: 0,
    });
  });
});
