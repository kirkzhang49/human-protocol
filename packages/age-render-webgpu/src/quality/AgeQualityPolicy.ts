import type { AgeRenderQualityTier } from "../core/AgeTypes";
import type { AgeVfxBudget } from "../vfx/AgeVfxRecords";

export interface AgeQualityProfile {
  tier: AgeRenderQualityTier;
  maxPixelRatio: number;
  enableOffscreenPost: boolean;
  enableWeightedOit: boolean;
  enableGpuParticles: boolean;
  vfxBudget: AgeVfxBudget;
}

export function ageDefaultQualityProfile(tier: AgeRenderQualityTier): AgeQualityProfile {
  if (tier === "rescue") {
    return {
      tier,
      maxPixelRatio: 1,
      enableOffscreenPost: false,
      enableWeightedOit: true,
      enableGpuParticles: false,
      vfxBudget: { maxProjectiles: 64, maxEffects: 64, maxParticleEmitters: 24, maxGpuParticles: 256 },
    };
  }
  if (tier === "high") {
    return {
      tier,
      maxPixelRatio: 1.5,
      enableOffscreenPost: true,
      enableWeightedOit: true,
      enableGpuParticles: true,
      vfxBudget: { maxProjectiles: 128, maxEffects: 128, maxParticleEmitters: 64, maxGpuParticles: 1024 },
    };
  }
  return {
    tier,
    maxPixelRatio: 1.2,
    enableOffscreenPost: true,
    enableWeightedOit: true,
    enableGpuParticles: true,
    vfxBudget: { maxProjectiles: 96, maxEffects: 96, maxParticleEmitters: 48, maxGpuParticles: 768 },
  };
}
