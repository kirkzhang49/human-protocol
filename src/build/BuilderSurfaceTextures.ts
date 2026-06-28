import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { BuilderSurfacePreset } from "./BuilderEnvironment";

/**
 * Procedural CanvasTextures for the 3D builder surfaces (no external images).
 * One 128px canvas is drawn per (preset pattern, base color) and shared; texture
 * instances (repeat/rotation variants) are cached so nothing is recreated per
 * frame. SSR-safe: without a DOM the helpers return null and the meshes fall
 * back to flat preset colors.
 */

const canvasCache = new Map<string, HTMLCanvasElement>();
const textureCache = new Map<string, CanvasTexture>();

const cellSize = 128;

/** Deterministic cache identity for a texture variant (exported for QA). */
export function surfaceTextureCacheKey(
  preset: BuilderSurfacePreset,
  color: string,
  repeatX: number,
  repeatY: number,
  rotationDeg: number,
) {
  return `${preset.id}|${color}|${quantize(repeatX)}|${quantize(repeatY)}|${rotationDeg}`;
}

/** Quantize repeats so wall segments of similar length share cache entries. */
export function quantize(value: number) {
  return Math.max(0.5, Math.round(value * 4) / 4);
}

/** Meters covered by one texture tile, per pattern (matches the 2D pattern cells loosely). */
export function patternCellMeters(pattern: BuilderSurfacePreset["pattern"]) {
  switch (pattern) {
    case "tile":
      return 2;
    case "metal":
      return 1.8;
    case "wood":
      return 2.4;
    case "hazard":
      return 2.4;
    case "stone":
      return 3.2;
    case "rubber":
      return 1.2;
    case "parquet":
      return 1.6;
    case "plate":
      return 1.4;
    case "labtile":
      return 1.2;
    case "route":
      return 3.2;
    case "panel":
      return 2.2;
    case "wainscot":
      return 2.6;
    case "glass":
      return 2.4;
    case "trim":
      return 2.4;
    case "marble":
      return 3;
    case "hex":
      return 1.6;
  }
}

/**
 * Floor texture for a w×d room painted with `preset` at `color`, honoring the
 * room's texture scale and rotation. Returns null without a DOM (SSR).
 */
export function floorSurfaceTexture(
  preset: BuilderSurfacePreset,
  color: string,
  scale: number,
  rotationDeg: number,
  widthMeters: number,
  depthMeters: number,
) {
  const cell = patternCellMeters(preset.pattern) * scale;
  return surfaceTexture(preset, color, widthMeters / cell, depthMeters / cell, rotationDeg);
}

/** Wall texture for a wall run of `lengthMeters` × `heightMeters`. */
export function wallSurfaceTexture(preset: BuilderSurfacePreset, color: string, lengthMeters: number, heightMeters: number) {
  const cell = patternCellMeters(preset.pattern);
  return surfaceTexture(preset, color, lengthMeters / cell, Math.max(0.5, heightMeters / cell) , 0);
}

export function surfaceTexture(
  preset: BuilderSurfacePreset,
  color: string,
  repeatX: number,
  repeatY: number,
  rotationDeg: number,
): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const key = surfaceTextureCacheKey(preset, color, repeatX, repeatY, rotationDeg);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const texture = new CanvasTexture(patternCanvas(preset, color));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.repeat.set(quantize(repeatX), quantize(repeatY));
  texture.center.set(0.5, 0.5);
  texture.rotation = (rotationDeg * Math.PI) / 180;
  textureCache.set(key, texture);
  return texture;
}

/** Texture-instance cache size (browser QA asserts cacheability). */
export function surfaceTextureCacheSize() {
  return textureCache.size;
}

function patternCanvas(preset: BuilderSurfacePreset, color: string) {
  const key = `${preset.pattern}|${color}|${preset.accent}`;
  const cached = canvasCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = cellSize;
  canvas.height = cellSize;
  const context = canvas.getContext("2d");
  if (context) drawPattern(context, preset.pattern, color, preset.accent);
  canvasCache.set(key, canvas);
  return canvas;
}

