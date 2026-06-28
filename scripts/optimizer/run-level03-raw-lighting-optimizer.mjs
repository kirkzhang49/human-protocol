import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEVEL_ID = readArg("--level") ?? "level_03_human_museum";
const SOURCE = path.join(ROOT, "scripts/optimizer/level03_raw_lighting_algorithm_optimizer.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/level03_raw_lighting_algorithm_optimizer");
const PLAN_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `render_plan_${LEVEL_ID}.json`);
const INPUT_PATH = path.join(ROOT, "node_modules/.tmp", `raw_lighting_profiles_${LEVEL_ID}.tsv`);
const TUNING_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_lighting_algorithm_tuning_${LEVEL_ID}.json`);
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_lighting_algorithm_optimizer_report_${LEVEL_ID}.json`);
const families = positiveInteger(readArg("--families"), 2200);
const candidates = positiveInteger(readArg("--candidates"), 120);

if (!fs.existsSync(PLAN_PATH)) {
  console.error(`Missing render plan: ${path.relative(ROOT, PLAN_PATH)}. Run npm run compile:raw-webgpu-plan first.`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
const rows = lightingRows(plan);
if (rows.length === 0) {
  console.error(`No lightingProfiles in ${path.relative(ROOT, PLAN_PATH)}.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(BINARY), { recursive: true });
fs.mkdirSync(path.dirname(TUNING_PATH), { recursive: true });
fs.writeFileSync(INPUT_PATH, tsv(rows));

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
const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
if (!tuning.rooms || !report.best) {
  console.error("Optimizer output did not include the expected tuning/report shape.");
  process.exit(1);
}

console.log(
  `PASS raw Level 3 C++ lighting optimizer rooms=${summary.rooms} candidates=${families * candidates + 1} current=${summary.currentScore.toFixed(3)} best=${summary.bestScore.toFixed(3)} improvement=${summary.improvement.toFixed(3)}`,
);
console.log(`  tuning=${path.relative(ROOT, TUNING_PATH)}`);
console.log(`  report=${path.relative(ROOT, REPORT_PATH)}`);

function lightingRows(plan) {
  return (plan.lightingProfiles ?? []).map((profile) => ({
    roomId: profile.roomId,
    area: number(profile.inputs?.area, 1),
    height: number(profile.inputs?.height, 4),
    roomLightCount: number(profile.inputs?.roomLightCount, 0),
    floorGlowCount: number(profile.inputs?.floorGlowCount, 0),
    areaLightCount: number(profile.inputs?.areaLightCount, 0),
    spotLightCount: number(profile.inputs?.spotLightCount, 0),
    dynamicLightPressure: number(profile.inputs?.dynamicLightPressure, 0),
    warmLightShare: number(profile.inputs?.warmLightShare, 0),
    cyanLightShare: number(profile.inputs?.cyanLightShare, 0),
    edgeDensity: number(profile.inputs?.edgeDensity, 0.5),
    exposure: number(profile.artist?.exposure, 1),
    contrast: number(profile.artist?.contrast, 1),
    saturation: number(profile.artist?.saturation, 1),
    warmth: number(profile.artist?.warmth, 0.45),
    floor: number(profile.bounce?.floor, 0.24),
    ceiling: number(profile.bounce?.ceiling, 0.24),
    side: number(profile.bounce?.side, 0.22),
    shadowDepth: number(profile.bounce?.shadowDepth, 0.78),
    ao: number(profile.algorithm?.ao, 0.9),
    probe: number(profile.algorithm?.probe, 0.82),
    material: number(profile.algorithm?.material, 0.92),
    localLight: number(profile.algorithm?.localLight, 0.92),
    shadowReceiver: number(profile.algorithm?.shadowReceiver, 0.86),
  }));
}

function tsv(rows) {
  const columns = [
    "roomId",
    "area",
    "height",
    "roomLightCount",
    "floorGlowCount",
    "areaLightCount",
    "spotLightCount",
    "dynamicLightPressure",
    "warmLightShare",
    "cyanLightShare",
    "edgeDensity",
    "exposure",
    "contrast",
    "saturation",
    "warmth",
    "floor",
    "ceiling",
    "side",
    "shadowDepth",
    "ao",
    "probe",
    "material",
    "localLight",
    "shadowReceiver",
  ];
  return `${columns.join("\t")}\n${rows.map((row) => columns.map((column) => row[column]).join("\t")).join("\n")}\n`;
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
