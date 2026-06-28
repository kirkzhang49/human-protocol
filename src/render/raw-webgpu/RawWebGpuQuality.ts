import type { RenderQualityTier } from "../../game/core/RenderPerformance";

export interface RawLightingShadowTuning {
  shadowStrengthHigh?: number;
  shadowStrengthBalanced?: number;
  shadowBias?: number;
  normalBias?: number;
}

export function rawSemanticColorEnabled() {
  return false;
}

export function rawDisplayTransformEnabled() {
  if (typeof window === "undefined") return true;
  const value = new URLSearchParams(window.location.search).get("rawDisplayTransform");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  return true;
}

function rawUrlFlagEnabled(name: string) {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get(name);
  return value === "1" || value === "on";
}

// Master quality gate: bloom + FXAA + the "full" tier scalars (lighting, AO,
// probe, material response, local-light, particle counts). This is an explicit
// debug/QA switch only; the raw renderer no longer has a global look preset.
export const rawFullEffectsEnabled = () => rawUrlFlagEnabled("rawFull") === true;

export function rawLightingQualityScalar(tier: RenderQualityTier) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.82;
  if (tier === "balanced") return 1;
  return 1;
}

export function rawShadowStrength(tier: RenderQualityTier, tuning?: RawLightingShadowTuning | null) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.58;
  if (tier === "balanced") return clamp(tuning?.shadowStrengthBalanced ?? 0.84, 0.62, 0.9);
  return clamp(tuning?.shadowStrengthHigh ?? 0.92, 0.74, 0.96);
}

export function rawRoomAoTierScalar(tier: RenderQualityTier) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.82;
  if (tier === "balanced") return 1;
  return 1.05;
}

export function rawRoomProbeTierScalar(tier: RenderQualityTier) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.78;
  if (tier === "balanced") return 1;
  return 1.05;
}

export function rawMaterialResponseTierScalar(tier: RenderQualityTier) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.8;
  if (tier === "balanced") return 1;
  return 1.05;
}

export function rawLocalLightShapeTierScalar(tier: RenderQualityTier) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.86;
  if (tier === "balanced") return 1.08;
  return 1.12;
}

export function rawBloomStrength(tier: RenderQualityTier) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.34;
  if (tier === "balanced") return 0.52;
  return 0.64;
}

export function rawBloomThreshold(tier: RenderQualityTier, configuredThreshold: number) {
  if (!rawFullEffectsEnabled()) return configuredThreshold;
  if (tier === "rescue") return Math.max(configuredThreshold + 0.26, 0.82);
  if (tier === "balanced") return Math.max(configuredThreshold + 0.20, 0.76);
  return Math.max(configuredThreshold + 0.14, 0.70);
}

export function rawBloomRadius(tier: RenderQualityTier) {
  if (!rawFullEffectsEnabled()) return 1;
  if (tier === "rescue") return 0.82;
  if (tier === "balanced") return 0.96;
  return 1.08;
}

export function rawCinematicLookIntensity() {
  return 0;
}

/**
 * Debug-only environment-brightness dial for raw-webgpu. Default 1.0 means the
 * renderer leaves the level plan untouched. If `?rawEnv=1.5` proves a level
 * needs brighter lighting, move that decision into the level source/tuning.
 */
export function rawEnvBrightness() {
  if (typeof window === "undefined") return 1;
  const raw = Number(new URLSearchParams(window.location.search).get("rawEnv"));
  return Number.isFinite(raw) && raw > 0 ? clamp(raw, 0.5, 3) : 1;
}

export function rawShadowDebugEnabled() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("rawShadowDebug");
}

/**
 * Projected shadow-map pass (real directional shadows). Opt-in for now: default
 * OFF so the shipped levels render byte-identically; enable with `?rawShadowMap=1`
 * to test. When on, the renderer runs the shadow depth pass and the scene samples
 * the real shadow map instead of the empty dummy texture.
 */
export function rawShadowMapEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawShadowMap");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  return false;
}

/**
 * Global multiplier for contact/grounding shadows (the soft discs under every
 * object that make things sit on the floor). Default stays neutral at 1.0; use
 * `?rawGrounding=<n>` only for explicit QA comparison.
 */
export function rawGroundingStrength() {
  if (typeof window === "undefined") return 1;
  const raw = Number(new URLSearchParams(window.location.search).get("rawGrounding"));
  return Number.isFinite(raw) ? clamp(raw, 0, 2.5) : 1;
}

// Per-pass GPU timing overlay (requires the device's timestamp-query feature).
// Off by default so the standard render path allocates no query resources.
export function rawGpuProfileEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawGpuProfile");
  return value === "1" || value === "on";
}

// Cache static opaque geometry into a GPURenderBundle replayed each frame.
// On by default (pure CPU-draw-call win, no visual change); ?rawRenderBundles=0
// opts out. Helps mobile too, so it is not mobile-gated.
export function rawRenderBundlesEnabled() {
  if (typeof window === "undefined") return true;
  const value = new URLSearchParams(window.location.search).get("rawRenderBundles");
  if (value === "0" || value === "off") return false;
  return true;
}

// Mipmaps + trilinear/anisotropic filtering for the base-color / material
// texture arrays and the hero floor. Off by default (opt-in) until validated
// in-browser; the scene shader already uses textureSample (auto-LOD), so with
// mips absent it samples level 0 exactly as before. ?rawMipmaps=1 turns it on.
export function rawMipmapsEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawMipmaps");
  return value === "1" || value === "on";
}

