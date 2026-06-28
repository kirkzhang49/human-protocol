import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEVEL_ID = readArg("--level") ?? "level_03_human_museum";
const SOURCE = path.join(ROOT, "scripts/optimizer/museum_lighting_director_solver.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/museum_lighting_director_solver");
const PLAN_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `render_plan_${LEVEL_ID}.json`);
const INPUT_PATH = path.join(ROOT, "node_modules/.tmp", `museum_lighting_director_${LEVEL_ID}.tsv`);
const TUNING_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_museum_lighting_director_tuning_${LEVEL_ID}.json`);
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_museum_lighting_director_report_${LEVEL_ID}.json`);
const families = positiveInteger(readArg("--families"), 12000);
const candidates = positiveInteger(readArg("--candidates"), 80);

if (!fs.existsSync(PLAN_PATH)) {
  console.error(`Missing render plan: ${path.relative(ROOT, PLAN_PATH)}. Run npm run compile:raw-webgpu-plan first.`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
const samples = directorSamples(plan);
if (samples.length === 0) {
  console.error("No render-plan material/light samples were available for the museum lighting director solver.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(BINARY), { recursive: true });
fs.mkdirSync(path.dirname(TUNING_PATH), { recursive: true });
fs.writeFileSync(INPUT_PATH, samplesTsv(samples));

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
console.log(
  `PASS museum lighting director solver samples=${summary.samples} candidates=${summary.candidatesEvaluated} best=${summary.bestScore.toFixed(3)}`,
);
console.log(`  tuning=${path.relative(ROOT, TUNING_PATH)}`);
console.log(`  report=${path.relative(ROOT, REPORT_PATH)}`);

function directorSamples(plan) {
  const materialSamples = (plan.geometry?.materials ?? [])
    .filter((material) => material.category !== "builtin")
    .map((material) => {
      const color = tuple3(material.paletteColorFactor ?? material.baseColorFactor, [1, 1, 1]);
      const textureStats = material.textures?.find((slot) => slot.semantic === "baseColor" && slot.stats)?.stats ?? null;
      const emissive = Math.max(tuple3(material.emissiveFactor, [0, 0, 0]).reduce((max, value) => Math.max(max, value), 0), number(material.emissiveStrength, 0));
      return {
        role: material.visualRole ?? material.category ?? material.name ?? "material",
        weight: roleWeight(material.visualRole ?? material.category),
        luma: luminance(color),
        chroma: chroma(color),
        cyan: cyanScore(color),
        warm: warmScore(color),
        texture: textureStats ? clamp(textureStats.contrast * 0.72 + textureStats.detail * 1.35, 0, 1) : 0,
        transparent: material.alphaMode === "BLEND" || material.visualRole === "glass_shell" ? 1 : 0,
        emissive: clamp(emissive, 0, 3),
      };
    });
  const lightSamples = (plan.lights ?? []).map((light) => {
    const color = hexToRgb(light.color);
    return {
      role: light.semanticRole ?? light.type ?? "light",
      weight: clamp(number(light.intensity, 1) * 0.35, 0.1, 2.5),
      luma: luminance(color),
      chroma: chroma(color),
      cyan: cyanScore(color),
      warm: warmScore(color),
      texture: 0,
      transparent: 0,
      emissive: clamp(number(light.intensity, 1) * 0.32, 0, 2),
    };
  });
  return [...materialSamples, ...lightSamples];
}

function samplesTsv(samples) {
  const columns = ["role", "weight", "luma", "chroma", "cyan", "warm", "texture", "transparent", "emissive"];
  return `${columns.join("\t")}\n${samples.map((sample) => columns.map((column) => sample[column]).join("\t")).join("\n")}\n`;
}

function roleWeight(role) {
  const key = String(role ?? "").toLowerCase();
  if (/floor|wall|ceiling|neutral|structural/.test(key)) return 1.35;
  if (/glass/.test(key)) return 1.25;
  if (/door|danger|route|pickup|screen/.test(key)) return 1.1;
  return 0.85;
}

function luminance(color) {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function chroma(color) {
  return Math.max(...color) - Math.min(...color);
}

function cyanScore(color) {
  return clamp(color[1] * 0.45 + color[2] * 0.62 - color[0] * 0.34, 0, 1);
}

function warmScore(color) {
  return clamp(color[0] * 0.78 + color[1] * 0.28 - color[2] * 0.34, 0, 1);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
