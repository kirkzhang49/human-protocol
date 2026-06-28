import type { LevelExitCinematicDefinition } from "../config/schema/levelConfig";
import type { ExitCinematicState } from "./GameMode";

export const officialExitAscentDuration = 4.8;
export const officialExitAscentHoldAfterWhiteOut = 1.12;

export interface ResolvedExitCinematicTiming {
  duration: number;
  walkInDuration: number;
  doorOpenTime: number;
  doorCloseTime: number;
  buttonPressTime: number;
  buttonPressDuration: number;
  ascentStartTime: number;
  ascentDuration: number;
  whiteOutTime: number;
}

type ExitButtonState = Pick<ExitCinematicState, "elapsed" | "buttonPressTime" | "buttonPressDuration">;
type ExitAscentState = Pick<ExitCinematicState, "elapsed" | "ascentStartTime" | "ascentDuration" | "duration" | "whiteOutTime">;

export interface ExitElevatorButtonVisualState {
  touch: number;
  plunger: number;
  pressDepthMeters: number;
  contactPulse: number;
  panelConfirm: number;
  latch: number;
  amberMix: number;
  ringGlow: number;
}

export interface ExitElevatorShaftVisualState {
  ascent: number;
  reveal: number;
  sealedCabin: number;
  glassOpacity: number;
  streakOpacity: number;
  beamOpacity: number;
  fogOpacity: number;
  speedMultiplier: number;
  whiteOut: number;
}

export function resolveExitCinematicTiming(cinematic: LevelExitCinematicDefinition): ResolvedExitCinematicTiming {
  const walkInDuration = Math.max(0.1, cinematic.walkInDuration);
  const doorOpenTime = cinematic.doorOpenTime ?? 0.1;
  const doorCloseTime = cinematic.doorCloseTime ?? Math.max(walkInDuration + 0.6, cinematic.duration * 0.58);
  const buttonPressTime = cinematic.buttonPressTime ?? Math.max(walkInDuration + 0.95, cinematic.duration * 0.7);
  const buttonPressDuration = Math.max(0.25, cinematic.buttonPressDuration ?? 1.05);
  const ascentStartTime = cinematic.ascentStartTime ?? buttonPressTime + Math.min(0.34, buttonPressDuration * 0.28);
  const ascentDuration = Math.max(0, cinematic.ascentDuration ?? officialExitAscentDuration);
  const rideWhiteOutTime = ascentStartTime + ascentDuration;
  const authoredWhiteOutTime = cinematic.whiteOutTime ?? Math.max(cinematic.duration - 0.9, cinematic.duration * 0.78);
  const whiteOutTime = Math.max(authoredWhiteOutTime, rideWhiteOutTime);
  const duration = Math.max(cinematic.duration, whiteOutTime + officialExitAscentHoldAfterWhiteOut);

  return {
    duration,
    walkInDuration,
    doorOpenTime,
    doorCloseTime,
    buttonPressTime,
    buttonPressDuration,
    ascentStartTime,
    ascentDuration,
    whiteOutTime,
  };
}

export function exitButtonPressLeadIn(duration: number) {
  return Math.min(Math.max(0.2, duration), 0.95);
}

export function exitButtonTouchProgress(state: Pick<ExitCinematicState, "elapsed" | "buttonPressTime" | "buttonPressDuration">) {
  const duration = exitButtonPressLeadIn(state.buttonPressDuration);
  const pressIn = segment(state.elapsed, state.buttonPressTime - duration, state.buttonPressTime);
  const pressOut = 1 - segment(state.elapsed, state.buttonPressTime + 0.16, state.buttonPressTime + 0.5);
  return easeInOutCubic(Math.min(pressIn, pressOut));
}

