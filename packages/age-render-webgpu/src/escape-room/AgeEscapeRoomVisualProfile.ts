import type { AgeId, AgeRenderQualityTier, AgeTuple3 } from "../core/AgeTypes";
import type { AgeGlassSurfacePolicy } from "../lighting/AgeLightingProfile";
import type { AgeMaterialRole } from "../materials/AgeMaterialRoles";

/**
 * Escape-room visual direction contracts.
 *
 * Escape rooms know things a generic scene renderer does not: the player is
 * always inside exactly one room, visibility flows through doors/portals,
 * lights belong to rooms, and materials carry gameplay semantics (route
 * markers, danger markers, interactive switches). These contracts make that
 * knowledge first-class rendering data. Game adapters derive a profile from
 * their own config; the engine consumes only generic numbers and role names.
 */

export interface AgeRoomVisualProfile {
  roomId: AgeId;
  mood?: string;
  /** Tone targets for the room the camera is in. */
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  /** Multipliers applied to the frame's base lighting when this room is current. */
  ambientIntensityScale: number;
  keyLightIntensityScale: number;
  localLightIntensityScale: number;
  /** Per-room local light budget; falls back to the profile-level selection budget. */
  lightBudget?: Partial<Record<AgeRenderQualityTier, number>>;
  fog?: {
    nearScale: number;
    farScale: number;
  };
  bloom?: {
    strengthScale: number;
    thresholdLift: number;
  };
  /** Surface role tuning hooks for this room (floor/wall/ceiling and friends). */
  surfaceTuning?: readonly AgeMaterialRoleTuning[];
}

export interface AgeMaterialRoleTuning {
  role: AgeMaterialRole;
  /** Scales diffuse/lighting response through existing material paths. */
  intensityScale: number;
  /** Scales emissive strength for the role (1 = authored value). */
  emissiveBoost: number;
  /** Optional tint pulled toward by existing palette paths; engine treats it as advisory. */
  tint?: AgeTuple3;
  saturationCeiling?: number;
}

export interface AgePortalVisualPolicy {
  /** Glow applied to portal/door materials while closed (locked attention cue). */
  closedGlow: { color: AgeTuple3; intensity: number };
  /** Glow applied while open (route confirmation cue). */
  openGlow: { color: AgeTuple3; intensity: number };
  /** Seconds for open/close visual transitions driven by portal state records. */
  openTransitionSeconds: number;
  /** Closed portals block room visibility (escape-room occlusion model). */
  occludeWhenClosed: boolean;
  /** Opening a portal reveals the adjacent room before the player crosses. */
  revealAdjacentRoomOnOpen: boolean;
}

export interface AgeGroundingVisualPolicy {
  enabled: boolean;
  /** Multiplier on contact record strength when converting to shadow opacity. */
  strengthScale: number;
  /** Half-extent clamp in world units. */
  maxRadius: number;
  /** Contacts above this height over their ground point fade to nothing. */
  fadeHeight: number;
  /** Hard cap on grounded contacts rendered per frame. */
  maxContacts: number;
  /** Optional opacity multipliers per contact kind (e.g. character vs pickup). */
  opacityByKind?: Readonly<Record<string, number>>;
}

export interface AgeRoomLightSelection {
  /** Default local light budget per quality tier. */
  budgetPerTier: Record<AgeRenderQualityTier, number>;
  /** Score bonus for lights in the camera's current room. */
  currentRoomBias: number;
  /** Keep at least one ambience light (e.g. floor glow) even under budget pressure. */
  reserveAmbienceSlot: boolean;
}

export interface AgeEscapeRoomVisualProfile {
  id: AgeId;
  label?: string;
  /** Fallback room profile when a room has no explicit entry. */
  defaultRoom: Omit<AgeRoomVisualProfile, "roomId">;
  rooms: Readonly<Record<string, AgeRoomVisualProfile>>;
  lightSelection: AgeRoomLightSelection;
  grounding: AgeGroundingVisualPolicy;
  portals: AgePortalVisualPolicy;
  glass: AgeGlassSurfacePolicy;
  roleTuning: readonly AgeMaterialRoleTuning[];
  bloom: { strengthScale: number; thresholdLift: number };
  fog: { nearScale: number; farScale: number };
}

