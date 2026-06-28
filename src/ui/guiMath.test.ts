import { describe, it, expect } from 'vitest';
import {
  clamp01,
  cubicEaseOut,
  hexToRgb,
  contrastRatio,
  srgbChannelToLinear,
  compositeLinear,
  compositeLuminance,
  relativeLuminance,
  contrastFromLuminance,
  visibleProgressScale,
  loadingAssetProgress,
  loadingGpuProgress,
  sceneAwareUiTokens,
  chooseReadablePanelAlpha,
  clampUiShadow,
  readableTextToneForScene,
  uiReadableVars,
  guiMath,
} from './guiMath';

describe('guiMath - Pure logic utilities', () => {
  describe('clamp01', () => {
    it('should clamp values to [0, 1]', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(1.5)).toBe(1);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(1)).toBe(1);
    });
  });

  describe('cubicEaseOut', () => {
    it('should apply cubic easing to values in [0, 1]', () => {
      expect(cubicEaseOut(0)).toBe(0);
      expect(cubicEaseOut(1)).toBe(1);
      expect(cubicEaseOut(0.5)).toBeGreaterThan(0.5);
      expect(cubicEaseOut(1.5)).toBe(1);
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex colors to RGB', () => {
      const white = hexToRgb('#ffffff');
      expect(white.r).toBeCloseTo(1, 5);
      expect(white.g).toBeCloseTo(1, 5);
      expect(white.b).toBeCloseTo(1, 5);

      const black = hexToRgb('#000000');
      expect(black.r).toBeCloseTo(0, 5);
      expect(black.g).toBeCloseTo(0, 5);
      expect(black.b).toBeCloseTo(0, 5);
    });

    it('should handle short hex format', () => {
      const color = hexToRgb('#fff');
      expect(color.r).toBeCloseTo(1, 5);
      expect(color.g).toBeCloseTo(1, 5);
      expect(color.b).toBeCloseTo(1, 5);
    });

    it('should handle invalid hex gracefully', () => {
      const invalid = hexToRgb('invalid');
      expect(invalid.r).toBe(0);
      expect(invalid.g).toBe(0);
      expect(invalid.b).toBe(0);
    });
  });

  describe('srgbChannelToLinear', () => {
    it('should convert sRGB channel to linear', () => {
      expect(srgbChannelToLinear(0)).toBeCloseTo(0, 5);
      expect(srgbChannelToLinear(1)).toBeCloseTo(1, 5);
      expect(srgbChannelToLinear(0.5)).toBeGreaterThan(0.2);
      expect(srgbChannelToLinear(0.5)).toBeLessThan(0.3);
    });
  });

  describe('relativeLuminance', () => {
    it('should calculate relative luminance from RGB', () => {
      const white = { r: 1, g: 1, b: 1 };
      expect(relativeLuminance(white)).toBeCloseTo(1, 1);

      const black = { r: 0, g: 0, b: 0 };
      expect(relativeLuminance(black)).toBeCloseTo(0, 1);
    });
  });

  describe('contrastFromLuminance', () => {
    it('should calculate contrast ratio from luminance values', () => {
      const ratio = contrastFromLuminance(1, 0);
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should be symmetric', () => {
      const ratio1 = contrastFromLuminance(0.5, 0.2);
      const ratio2 = contrastFromLuminance(0.2, 0.5);
      expect(ratio1).toBeCloseTo(ratio2, 5);
    });
  });

  describe('contrastRatio', () => {
    it('should calculate contrast ratio between two colors', () => {
      const white = { r: 1, g: 1, b: 1 };
      const black = { r: 0, g: 0, b: 0 };
      const ratio = contrastRatio(white, black);
      expect(ratio).toBeGreaterThan(20);
    });
  });

  describe('compositeLinear', () => {
    it('should composite UI channel over scene channel at alpha', () => {
      expect(compositeLinear(1, 0, 0)).toBeCloseTo(0, 5);
      expect(compositeLinear(1, 0, 1)).toBeCloseTo(1, 5);
      expect(compositeLinear(1, 0, 0.5)).toBeGreaterThan(0);
      expect(compositeLinear(1, 0, 0.5)).toBeLessThan(1);
    });
  });

  describe('compositeLuminance', () => {
    it('should calculate luminance of composited colors', () => {
      const ui = { r: 1, g: 1, b: 1 };
      const scene = { r: 0, g: 0, b: 0 };
      const lum0 = compositeLuminance(ui, scene, 0);
      const lum1 = compositeLuminance(ui, scene, 1);
      expect(lum0).toBeCloseTo(0, 5);
      expect(lum1).toBeCloseTo(1, 5);
    });
  });

  describe('visibleProgressScale', () => {
    it('should enforce minimum progress visibility', () => {
      const below = visibleProgressScale(0);
      expect(below).toBe(guiMath.loadingProgressFloor);

      const above = visibleProgressScale(0.5);
      expect(above).toBe(0.5);
    });
  });

  describe('loadingAssetProgress', () => {
    it('should map asset progress to loading bar range', () => {
      const start = loadingAssetProgress(0);
      expect(start).toBeCloseTo(guiMath.loadingAssetsStart, 5);

      const end = loadingAssetProgress(1);
      expect(end).toBeCloseTo(guiMath.loadingAssetsStart + guiMath.loadingAssetsWeight, 5);
    });
  });

  describe('loadingGpuProgress', () => {
    it('should map GPU progress to loading bar range with easing', () => {
      const start = loadingGpuProgress(0);
      expect(start).toBeCloseTo(guiMath.loadingGpuStart, 5);

      const end = loadingGpuProgress(1);
      expect(end).toBeCloseTo(guiMath.loadingGpuEnd, 5);
    });
  });

  describe('clampUiShadow', () => {
    it('should enforce shadow strength floor', () => {
      const below = clampUiShadow(0.5);
      expect(below).toBeGreaterThanOrEqual(guiMath.minUiShadowClamp);

      // A value above the floor passes through unchanged.
      const aboveFloor = clampUiShadow(0.9);
      expect(aboveFloor).toBe(0.9);
    });
  });

  describe('readableTextToneForScene', () => {
    it('should choose light text for dark scenes', () => {
      const tone = readableTextToneForScene(0.1);
      expect(tone).toBe('light');
    });

    it('should choose dark text for bright scenes', () => {
      const tone = readableTextToneForScene(0.8);
      expect(tone).toBe('dark');
    });
  });

  describe('chooseReadablePanelAlpha', () => {
    it('should choose alpha for readable panel', () => {
      const alpha = chooseReadablePanelAlpha({
        panel: { r: 0.1, g: 0.1, b: 0.1 },
        text: { r: 0.9, g: 0.9, b: 0.9 },
        sceneLuminance: 0.5,
      });
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    });
  });

  describe('sceneAwareUiTokens', () => {
    it('should return consistent UI tokens for a scene tone', () => {
      const tokens = sceneAwareUiTokens(0.5);
      expect(tokens).toHaveProperty('panelBgAlpha');
      expect(tokens).toHaveProperty('borderAlpha');
      expect(tokens).toHaveProperty('textTone');
      expect(tokens).toHaveProperty('shadowFloor');
      expect(tokens).toHaveProperty('bodyContrast');
      expect(['light', 'dark']).toContain(tokens.textTone);
      expect(tokens.shadowFloor).toBeGreaterThanOrEqual(guiMath.minUiShadowClamp);
    });
  });

  describe('uiReadableVars', () => {
    it('should return CSS custom properties', () => {
      const vars = uiReadableVars(0.5);
      expect(vars).toHaveProperty('--ui-panel-alpha');
      expect(vars).toHaveProperty('--ui-border-alpha');
      expect(vars).toHaveProperty('--ui-shadow-floor');
    });
  });
});
