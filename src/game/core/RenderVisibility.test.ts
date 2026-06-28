import { describe, expect, it } from "vitest";
import { isRoomRenderVisible } from "./RenderVisibility";

describe("RenderVisibility focus reveals", () => {
  it("keeps both sides of a door reveal visible", () => {
    const world = {
      level: {
        map: {
          rooms: [
            { id: "control_room", bounds: { center: [0, 0, -12], size: [8, 4, 8] } },
            { id: "left_room", bounds: { center: [0, 0, 0], size: [8, 4, 8] } },
            { id: "right_room", bounds: { center: [0, 0, 8], size: [8, 4, 8] } },
            { id: "far_room", bounds: { center: [0, 0, 30], size: [8, 4, 8] } },
          ],
          doors: [
            { id: "door_reveal", fromRoomId: "left_room", toRoomId: "right_room", position: [0, 0, 4] },
          ],
        },
      },
      session: {
        activeFocusReveal: {
          kind: "door",
          targetId: "door_reveal",
          roomId: "right_room",
        },
        mapProgress: {
          currentRoomId: "control_room",
        },
        exitUnlocked: false,
      },
      renderPerformance: { quality: { tier: "rescue" } },
      player: { position: { x: 0, z: -12 } },
      activeObjective: () => null,
    };

    expect(isRoomRenderVisible(world as any, "left_room")).toBe(true);
    expect(isRoomRenderVisible(world as any, "right_room")).toBe(true);
    expect(isRoomRenderVisible(world as any, "far_room")).toBe(false);
  });
});
