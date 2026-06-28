import {
  RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON,
  RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS,
  RAW_VIEWMODEL_MODEL_KEYS,
  type RawViewmodelHandGripFamily,
} from "./RawViewmodelMode";
import type { Tuple3 } from "./RawWebGpuTypes";
import { ROD_VIEWMODEL_RAW_SCALE } from "../viewmodelScaleTuning";

/**
 * Data-driven profiles for the native Raw WebGPU viewmodel pass: one entry
 * per weapon pairing the cooked weapon GLB with its baked hand GLB, camera-
 * space poses, anchoring, muzzle anchor, and articulation rules.
 *
 * All numbers here are tuning knobs for screenshot QA — the pass consumes
 * profiles and never hardcodes weapon-specific keys or poses.
 */

export interface RawViewmodelPose {
  /** Camera-space position (x right, y up, z forward-negative), meters. */
  basePosition: Tuple3;
  /** Base orientation, XYZ euler radians. */
  baseRotation: Tuple3;
  /**
   * "recenter": geometry is recentered on its bounds before posing; `scale`
   * is the displayed length in meters along the longest axis.
   * "origin": geometry keeps its authored origin (matches the Three overlay
   * placement); `scale` is a raw multiplier on authored units.
   */
  anchor: "recenter" | "origin";
  scale: number;
}

export interface RawViewmodelArticulationRule {
  /** Which model-space delta drives the animated group. */
  kind: "slide" | "impact";
  /** Node-chunk names belonging to the animated group. */
  chunkPattern: RegExp;
}

export interface RawViewmodelWeaponProfile {
  weaponId: "pulseRifle" | "railLance";
  weaponModelKey: string;
  /** Reusable hand asset family. Prefer adding a family over baking per-weapon hands. */
  handGripFamily: RawViewmodelHandGripFamily;
  handModelKey: string;
  weaponPose: RawViewmodelPose;
  /** Baked one-hand grip pose; follows the same sway/recoil motion as the weapon. */
  handPose: RawViewmodelPose;
  /** Model-space muzzle anchor for flash placement (null = camera-space fallback). */
  muzzleModel: Tuple3 | null;
  articulation: RawViewmodelArticulationRule | null;
  /** Player-facing label when the hand asset is unavailable. */
  handFallbackLabel: string;
}

/** Iron rod (weapon id pulseRifle): modeled along +Y; held diagonally low-right. */
export const RAW_VIEWMODEL_POSE_ROD: RawViewmodelPose = {
  basePosition: [0.44, -0.4, -0.95],
  baseRotation: [-1.02, 0.16, 0.46],
  anchor: "recenter",
  scale: ROD_VIEWMODEL_RAW_SCALE,
};

/**
 * Sidearm (weapon id railLance): authored origin at the hands, muzzle -Z —
 * placed like the Three overlay (origin-anchored), slightly smaller for the
 * raw camera's 72° FOV.
 */
export const RAW_VIEWMODEL_POSE_SIDEARM: RawViewmodelPose = {
  basePosition: [0.4, -0.6, -1.16],
  baseRotation: [-0.08, -0.16, -0.06],
  anchor: "origin",
  scale: 0.7,
};

/**
 * Baked hand poses: conservative grip placement near each weapon's hold
 * point. Pure tuning knobs — adjust with screenshot QA.
 */
export const RAW_VIEWMODEL_HAND_POSE_ROD: RawViewmodelPose = {
  basePosition: [0.39, -0.52, -0.86],
  baseRotation: [-0.52, 0.12, 0.24],
  anchor: "recenter",
  scale: 0.38,
};

export const RAW_VIEWMODEL_HAND_POSE_SIDEARM: RawViewmodelPose = {
  basePosition: [0.39, -0.63, -1.06],
  baseRotation: [-0.08, -0.16, -0.06],
  anchor: "recenter",
  scale: 0.48,
};

export const RAW_VIEWMODEL_PROFILES: Readonly<Record<string, RawViewmodelWeaponProfile>> = {
  pulseRifle: {
    weaponId: "pulseRifle",
    weaponModelKey: RAW_VIEWMODEL_MODEL_KEYS.pulseRifle,
    handGripFamily: RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON.pulseRifle,
    handModelKey: RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS[RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON.pulseRifle],
    weaponPose: RAW_VIEWMODEL_POSE_ROD,
    handPose: RAW_VIEWMODEL_HAND_POSE_ROD,
    muzzleModel: null,
    articulation: { kind: "impact", chunkPattern: /impact_head|impact_rivet/ },
    handFallbackLabel: "铁棍仅武器（手部素材缺失）",
  },
  railLance: {
    weaponId: "railLance",
    weaponModelKey: RAW_VIEWMODEL_MODEL_KEYS.railLance,
    handGripFamily: RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON.railLance,
    handModelKey: RAW_VIEWMODEL_HAND_GRIP_MODEL_KEYS[RAW_VIEWMODEL_HAND_GRIP_BY_WEAPON.railLance],
    weaponPose: RAW_VIEWMODEL_POSE_SIDEARM,
    handPose: RAW_VIEWMODEL_HAND_POSE_SIDEARM,
    muzzleModel: [0, 0.24, -1.44],
    articulation: { kind: "slide", chunkPattern: /(^|_)slide($|_)|slide_rail|top_machined_rib|top_battered_spine/ },
    handFallbackLabel: "手枪仅武器（手部素材缺失）",
  },
};

export function rawViewmodelProfileFor(weaponId: string): RawViewmodelWeaponProfile | null {
  return RAW_VIEWMODEL_PROFILES[weaponId] ?? null;
}
