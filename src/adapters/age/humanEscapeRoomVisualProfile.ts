import {
  ageDefaultEscapeRoomVisualProfile,
  type AgeEscapeRoomVisualProfile,
  type AgeGroundingVisualPolicy,
  type AgeMaterialRoleTuning,
  type AgePortalVisualPolicy,
  type AgeRenderQualityTier,
  type AgeRoomVisualProfile,
  type AgeTuple3,
} from "@age/render-webgpu";
import { defaultLightingProfile } from "../../render/raw-webgpu/RawWebGpuLighting";
import type { RawPlanMaterial, RawRenderPlan } from "../../render/raw-webgpu/RawWebGpuTypes";

/**
 * Derives a generic AGE escape-room visual profile from Human Protocol's raw
 * render plan: per-room tone from cooked lighting profiles, room moods and
 * art-direction directives, per-room/per-tier local light budgets from the
 * compiled visibility scenarios, portal glow colors from door material roles,
 * and glass policy from transparent directives.
 *
 * The output contains no Human Protocol IDs the engine branches on — room ids
 * are opaque keys, and all semantics are expressed as generic AGE policy.
 */
export function humanEscapeRoomVisualProfileFor(plan: RawRenderPlan): AgeEscapeRoomVisualProfile {
  const moodByRoom = new Map(plan.rooms.map((room) => [room.id, room.mood ?? null]));
  const baseLightingByRoom = new Map(
    (plan.rawArtDirection?.roomDirectives ?? []).map((directive) => [directive.roomId, directive.baseLighting]),
  );
  const roomBudgets = roomLightBudgetsFrom(plan);

  const rooms: Record<string, AgeRoomVisualProfile> = {};
  // Guard with Array.isArray, not `?? []`: some committed plans (e.g. the
  // builder_runtime_resources supplemental pack, which has no real rooms) emit
  // `lightingProfiles: {}`, and `{} ?? []` is still `{}` — iterating it throws
  // `TypeError: object is not iterable`. Treat any non-array as empty.
  for (const lightingProfile of Array.isArray(plan.lightingProfiles) ? plan.lightingProfiles : []) {
    const roomId = lightingProfile.roomId;
    const moodScales = moodLightingScales(moodByRoom.get(roomId) ?? null, baseLightingByRoom.get(roomId) ?? null);
    rooms[roomId] = {
      roomId,
      mood: moodByRoom.get(roomId) ?? undefined,
      exposure: lightingProfile.artist?.exposure ?? defaultLightingProfile.artist.exposure,
      contrast: (lightingProfile.artist?.contrast ?? defaultLightingProfile.artist.contrast) + moodScales.contrastLift,
      saturation: lightingProfile.artist?.saturation ?? defaultLightingProfile.artist.saturation,
      warmth: lightingProfile.artist?.warmth ?? defaultLightingProfile.artist.warmth,
      ambientIntensityScale: moodScales.ambient,
      keyLightIntensityScale: moodScales.key,
      localLightIntensityScale: clamp(
        (lightingProfile.algorithm?.localLight ?? defaultLightingProfile.algorithm.localLight) * moodScales.localLight,
        0.5,
        1.5,
      ),
      lightBudget: roomBudgets.get(roomId),
      fog: { nearScale: 1, farScale: 1 },
      bloom: { strengthScale: moodScales.bloom, thresholdLift: 0 },
    };
  }

  const emissiveShare = emissiveMaterialShare(plan.geometry?.materials ?? []);
  return {
    id: `human-protocol.escape-room-visual.${plan.level.id}`,
    label: `Escape-room visual direction derived from raw plan for ${plan.level.id}`,
    defaultRoom: {
      exposure: defaultLightingProfile.artist.exposure,
      contrast: defaultLightingProfile.artist.contrast,
      saturation: defaultLightingProfile.artist.saturation,
      warmth: defaultLightingProfile.artist.warmth,
      ambientIntensityScale: 1,
      keyLightIntensityScale: 1,
      localLightIntensityScale: 1,
      fog: { nearScale: 1, farScale: 1 },
      bloom: { strengthScale: 1, thresholdLift: 0 },
    },
    rooms,
    lightSelection: {
      budgetPerTier: globalTierBudgets(plan),
      currentRoomBias: 1,
      reserveAmbienceSlot: true,
    },
    grounding: groundingPolicyFrom(plan),
    portals: portalPolicyFrom(plan.geometry?.materials ?? []),
    glass: glassPolicyFrom(plan),
    roleTuning: roleTuningFrom(emissiveShare),
    // More emissive-heavy levels earn a stronger bloom lift; clamp keeps the
    // escape-room direction from blowing out sparse levels.
    bloom: { strengthScale: clamp(1 + emissiveShare * 0.4, 1, 1.25), thresholdLift: 0 },
    // Escape rooms read better with slightly later fog onset than open scenes.
    fog: { nearScale: 1.05, farScale: 1.1 },
  };
}