// Depth-aware soft particles: GPU particles render in a separate pass that
// samples scene depth and fades near geometry. On by default on desktop;
// ?rawSoftParticles=0 opts out. Off on mobile (GPU particles are disabled there
// anyway, and the depth TEXTURE_BINDING would defeat tile-memory on tiled GPUs).
export function rawSoftParticlesEnabled() {
  if (typeof window === "undefined") return true;
  const value = new URLSearchParams(window.location.search).get("rawSoftParticles");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  if (rawMobileMode()) return false;
  return true;
}

export function rawBloomEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("rawBloom") === "0") return false;
  if (params.get("rawBloom") === "1") return true;
  if (rawMobileMode()) return false;
  return rawFullEffectsEnabled();
}

export function rawFxaaEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("rawFxaa");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  if (rawMobileMode()) return false;
  return rawFullEffectsEnabled();
}

export function rawFxaaStrength(tier: RenderQualityTier) {
  if (typeof window !== "undefined") {
    const override = Number(new URLSearchParams(window.location.search).get("rawFxaaStrength"));
    if (Number.isFinite(override)) return clamp(override, 0, 1.25);
  }
  if (!rawFullEffectsEnabled()) {
    if (tier === "rescue") return 0.54;
    if (tier === "balanced") return 0.66;
    return 0.74;
  }
  if (tier === "rescue") return 0.58;
  if (tier === "balanced") return 0.76;
  return 0.86;
}

export function rawColorPipelineV2Enabled() {
  return false;
}

export function rawMuseumToeEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawMuseumToe");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  return false;
}

// AgX filmic tonemap for the final scene output transform. Explicit debug/QA
// only; production tone mapping belongs in the level's own plan/tuning.
export function rawAgxEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawAgx");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  return false;
}

// Phase-1 IBL: SH9 diffuse irradiance + analytic environment specular (kills the
// flat-grey metal reflection). Opt-in / default OFF until validated in-browser —
// `?rawIbl=1` turns it on; when off the SH path multiplies out to zero (shipped
// look byte-identical). Plumbed via the lighting uniform's sh_meta.x.
export function rawIblEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawIbl");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  return false;
}

// Strength dial for the IBL contribution. Default 1.0; `?rawIblIntensity=0.6` etc.
export function rawIblIntensity() {
  if (typeof window === "undefined") return 1;
  const raw = Number(new URLSearchParams(window.location.search).get("rawIblIntensity"));
  return Number.isFinite(raw) && raw >= 0 ? clamp(raw, 0, 4) : 1;
}

// Real prefiltered specular cubemap + DFG LUT (offline-baked IBL) for the env
// reflection term, vs. the cheap analytic SH approximation. Opt-in / default OFF
// (`?rawCube=1`) until validated in-browser — it adds a cube + LUT binding, so
// it is the highest-risk renderer toggle. Plumbed via the lighting uniform's
// sh_meta.z; only swaps the specular source, never disturbs the default path.
export function rawCubeEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawCube");
  return value === "1" || value === "on";
}

export function rawHeroFloorEnabled() {
  if (typeof window === "undefined") return true;
  const value = new URLSearchParams(window.location.search).get("rawHeroFloor");
  if (value === "0" || value === "off") return false;
  if (value === "1" || value === "on") return true;
  return true;
}

export function rawLegacyGlassOverlayEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawGlassOverlay");
  return value === "1" || value === "legacy";
}

export function rawGlassOitEnabled() {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("rawGlassOit");
  if (value === "1" || value === "on") return true;
  return false;
}

export function rawGpuParticlesEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("rawParticles");
  if (value === "0" || value === "off") return false;
  if (rawMobileMode() && !(value === "1" || value === "on")) return false;
  return true;
}

export function rawGpuParticleCount(tier: RenderQualityTier) {
  if (!rawGpuParticlesEnabled()) return 0;
  if (!rawFullEffectsEnabled()) {
    if (tier === "rescue") return 96;
    if (tier === "balanced") return 192;
    return 300;
  }
  if (tier === "rescue") return 110;
  if (tier === "balanced") return 160;
  return 200;
}

export function rawPixelRatioOverride() {
  if (typeof window === "undefined") return null;
  const value = Number(new URLSearchParams(window.location.search).get("rawPixelRatio"));
  if (!Number.isFinite(value) || value <= 0) return null;
  return clamp(value, 0.66, 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// Mobile heavy-effects gate. Defaults false so every gate below is byte-identical
// on desktop; RawWebGpuCanvas calls setRawMobileMode(true) only for coarse-pointer
// / <=900px viewports, mirroring the WebGL mobile profile (no bloom/post/particles).
let rawMobileHeavyEffectsMode = false;
export function setRawMobileMode(mobile: boolean) {
  rawMobileHeavyEffectsMode = mobile;
}
export function rawMobileMode() {
  return rawMobileHeavyEffectsMode;
}
export function rawPostProcessEnabled(): boolean {
  const search =
    typeof window !== "undefined" && typeof window.location?.search === "string"
      ? new URLSearchParams(window.location.search)
      : null;
  const value = search?.get("rawPost")?.trim().toLowerCase() ?? null;
  if (value === "1" || value === "on") return true;
  if (value === "0" || value === "off") return false;
  return false;
}
