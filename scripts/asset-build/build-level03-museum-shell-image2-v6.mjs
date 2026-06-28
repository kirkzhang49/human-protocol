import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEXTURE_DIR = path.join(ROOT, "src/assets/textures/environment/level03");
const REFERENCE_SHEET = path.join(TEXTURE_DIR, "level03_image2_museum_premium_shell_reference_v6.png");
const FLOOR_SOURCE = path.join(TEXTURE_DIR, "level03_image2_museum_floor_dark_premium_source_v6.png");
const FLOOR_VARIANT_D = path.join(
  TEXTURE_DIR,
  "image2-floor-variants-v7",
  "level03_image2_museum_floor_d_black_titanium_stone_v7.png",
);

const OUTPUTS = {
  floor: path.join(TEXTURE_DIR, "level03_image2_museum_floor_premium_stone_skin_v6.png"),
  wall: path.join(TEXTURE_DIR, "level03_image2_museum_black_gallery_wall_skin_v6.png"),
  ceiling: path.join(TEXTURE_DIR, "level03_image2_museum_ceiling_warm_panel_skin_v6.png"),
};

await fs.mkdir(TEXTURE_DIR, { recursive: true });

await buildFloor();
await buildWall();
await buildCeiling();

console.log(
  JSON.stringify(
    {
      schemaVersion: "hp.level03-museum-shell-image2-v6.build",
      outputs: Object.fromEntries(Object.entries(OUTPUTS).map(([key, value]) => [key, path.relative(ROOT, value)])),
    },
    null,
    2,
  ),
);