/** Per-room/per-tier budgets straight from the compiled visibility scenarios. */
function roomLightBudgetsFrom(plan: RawRenderPlan) {
  const budgets = new Map<string, Partial<Record<AgeRenderQualityTier, number>>>();
  for (const scenario of plan.visibilityScenarios) {
    const entry = budgets.get(scenario.currentRoomId) ?? {};
    entry[scenario.qualityTier] = clamp(scenario.selectedLights.length, 1, 10);
    budgets.set(scenario.currentRoomId, entry);
  }
  return budgets;
}

function globalTierBudgets(plan: RawRenderPlan): Record<AgeRenderQualityTier, number> {
  const maxPerTier: Partial<Record<AgeRenderQualityTier, number>> = {};
  for (const scenario of plan.visibilityScenarios) {
    const current = maxPerTier[scenario.qualityTier] ?? 0;
    maxPerTier[scenario.qualityTier] = Math.max(current, clamp(scenario.selectedLights.length, 1, 10));
  }
  return {
    high: maxPerTier.high ?? 10,
    balanced: maxPerTier.balanced ?? 8,
    rescue: maxPerTier.rescue ?? 4,
    custom: maxPerTier.balanced ?? 8,
  };
}

/**
 * Escape-room mood direction: danger thresholds get darker ambient with a
 * hotter key light, galleries get a gentle key lift so exhibits separate from
 * shells. Derived from cooked mood/directive strings, not level IDs.
 */
function moodLightingScales(mood: string | null, baseLighting: string | null) {
  const subject = `${mood ?? ""} ${baseLighting ?? ""}`.toLowerCase();
  if (/danger|threshold|alarm/.test(subject)) {
    return { ambient: 0.88, key: 1.1, localLight: 1.08, contrastLift: 0.04, bloom: 1.1 };
  }
  if (/gallery|exhibit|dark/.test(subject)) {
    return { ambient: 0.96, key: 1.06, localLight: 1.04, contrastLift: 0.02, bloom: 1.06 };
  }
  if (/lab|clinic|neutral/.test(subject)) {
    return { ambient: 1.02, key: 1, localLight: 1, contrastLift: 0, bloom: 1 };
  }
  return { ambient: 1, key: 1.04, localLight: 1.02, contrastLift: 0.01, bloom: 1.04 };
}

function groundingPolicyFrom(plan: RawRenderPlan): AgeGroundingVisualPolicy {
  const contactValues = (Array.isArray(plan.lightingProfiles) ? plan.lightingProfiles : [])
    .map((profile) => profile.algorithm?.contact)
    .filter((value): value is number => typeof value === "number");
  const meanContact = contactValues.length > 0
    ? contactValues.reduce((sum, value) => sum + value, 0) / contactValues.length
    : defaultLightingProfile.algorithm.contact;
  return {
    enabled: true,
    // The 1.12 lift is the escape-room grounding emphasis over the cooked
    // contact response; it is the main Three.js-parity "objects float" fix.
    strengthScale: clamp(meanContact * 1.12, 0.6, 1.6),
    maxRadius: 1.8,
    fadeHeight: 1.6,
    maxContacts: 48,
    opacityByKind: { character: 1, pickup: 0.85 },
  };
}