export function exitButtonPlungerProgress(state: Pick<ExitCinematicState, "elapsed" | "buttonPressTime">) {
  const pressIn = smoothstep(segment(state.elapsed, state.buttonPressTime - 0.22, state.buttonPressTime + 0.06));
  if (pressIn <= 0) return 0;
  const reboundPhase = segment(state.elapsed, state.buttonPressTime + 0.06, state.buttonPressTime + 0.22);
  const settle = smoothstep(segment(state.elapsed, state.buttonPressTime + 0.22, state.buttonPressTime + 0.68));
  const tactileOvershoot = Math.sin(reboundPhase * Math.PI) * 0.08 * (1 - settle);
  return clamp01(pressIn * (1 - settle * 0.42) + tactileOvershoot);
}

export function exitElevatorButtonVisualState(state: ExitButtonState | null | undefined): ExitElevatorButtonVisualState {
  if (!state) {
    return {
      touch: 0,
      plunger: 0,
      pressDepthMeters: 0,
      contactPulse: 0,
      panelConfirm: 0,
      latch: 0,
      amberMix: 0,
      ringGlow: 0.42,
    };
  }
  const touch = exitButtonTouchProgress(state);
  const plunger = exitButtonPlungerProgress(state);
  const panelConfirm = smoothstep(segment(state.elapsed, state.buttonPressTime + 0.06, state.buttonPressTime + 0.48));
  const latch = smoothstep(segment(state.elapsed, state.buttonPressTime + 0.18, state.buttonPressTime + 0.64));
  const contactPulse = smoothstep(1 - Math.abs(state.elapsed - state.buttonPressTime) / 0.18);
  const amberMix = clamp01(latch * 0.92 + contactPulse * 0.18);

  return {
    touch,
    plunger,
    pressDepthMeters: plunger * 0.105,
    contactPulse,
    panelConfirm,
    latch,
    amberMix,
    ringGlow: 0.28 + panelConfirm * 1.35 + contactPulse * 0.95,
  };
}

export function exitAscentProgress(
  state: Pick<ExitCinematicState, "elapsed" | "ascentStartTime" | "ascentDuration"> | null | undefined,
) {
  if (!state || state.ascentDuration <= 0) return 0;
  return smoothstep(segment(state.elapsed, state.ascentStartTime, state.ascentStartTime + state.ascentDuration));
}

export function exitElevatorShaftVisualState(state: ExitAscentState | null | undefined): ExitElevatorShaftVisualState {
  if (!state || state.ascentDuration <= 0) {
    return {
      ascent: 0,
      reveal: 0,
      sealedCabin: 0,
      glassOpacity: 0,
      streakOpacity: 0,
      beamOpacity: 0,
      fogOpacity: 0,
      speedMultiplier: 1,
      whiteOut: 0,
    };
  }
  const ascent = exitAscentProgress(state);
  const whiteOut = exitCinematicWhiteOutProgress(state);
  const reveal = smoothstep(segment(state.elapsed, state.ascentStartTime + 0.22, state.ascentStartTime + 1.04));
  const sealedCabin = smoothstep(segment(state.elapsed, state.ascentStartTime - 0.42, state.ascentStartTime + 0.34));
  const preWhite = 1 - whiteOut * 0.62;

  return {
    ascent,
    reveal,
    sealedCabin,
    glassOpacity: clamp01((0.04 + reveal * 0.22 + ascent * 0.05) * preWhite),
    streakOpacity: clamp01((0.08 + reveal * 0.68) * ascent * preWhite),
    beamOpacity: clamp01((0.04 + reveal * 0.46) * ascent * preWhite),
    fogOpacity: clamp01((0.02 + reveal * 0.12 + ascent * 0.08) * (1 - whiteOut * 0.35)),
    speedMultiplier: 0.9 + ascent * 0.82 + reveal * 0.22,
    whiteOut,
  };
}

export function exitCinematicWhiteOutProgress(
  state: Pick<ExitCinematicState, "elapsed" | "duration" | "whiteOutTime"> | null | undefined,
) {
  if (!state) return 0;
  return clamp01((state.elapsed - state.whiteOutTime) / Math.max(0.001, state.duration - state.whiteOutTime));
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function segment(value: number, start: number, end: number) {
  return clamp01((value - start) / Math.max(0.001, end - start));
}

function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
