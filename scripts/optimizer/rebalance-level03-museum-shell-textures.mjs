import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MATERIAL_TARGETS_PATH = path.join(ROOT, "src/assets/manifests/generated/age/human_protocol_level03_museum_material_targets_v1.json");
const MATERIAL_TARGETS = JSON.parse(await fs.readFile(MATERIAL_TARGETS_PATH, "utf8"));
const SURFACES = MATERIAL_TARGETS.surfaces ?? {};

const targets = [
  {
    kind: "floor",
    input: "src/assets/textures/environment/hero-floors/image2/source-roomfit/level03_image2_full_room_human_museum_gallery_floor_18x12.png",
    outputs: [
      "src/assets/textures/environment/hero-floors/image2/source-roomfit/level03_image2_full_room_human_museum_gallery_floor_18x12.png",
      "src/assets/textures/environment/hero-floors/image2/runtime/level03_image2_full_room_human_museum_gallery_floor_18x12_runtime.webp",
    ],
  },
  {
    kind: "wall",
    input: "src/assets/textures/environment/level03/level03_image2_museum_stone_panel.png",
    outputs: ["src/assets/textures/environment/level03/level03_image2_museum_stone_panel.png"],
  },
];

const kindFilter = readKindFilter();

for (const target of targets.filter((candidate) => !kindFilter || candidate.kind === kindFilter)) {
  const inputPath = path.join(ROOT, target.input);
  const source = sharp(inputPath, { limitInputPixels: false }).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  const metricsBefore = measure(data, info);
  rebalance(output, info, target.kind);
  const metricsAfter = measure(output, info);
  for (const outputRelative of target.outputs) {
    const outputPath = path.join(ROOT, outputRelative);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    let image = sharp(output, { raw: info });
    if (outputRelative.endsWith(".webp")) {
      image = image.webp({ quality: 88, effort: 5 });
    } else {
      image = image.png({ compressionLevel: 9 });
    }
    await image.toFile(outputPath);
  }
  console.log(`${target.kind}: ${JSON.stringify({ before: metricsBefore, after: metricsAfter })}`);
}

