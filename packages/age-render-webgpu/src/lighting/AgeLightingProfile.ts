import type { AgeId, AgeRenderQualityTier, AgeTuple3 } from "../core/AgeTypes";

export interface AgeAmbientLight {
  color: AgeTuple3;
  intensity: number;
}

export interface AgeDirectionalLight {
  color: AgeTuple3;
  intensity: number;
  direction: AgeTuple3;
}

export interface AgeLocalLight {
  id: AgeId;
  type: "point" | "spot" | "area" | "floor-glow";
  color: AgeTuple3;
  intensity: number;
  position: AgeTuple3;
  direction?: AgeTuple3;
  range?: number;
  width?: number;
  height?: number;
  role?: string;
}

export interface AgeRoomLightingProfile {
  roomId: AgeId;
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  ao: number;
  probe: number;
  contact: number;
}

export interface AgeLightingFrame {
  ambient: AgeAmbientLight;
  directional?: AgeDirectionalLight;
  localLights: readonly AgeLocalLight[];
  roomProfile?: AgeRoomLightingProfile;
  parityProfileId?: AgeId;
}

export type AgeToneMappingTransform = "linear" | "neutral" | "filmic-toe" | "aces" | "adapter";

export interface AgeToneMappingIntent {
  transform: AgeToneMappingTransform;
  exposureBias: number;
  contrast: number;
  saturation: number;
  toeStrength?: number;
  whitePoint?: number;
}

export interface AgeEmissiveContributionPolicy {
  surfaceBoost: number;
  extractLocalLights: boolean;
  maxExtractedLights: number;
  minExtractionStrength: number;
  defaultExtractedRange: number;
  bloomWeightScale: number;
}

export interface AgeContactShadowPolicy {
  enabled: boolean;
  maxContacts: number;
  strength: number;
  maxRadius: number;
  fadeHeight: number;
  acceptDerivedContacts: boolean;
}

export interface AgeLocalLightBudget {
  maxShaderLights: number;
  maxShadowedLights: number;
  perTier?: Partial<Record<AgeRenderQualityTier, { maxShaderLights: number; maxShadowedLights: number }>>;
}

export interface AgeGlassSurfacePolicy {
  preferWeightedOit: boolean;
  fresnelF0: number;
  absorptionColor: AgeTuple3;
  absorptionDistance: number;
  roughnessFloor: number;
  refractionStrength: number;
}

export interface AgeLightingParityProfile {
  id: AgeId;
  label?: string;
  toneMapping: AgeToneMappingIntent;
  emissive: AgeEmissiveContributionPolicy;
  contactShadows: AgeContactShadowPolicy;
  localLightBudget: AgeLocalLightBudget;
  glass: AgeGlassSurfacePolicy;
  environmentProfileId?: AgeId;
}

export const ageDefaultLightingParityProfile: AgeLightingParityProfile = {
  id: "age.default.lighting-parity",
  label: "Baseline parity targets for matching a tone-mapped rasterizer reference",
  toneMapping: {
    transform: "filmic-toe",
    exposureBias: 1,
    contrast: 1.04,
    saturation: 1.02,
    toeStrength: 0.35,
    whitePoint: 1.18,
  },
  emissive: {
    surfaceBoost: 1.35,
    extractLocalLights: true,
    maxExtractedLights: 12,
    minExtractionStrength: 0.4,
    defaultExtractedRange: 5.5,
    bloomWeightScale: 1,
  },
  contactShadows: {
    enabled: true,
    maxContacts: 48,
    strength: 0.82,
    maxRadius: 1.6,
    fadeHeight: 1.4,
    acceptDerivedContacts: true,
  },
  localLightBudget: {
    maxShaderLights: 8,
    maxShadowedLights: 1,
    perTier: {
      high: { maxShaderLights: 8, maxShadowedLights: 1 },
      balanced: { maxShaderLights: 8, maxShadowedLights: 1 },
      rescue: { maxShaderLights: 4, maxShadowedLights: 0 },
    },
  },
  glass: {
    preferWeightedOit: true,
    fresnelF0: 0.04,
    absorptionColor: [0.18, 0.2, 0.22],
    absorptionDistance: 1.8,
    roughnessFloor: 0.06,
    refractionStrength: 0.12,
  },
};

export function ageLocalLightBudgetForTier(budget: AgeLocalLightBudget, tier: AgeRenderQualityTier) {
  return budget.perTier?.[tier] ?? { maxShaderLights: budget.maxShaderLights, maxShadowedLights: budget.maxShadowedLights };
}
