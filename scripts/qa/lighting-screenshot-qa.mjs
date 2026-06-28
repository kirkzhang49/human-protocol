import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const options = parseOptions(process.argv.slice(2));
const screenshotPath = path.resolve(ROOT, options.screenshot);
const reportPath = path.resolve(ROOT, options.out);

if (!fs.existsSync(screenshotPath)) {
  fail(`missing screenshot: ${screenshotPath}`);
}

const image = decodePng(fs.readFileSync(screenshotPath));
const rois = sampleRois(image);
const global = sampleRect(image, { id: "global", x: 0, y: 0, width: 1, height: 1 });
const report = buildReport(image, global, rois);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (!report.metrics.ok) {
  fail(`lighting screenshot QA failed: ${report.metrics.failures.join("; ")}`);
}

console.log(
  `PASS lighting screenshot QA screenshot=${path.relative(ROOT, screenshotPath)} score=${report.metrics.score} contrast=${report.metrics.roiContrast} overbright=${report.metrics.overbrightRatio}`,
);

function parseOptions(args) {
  const options = {
    screenshot: "",
    out: "src/assets/manifests/reports/human_protocol_level01_lighting_screenshot_report.json",
  };
  for (const arg of args) {
    if (arg.startsWith("--screenshot=")) options.screenshot = arg.slice("--screenshot=".length);
    if (arg.startsWith("--out=")) options.out = arg.slice("--out=".length);
  }
  if (!options.screenshot) {
    fail("usage: node scripts/qa/lighting-screenshot-qa.mjs --screenshot=/path/to/level01.png [--out=...]");
  }
  return options;
}

function buildReport(image, global, rois) {
  const byId = Object.fromEntries(rois.map((roi) => [roi.id, roi]));
  const roomCenter = average([byId.center_lane.meanLuminance, byId.repair_bay.meanLuminance, byId.hero_screen.meanLuminance]);
  const roomEdges = average([byId.left_wall.meanLuminance, byId.right_wall.meanLuminance, byId.ceiling.meanLuminance]);
  const floorDepth = Math.abs(byId.floor_near.meanLuminance - byId.floor_mid.meanLuminance);
  const wallDepth = Math.abs(byId.left_wall.meanLuminance - byId.elevator.meanLuminance);
  const ceilingRead = clamp01((byId.ceiling.stdDev + Math.abs(byId.ceiling.meanLuminance - byId.hero_screen.meanLuminance) * 0.45) / 0.18);
  const pickupVisibilityProxy = clamp01((byId.lower_props.meanLuminance - byId.floor_mid.meanLuminance + 0.16) / 0.38) * clamp01(byId.lower_props.stdDev / 0.12);
  const roiContrast = round((stdDev(rois.map((roi) => roi.meanLuminance)) / (average(rois.map((roi) => roi.meanLuminance)) + 0.001)));
  const overbrightRatio = round(global.overbrightRatio);
  const crushedRatio = round(global.crushedRatio);
  const darkPlayable = scoreBand(global.meanLuminance, 0.18, 0.42, 0.18) * scoreBand(crushedRatio, 0.02, 0.24, 0.2);
  const highlightDiscipline = scoreBand(overbrightRatio, 0.002, 0.08, 0.06);
  const reflectionLayering = scoreBand(floorDepth, 0.035, 0.16, 0.11) * 0.56 + scoreBand(byId.floor_mid.stdDev, 0.035, 0.13, 0.08) * 0.44;
  const depthLayering = scoreBand(floorDepth + wallDepth, 0.08, 0.34, 0.22);
  const score = round(
    100 *
      (0.18 * darkPlayable +
        0.15 * highlightDiscipline +
        0.18 * reflectionLayering +
        0.18 * depthLayering +
        0.12 * ceilingRead +
        0.12 * pickupVisibilityProxy +
        0.07 * scoreBand(roiContrast, 0.24, 0.58, 0.25)),
  );
  const failures = [];
  if (global.meanLuminance < 0.12) failures.push(`image too dark mean=${round(global.meanLuminance)}`);
  if (global.meanLuminance > 0.58) failures.push(`image too flat/bright mean=${round(global.meanLuminance)}`);
  if (overbrightRatio > 0.14) failures.push(`overbright ratio too high: ${overbrightRatio}`);
  if (crushedRatio > 0.34) failures.push(`crushed shadow ratio too high: ${crushedRatio}`);
  if (roiContrast < 0.16) failures.push(`ROI contrast too low: ${roiContrast}`);
  if (score < 54) failures.push(`screenshot lighting score too low: ${score}`);

  return {
    schema: "human-protocol/lighting-screenshot-qa@1",
    generatedAt: new Date().toISOString(),
    screenshot: path.relative(ROOT, screenshotPath),
    image: { width: image.width, height: image.height },
    metrics: {
      ok: failures.length === 0,
      score,
      meanLuminance: round(global.meanLuminance),
      stdDev: round(global.stdDev),
      roiContrast,
      overbrightRatio,
      crushedRatio,
      darkPlayable: round(darkPlayable),
      highlightDiscipline: round(highlightDiscipline),
      reflectionLayering: round(reflectionLayering),
      depthLayering: round(depthLayering),
      ceilingRead: round(ceilingRead),
      pickupVisibilityProxy: round(pickupVisibilityProxy),
      failures,
    },
    rois: Object.fromEntries(rois.map((roi) => [roi.id, roi])),
    thresholds: {
      meanLuminance: [0.12, 0.58],
      overbrightRatioMax: 0.14,
      crushedRatioMax: 0.34,
      roiContrastMin: 0.16,
      scoreMin: 54,
    },
    note: "This is a real screenshot sampler for Objective v3 and human review. It samples normalized ROIs and does not mutate roomPresentationKits.",
  };
}