function rebalance(data, info, kind) {
  const channels = info.channels;
  const width = info.width;
  const height = info.height;
  for (let y = 0; y < height; y += 1) {
    const v = height <= 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = width <= 1 ? 0 : x / (width - 1);
      const offset = (y * width + x) * channels;
      const r0 = data[offset] / 255;
      const g0 = data[offset + 1] / 255;
      const b0 = data[offset + 2] / 255;
      const luma0 = r0 * 0.2126 + g0 * 0.7152 + b0 * 0.0722;
      const detail = (noise(u * 91.7 + 0.21, v * 77.1 + 0.37) - 0.5) * 0.035;
      const broad = noise(u * 7.2 + 1.8, v * 6.4 + 2.3);
      const center = 1 - smoothstep(0.12, 0.56, Math.hypot(u - 0.5, v - 0.5));
      let r;
      let g;
      let b;
      if (kind === "floor") {
        const floorTarget = SURFACES.floor_polished_stone ?? {};
        const baseRgb = rgbTarget(floorTarget.targetRgbSrgb, [0.34, 0.34, 0.31]);
        const reflectionRgb = rgbTarget(floorTarget.reflectionRgbSrgb, [0.38, 0.37, 0.33]);
        const metalRgb = rgbTarget(floorTarget.metalTraceRgbSrgb, [0.56, 0.47, 0.26]);
        const lumaRange = Array.isArray(floorTarget.lumaRange) ? floorTarget.lumaRange : [0.28, 0.39];
        const midLuma = (Number(lumaRange[0]) + Number(lumaRange[1])) * 0.5;
        const targetLuma = clamp(0.24 + luma0 * 0.22 + center * 0.035 + broad * 0.026 + detail * 0.45, 0.22, 0.42);
        const coolStone = softEllipse(u, v, 0.44, 0.52, 0.48, 0.28) * 0.035;
        const softReflection = softEllipse(u, v, 0.36, 0.62, 0.32, 0.14) * 0.055 + softEllipse(u, v, 0.68, 0.38, 0.26, 0.13) * 0.04;
        const brassLine =
          line(u, 0.12, 0.0035) * 0.11 +
          line(u, 0.88, 0.0035) * 0.11 +
          line(v, 0.15, 0.0035) * 0.08 +
          line(v, 0.85, 0.0035) * 0.08;
        const lumaScale = targetLuma / Math.max(0.001, midLuma);
        r = baseRgb[0] * lumaScale + reflectionRgb[0] * softReflection + metalRgb[0] * brassLine;
        g = baseRgb[1] * lumaScale + reflectionRgb[1] * softReflection + metalRgb[1] * brassLine + coolStone * 0.04;
        b = baseRgb[2] * lumaScale + reflectionRgb[2] * softReflection + metalRgb[2] * brassLine + coolStone * 0.12;
        const originalMix = 0.03;
        r = mix(r, r0, originalMix);
        g = mix(g, g0, originalMix);
        b = mix(b, b0, originalMix);
      } else {
        const wallTarget = SURFACES.wall_black_gallery ?? {};
        const baseRgb = rgbTarget(wallTarget.targetRgbSrgb, [0.055, 0.058, 0.054]);
        const edgeRgb = rgbTarget(wallTarget.edgeGlintRgbSrgb, [0.36, 0.34, 0.25]);
        const reflectionRgb = rgbTarget(wallTarget.reflectionRgbSrgb, [0.12, 0.12, 0.105]);
        const lumaRange = Array.isArray(wallTarget.lumaRange) ? wallTarget.lumaRange : [0.035, 0.095];
        const midLuma = (Number(lumaRange[0]) + Number(lumaRange[1])) * 0.5;
        const targetLuma = clamp(midLuma + (luma0 - 0.18) * 0.16 + (broad - 0.5) * 0.018 + detail * 0.28, lumaRange[0], lumaRange[1]);
        const verticalGlint = line(u, 0.18, 0.0045) * 0.11 + line(u, 0.82, 0.0045) * 0.11;
        const hairlineGlint =
          line(v, 0.14, 0.0028) * 0.045 +
          line(v, 0.86, 0.0028) * 0.045 +
          line(u, 0.5, 0.0022) * 0.026;
        const softCaseReflection =
          softEllipse(u, v, 0.32, 0.34, 0.22, 0.06) * 0.036 +
          softEllipse(u, v, 0.68, 0.66, 0.22, 0.06) * 0.032;
        const lumaScale = targetLuma / Math.max(0.001, midLuma);
        r = baseRgb[0] * lumaScale + edgeRgb[0] * verticalGlint + edgeRgb[0] * hairlineGlint + reflectionRgb[0] * softCaseReflection;
        g = baseRgb[1] * lumaScale + edgeRgb[1] * verticalGlint + edgeRgb[1] * hairlineGlint + reflectionRgb[1] * softCaseReflection;
        b = baseRgb[2] * lumaScale + edgeRgb[2] * verticalGlint + edgeRgb[2] * hairlineGlint + reflectionRgb[2] * softCaseReflection;
        const originalMix = 0.08;
        r = mix(r, r0, originalMix);
        g = mix(g, g0, originalMix);
        b = mix(b, b0, originalMix);
      }
      data[offset] = byte(r);
      data[offset + 1] = byte(g);
      data[offset + 2] = byte(b);
    }
  }
}

function measure(data, info) {
  const channels = info.channels;
  let luma = 0;
  let chroma = 0;
  const count = info.width * info.height;
  for (let index = 0; index < count; index += 1) {
    const offset = index * channels;
    const r = data[offset] / 255;
    const g = data[offset + 1] / 255;
    const b = data[offset + 2] / 255;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    luma += y;
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
  }
  return { luma: round(luma / count), chroma: round(chroma / count) };
}

function noise(x, y) {
  const value = Math.sin(x * 142.13 + y * 47.31) * 43758.5453;
  return value - Math.floor(value);
}

function line(value, center, width) {
  return 1 - smoothstep(width, width * 3.5, Math.abs(value - center));
}

function softEllipse(u, v, cx, cy, sx, sy) {
  const dx = (u - cx) / sx;
  const dy = (v - cy) / sy;
  return smoothstep(1, 0, Math.sqrt(dx * dx + dy * dy));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function byte(value) {
  return Math.round(clamp(value, 0, 1) * 255);
}

function round(value) {
  return Number(value.toFixed(4));
}

function rgbTarget(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}

function readKindFilter() {
  const arg = process.argv.find((candidate) => candidate.startsWith("--kind="));
  if (!arg) return null;
  const value = arg.slice("--kind=".length);
  if (!targets.some((target) => target.kind === value)) {
    throw new Error(`Unknown --kind=${value}`);
  }
  return value;
}
