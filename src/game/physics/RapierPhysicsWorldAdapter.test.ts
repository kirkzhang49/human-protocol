import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import type { ObstacleState } from "../entities/EntityTypes";
import { createRapierPhysicsWorldAdapter } from "./RapierPhysicsWorldAdapter";

describe("RapierPhysicsWorldAdapter", () => {
  it("initializes Rapier without deprecated init warnings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const adapter = createRapierPhysicsWorldAdapter();

      await adapter.init();

      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("deprecated parameters"));
    } finally {
      warn.mockRestore();
    }
  });

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

  it("keeps sliding momentum against rotated furniture colliders", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();
    adapter.syncStaticObstacles([
      obstacle({
        id: "rotated-display-case",
        position: new Vector3(0.75, 0.5, 0),
        halfSize: new Vector3(0.25, 0.5, 0.95),
        yaw: Math.PI / 4,
      }),
    ]);

    const moved = adapter.moveKinematicCircle({
      id: "player",
      position: new Vector3(-0.5, 0, -0.55),
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(2, 0, 0.5),
    });

    expect(moved.blocked).toBe(true);
    expect(moved.translation.length()).toBeGreaterThan(0.25);
    expect(moved.position.z).toBeGreaterThan(-0.35);
  });

  it("lets kinematic players squeeze through a passable doorframe", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();
    adapter.syncStaticObstacles([
      obstacle({
        id: "left-door-post",
        position: new Vector3(-0.44, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      }),
      obstacle({
        id: "right-door-post",
        position: new Vector3(0.44, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      }),
    ]);

    const moved = adapter.moveKinematicCircle({
      id: "player",
      position: new Vector3(0, 0, 0),
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(0, 0, -1.5),
    });

    expect(moved.blocked).toBe(false);
    expect(moved.position.z).toBeCloseTo(-1.5, 4);
  });

  it("blocks kinematic players from squeezing through an undersized doorframe", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();
    adapter.syncStaticObstacles([
      obstacle({
        id: "left-tight-door-post",
        position: new Vector3(-0.41, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      }),
      obstacle({
        id: "right-tight-door-post",
        position: new Vector3(0.41, 0.75, -1),
        halfSize: new Vector3(0.1, 0.75, 0.2),
      }),
    ]);

    const moved = adapter.moveKinematicCircle({
      id: "player",
      position: new Vector3(0, 0, 0),
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(0, 0, -1.5),
    });

    expect(moved.blocked).toBe(true);
    expect(moved.position.z).toBeGreaterThan(-1.1);
  });

  it("uses kinematic character height when sweeping through raised obstacles", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();
    adapter.syncStaticObstacles([
      obstacle({
        id: "raised-crossbar",
        position: new Vector3(1.1, 1.2, 0),
        halfSize: new Vector3(0.22, 0.18, 1),
      }),
    ]);

    const moved = adapter.moveKinematicCircle({
      id: "player",
      position: new Vector3(0, 0, 0),
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(1.6, 0, 0),
    });

    expect(moved.blocked).toBe(true);
    expect(moved.position.x).toBeLessThan(0.72);
  });

  it("keeps kinematic character movement on the ground plane", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();

    const moved = adapter.moveKinematicCircle({
      id: "player",
      position: new Vector3(0, 0, 0),
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(0.75, 0.25, 0),
    });

    expect(moved.position.y).toBeCloseTo(0, 5);
    expect(moved.translation.y).toBeCloseTo(0, 5);
  });

  it("recovers kinematic characters that start overlapped with fixed obstacles", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();
    adapter.syncStaticObstacles([
      obstacle({
        id: "post-separation-wall",
        position: new Vector3(0, 0.5, 0),
        halfSize: new Vector3(0.5, 0.5, 0.5),
      }),
    ]);

    const moved = adapter.moveKinematicCircle({
      id: "enemy:1",
      position: new Vector3(0.42, 0, 0),
      radius: 0.3,
      height: 1.2,
      desiredTranslation: new Vector3(0, 0, 0),
    });

    expect(moved.blocked).toBe(true);
    expect(moved.position.x).toBeGreaterThan(0.79);
    expect(moved.position.y).toBeCloseTo(0, 5);
  });

  it("steps opt-in dynamic prop bodies on the ground plane", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();

    adapter.syncDynamicPropBodies([
      {
        id: "loose-crate",
        position: new Vector3(0, 0.35, 0),
        halfSize: new Vector3(0.35, 0.35, 0.35),
        mass: 1,
      },
    ]);
    expect(adapter.applyDynamicImpulse("loose-crate", new Vector3(2.4, 0, 0))).toBe(true);

    adapter.step(1 / 30);

    const snapshot = adapter.dynamicBodySnapshots().find((body) => body.id === "loose-crate");
    expect(snapshot?.position.x).toBeGreaterThan(0.01);
    expect(snapshot?.position.y).toBeCloseTo(0.35, 4);
  });

  it("does not treat dynamic prop bodies as static kinematic blockers", async () => {
    const adapter = createRapierPhysicsWorldAdapter();
    await adapter.init();
    adapter.syncDynamicPropBodies([
      {
        id: "loose-crate",
        position: new Vector3(0.7, 0.35, 0),
        halfSize: new Vector3(0.25, 0.35, 0.25),
        mass: 1,
      },
    ]);

    const moved = adapter.moveKinematicCircle({
      id: "player",
      position: new Vector3(0, 0, 0),
      radius: 0.32,
      height: 1.6,
      desiredTranslation: new Vector3(1.2, 0, 0),
    });

    expect(moved.blocked).toBe(false);
    expect(moved.position.x).toBeCloseTo(1.2, 4);
  });
});

function obstacle(partial: Pick<ObstacleState, "id" | "position" | "halfSize"> & Partial<ObstacleState>): ObstacleState {
  return {
    visualKey: "test_obstacle",
    ...partial,
  };
}