function sampleRois(image) {
  const regions = [
    { id: "center_lane", x: 0.38, y: 0.42, width: 0.24, height: 0.22 },
    { id: "floor_near", x: 0.28, y: 0.72, width: 0.44, height: 0.18 },
    { id: "floor_mid", x: 0.32, y: 0.58, width: 0.36, height: 0.13 },
    { id: "ceiling", x: 0.2, y: 0.06, width: 0.6, height: 0.2 },
    { id: "hero_screen", x: 0.43, y: 0.24, width: 0.2, height: 0.22 },
    { id: "repair_bay", x: 0.22, y: 0.42, width: 0.2, height: 0.24 },
    { id: "lower_props", x: 0.2, y: 0.52, width: 0.32, height: 0.25 },
    { id: "elevator", x: 0.45, y: 0.28, width: 0.2, height: 0.34 },
    { id: "left_wall", x: 0.04, y: 0.26, width: 0.16, height: 0.36 },
    { id: "right_wall", x: 0.8, y: 0.24, width: 0.16, height: 0.36 },
  ];
  return regions.map((region) => sampleRect(image, region));
}

function sampleRect(image, region) {
  const x0 = Math.max(0, Math.floor(region.x * image.width));
  const y0 = Math.max(0, Math.floor(region.y * image.height));
  const x1 = Math.min(image.width, Math.ceil((region.x + region.width) * image.width));
  const y1 = Math.min(image.height, Math.ceil((region.y + region.height) * image.height));
  const luminances = [];
  let overbright = 0;
  let crushed = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * image.width + x) * 4;
      const lum = luminance(image.pixels[offset], image.pixels[offset + 1], image.pixels[offset + 2]);
      luminances.push(lum);
      if (lum > 0.86) overbright += 1;
      if (lum < 0.045) crushed += 1;
    }
  }
  const meanLuminance = average(luminances);
  return {
    id: region.id,
    meanLuminance: round(meanLuminance),
    stdDev: round(stdDev(luminances, meanLuminance)),
    overbrightRatio: round(overbright / Math.max(1, luminances.length)),
    crushedRatio: round(crushed / Math.max(1, luminances.length)),
    sampleCount: luminances.length,
  };
}

function decodePng(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") fail("not a PNG file");
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let bitDepth = -1;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    fail(`unsupported PNG format bitDepth=${bitDepth} colorType=${colorType}; expected RGB/RGBA 8-bit`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let rawOffset = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset++];
    const scanline = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;
    unfilter(scanline, prev, channels, filter);
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      pixels[dst] = scanline[src];
      pixels[dst + 1] = scanline[src + 1];
      pixels[dst + 2] = scanline[src + 2];
      pixels[dst + 3] = channels === 4 ? scanline[src + 3] : 255;
    }
    prev = scanline;
  }
  return { width, height, pixels };
}

function unfilter(scanline, prev, channels, filter) {
  for (let i = 0; i < scanline.length; i += 1) {
    const left = i >= channels ? scanline[i - channels] : 0;
    const up = prev[i] ?? 0;
    const upLeft = i >= channels ? prev[i - channels] ?? 0 : 0;
    let value = scanline[i];
    if (filter === 1) value += left;
    else if (filter === 2) value += up;
    else if (filter === 3) value += Math.floor((left + up) / 2);
    else if (filter === 4) value += paeth(left, up, upLeft);
    else if (filter !== 0) fail(`unsupported PNG filter ${filter}`);
    scanline[i] = value & 255;
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function luminance(r8, g8, b8) {
  const r = srgbToLinear(r8 / 255);
  const g = srgbToLinear(g8 / 255);
  const b = srgbToLinear(b8 / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stdDev(values, mean = average(values)) {
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function scoreBand(value, low, high, softness) {
  if (value >= low && value <= high) return 1;
  if (value < low) return clamp01(1 - (low - value) / softness);
  return clamp01(1 - (value - high) / softness);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}