export const ageDefaultEscapeRoomVisualProfile: AgeEscapeRoomVisualProfile = {
  id: "age.default.escape-room-visual",
  label: "Neutral escape-room visual direction",
  defaultRoom: {
    exposure: 1,
    contrast: 1.05,
    saturation: 1,
    warmth: 0.45,
    ambientIntensityScale: 1,
    keyLightIntensityScale: 1,
    localLightIntensityScale: 1,
    fog: { nearScale: 1, farScale: 1 },
    bloom: { strengthScale: 1, thresholdLift: 0 },
  },
  rooms: {},
  lightSelection: {
    budgetPerTier: { high: 10, balanced: 8, rescue: 4, custom: 8 },
    currentRoomBias: 1,
    reserveAmbienceSlot: true,
  },
  grounding: {
    enabled: true,
    strengthScale: 1,
    maxRadius: 1.8,
    fadeHeight: 1.6,
    maxContacts: 48,
    opacityByKind: { character: 1, pickup: 0.7 },
  },
  portals: {
    closedGlow: { color: [1, 0.32, 0.26], intensity: 0.8 },
    openGlow: { color: [0.45, 0.92, 1], intensity: 0.6 },
    openTransitionSeconds: 0.6,
    occludeWhenClosed: true,
    revealAdjacentRoomOnOpen: true,
  },
  glass: {
    preferWeightedOit: true,
    fresnelF0: 0.04,
    absorptionColor: [0.18, 0.2, 0.22],
    absorptionDistance: 1.8,
    roughnessFloor: 0.06,
    refractionStrength: 0.12,
  },
  roleTuning: [
    { role: "emissive-accent", intensityScale: 1, emissiveBoost: 1.2 },
    { role: "route-marker", intensityScale: 1, emissiveBoost: 1.15 },
    { role: "danger-marker", intensityScale: 1, emissiveBoost: 1.25 },
    { role: "screen-label", intensityScale: 1, emissiveBoost: 1.1 },
  ],
  bloom: { strengthScale: 1, thresholdLift: 0 },
  fog: { nearScale: 1, farScale: 1 },
};

/** Resolves the effective visual profile for a room, falling back to the profile default. */
export function ageRoomVisualProfileFor(
  profile: AgeEscapeRoomVisualProfile,
  roomId: string,
): AgeRoomVisualProfile {
  return profile.rooms[roomId] ?? { roomId, ...profile.defaultRoom };
}

/** Resolves the local-light budget for a room and quality tier. */
export function ageRoomLightBudgetFor(
  profile: AgeEscapeRoomVisualProfile,
  roomId: string,
  tier: AgeRenderQualityTier,
): number {
  const room = profile.rooms[roomId];
  const roomBudget = room?.lightBudget?.[tier];
  if (typeof roomBudget === "number" && roomBudget >= 0) return roomBudget;
  return profile.lightSelection.budgetPerTier[tier] ?? profile.lightSelection.budgetPerTier.custom ?? 8;
}

export interface AgeSelectableLight {
  id: AgeId;
  roomId?: AgeId | null;
  score: number;
  /** Ambience lights (floor glow, wash) compete for the reserved slot. */
  ambience?: boolean;
}

/**
 * Room-aware local light selection: scores lights with a current-room bias and
 * optionally reserves one slot for the best ambience light so budget pressure
 * never strips a room of its fill glow. Generic version of the selection the
 * raw Human Protocol renderer performs in rawShaderLightsFor.
 */
export function ageSelectRoomLights<T extends AgeSelectableLight>(
  lights: readonly T[],
  currentRoomId: string,
  budget: number,
  selection: AgeRoomLightSelection,
): T[] {
  if (budget <= 0) return [];
  const scored = [...lights].sort((left, right) => effectiveScore(right, currentRoomId, selection) - effectiveScore(left, currentRoomId, selection));
  if (scored.length <= budget) return scored;
  const picked = scored.slice(0, budget);
  if (!selection.reserveAmbienceSlot || picked.some((light) => light.ambience)) return picked;
  const bestAmbience = scored.find((light) => light.ambience);
  if (!bestAmbience) return picked;
  picked[picked.length - 1] = bestAmbience;
  return picked;
}

function effectiveScore(light: AgeSelectableLight, currentRoomId: string, selection: AgeRoomLightSelection) {
  return light.score + (light.roomId === currentRoomId ? selection.currentRoomBias : 0);
}
