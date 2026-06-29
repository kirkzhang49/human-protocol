import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import type { FocusRevealState } from "../game/core/GameMode";
import { applyFocusRevealCameraBlend, focusRevealBlend, focusRevealCameraApproach } from "./focusRevealCamera";

function robotReveal(overrides: Partial<FocusRevealState> = {}): FocusRevealState {
  return {
    kind: "robot",
    targetId: "enemy:7",
    roomId: "room_boss",
    elapsed: 0.25,
    duration: 3,
    targetPosition: [8, 1.4, 1],
    cameraPosition: [10, 2, 4],
    cameraCut: true,
    ...overrides,
  };
}

describe("applyFocusRevealCameraBlend", () => {
  it("uses the cut reveal camera pose for overlay renderers", () => {
    const cameraPosition = new Vector3(1, 2, 3);
    const lookTarget = new Vector3(1, 2, -7);
    const revealPosition = new Vector3();
    const revealTarget = new Vector3();

    const blend = applyFocusRevealCameraBlend(robotReveal(), cameraPosition, lookTarget, revealPosition, revealTarget);

    expect(blend).toBe(1);
    expect(cameraPosition.toArray()).toEqual([10, 2, 4]);
    expect(lookTarget.toArray()).toEqual([8, 1.4, 1]);
  });

  it("leaves the camera pose unchanged without a reveal", () => {
    const cameraPosition = new Vector3(1, 2, 3);
    const lookTarget = new Vector3(1, 2, -7);
    const revealPosition = new Vector3();
    const revealTarget = new Vector3();

    const blend = applyFocusRevealCameraBlend(null, cameraPosition, lookTarget, revealPosition, revealTarget);

    expect(blend).toBe(0);
    expect(cameraPosition.toArray()).toEqual([1, 2, 3]);
    expect(lookTarget.toArray()).toEqual([1, 2, -7]);
  });

  it("keeps camera-cut reveals fully on the facility camera until the reveal clears", () => {
    expect(focusRevealBlend(robotReveal({ elapsed: 2.92, duration: 3 }))).toBe(1);
  });

  it("snaps back to the player camera on the first frame after a camera-cut reveal", () => {
    expect(focusRevealCameraApproach(null, { snapReturnFromCameraCut: true })).toBeGreaterThan(1000);
  });
});
