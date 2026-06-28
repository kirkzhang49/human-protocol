// Shared builder visual profile: ONE derivation of the lighting/grounding tokens
// so the /build 3D preview and the runtime playtest read the same. The runtime
// presentation is reused verbatim from builderLightingBake#presentationFrom (so
// this module changes no baked runtime bytes), and the preview-side multipliers
// match what BuilderPreview3D used to inline — now centralized and documented.
//
// This is the §1.4 "one light profile" + §1.3 contact-shadow policy from
// docs/human-protocol-wgpu-lab-lighting-mix-plan.md. Pure data, no React/Three.

import { clamp01 } from "../ui/guiMath";
import type { BuilderLighting, BuilderProject } from "./BuilderTypes";
import { clampLighting } from "./BuilderEnvironment";
import { presentationFrom } from "./runtime-pack/builderLightingBake";

export interface BuilderPreviewLightTokens {
  /** Ambient fill multiplier for the R3F ambientLight. */
  ambientIntensity: number;
  /** Hemisphere sky/ground fill. */
  hemisphereIntensity: number;
  /** Key directional light intensity. */
  keyIntensity: number;
  /** Two cool/warm fill directionals (kept subtle and constant by design). */
  warmFillIntensity: number;
  coolFillIntensity: number;
  /** Fog distances are `focusSpan * factor`; keep the existing look. */
  fogNearFactor: number;
  fogFarFactor: number;
  fogColor: string;
  /** Emissive/glow scale for accent meshes. */
  glow: number;
  /** Contact-shadow strength base (0..1), AGE-clamped downstream. */
  shadowStrength: number;
}

export interface BuilderVisualProfile {
  lighting: BuilderLighting;
  preview: BuilderPreviewLightTokens;
  /** Runtime render-plan presentation (same source the deep pack bakes). */
  presentation: ReturnType<typeof presentationFrom>;
  /** Estimated background relative luminance for sceneAwareUiTokens (0..1). */
  uiSceneTone: number;
}

function previewTokens(lighting: BuilderLighting): BuilderPreviewLightTokens {
  return {
    ambientIntensity: lighting.ambient * 1.15,
    hemisphereIntensity: lighting.ambient * 0.85,
    keyIntensity: lighting.keyIntensity * 1.15,
    warmFillIntensity: 0.3,
    coolFillIntensity: 0.22,
    fogNearFactor: 2.2 - lighting.fog * 1.8,
    fogFarFactor: 6 - lighting.fog * 4.6,
    fogColor: "#071411",
    glow: 0.4 + lighting.bloom * 0.9,
    shadowStrength: lighting.shadow * 0.64,
  };
}

/**
 * Rough background relative luminance behind a 2D overlay during this project's
 * playtest: a dark facility floor lifted by ambient + key + bloom. A high value
 * means the overlay sits over bright light (cyan floor / white practical) and the
 * readability math must push panel alpha up.
 */
export function estimateUiSceneTone(lighting: BuilderLighting): number {
  return clamp01(0.04 + lighting.ambient * 0.34 + lighting.keyIntensity * 0.12 + lighting.bloom * 0.1);
}

export function builderVisualProfile(project: BuilderProject): BuilderVisualProfile {
  const lighting = clampLighting(project.lighting);
  return {
    lighting,
    preview: previewTokens(lighting),
    presentation: presentationFrom(lighting),
    uiSceneTone: estimateUiSceneTone(lighting),
  };
}

export interface ContactShadowSpec {
  radius: number;
  opacity: number;
}

/**
 * Shared footprint contact-shadow sizing (§1.3). Radius follows the object's
 * footprint; opacity scales with the profile shadow strength and a per-kind
 * weight, hard-capped at 0.42 like the AGE grounding policy so objects gain
 * weight without a heavy black ring. Returns null when it should not draw.
 */
export function contactShadowSpec(
  footprintRadius: number,
  profile: BuilderVisualProfile,
  kind: "prop" | "puzzle" | "pickup" | "robot" = "prop",
): ContactShadowSpec | null {
  const kindScale = kind === "pickup" ? 0.78 : kind === "robot" ? 0.92 : kind === "puzzle" ? 1.05 : 1;
  const opacity = Math.min(0.42, Math.max(0, profile.preview.shadowStrength * kindScale));
  if (opacity <= 0.012) return null;
  const radius = Math.max(0.22, Math.min(1.7, footprintRadius));
  return { radius, opacity: Math.round(opacity * 1000) / 1000 };
}
