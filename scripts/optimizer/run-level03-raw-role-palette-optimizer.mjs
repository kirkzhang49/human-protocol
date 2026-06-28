import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LEVEL_ID = readArg("--level") ?? "level_03_human_museum";
const SOURCE = path.join(ROOT, "scripts/optimizer/level03_raw_role_palette_optimizer.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/level03_raw_role_palette_optimizer");
const PLAN_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `render_plan_${LEVEL_ID}.json`);
const INPUT_PATH = path.join(ROOT, "node_modules/.tmp", `raw_role_palette_metrics_${LEVEL_ID}.tsv`);
const TUNING_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_role_palette_tuning_${LEVEL_ID}.json`);
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu", `raw_role_palette_optimizer_report_${LEVEL_ID}.json`);
const families = positiveInteger(readArg("--families"), 20000);
const candidates = positiveInteger(readArg("--candidates"), 500);

if (!fs.existsSync(PLAN_PATH)) {
  console.error(`Missing render plan: ${path.relative(ROOT, PLAN_PATH)}. Run npm run compile:raw-webgpu-plan first.`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
const roleMetrics = materialRoleMetrics(plan);

fs.mkdirSync(path.dirname(BINARY), { recursive: true });
fs.mkdirSync(path.dirname(TUNING_PATH), { recursive: true });
fs.writeFileSync(INPUT_PATH, metricsTsv(roleMetrics));

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
  maxBuffer: 1024 * 1024 * 24,
});

if (run.status !== 0) {
  process.stderr.write(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}

const summary = JSON.parse(run.stdout);
const tuning = JSON.parse(fs.readFileSync(TUNING_PATH, "utf8"));
if (!tuning.roles || typeof tuning.roles !== "object") {
  console.error("Optimizer output did not include roles.");
  process.exit(1);
}

console.log(
  `PASS raw Level 3 C++ role palette optimizer candidates=${summary.candidatesEvaluated} current=${summary.currentScore.toFixed(3)} best=${summary.bestScore.toFixed(3)} improvement=${summary.improvement.toFixed(3)}`,
);
console.log(`  roles=${Object.keys(tuning.roles).length}`);
console.log(`  tuning=${path.relative(ROOT, TUNING_PATH)}`);
console.log(`  report=${path.relative(ROOT, REPORT_PATH)}`);

function materialRoleMetrics(plan) {
  const display = finalDisplayMetrics(plan);
  const groups = new Map();
  for (const material of plan.geometry?.materials ?? []) {
    if (material.category === "builtin") continue;
    const role = material.visualRole ?? "default";
    const group = groups.get(role) ?? {
      role,
      count: 0,
      weight: 0,
      r: 0,
      g: 0,
      b: 0,
      luma: 0,
      chroma: 0,
      alpha: 0,
      emissive: 0,
      roughness: 0,
      metallic: 0,
      textureWeight: 0,
      textureContrast: 0,
      textureDetail: 0,
      textureChroma: 0,
      profileExposure: display.profileExposure,
      profileContrast: display.profileContrast,
      profileSaturation: display.profileSaturation,
      profileWarmth: display.profileWarmth,
      postExposureScale: display.postExposureScale,
      postContrastScale: display.postContrastScale,
      postSaturationScale: display.postSaturationScale,
      postBlackScale: display.postBlackScale,
      postCyanRedLift: display.postCyanRedLift,
      postCyanGreenScale: display.postCyanGreenScale,
      postCyanBlueScale: display.postCyanBlueScale,
      postCyanNeutralMix: display.postCyanNeutralMix,
    };
    const color = tuple3(material.baseColorFactor, [1, 1, 1]);
    const alpha = number(material.baseColorFactor?.[3], 1);
    const texture = material.textures?.find((slot) => slot.semantic === "baseColor" && Number.isFinite(slot.layer));
    const textureStats = texture?.stats ?? null;
    const textureReadability = textureStats ? clamp(textureStats.contrast * 0.72 + textureStats.detail * 1.35, 0, 1) : 0;
    const roleWeight =
      role === "floor_surface"
        ? 8.5
        : role === "ceiling_surface"
          ? 6.5
          : role === "neutral_surface"
            ? 3.0
            : role === "structural_dark"
              ? 2.2
              : role === "glass_shell"
                ? 2.4
                : role === "route_gold" || role === "danger_red"
                  ? 1.7
                  : role === "robot_body"
                    ? 1.25
                    : 1;
    const weight = roleWeight * (texture ? 1.22 : 0.94) * (0.86 + textureReadability * 0.32);
    const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
    const chroma = Math.max(color[0], color[1], color[2]) - Math.min(color[0], color[1], color[2]);
    group.count += 1;
    group.weight += weight;
    group.r += color[0] * weight;
    group.g += color[1] * weight;
    group.b += color[2] * weight;
    group.luma += luma * weight;
    group.chroma += chroma * weight;
    group.alpha += alpha * weight;
    group.emissive += number(material.emissiveStrength, 0) * weight;
    group.roughness += number(material.roughnessFactor, 0.72) * weight;
    group.metallic += number(material.metallicFactor, 0) * weight;
    if (textureStats) {
      group.textureWeight += weight;
      group.textureContrast += textureStats.contrast * weight;
      group.textureDetail += textureStats.detail * weight;
      group.textureChroma += textureStats.chroma * weight;
    }
    groups.set(role, group);
  }

  return [...groups.values()]
    .sort((left, right) => left.role.localeCompare(right.role))
    .map((group) => {
      const w = group.weight || 1;
      const tw = group.textureWeight || 1;
      return {
        role: group.role,
        count: group.count,
        weight: round(group.weight),
        r: round(group.r / w),
        g: round(group.g / w),
        b: round(group.b / w),
        luma: round(group.luma / w),
        chroma: round(group.chroma / w),
        alpha: round(group.alpha / w),
        emissive: round(group.emissive / w),
        roughness: round(group.roughness / w),
        metallic: round(group.metallic / w),
        textureCoverage: round(group.textureWeight / w),
        textureContrast: round(group.textureWeight > 0 ? group.textureContrast / tw : 0),
        textureDetail: round(group.textureWeight > 0 ? group.textureDetail / tw : 0),
        textureChroma: round(group.textureWeight > 0 ? group.textureChroma / tw : 0),
        profileExposure: group.profileExposure,
        profileContrast: group.profileContrast,
        profileSaturation: group.profileSaturation,
        profileWarmth: group.profileWarmth,
        postExposureScale: group.postExposureScale,
        postContrastScale: group.postContrastScale,
        postSaturationScale: group.postSaturationScale,
        postBlackScale: group.postBlackScale,
        postCyanRedLift: group.postCyanRedLift,
        postCyanGreenScale: group.postCyanGreenScale,
        postCyanBlueScale: group.postCyanBlueScale,
        postCyanNeutralMix: group.postCyanNeutralMix,
      };
    });
}

function finalDisplayMetrics(plan) {
  const profiles = plan.lightingProfiles ?? [];
  const params = plan.rawVisualColorTuning?.params ?? {};
  return {
    profileExposure: round(average(profiles.map((profile) => number(profile.artist?.exposure, 1.1)), 1.1)),
    profileContrast: round(average(profiles.map((profile) => number(profile.artist?.contrast, 1.15)), 1.15)),
    profileSaturation: round(average(profiles.map((profile) => number(profile.artist?.saturation, 1.02)), 1.02)),
    profileWarmth: round(average(profiles.map((profile) => number(profile.artist?.warmth, 0.5)), 0.5)),
    postExposureScale: round(number(params.exposureScale, 1)),
    postContrastScale: round(number(params.contrastScale, 1)),
    postSaturationScale: round(number(params.saturationScale, 1)),
    postBlackScale: round(number(params.blackScale, 1)),
    postCyanRedLift: round(number(params.cyanRedLift, 0)),
    postCyanGreenScale: round(number(params.cyanGreenScale, 1)),
    postCyanBlueScale: round(number(params.cyanBlueScale, 1)),
    postCyanNeutralMix: round(number(params.cyanNeutralMix, 0)),
  };
}

function metricsTsv(rows) {
  const headers = [
    "role",
    "count",
    "weight",
    "r",
    "g",
    "b",
    "luma",
    "chroma",
    "alpha",
    "emissive",
    "roughness",
    "metallic",
    "textureCoverage",
    "textureContrast",
    "textureDetail",
    "textureChroma",
    "profileExposure",
    "profileContrast",
    "profileSaturation",
    "profileWarmth",
    "postExposureScale",
    "postContrastScale",
    "postSaturationScale",
    "postBlackScale",
    "postCyanRedLift",
    "postCyanGreenScale",
    "postCyanBlueScale",
    "postCyanNeutralMix",
  ];
  return `${headers.join("\t")}\n${rows.map((row) => headers.map((header) => row[header]).join("\t")).join("\n")}\n`;
}

function tuple3(value, fallback) {
  return Array.isArray(value) && value.length >= 3 ? [number(value[0], fallback[0]), number(value[1], fallback[1]), number(value[2], fallback[2])] : fallback;
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
