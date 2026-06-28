import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEVEL_ID = readArg("--level") ?? "level_03_human_museum";
const SOURCE = path.join(ROOT, "scripts/optimizer/level03_raw_color_grade_optimizer.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/level03_raw_color_grade_optimizer");
const PLAN_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `render_plan_${LEVEL_ID}.json`);
const INPUT_PATH = path.join(ROOT, "node_modules/.tmp", `raw_visual_color_metrics_${LEVEL_ID}.tsv`);
const TUNING_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_visual_color_tuning_${LEVEL_ID}.json`);
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_visual_color_optimizer_report_${LEVEL_ID}.json`);
const families = positiveInteger(readArg("--families"), 50000);
const candidates = positiveInteger(readArg("--candidates"), 199);

if (!fs.existsSync(PLAN_PATH)) {
  console.error(`Missing render plan: ${path.relative(ROOT, PLAN_PATH)}. Run npm run compile:raw-webgpu-plan first.`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
const metrics = visualMetrics(plan);

fs.mkdirSync(path.dirname(BINARY), { recursive: true });
fs.mkdirSync(path.dirname(TUNING_PATH), { recursive: true });
fs.writeFileSync(INPUT_PATH, metricsTsv(metrics));

const compile = spawnSync("c++", ["-std=c++17", "-O3", "-march=native", SOURCE, "-o", BINARY], {
  cwd: ROOT,
  encoding: "utf8",
});

if (compile.status !== 0) {
  process.stderr.write(compile.stderr || compile.stdout);
  process.exit(compile.status ?? 1);
}

const run = spawnSync(BINARY, [INPUT_PATH, TUNING_PATH, REPORT_PATH, String(families), String(candidates)], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 20,
});

if (run.status !== 0) {
  process.stderr.write(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}

const summary = JSON.parse(run.stdout);
const tuning = JSON.parse(fs.readFileSync(TUNING_PATH, "utf8"));
if (!tuning.params) {
  console.error("Optimizer output did not include params.");
  process.exit(1);
}

console.log(
  `PASS raw Level 3 C++ color grade optimizer candidates=${summary.candidatesEvaluated} current=${summary.currentScore.toFixed(3)} best=${summary.bestScore.toFixed(3)} improvement=${summary.improvement.toFixed(3)}`,
);
console.log(`  tuning=${path.relative(ROOT, TUNING_PATH)}`);
console.log(`  report=${path.relative(ROOT, REPORT_PATH)}`);

function visualMetrics(plan) {
  const materialSamples = (plan.geometry?.materials ?? [])
    .filter((material) => material.category !== "builtin" && material.materialKind >= 0)
    .map((material) => {
      const color = tuple3(material.baseColorFactor, [1, 1, 1]);
      const texture = material.textures?.find((slot) => slot.semantic === "baseColor" && Number.isFinite(slot.layer));
      const stats = texture?.stats ?? null;
      const hasTexture = Boolean(texture);
      const textureReadability = stats ? clamp(stats.contrast * 0.72 + stats.detail * 1.35, 0, 1) : 0;
      return colorSample(color, hasTexture ? 1.35 : 0.82, textureReadability, hasTexture, stats);
    });
  const lightSamples = (plan.lights ?? []).map((light) => colorSample(hexToRgb(light.color), clamp(number(light.intensity, 1) * 0.28, 0.08, 1.8), 0, false, null));
  const samples = [...materialSamples, ...lightSamples];
  const totalWeight = samples.reduce((total, sample) => total + sample.weight, 0) || 1;
  const totalChromaWeight = samples.reduce((total, sample) => total + sample.chromaWeight, 0) || 1;
  const textureWeight = samples.filter((sample) => sample.hasTexture).reduce((total, sample) => total + sample.weight, 0);
  const textureReadability = samples.filter((sample) => sample.hasTexture).reduce((total, sample) => total + sample.textureReadability * sample.weight, 0);
  const textureDetail = samples.filter((sample) => sample.stats).reduce((total, sample) => total + sample.stats.detail * sample.weight, 0);
  const textureStatsWeight = samples.filter((sample) => sample.stats).reduce((total, sample) => total + sample.weight, 0);
  const profiles = plan.lightingProfiles ?? [];

  return {
    cyanDominance: round(samples.reduce((total, sample) => total + sample.cyanWeight, 0) / totalChromaWeight),
    warmBalance: round(samples.reduce((total, sample) => total + sample.warmWeight, 0) / totalChromaWeight),
    neutralAnchor: round(samples.reduce((total, sample) => total + sample.neutralWeight, 0) / totalWeight),
    textureCoverage: round(textureWeight / totalWeight),
    materialReadability: round(textureWeight > 0 ? textureReadability / textureWeight : 0),
    meanLuma: round(samples.reduce((total, sample) => total + sample.luma * sample.weight, 0) / totalWeight),
    textureDetail: round(textureStatsWeight > 0 ? textureDetail / textureStatsWeight : 0),
    cyanLightPressure: round(lightPressure(plan.lights ?? [], "cyan")),
    warmLightPressure: round(lightPressure(plan.lights ?? [], "warm")),
    profileExposure: round(average(profiles.map((profile) => number(profile.artist?.exposure, 1.1)), 1.1)),
    profileContrast: round(average(profiles.map((profile) => number(profile.artist?.contrast, 1.15)), 1.15)),
    profileSaturation: round(average(profiles.map((profile) => number(profile.artist?.saturation, 1.02)), 1.02)),
    profileWarmth: round(average(profiles.map((profile) => number(profile.artist?.warmth, 0.5)), 0.5)),
  };
}

function colorSample(color, weight, textureReadability, hasTexture, stats) {
  const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  const high = Math.max(color[0], color[1], color[2]);
  const low = Math.min(color[0], color[1], color[2]);
  const chroma = Math.max(0, high - low);
  const chromaWeight = weight * Math.max(0.02, chroma) * clamp(Math.sqrt(Math.max(0, luma)) + 0.22, 0.12, 1.12);
  const cyan = clamp(color[1] * 0.45 + color[2] * 0.62 - color[0] * 0.34, 0, 1);
  const warm = clamp(color[0] * 0.78 + color[1] * 0.28 - color[2] * 0.34, 0, 1);
  const neutral = chroma < 0.085 && luma > 0.055 && luma < 0.88 ? weight : 0;
  return {
    weight,
    chromaWeight,
    cyanWeight: chromaWeight * cyan,
    warmWeight: chromaWeight * warm,
    neutralWeight: neutral,
    textureReadability,
    hasTexture,
    luma,
    stats,
  };
}

function lightPressure(lights, mode) {
  let total = 0;
  let weighted = 0;
  for (const light of lights) {
    const color = hexToRgb(light.color);
    const weight = clamp(number(light.intensity, 1), 0, 6);
    const score =
      mode === "cyan"
        ? clamp(color[1] * 0.45 + color[2] * 0.62 - color[0] * 0.34, 0, 1)
        : clamp(color[0] * 0.78 + color[1] * 0.28 - color[2] * 0.34, 0, 1);
    total += weight;
    weighted += score * weight;
  }
  return total > 0 ? weighted / total : 0;
}

function metricsTsv(metrics) {
  return `metric\tvalue\n${Object.entries(metrics)
    .map(([key, value]) => `${key}\t${value}`)
    .join("\n")}\n`;
}

function tuple3(value, fallback) {
  return Array.isArray(value) && value.length >= 3 ? [number(value[0], fallback[0]), number(value[1], fallback[1]), number(value[2], fallback[2])] : fallback;
}

function hexToRgb(value) {
  const normalized = String(value ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return [0.7, 0.9, 1];
  const intValue = Number.parseInt(normalized, 16);
  return [((intValue >> 16) & 255) / 255, ((intValue >> 8) & 255) / 255, (intValue & 255) / 255];
}

function readArg(name) {
  const prefix = `${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function number(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function average(values, fallback) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
