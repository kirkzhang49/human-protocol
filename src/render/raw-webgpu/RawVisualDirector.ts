import type {
  RawRenderPlan,
  RawRolePaletteTuning,
  RawVisualColorTuning,
  ResolvedRoomLightingProfile,
  Tuple3,
  Tuple4,
} from "./RawWebGpuTypes";
import { clamp, colorFromHex } from "./RawWebGpuMath";
import { rawSemanticColorEnabled } from "./RawWebGpuQuality";

type RawVisualDebugMode = 0 | 1 | 2 | 3 | 4;
type RawLightRole = "ambient" | "directional" | "local" | "fog";

export interface RawVisualMetrics {
  cyanDominance: number;
  warmBalance: number;
  neutralAnchor: number;
  textureCoverage: number;
  materialReadability: number;
  colorCrowding: number;
  visualScore: number;
}

export interface RawVisualDirector {
  enabled: boolean;
  metrics: RawVisualMetrics;
  visualParams: [number, number, number, number];
  colorGrade0: Tuple4;
  colorGrade1: Tuple4;
  applyArtistProfile(profile: ResolvedRoomLightingProfile): ResolvedRoomLightingProfile;
  applyLightColor(color: Tuple3, role: RawLightRole): Tuple3;
  applyFogColor(color: Tuple3): Tuple3;
  fogRange(near: number, far: number): [number, number];
  bloomStrengthScale(): number;
  bloomThresholdLift(): number;
}

interface RawVisualCorrections {
  strength: number;
  cyanGuard: number;
  neutralGuard: number;
  fogDetailGuard: number;
  saturationScale: number;
  contrastScale: number;
  warmthLift: number;
  exposureScale: number;
  bloomScale: number;
  bloomThresholdLift: number;
  debugMode: RawVisualDebugMode;
  colorGrade0: Tuple4;
  colorGrade1: Tuple4;
  colorTuning: RawVisualColorTuning | null;
}

const defaultMetrics: RawVisualMetrics = {
  cyanDominance: 0,
  warmBalance: 0,
  neutralAnchor: 0.42,
  textureCoverage: 0,
  materialReadability: 0,
  colorCrowding: 0,
  visualScore: 1,
};

export function createRawVisualDirector(plan: RawRenderPlan): RawVisualDirector {
  const strength = rawVisualDirectorStrength();
  const debugMode = rawVisualDebugMode();
  const enabled = strength > 0;
  const metrics = analyzeRawVisualMetrics(plan);
  const corrections = rawVisualCorrections(metrics, strength, debugMode, plan.rawVisualColorTuning ?? null);
  if (rawVisualDiagnosticsEnabled()) {
    publishRawVisualDiagnostics(metrics, corrections, rawMaterialRoleCounts(plan), rawSemanticLightCounts(plan), plan.rawRolePaletteTuning ?? null);
  }

  return {
    enabled,
    metrics,
    visualParams: [corrections.cyanGuard, corrections.fogDetailGuard, corrections.neutralGuard, corrections.debugMode],
    colorGrade0: corrections.colorGrade0,
    colorGrade1: corrections.colorGrade1,
    applyArtistProfile(profile) {
      if (!enabled) return profile;
      return {
        ...profile,
        artist: {
          exposure: clamp(profile.artist.exposure * corrections.exposureScale, 0.7, 1.6),
          contrast: clamp(profile.artist.contrast * corrections.contrastScale, 0.75, 1.45),
          saturation: clamp(profile.artist.saturation * corrections.saturationScale, 0.72, 1.28),
          warmth: clamp(profile.artist.warmth + corrections.warmthLift, 0, 1),
        },
      };
    },
    applyLightColor(color, role) {
      if (!enabled) return color;
      const roleWeight = role === "ambient" ? 0.55 : role === "fog" ? 0.78 : role === "directional" ? 0.28 : 0.22;
      return rebalanceCyanRgb(color, corrections.cyanGuard * roleWeight);
    },
    applyFogColor(color) {
      if (!enabled) return color;
      return desaturateFogColor(color, corrections.cyanGuard, corrections.neutralGuard);
    },
    fogRange(near, far) {
      if (!enabled) return [near, far];
      const nearLift = corrections.fogDetailGuard * 4.8 + corrections.cyanGuard * 2.6;
      const farLift = corrections.fogDetailGuard * 8.0 + corrections.cyanGuard * 4.2;
      return [near + nearLift, far + farLift];
    },
    bloomStrengthScale() {
      return enabled ? corrections.bloomScale : 1;
    },
    bloomThresholdLift() {
      return enabled ? corrections.bloomThresholdLift : 0;
    },
  };
}

