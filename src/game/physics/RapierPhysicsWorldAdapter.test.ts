import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { ObstacleState } from "../entities/EntityTypes";
import { createRapierPhysicsWorldAdapter } from "./RapierPhysicsWorldAdapter";

describe("RapierPhysicsWorldAdapter", () => {
  it("syncs fixed obstacle colliders and answers filtered segment queries", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();

    adapter.syncStaticObstacles([
      obstacle({
        id: "solid-wall",
        position: new Vector3(0, 1, 0),
        halfSize: new Vector3(0.25, 1, 2),
      }),
    ]);

    expect(adapter.debugSnapshot()).toMatchObject({
      ready: true,
      staticColliderCount: 1,
    });
    expect(
      adapter.isSegmentBlocked({
        start: new Vector3(-2, 1, 0),
        end: new Vector3(2, 1, 0),
      }),
    ).toBe(true);
    expect(
      adapter.isSegmentBlocked({
        start: new Vector3(-2, 1, 0),
        end: new Vector3(2, 1, 0),
        filter: (candidate) => candidate.id !== "solid-wall",
      }),
    ).toBe(false);
  });

  it("slides kinematic circles out of fixed obstacle colliders", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();
    adapter.syncStaticObstacles([
      obstacle({
        id: "cover-block",
        position: new Vector3(1.2, 0.5, 0),
        halfSize: new Vector3(0.35, 0.5, 0.85),
      }),
    ]);

    const moved = adapter.moveKinematicCircle({
      id: "player",
      position: new Vector3(0, 0, 0),
      radius: 0.32,
      desiredTranslation: new Vector3(1.4, 0, 0.18),
    });

    expect(moved.blocked).toBe(true);
    expect(moved.position.x).toBeLessThan(0.95);
    expect(moved.position.z).toBeGreaterThan(0);
  });
});

function obstacle(partial: Pick<ObstacleState, "id" | "position" | "halfSize"> & Partial<ObstacleState>): ObstacleState {
  return {
    visualKey: "test_obstacle",
    ...partial,
  };
}