function drawPattern(
  context: CanvasRenderingContext2D,
  pattern: BuilderSurfacePreset["pattern"],
  base: string,
  accent: string,
) {
  const s = cellSize;
  context.fillStyle = base;
  context.fillRect(0, 0, s, s);

  switch (pattern) {
    case "tile": {
      // grout grid: one major tile per cell + faint quarter lines
      context.strokeStyle = withAlpha(accent, 0.32);
      context.lineWidth = 3;
      context.strokeRect(1.5, 1.5, s - 3, s - 3);
      context.strokeStyle = withAlpha(accent, 0.1);
      context.lineWidth = 1;
      line(context, s / 2, 0, s / 2, s);
      line(context, 0, s / 2, s, s / 2);
      sheen(context, base, 0.05);
      break;
    }
    case "metal": {
      // panel seams + rivets + brushed strips
      context.strokeStyle = withAlpha(accent, 0.26);
      context.lineWidth = 2;
      line(context, 0, s * 0.5, s, s * 0.5);
      line(context, s * 0.5, 0, s * 0.5, s);
      context.fillStyle = withAlpha(accent, 0.3);
      for (const [x, y] of [[0.12, 0.12], [0.38, 0.38], [0.62, 0.62], [0.88, 0.88], [0.88, 0.12], [0.12, 0.88]] as const) {
        dot(context, x * s, y * s, 2.4);
      }
      context.fillStyle = withAlpha("#ffffff", 0.035);
      for (let x = 6; x < s; x += 14) context.fillRect(x, 0, 2, s);
      break;
    }
    case "wood": {
      // three plank bands with seams + grain strokes
      const plank = s / 3;
      for (let row = 0; row < 3; row += 1) {
        context.fillStyle = withAlpha(row % 2 === 0 ? "#ffffff" : "#000000", 0.045);
        context.fillRect(0, row * plank, s, plank);
        context.strokeStyle = withAlpha(accent, 0.3);
        context.lineWidth = 2;
        line(context, 0, row * plank + 0.5, s, row * plank + 0.5);
        // staggered butt joints
        const joint = ((row * 53) % s) + 8;
        line(context, joint, row * plank, joint, (row + 1) * plank);
        context.strokeStyle = withAlpha(accent, 0.1);
        context.lineWidth = 1;
        line(context, 6, row * plank + plank * 0.4, s - 10, row * plank + plank * 0.42);
        line(context, 14, row * plank + plank * 0.75, s - 4, row * plank + plank * 0.7);
      }
      break;
    }
    case "hazard": {
      // diagonal caution stripes
      context.save();
      context.translate(s / 2, s / 2);
      context.rotate(Math.PI / 4);
      const band = s * 0.28;
      for (let offset = -2 * s; offset < 2 * s; offset += band * 2) {
        context.fillStyle = withAlpha(accent, 0.3);
        context.fillRect(offset, -s, band, s * 2);
      }
      context.restore();
      sheen(context, base, 0.04);
      break;
    }
    case "stone": {
      // staggered slab seams (2 rows, offset)
      context.strokeStyle = withAlpha(accent, 0.28);
      context.lineWidth = 2.5;
      line(context, 0, s / 2, s, s / 2);
      line(context, s / 2, 0, s / 2, s / 2);
      line(context, s / 4, s / 2, s / 4, s);
      line(context, (3 * s) / 4, s / 2, (3 * s) / 4, s);
      context.fillStyle = withAlpha("#ffffff", 0.03);
      context.fillRect(0, 0, s, s / 2);
      break;
    }
    case "rubber": {
      // deterministic speckle + faint ribbing
      const random = mulberry32(0x5eed);
      context.fillStyle = withAlpha(accent, 0.22);
      for (let index = 0; index < 70; index += 1) {
        dot(context, random() * s, random() * s, 0.8 + random() * 1.1);
      }
      context.fillStyle = withAlpha("#000000", 0.07);
      for (let y = 4; y < s; y += 10) context.fillRect(0, y, s, 2);
      break;
    }
    case "parquet": {
      // herringbone blocks with a brass inlay cross
      const block = s / 4;
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const even = (row + col) % 2 === 0;
          context.fillStyle = withAlpha(even ? "#ffffff" : "#000000", 0.05);
          context.fillRect(col * block, row * block, block, block);
          context.strokeStyle = withAlpha(accent, 0.22);
          context.lineWidth = 1.4;
          context.strokeRect(col * block + 0.7, row * block + 0.7, block - 1.4, block - 1.4);
          // grain direction alternates per block
          context.strokeStyle = withAlpha(accent, 0.1);
          context.lineWidth = 1;
          if (even) line(context, col * block + 4, row * block + block / 2, (col + 1) * block - 4, row * block + block / 2);
          else line(context, col * block + block / 2, row * block + 4, col * block + block / 2, (row + 1) * block - 4);
        }
      }
      // brass inlay seam
      context.strokeStyle = withAlpha(accent, 0.5);
      context.lineWidth = 2;
      line(context, 0, s / 2, s, s / 2);
      sheen(context, base, 0.04);
      break;
    }
    case "plate": {
      // diamond tread plate: staggered raised lugs + bolted seams
      context.strokeStyle = withAlpha(accent, 0.3);
      context.lineWidth = 2;
      context.strokeRect(1, 1, s - 2, s - 2);
      context.fillStyle = withAlpha(accent, 0.2);
      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 6; col += 1) {
          const x = (col + 0.5) * (s / 6) + (row % 2 === 0 ? 0 : s / 12);
          const y = (row + 0.5) * (s / 6);
          context.save();
          context.translate(x % s, y);
          context.rotate(row % 2 === 0 ? Math.PI / 4 : -Math.PI / 4);
          context.fillRect(-4.2, -1.4, 8.4, 2.8);
          context.restore();
        }
      }
      context.fillStyle = withAlpha(accent, 0.42);
      for (const [x, y] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]] as const) {
        dot(context, x * s, y * s, 2.6);
      }
      sheen(context, base, 0.05);
      break;
    }
    case "labtile": {
      // small lab tiles with grout + deterministic stains
      const tile = s / 4;
      context.strokeStyle = withAlpha(accent, 0.3);
      context.lineWidth = 1.4;
      for (let i = 0; i <= 4; i += 1) {
        line(context, i * tile, 0, i * tile, s);
        line(context, 0, i * tile, s, i * tile);
      }
      const random = mulberry32(0x1ab5);
      for (let index = 0; index < 5; index += 1) {
        context.fillStyle = withAlpha(index % 2 === 0 ? "#000000" : accent, 0.06 + random() * 0.05);
        dot(context, random() * s, random() * s, 4 + random() * 9);
      }
      sheen(context, base, 0.06);
      break;
    }
    case "route": {
      // big stone slabs with a glowing guidance inlay running through
      context.strokeStyle = withAlpha(accent, 0.16);
      context.lineWidth = 2.2;
      line(context, 0, s / 2, s, s / 2);
      line(context, s / 3, 0, s / 3, s / 2);
      line(context, (2 * s) / 3, s / 2, (2 * s) / 3, s);
      context.fillStyle = withAlpha("#ffffff", 0.03);
      context.fillRect(0, 0, s, s / 2);
      // route inlay: bright double line with center glow
      context.strokeStyle = withAlpha(accent, 0.55);
      context.lineWidth = 1.6;
      line(context, 0, s * 0.78, s, s * 0.78);
      line(context, 0, s * 0.86, s, s * 0.86);
      context.fillStyle = withAlpha(accent, 0.14);
      context.fillRect(0, s * 0.78, s, s * 0.08);
      break;
    }
    case "panel": {
      // tall dark metal wall panels: vertical seams, offset bolts, vent slits
      context.strokeStyle = withAlpha(accent, 0.26);
      context.lineWidth = 2;
      line(context, s / 3, 0, s / 3, s);
      line(context, (2 * s) / 3, 0, (2 * s) / 3, s);
      context.strokeStyle = withAlpha(accent, 0.12);
      context.lineWidth = 1;
      line(context, 0, s * 0.22, s, s * 0.22);
      context.fillStyle = withAlpha(accent, 0.3);
      for (const [x, y] of [[0.17, 0.1], [0.5, 0.34], [0.83, 0.1], [0.17, 0.66], [0.83, 0.66]] as const) {
        dot(context, x * s, y * s, 2);
      }
      context.fillStyle = withAlpha("#000000", 0.18);
      for (let i = 0; i < 4; i += 1) context.fillRect(s * 0.4, s * (0.74 + i * 0.05), s * 0.2, 2);
      sheen(context, base, 0.05);
      break;
    }
    case "wainscot": {
      // warm archive wall: upper fabric field + lower wood wainscot + brass rail
      context.fillStyle = withAlpha("#000000", 0.12);
      context.fillRect(0, s * 0.55, s, s * 0.45);
      context.strokeStyle = withAlpha(accent, 0.5);
      context.lineWidth = 2;
      line(context, 0, s * 0.55, s, s * 0.55);
      context.strokeStyle = withAlpha(accent, 0.22);
      context.lineWidth = 1.4;
      for (let i = 0; i < 4; i += 1) {
        const x = (i + 0.5) * (s / 4);
        context.strokeRect(x - s / 10, s * 0.62, s / 5, s * 0.3);
      }
      context.strokeStyle = withAlpha(accent, 0.1);
      context.lineWidth = 1;
      line(context, s / 2, 0, s / 2, s * 0.5);
      sheen(context, base, 0.05);
      break;
    }
    case "glass": {
      // observation glazing: mullion grid + diagonal reflection streaks
      context.strokeStyle = withAlpha(accent, 0.4);
      context.lineWidth = 2.4;
      context.strokeRect(1.2, 1.2, s - 2.4, s - 2.4);
      line(context, s / 2, 0, s / 2, s);
      context.strokeStyle = withAlpha("#ffffff", 0.07);
      context.lineWidth = 5;
      line(context, s * 0.1, s * 0.95, s * 0.6, s * 0.05);
      context.lineWidth = 2.4;
      line(context, s * 0.4, s * 0.98, s * 0.95, s * 0.1);
      context.fillStyle = withAlpha(accent, 0.05);
      context.fillRect(2, 2, s - 4, s - 4);
      break;
    }
    case "trim": {
      // plain wall with a hazard chevron band at waist height
      context.strokeStyle = withAlpha(accent, 0.1);
      context.lineWidth = 1;
      line(context, s / 2, 0, s / 2, s);
      const bandY = s * 0.58;
      const bandH = s * 0.14;
      context.fillStyle = withAlpha("#000000", 0.25);
      context.fillRect(0, bandY, s, bandH);
      context.save();
      context.beginPath();
      context.rect(0, bandY, s, bandH);
      context.clip();
      context.fillStyle = withAlpha(accent, 0.45);
      for (let x = -s; x < s * 1.5; x += s / 4) {
        context.beginPath();
        context.moveTo(x, bandY + bandH);
        context.lineTo(x + s / 8, bandY);
        context.lineTo(x + s / 4.5, bandY);
        context.lineTo(x + s / 11, bandY + bandH);
        context.closePath();
        context.fill();
      }
      context.restore();
      context.strokeStyle = withAlpha(accent, 0.4);
      context.lineWidth = 1.4;
      line(context, 0, bandY, s, bandY);
      line(context, 0, bandY + bandH, s, bandY + bandH);
      sheen(context, base, 0.04);
      break;
    }
    case "marble": {
      // soft polished field + meandering veins (deterministic so it caches)
      context.fillStyle = withAlpha("#ffffff", 0.05);
      context.fillRect(0, 0, s, s);
      const random = mulberry32(0x3a12);
      for (let vein = 0; vein < 4; vein += 1) {
        context.strokeStyle = withAlpha(accent, 0.18 + random() * 0.18);
        context.lineWidth = 0.6 + random() * 1.8;
        context.beginPath();
        let x = random() * s;
        let y = -4;
        context.moveTo(x, y);
        while (y < s + 4) {
          x += (random() - 0.5) * s * 0.5;
          y += s * (0.18 + random() * 0.16);
          context.quadraticCurveTo(x + (random() - 0.5) * 12, y - 6, Math.max(-4, Math.min(s + 4, x)), y);
        }
        context.stroke();
      }
      // faint hairline tributaries
      context.strokeStyle = withAlpha(accent, 0.08);
      context.lineWidth = 0.5;
      for (let i = 0; i < 6; i += 1) line(context, random() * s, random() * s, random() * s, random() * s);
      sheen(context, base, 0.05);
      break;
    }
    case "hex": {
      // honeycomb tiling: offset rows of hexagon outlines
      const radius = s / 4.2;
      const horiz = radius * Math.sqrt(3);
      const vert = radius * 1.5;
      context.strokeStyle = withAlpha(accent, 0.3);
      context.lineWidth = 1.4;
      for (let row = -1; row * vert < s + radius; row += 1) {
        const cy = row * vert;
        const offset = row % 2 === 0 ? 0 : horiz / 2;
        for (let col = -1; col * horiz + offset < s + horiz; col += 1) {
          const cx = col * horiz + offset;
          context.beginPath();
          for (let k = 0; k < 6; k += 1) {
            const angle = (Math.PI / 180) * (60 * k - 90);
            const px = cx + radius * Math.cos(angle);
            const py = cy + radius * Math.sin(angle);
            if (k === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
          }
          context.closePath();
          context.stroke();
        }
      }
      context.fillStyle = withAlpha("#ffffff", 0.03);
      context.fillRect(0, 0, s, s);
      sheen(context, base, 0.05);
      break;
    }
  }
}

function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function dot(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

/** Soft top-left lighting sheen so big surfaces don't read perfectly flat. */
function sheen(context: CanvasRenderingContext2D, _base: string, strength: number) {
  const gradient = context.createLinearGradient(0, 0, cellSize, cellSize);
  gradient.addColorStop(0, withAlpha("#ffffff", strength));
  gradient.addColorStop(1, withAlpha("#000000", strength));
  context.fillStyle = gradient;
  context.fillRect(0, 0, cellSize, cellSize);
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Deterministic PRNG so the rubber speckle is identical across runs. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