function analyzeRawVisualMetrics(plan: RawRenderPlan): RawVisualMetrics {
  const materialMetrics = plan.geometry?.materials
    ?.filter((material) => material.category !== "builtin")
    .map((material) => {
      const hasTexture = Boolean(material.textures?.some((texture) => texture.semantic === "baseColor" && Number.isFinite(texture.layer)));
      const stats = material.textures?.find((texture) => texture.semantic === "baseColor")?.stats;
      const textureReadability = stats ? clamp(stats.contrast * 0.72 + stats.detail * 1.35, 0, 1) : 0;
      const priority = hasTexture ? 1.25 : 0.9;
      return sampleColorMetrics(material.baseColorFactor.slice(0, 3) as Tuple3, priority, textureReadability, hasTexture);
    }) ?? [];
  const lightMetrics = (plan.lights ?? []).map((light) => sampleColorMetrics(colorFromHex(light.color, [0.8, 0.96, 1]), clamp((light.intensity ?? 1) * 0.22, 0.08, 1.6), 0, false));
  const samples = [...materialMetrics, ...lightMetrics];
  if (samples.length <= 0) return defaultMetrics;

  let totalWeight = 0;
  let totalChromaWeight = 0;
  let cyan = 0;
  let warm = 0;
  let neutral = 0;
  let textureWeight = 0;
  let textureReadability = 0;

  for (const sample of samples) {
    totalWeight += sample.weight;
    totalChromaWeight += sample.chromaWeight;
    cyan += sample.cyanWeight;
    warm += sample.warmWeight;
    neutral += sample.neutralWeight;
    if (sample.hasTexture) {
      textureWeight += sample.weight;
      textureReadability += sample.textureReadability * sample.weight;
    }
  }

  const cyanDominance = totalChromaWeight > 0 ? cyan / totalChromaWeight : 0;
  const warmBalance = totalChromaWeight > 0 ? warm / totalChromaWeight : 0;
  const neutralAnchor = totalWeight > 0 ? neutral / totalWeight : 0;
  const textureCoverage = totalWeight > 0 ? textureWeight / totalWeight : 0;
  const materialReadability = textureWeight > 0 ? textureReadability / textureWeight : 0;
  const colorCrowding = clamp(cyanDominance * 0.72 + Math.max(0, 0.32 - warmBalance) * 0.58 + Math.max(0, 0.34 - neutralAnchor) * 0.74, 0, 1);
  const visualScore = clamp(1 - colorCrowding * 0.58 + materialReadability * 0.16 + textureCoverage * 0.08, 0, 1);

  return {
    cyanDominance: roundMetric(cyanDominance),
    warmBalance: roundMetric(warmBalance),
    neutralAnchor: roundMetric(neutralAnchor),
    textureCoverage: roundMetric(textureCoverage),
    materialReadability: roundMetric(materialReadability),
    colorCrowding: roundMetric(colorCrowding),
    visualScore: roundMetric(visualScore),
  };
}

function rawVisualCorrections(
  metrics: RawVisualMetrics,
  strength: number,
  debugMode: RawVisualDebugMode,
  colorTuning: RawVisualColorTuning | null,
): RawVisualCorrections {
  const cyanGuard = clamp((metrics.cyanDominance - 0.34) / 0.46, 0, 1) * strength;
  const neutralGuard = clamp((0.34 - metrics.neutralAnchor) / 0.34, 0, 1) * strength;
  const flatTextureGuard = clamp(1 - metrics.materialReadability * 1.7, 0, 1) * metrics.textureCoverage;
  const colorGrade = rawVisualColorGrade(colorTuning);
  const fogDetailGuard = clamp((cyanGuard * 0.55 + flatTextureGuard * 0.38 + neutralGuard * 0.22) * colorGrade.fogGuardScale, 0, 1);

  return {
    strength,
    cyanGuard,
    neutralGuard,
    fogDetailGuard,
    saturationScale: 1 - cyanGuard * 0.12 - neutralGuard * 0.035,
    contrastScale: 1 + neutralGuard * 0.06 + flatTextureGuard * 0.035,
    warmthLift: cyanGuard * 0.13 + neutralGuard * 0.045,
    exposureScale: 1 - cyanGuard * 0.035,
    bloomScale: (1 - cyanGuard * 0.20 - flatTextureGuard * 0.06) * colorGrade.bloomScale,
    bloomThresholdLift: cyanGuard * 0.06 + flatTextureGuard * 0.025,
    debugMode,
    colorGrade0: colorGrade.grade0,
    colorGrade1: colorGrade.grade1,
    colorTuning,
  };
}