function portalPolicyFrom(materials: readonly RawPlanMaterial[]): AgePortalVisualPolicy {
  const fallback = ageDefaultEscapeRoomVisualProfile.portals;
  const locked = materials.find((material) => material.visualRole === "door_locked_red");
  const access = materials.find((material) => material.visualRole === "door_access_cyan");
  return {
    closedGlow: {
      color: emissiveColorOf(locked) ?? fallback.closedGlow.color,
      intensity: clamp(locked?.emissiveStrength ?? fallback.closedGlow.intensity, 0.2, 2),
    },
    openGlow: {
      color: emissiveColorOf(access) ?? fallback.openGlow.color,
      intensity: clamp(access?.emissiveStrength ?? fallback.openGlow.intensity, 0.2, 2),
    },
    openTransitionSeconds: 0.6,
    occludeWhenClosed: true,
    revealAdjacentRoomOnOpen: true,
  };
}

function glassPolicyFrom(plan: RawRenderPlan) {
  const fallback = ageDefaultEscapeRoomVisualProfile.glass;
  const directives = plan.rawArtDirection?.transparentDirectives ?? [];
  if (directives.length <= 0) return fallback;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    preferWeightedOit: true,
    fresnelF0: clamp(mean(directives.map((directive) => directive.fresnelF0)), 0.01, 0.12),
    absorptionColor: averageTuple3(directives.map((directive) => directive.absorptionColor)) ?? fallback.absorptionColor,
    absorptionDistance: clamp(mean(directives.map((directive) => directive.absorptionDistance)), 0.4, 6),
    roughnessFloor: clamp(mean(directives.map((directive) => directive.roughness)), 0.02, 0.4),
    refractionStrength: clamp(mean(directives.map((directive) => directive.refractionStrength)), 0, 0.4),
  };
}

function roleTuningFrom(emissiveShare: number): AgeMaterialRoleTuning[] {
  // Emissive-heavy plans get a stronger accent boost; the boost lands through
  // the existing material packing path on the raw renderer side.
  const accentBoost = clamp(1.15 + emissiveShare * 0.5, 1.15, 1.4);
  return [
    { role: "emissive-accent", intensityScale: 1, emissiveBoost: accentBoost },
    { role: "route-marker", intensityScale: 1, emissiveBoost: clamp(accentBoost - 0.05, 1.1, 1.35) },
    { role: "danger-marker", intensityScale: 1, emissiveBoost: clamp(accentBoost + 0.05, 1.2, 1.45) },
    { role: "screen-label", intensityScale: 1, emissiveBoost: 1.1 },
    { role: "interactive-active", intensityScale: 1, emissiveBoost: 1.15 },
  ];
}

function emissiveMaterialShare(materials: readonly RawPlanMaterial[]) {
  if (materials.length <= 0) return 0;
  const emissive = materials.filter((material) => (material.emissiveStrength ?? 0) > 0.05).length;
  return emissive / materials.length;
}

function emissiveColorOf(material: RawPlanMaterial | undefined): AgeTuple3 | null {
  if (!material) return null;
  const emissive = material.emissiveFactor;
  if (emissive && (emissive[0] > 0.01 || emissive[1] > 0.01 || emissive[2] > 0.01)) {
    return [emissive[0], emissive[1], emissive[2]];
  }
  const base = material.baseColorFactor;
  return base ? [base[0], base[1], base[2]] : null;
}

function averageTuple3(values: readonly AgeTuple3[] | readonly [number, number, number][]): AgeTuple3 | null {
  if (values.length <= 0) return null;
  const sum: [number, number, number] = [0, 0, 0];
  for (const value of values) {
    sum[0] += value[0];
    sum[1] += value[1];
    sum[2] += value[2];
  }
  return [sum[0] / values.length, sum[1] / values.length, sum[2] / values.length];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
