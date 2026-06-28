export const guiMath = {
  minTouchTargetPx: 44,
  recommendedCombatTouchPx: 58,
  minOverlayButtonPx: 44,
  minProgressBarPx: 6,
  minBodyContrast: 4.5,
  minLargeTextContrast: 3,
  minUiShadowClamp: 0.66,
  hybridDepthEpsilonMeters: 0.03,
  loadingProgressFloor: 0.025,
  loadingAssetsStart: 0.1,
  loadingAssetsWeight: 0.58,
  loadingGpuStart: 0.72,
  loadingGpuEnd: 0.92,
} as const;

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function cubicEaseOut(t: number) {
  const clamped = clamp01(t);
  return 1 - Math.pow(1 - clamped, 3);
}

export function loadingAssetProgress(assetProgress: number) {
  return guiMath.loadingAssetsStart + clamp01(assetProgress) * guiMath.loadingAssetsWeight;
}

export function loadingGpuProgress(t: number) {
  return guiMath.loadingGpuStart + (guiMath.loadingGpuEnd - guiMath.loadingGpuStart) * cubicEaseOut(t);
}

export function visibleProgressScale(progress: number) {
  return Math.max(guiMath.loadingProgressFloor, clamp01(progress));
}

export function srgbChannelToLinear(channel: number) {
  const c = clamp01(channel);
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

export function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  return contrastFromLuminance(relativeLuminance(a), relativeLuminance(b));
}

// ---------------------------------------------------------------------------
// Scene-aware 2D-over-3D readability math, absorbed from the WGPU Robot Lab
// Image2 GUI art-direction contract:
//   C_out = alpha*C_ui_linear + (1-alpha)*C_scene_linear   (composite in linear)
//   contrast = (max(Y1,Y2)+0.05)/(min(Y1,Y2)+0.05)
//   shadow_ui = max(0.66, shadow_raw)
// These are pure functions: no React, no DOM. A translucent UI panel over a
// bright cyan floor / white practical must still hit the body-contrast target,
// so panel alpha is solved (not guessed) and the drop shadow has a floor.
// ---------------------------------------------------------------------------

export type Rgb = { r: number; g: number; b: number };

/** Alias of the per-channel sRGB->linear transfer (spelled per the math contract). */
export const srgbToLinear = srgbChannelToLinear;

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(int)) return { r: 0, g: 0, b: 0 };
  return { r: ((int >> 16) & 0xff) / 255, g: ((int >> 8) & 0xff) / 255, b: (int & 0xff) / 255 };
}

export function contrastFromLuminance(yA: number, yB: number) {
  return (Math.max(yA, yB) + 0.05) / (Math.min(yA, yB) + 0.05);
}

/** Composite one sRGB channel of `ui` over `scene` at `alpha`, returned in LINEAR space. */
export function compositeLinear(uiChannel: number, sceneChannel: number, alpha: number) {
  const a = clamp01(alpha);
  return a * srgbChannelToLinear(uiChannel) + (1 - a) * srgbChannelToLinear(sceneChannel);
}

/** Relative luminance of `ui` composited over `scene` at `alpha` (linear composite). */
export function compositeLuminance(ui: Rgb, scene: Rgb, alpha: number) {
  return (
    0.2126 * compositeLinear(ui.r, scene.r, alpha) +
    0.7152 * compositeLinear(ui.g, scene.g, alpha) +
    0.0722 * compositeLinear(ui.b, scene.b, alpha)
  );
}

/**
 * Smallest panel alpha so `text` over `panel` (composited on a scene of relative
 * luminance `sceneLuminance`) reaches `minContrast`. Closed form: luminance is
 * linear in the linear channels, so compositeY = sceneY + alpha*(panelY-sceneY).
 * Clamped to [floor, 0.97] so the panel always reads as facility glass.
 */