function rawVisualColorGrade(tuning: RawVisualColorTuning | null) {
  const params = tuning?.params ?? null;
  const strength = rawVisualColorGradeStrength(tuning);
  const exposureScale = mixNumber(1, clamp(params?.exposureScale ?? 1, 0.72, 1.55), strength);
  const contrastScale = mixNumber(1, clamp(params?.contrastScale ?? 1, 0.78, 1.32), strength);
  const saturationScale = mixNumber(1, clamp(params?.saturationScale ?? 1, 0.68, 1.18), strength);
  const blackScale = mixNumber(1, clamp(params?.blackScale ?? 1, 0.25, 1.15), strength);
  const cyanRedLift = mixNumber(0, clamp(params?.cyanRedLift ?? 0, 0, 0.34), strength);
  const cyanGreenScale = mixNumber(1, clamp(params?.cyanGreenScale ?? 1, 0.48, 1.12), strength);
  const cyanBlueScale = mixNumber(1, clamp(params?.cyanBlueScale ?? 1, 0.55, 1.16), strength);
  const cyanNeutralMix = mixNumber(0, clamp(params?.cyanNeutralMix ?? 0, 0, 0.48), strength);
  const bloomScale = mixNumber(1, clamp(params?.bloomScale ?? 1, 0.52, 1.12), strength);
  const fogGuardScale = mixNumber(1, clamp(params?.fogGuardScale ?? 1, 0.72, 2.4), strength);
  return {
    bloomScale,
    fogGuardScale,
    grade0: [exposureScale, contrastScale, saturationScale, blackScale] as Tuple4,
    grade1: [cyanRedLift, cyanGreenScale, cyanBlueScale, cyanNeutralMix] as Tuple4,
  };
}

function sampleColorMetrics(color: Tuple3, weight: number, textureReadability: number, hasTexture: boolean) {
  const lab = rgbToOklab(color);
  const chroma = Math.hypot(lab.a, lab.b);
  const hue = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  const chromaWeight = weight * chroma * clamp(Math.sqrt(Math.max(0, luma)) + 0.24, 0.15, 1.1);
  const neutralBand = chroma < 0.055 && luma > 0.065 && luma < 0.86 ? weight : 0;
  return {
    weight,
    chromaWeight,
    cyanWeight: chromaWeight * hueBand(hue, 205, 82),
    warmWeight: chromaWeight * Math.max(hueBand(hue, 48, 78), hueBand(hue, 18, 38)),
    neutralWeight: neutralBand,
    textureReadability,
    hasTexture,
  };
}

function hueBand(hue: number, center: number, width: number) {
  const delta = Math.abs(((hue - center + 540) % 360) - 180);
  return clamp(1 - delta / Math.max(1, width), 0, 1);
}

function rebalanceCyanRgb(color: Tuple3, amount: number): Tuple3 {
  if (amount <= 0) return color;
  const cyanExcess = Math.max(0, color[1] + color[2] - color[0] * 1.18);
  return [
    clamp(color[0] + cyanExcess * amount * 0.115, 0, 1.4),
    clamp(color[1] * (1 - amount * 0.052), 0, 1.4),
    clamp(color[2] * (1 - amount * 0.068), 0, 1.4),
  ];
}

function desaturateFogColor(color: Tuple3, cyanGuard: number, neutralGuard: number): Tuple3 {
  const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  const neutral: Tuple3 = [luma * 0.86, luma * 0.94, luma];
  const mixAmount = clamp(cyanGuard * 0.62 + neutralGuard * 0.28, 0, 0.78);
  const balanced = mixTuple3(color, neutral, mixAmount);
  const dim = 1 - cyanGuard * 0.10;
  return [balanced[0] * dim, balanced[1] * dim, balanced[2] * dim];
}