async function buildFloor() {
  const size = 2048;
  if (await fileExists(FLOOR_VARIANT_D)) {
    await sharp(FLOOR_VARIANT_D)
      .resize(size, size, { fit: "cover" })
      .modulate({ brightness: 0.88, saturation: 1.05 })
      .linear(1.08, -5)
      .png({ compressionLevel: 9 })
      .toFile(OUTPUTS.floor);
    return;
  }
  const source = await cleanFloorStoneBase(size);
  const base = await neutralizeBufferToTarget(source, size, {
    target: [0.30, 0.265, 0.205],
    lumaMin: 0.145,
    lumaMax: 0.405,
    detail: 0.92,
    saturation: 0.94,
    grain: 0.026,
    macro: 0.052,
    vein: 0.064,
    panelShade: 0.035,
  });
  const svg = floorLayoutSvg(size);
  await sharp(base, { raw: { width: size, height: size, channels: 4 } })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png({ compressionLevel: 9 })
    .toFile(OUTPUTS.floor);
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function buildWall() {
  const size = 2048;
  const crop = await cropReferenceThird(1, size);
  const base = await neutralizeBufferToTarget(crop, size, {
    // Was near-black (target 0.022, lumaMax 0.105) -> the wall read as void in-game.
    // Lift to a visible dark-gallery gray so walls are clearly present but still moody.
    target: [0.175, 0.177, 0.168],
    lumaMin: 0.145,
    lumaMax: 0.34,
    detail: 0.24,
    saturation: 0.5,
  });
  const svg = wallLayoutSvg(size);
  await sharp(base, { raw: { width: size, height: size, channels: 4 } })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png({ compressionLevel: 9 })
    .toFile(OUTPUTS.wall);
}

async function buildCeiling() {
  const size = 2048;
  const crop = await cropReferenceThird(2, size);
  const base = await neutralizeBufferToTarget(crop, size, {
    target: [0.70, 0.69, 0.63],
    lumaMin: 0.58,
    lumaMax: 0.78,
    detail: 0.18,
    saturation: 0.48,
  });
  const svg = ceilingLayoutSvg(size);
  await sharp(base, { raw: { width: size, height: size, channels: 4 } })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png({ compressionLevel: 9 })
    .toFile(OUTPUTS.ceiling);
}

async function cropReferenceThird(index, size) {
  const meta = await sharp(REFERENCE_SHEET).metadata();
  const third = Math.floor(meta.width / 3);
  const left = Math.min(meta.width - third, Math.max(0, index * third));
  return sharp(REFERENCE_SHEET)
    .extract({ left, top: 0, width: third, height: meta.height })
    .resize(size, size, { fit: "cover" })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function cleanFloorStoneBase(size) {
  const meta = await sharp(FLOOR_SOURCE).metadata();
  const cropSize = Math.floor(Math.min(meta.width, meta.height) * 0.56);
  const left = Math.floor((meta.width - cropSize) * 0.5);
  const top = Math.floor((meta.height - cropSize) * 0.5);
  return sharp(FLOOR_SOURCE)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(size, size, { fit: "cover" })
    .blur(0.45)
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function neutralizeBufferToTarget(buffer, size, options) {
  const out = Buffer.from(buffer);
  const target = options.target;
  const targetLuma = luma(target);
  const grainStrength = options.grain ?? 0.018;
  const macroStrength = options.macro ?? 0;
  const veinStrength = options.vein ?? 0;
  const panelShade = options.panelShade ?? 0;
  for (let y = 0; y < size; y += 1) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const offset = (y * size + x) * 4;
      const input = [out[offset] / 255, out[offset + 1] / 255, out[offset + 2] / 255];
      const sourceLuma = luma(input);
      const grain = (hashNoise(u * 173.1 + 0.2, v * 151.7 + 0.6) - 0.5) * grainStrength;
      const macro =
        (hashNoise(Math.floor(u * 9.0) * 1.37 + 2.4, Math.floor(v * 9.0) * 1.91 + 5.2) - 0.5) * macroStrength;
      const panel = panelShade * panelRelief(u, v);
      const vein = veinStrength * floorStoneVein(u, v);
      const preserved = clamp(
        (sourceLuma - 0.5) * options.detail + targetLuma + grain + macro + panel + vein,
        options.lumaMin,
        options.lumaMax,
      );
      const scale = preserved / Math.max(0.001, targetLuma);
      const grey = [preserved, preserved, preserved];
      const colored = target.map((channel) => clamp(channel * scale, 0, 1));
      const mixed = colored.map((channel, i) => mix(grey[i], channel, options.saturation));
      out[offset] = byte(mixed[0]);
      out[offset + 1] = byte(mixed[1]);
      out[offset + 2] = byte(mixed[2]);
      out[offset + 3] = 255;
    }
  }
  return out;
}

function floorLayoutSvg(size) {
  const brass = "#8f764b";
  const dark = "#1d1a16";
  const soft = "#a69570";
  const seam = "#39352e";
  const black = "#090806";
  return svg(size, `
    <rect width="${size}" height="${size}" fill="rgba(18,14,10,0.16)"/>
    ${rect(0.018, 0.018, 0.964, 0.964, "none", black, 18, 0.34)}
    ${line(0.16, 0, 0.16, 1, seam, 2, 0.34)}
    ${line(0.50, 0, 0.50, 1, seam, 1.5, 0.30)}
    ${line(0.84, 0, 0.84, 1, seam, 2, 0.34)}
    ${line(0, 0.18, 1, 0.18, seam, 2, 0.30)}
    ${line(0, 0.50, 1, 0.50, seam, 1.5, 0.26)}
    ${line(0, 0.82, 1, 0.82, seam, 2, 0.30)}
    ${line(0.06, 0.06, 0.94, 0.06, brass, 2, 0.44)}
    ${line(0.06, 0.94, 0.94, 0.94, brass, 2, 0.44)}
    ${line(0.06, 0.06, 0.06, 0.94, brass, 2, 0.44)}
    ${line(0.94, 0.06, 0.94, 0.94, brass, 2, 0.44)}
    ${line(0.12, 0.28, 0.88, 0.14, soft, 1.4, 0.17)}
    ${line(0.08, 0.66, 0.82, 0.90, soft, 1.2, 0.13)}
    ${line(0.24, 0.10, 0.92, 0.72, "#6e5a38", 1.2, 0.13)}
    ${line(0.46, 0.06, 0.46, 0.16, brass, 2, 0.46)}
    ${line(0.50, 0.06, 0.50, 0.16, dark, 1.4, 0.24)}
    ${line(0.54, 0.06, 0.54, 0.16, brass, 2, 0.46)}
    ${line(0.46, 0.84, 0.46, 0.94, brass, 2, 0.46)}
    ${line(0.50, 0.84, 0.50, 0.94, dark, 1.4, 0.24)}
    ${line(0.54, 0.84, 0.54, 0.94, brass, 2, 0.46)}
    ${rect(0.12, 0.14, 0.76, 0.72, "none", soft, 1.4, 0.13)}
  `);
}

function wallLayoutSvg(size) {
  const brass = "#8d7447";
  const glint = "#c7b98a";
  const cyan = "#54d9e8";
  return svg(size, `
    <rect width="${size}" height="${size}" fill="rgba(0,0,0,0.08)"/>
    ${rect(0.018, 0.018, 0.964, 0.964, "none", "#050505", 16, 0.82)}
    ${rect(0.055, 0.055, 0.89, 0.89, "none", "#181713", 5, 0.75)}
    ${line(0.08, 0.22, 0.92, 0.22, brass, 3)}
    ${line(0.08, 0.78, 0.92, 0.78, brass, 3)}
    ${line(0.28, 0.08, 0.28, 0.92, "#111111", 4)}
    ${line(0.72, 0.08, 0.72, 0.92, "#111111", 4)}
    ${line(0.12, 0.37, 0.42, 0.37, glint, 2)}
    ${line(0.56, 0.62, 0.88, 0.62, glint, 2)}
    ${rect(0.08, 0.10, 0.10, 0.015, brass, "none", 0, 0.65)}
    ${rect(0.82, 0.86, 0.10, 0.015, brass, "none", 0, 0.65)}
    ${rect(0.082, 0.48, 0.012, 0.14, cyan, "none", 0, 0.78)}
    ${rect(0.906, 0.38, 0.010, 0.10, cyan, "none", 0, 0.62)}
  `);
}

function ceilingLayoutSvg(size) {
  const groove = "#b7b1a0";
  const shadow = "#7d7a70";
  const light = "#f5eed8";
  const brass = "#b29a68";
  return svg(size, `
    <rect width="${size}" height="${size}" fill="rgba(255,255,255,0.05)"/>
    ${rect(0.04, 0.04, 0.92, 0.92, "none", shadow, 8, 0.55)}
    ${rect(0.10, 0.10, 0.80, 0.34, "rgba(255,255,255,0.055)", groove, 5, 0.5)}
    ${rect(0.10, 0.56, 0.80, 0.34, "rgba(255,255,255,0.045)", groove, 5, 0.5)}
    ${rect(0.15, 0.47, 0.70, 0.035, light, "none", 0, 0.86)}
    ${rect(0.16, 0.505, 0.68, 0.010, brass, "none", 0, 0.35)}
    ${line(0.50, 0.04, 0.50, 0.96, shadow, 3)}
    ${line(0.04, 0.50, 0.96, 0.50, shadow, 3)}
    ${rect(0.018, 0.35, 0.024, 0.30, "#d6cfba", "none", 0, 0.35)}
    ${rect(0.958, 0.35, 0.024, 0.30, "#d6cfba", "none", 0, 0.35)}
  `);
}

function svg(size, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
}

function line(x1, y1, x2, y2, color, width, opacity = 0.72) {
  return `<line x1="${x1 * 2048}" y1="${y1 * 2048}" x2="${x2 * 2048}" y2="${y2 * 2048}" stroke="${color}" stroke-width="${width}" stroke-linecap="square" opacity="${opacity}"/>`;
}

function rect(x, y, w, h, fill, stroke, strokeWidth, opacity) {
  return `<rect x="${x * 2048}" y="${y * 2048}" width="${w * 2048}" height="${h * 2048}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

function luma(rgb) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function floorStoneVein(u, v) {
  const a = Math.abs(Math.sin((u * 2.2 + v * 1.45 + hashNoise(u * 7.1, v * 5.7) * 0.18) * Math.PI * 4.0));
  const b = Math.abs(Math.sin((u * -1.1 + v * 2.75 + hashNoise(u * 4.9 + 8.1, v * 6.3) * 0.22) * Math.PI * 3.0));
  const bright = Math.pow(1.0 - a, 8.0) * 0.72 + Math.pow(1.0 - b, 10.0) * 0.34;
  const darkCut = Math.pow(a, 18.0) * -0.28;
  return bright + darkCut;
}

function panelRelief(u, v) {
  const edgeU = Math.min(fract(u * 6.0), 1.0 - fract(u * 6.0));
  const edgeV = Math.min(fract(v * 5.0), 1.0 - fract(v * 5.0));
  const edge = Math.min(edgeU, edgeV);
  const centerLift = smoothstep(0.10, 0.42, edge) * 0.42;
  const seamDip = (1.0 - smoothstep(0.006, 0.030, edge)) * -0.86;
  return centerLift + seamDip;
}

function hashNoise(x, y) {
  const value = Math.sin(x * 142.13 + y * 47.31) * 43758.5453;
  return value - Math.floor(value);
}

function fract(value) {
  return value - Math.floor(value);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function byte(value) {
  return Math.round(clamp(value, 0, 1) * 255);
}
