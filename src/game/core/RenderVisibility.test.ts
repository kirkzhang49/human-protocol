import { describe, expect, it } from "vitest";
import { interactionFocusRevealRiseOffsetY, isInteractionVisualVisible, isRoomRenderVisible } from "./RenderVisibility";

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

  it("hides route-gated puzzle interactions until their switch output is active", () => {
    const interaction = {
      id: "route_puzzle_panel",
      roomId: "puzzle_room",
      visualKey: "puzzle_console_circuit_grid",
      requiresSwitchState: { switchId: "route_console", stateId: "out_1_puzzle" },
    };
    const world = {
      activeSwitchStateId: () => "idle",
      session: { activeFocusReveal: null },
    };

    expect(isInteractionVisualVisible(world as any, interaction as any)).toBe(false);

    const activeWorld = {
      ...world,
      activeSwitchStateId: () => "out_1_puzzle",
    };
    expect(isInteractionVisualVisible(activeWorld as any, interaction as any)).toBe(true);

    const latchedWorld = {
      ...world,
      activeSwitchStateId: () => "out_2_wave",
      session: {
        activeFocusReveal: null,
        mapProgress: {
          activatedSwitchIds: ["route_console:out_1_puzzle"],
        },
      },
    };
    expect(isInteractionVisualVisible(latchedWorld as any, interaction as any)).toBe(true);

    const revealingWorld = {
      ...world,
      session: {
        activeFocusReveal: {
          kind: "puzzle",
          targetId: "route_puzzle_panel",
        },
      },
    };
    expect(isInteractionVisualVisible(revealingWorld as any, interaction as any)).toBe(true);
  });

  it("raises the focused puzzle interaction from below during its reveal", () => {
    const interaction = {
      id: "route_puzzle_panel",
      roomId: "puzzle_room",
      visualKey: "puzzle_console_circuit_grid",
    };
    const world = {
      session: {
        activeFocusReveal: {
          kind: "puzzle",
          targetId: "route_puzzle_panel",
          elapsed: 0,
          duration: 3.4,
        },
      },
    };

    expect(interactionFocusRevealRiseOffsetY(world as any, interaction as any, 2.48)).toBeCloseTo(-2.48);
    world.session.activeFocusReveal.elapsed = 1.25;
    expect(interactionFocusRevealRiseOffsetY(world as any, interaction as any, 2.48)).toBeLessThan(-0.3);
    world.session.activeFocusReveal.elapsed = 2.5;
    expect(interactionFocusRevealRiseOffsetY(world as any, interaction as any)).toBeCloseTo(0);
  });
});
