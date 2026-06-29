import { describe, expect, it } from "vitest";
import { resolvePropCollisionProxy } from "./MapGeometry";

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
