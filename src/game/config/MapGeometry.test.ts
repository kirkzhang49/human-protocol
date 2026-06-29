import { describe, expect, it } from "vitest";
import { createRoomWallSegments, resolvePropCollisionProxy } from "./MapGeometry";

describe("resolvePropCollisionProxy", () => {
  it("preserves explicit collider yaw for rotated GLB furniture proxies", () => {
    const proxy = resolvePropCollisionProxy({
      id: "rotated-display-case",
      roomId: "museum-room",
      modelKey: "level03_display_case",
      position: [4, 0, -2],
      rotation: [0, Math.PI / 4, 0],
      scale: 1,
      collider: {
        halfSize: [0.8, 1.1, 0.25],
        offset: [0.1, 0.4, -0.2],
      },
    });

    expect(proxy).toMatchObject({
      id: "rotated-display-case",
      modelKey: "level03_display_case",
      position: [4.1, 0.4, -2.2],
      halfSize: [0.8, 1.1, 0.25],
      yaw: Math.PI / 4,
    });
  });
});

describe("createRoomWallSegments", () => {
  it("orients shaped-room diagonal walls along their polygon edge", () => {
    const level = {
      id: "shape-wall-test",
      map: {
        rooms: [
          {
            id: "triangle_room",
            label: "Triangle Room",
            bounds: {
              center: [0, 0, 0],
              size: [8, 4, 5.2],
              shape: { points: [[-4, -2.6], [4, -2.6], [0, 2.6]] },
            },
            geometry: { collisionWalls: true },
          },
        ],
        doors: [],
      },
    } as any;

    const segments = createRoomWallSegments(level, () => true);
    const diagonal = segments.find((segment) => segment.id === "triangle_room:edge1:0");

    expect(diagonal?.yaw).toBeTypeOf("number");
    const edgeDirection = [-4, 5.2];
    const length = Math.hypot(edgeDirection[0], edgeDirection[1]);
    const yawDirection = [Math.cos(diagonal!.yaw!), -Math.sin(diagonal!.yaw!)];
    const alignment = (yawDirection[0] * edgeDirection[0] + yawDirection[1] * edgeDirection[1]) / length;

    expect(alignment).toBeGreaterThan(0.999);
  });
});
