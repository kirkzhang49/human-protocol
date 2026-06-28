import type { AgeRendererCapabilities } from "../core/AgeTypes";
import type { AgeQualityProfile } from "../quality/AgeQualityPolicy";

export interface AgeFeatureFlags {
  offscreenPost: boolean;
  weightedOit: boolean;
  legacySortedTransparency: boolean;
  gpuParticles: boolean;
  projectileVfx: boolean;
  contactGrounding: boolean;
  analyticRoomProbe: boolean;
  prefilteredEnvironment: boolean;
}

export const ageConservativeFeatureFlags: AgeFeatureFlags = {
  offscreenPost: false,
  weightedOit: false,
  legacySortedTransparency: true,
  gpuParticles: false,
  projectileVfx: false,
  contactGrounding: false,
  analyticRoomProbe: false,
  prefilteredEnvironment: false,
};

export function deriveAgeFeatureFlags(
  capabilities: Pick<
    AgeRendererCapabilities,
    "supportsCompute" | "supportsOffscreenPost" | "supportsWeightedOit"
  >,
  quality: Pick<
    AgeQualityProfile,
    "enableOffscreenPost" | "enableWeightedOit" | "enableGpuParticles"
  >,
): AgeFeatureFlags {
  return {
    offscreenPost: capabilities.supportsOffscreenPost && quality.enableOffscreenPost,
    weightedOit: capabilities.supportsWeightedOit && quality.enableWeightedOit,
    legacySortedTransparency: true,
    gpuParticles: capabilities.supportsCompute && quality.enableGpuParticles,
    projectileVfx: true,
    contactGrounding: true,
    analyticRoomProbe: false,
    prefilteredEnvironment: false,
  };
}
