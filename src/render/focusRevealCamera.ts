import type { FocusRevealState } from "../game/core/GameMode";
import type { Vector3 } from "three";

function smoothstep(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Eased 0..1 blend for a target reveal: ramps in, holds, ramps back out so the
 * camera glides to the target and returns to the player. Shared by the Three
 * (CameraRig) and Raw WebGPU camera rigs so both paths behave identically.
 */
export function focusRevealBlend(reveal: FocusRevealState): number {
  const duration = Math.max(0.001, reveal.duration);
  const elapsed = reveal.elapsed;
  if (reveal.cameraCut) {
    return 1;
  }
  const ramp = Math.min(0.6, duration * 0.32);
  if (elapsed < ramp) return smoothstep(elapsed / ramp);
  if (reveal.chainToNext) return 1;
  if (elapsed > duration - ramp) return smoothstep((duration - elapsed) / ramp);
  return 1;
}

/**
 * 0..1 "weapon hidden" amount for the first-person viewmodel while a reveal is
 * active. Leads the camera blend slightly so the weapon/hands lower out of
 * frame just before the facility camera glides away (and are restored as it
 * returns) — without this the viewmodel stays glued to the camera and the glide
 * reads as teleporting the player while holding a weapon. Returns 0 when there
 * is no reveal, so the player is never permanently unequipped. Shared by the
 * Three viewmodel (drop-and-hide) and the Raw viewmodel pass (hard hide).
 */
export function focusRevealWeaponHidden(reveal: FocusRevealState | null | undefined): number {
  if (!reveal) return 0;
  if (reveal.cameraCut) return 1;
  if (reveal.elapsed <= 0) return 0;
  return Math.max(0, Math.min(1, focusRevealBlend(reveal) * 1.5));
}

/**
 * Per-frame camera approach rate (used as `1 - exp(-rate * delta)`). The reveal
 * glide is intentionally gentler than normal first-person follow so the handoff
 * reads as a controlled facility camera move rather than a snap.
 */
export function focusRevealCameraApproach(
  reveal: FocusRevealState | null | undefined,
  options: { snapReturnFromCameraCut?: boolean } = {},
): number {
  if (reveal?.cameraCut || options.snapReturnFromCameraCut) return 1_000_000;
  return reveal ? 7.5 : 18;
}

export function applyFocusRevealCameraBlend(
  reveal: FocusRevealState | null | undefined,
  cameraPosition: Vector3,
  lookTarget: Vector3,
  revealPosition: Vector3,
  revealTarget: Vector3,
) {
  if (!reveal) return 0;
  const blend = focusRevealBlend(reveal);
  revealPosition.fromArray(reveal.cameraPosition);
  revealTarget.fromArray(reveal.targetPosition);
  cameraPosition.lerp(revealPosition, blend);
  lookTarget.lerp(revealTarget, blend);
  return blend;
}