export function chooseReadablePanelAlpha(options: {
  panel: Rgb;
  text: Rgb;
  sceneLuminance: number;
  minContrast?: number;
  floor?: number;
}): number {
  const minContrast = options.minContrast ?? guiMath.minBodyContrast;
  const floor = clamp01(options.floor ?? 0.5);
  const panelY = relativeLuminance(options.panel);
  const textY = relativeLuminance(options.text);
  const sceneY = clamp01(options.sceneLuminance);
  // Target composite luminance that satisfies the contrast ratio against text.
  const targetY = textY > panelY ? (textY + 0.05) / minContrast - 0.05 : (textY + 0.05) * minContrast - 0.05;
  // compositeY = sceneY + alpha*(panelY - sceneY); solve for alpha toward the panel.
  const denom = panelY - sceneY;
  let alpha = floor;
  if (Math.abs(denom) > 1e-6) {
    const needed = (targetY - sceneY) / denom;
    alpha = textY > panelY ? Math.max(floor, needed) : Math.max(floor, needed);
  }
  return Math.max(floor, Math.min(0.97, alpha));
}

/** Drop-shadow strength never falls below the contract floor (0.66) so a panel
 *  over a bright floor/white light still casts a visible separating shadow. */
export function clampUiShadow(raw: number) {
  return Math.max(guiMath.minUiShadowClamp, clamp01(raw));
}

/** Pick the higher-contrast text tone for a background of `sceneLuminance`. */
export function readableTextToneForScene(sceneLuminance: number): "light" | "dark" {
  const y = clamp01(sceneLuminance);
  const light = contrastFromLuminance(relativeLuminance({ r: 0.96, g: 0.98, b: 1 }), y);
  const dark = contrastFromLuminance(relativeLuminance({ r: 0.04, g: 0.05, b: 0.06 }), y);
  return dark > light ? "dark" : "light";
}

export interface SceneAwareUiTokens {
  /** Background alpha for the facility-glass panel (over the 3D scene). */
  panelBgAlpha: number;
  /** Border alpha — grows with scene brightness to keep the panel edge defined. */
  borderAlpha: number;
  /** Recommended live-text tone for the panel body. */
  textTone: "light" | "dark";
  /** Drop-shadow strength floor (>= 0.66). */
  shadowFloor: number;
  /** Achieved body contrast of the panel text on this scene (for QA/telemetry). */
  bodyContrast: number;
}

const FACILITY_PANEL = hexToRgb("#0a1014");
const FACILITY_TEXT = hexToRgb("#e6f4ff");

/** Representative facility background tone for overlays that can sit over either a
 *  dark shadow OR a bright cyan floor; sized so the brighter case still passes. */
export const defaultOverlaySceneTone = 0.42;

/** CSS custom properties for a scene-aware readable panel; spread into a style. */
export function uiReadableVars(sceneLuminance: number = defaultOverlaySceneTone): Record<string, string | number> {
  const tokens = sceneAwareUiTokens(sceneLuminance);
  return {
    "--ui-panel-alpha": tokens.panelBgAlpha,
    "--ui-border-alpha": tokens.borderAlpha,
    "--ui-shadow-floor": tokens.shadowFloor,
  };
}

/**
 * One scene-tone in (estimated background relative luminance 0..1), one consistent
 * set of readability tokens out — used so 2D overlays composited on dark facility
 * shadow OR bright cyan floor both stay legible without decorative guesswork.
 */
export function sceneAwareUiTokens(sceneLuminance: number): SceneAwareUiTokens {
  const sceneY = clamp01(sceneLuminance);
  const panelBgAlpha = chooseReadablePanelAlpha({
    panel: FACILITY_PANEL,
    text: FACILITY_TEXT,
    sceneLuminance: sceneY,
    minContrast: guiMath.minBodyContrast,
    floor: 0.52,
  });
  const compositeY = sceneY + panelBgAlpha * (relativeLuminance(FACILITY_PANEL) - sceneY);
  return {
    panelBgAlpha: Math.round(panelBgAlpha * 1000) / 1000,
    borderAlpha: Math.round(Math.max(0.32, Math.min(0.85, 0.32 + sceneY * 0.55)) * 1000) / 1000,
    textTone: readableTextToneForScene(compositeY),
    shadowFloor: Math.round(clampUiShadow(0.5 + sceneY * 0.32) * 1000) / 1000,
    bodyContrast: Math.round(contrastFromLuminance(relativeLuminance(FACILITY_TEXT), compositeY) * 100) / 100,
  };
}