function mixTuple3(a: Tuple3, b: Tuple3, t: number): Tuple3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbToOklab(color: Tuple3) {
  const r = srgbToLinear(color[0]);
  const g = srgbToLinear(color[1]);
  const b = srgbToLinear(color[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function srgbToLinear(value: number) {
  const x = clamp(value, 0, 1);
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rawVisualDirectorStrength() {
  if (typeof window === "undefined") return 0;
  const value = new URLSearchParams(window.location.search).get("rawVisualDirector");
  if (value === "0" || value === "off") return 0;
  if (value === "1" || value === "on") return 0.42;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return clamp(numeric, 0, 1);
  return 0;
}

function rawVisualColorGradeStrength(tuning: RawVisualColorTuning | null) {
  if (!tuning) return 0;
  if (typeof window === "undefined") return 1;
  const value = new URLSearchParams(window.location.search).get("rawVisualGrade");
  if (value === "0" || value === "off") return 0;
  if (value === "1" || value === "on") return 1;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return clamp(numeric, 0, 1);
  return 1;
}

function rawVisualDebugMode(): RawVisualDebugMode {
  if (typeof window === "undefined") return 0;
  const value = new URLSearchParams(window.location.search).get("rawVisualDebug");
  if (value === "albedo") return 1;
  if (value === "fog") return 2;
  if (value === "lighting") return 3;
  if (value === "roles") return 4;
  return 0;
}

function rawVisualDiagnosticsEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("rawVisualReport") === "1" || params.has("rawVisualDebug");
}

function rawMaterialRoleCounts(plan: RawRenderPlan) {
  const counts: Record<string, number> = {};
  for (const material of plan.geometry?.materials ?? []) {
    const role = material.visualRole ?? "legacy";
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts;
}

function rawSemanticLightCounts(plan: RawRenderPlan) {
  const counts: Record<string, number> = {};
  for (const light of plan.lights ?? []) {
    const role = light.semanticRole ?? "authored";
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts;
}

function publishRawVisualDiagnostics(
  metrics: RawVisualMetrics,
  corrections: RawVisualCorrections,
  materialRoles: Record<string, number>,
  semanticLights: Record<string, number>,
  rolePaletteTuning: RawRolePaletteTuning | null,
) {
  const diagnostics = {
    engine: "RawVisualDirector.v2",
    metrics,
    materialRoles,
    semanticLights,
    rolePalette: rolePaletteTuning
      ? {
          algorithm: rolePaletteTuning.algorithm ?? null,
          score: rolePaletteTuning.score ?? null,
          improvement: rolePaletteTuning.improvement ?? null,
          candidatesEvaluated: rolePaletteTuning.candidatesEvaluated ?? null,
          roleCount: Object.keys(rolePaletteTuning.roles ?? {}).length,
        }
      : null,
    corrections: {
      cyanGuard: roundMetric(corrections.cyanGuard),
      neutralGuard: roundMetric(corrections.neutralGuard),
      fogDetailGuard: roundMetric(corrections.fogDetailGuard),
      saturationScale: roundMetric(corrections.saturationScale),
      contrastScale: roundMetric(corrections.contrastScale),
      warmthLift: roundMetric(corrections.warmthLift),
      bloomScale: roundMetric(corrections.bloomScale),
      colorGrade0: corrections.colorGrade0.map(roundMetric),
      colorGrade1: corrections.colorGrade1.map(roundMetric),
      colorTuning: corrections.colorTuning
        ? {
            algorithm: corrections.colorTuning.algorithm ?? null,
            score: corrections.colorTuning.score ?? null,
            improvement: corrections.colorTuning.improvement ?? null,
            candidatesEvaluated: corrections.colorTuning.candidatesEvaluated ?? null,
          }
        : null,
      debugMode: corrections.debugMode,
    },
  };
  (window as Window & { __hpRawVisualDirector?: typeof diagnostics }).__hpRawVisualDirector = diagnostics;
  console.info("[HumanProtocol] Raw Visual Director", diagnostics);
}

function roundMetric(value: number) {
  return Math.round(value * 10000) / 10000;
}

function mixNumber(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
