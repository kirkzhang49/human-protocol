import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTRY_PATH = path.join(ROOT, "src/game/config/roomPresentationKits.json");
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/reports/human_protocol_level01_lighting_math_report.json");

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const shell = registry.shellKits["hp:industrial_panel_arena_shell_v3_art_pass"];
const lighting = registry.lightingPresets["hp:cyan_lockdown_arena_v5_age_director"];

if (!shell || !lighting) {
  fail("Missing Level 1 art-pass shell or lighting preset.");
}

const room = {
  id: "maintenance_bay_floor",
  center: [0, 0, -3.2],
  size: [18, 4, 25],
};

const diagnosticSamples = [
  { id: "player_start", role: "readability", position: [0, 1.0, 8] },
  { id: "center_lane", role: "combat", position: [0, 1.0, -3.2] },
  { id: "repair_bay", role: "hero_prop", position: [-2.8, 1.0, 6.8] },
  { id: "repair_pickup", role: "pickup", position: [3.8, 0.75, 5.5] },
  { id: "energy_pickup", role: "pickup", position: [4.65, 0.75, 5.15] },
  { id: "elevator_door", role: "exit", position: [0, 1.2, -14.5] },
  { id: "hero_screen", role: "focus", position: [0, 1.55, 8.3] },
  { id: "enemy_left_spawn", role: "enemy", position: [-6.48, 1.0, 5.8] },
  { id: "enemy_right_spawn", role: "enemy", position: [6.12, 1.0, 5.3] },
];

const lightEntries = lighting.lights.map((light) => ({
  ...light,
  worldPosition: resolveLightPosition(light),
  worldTarget: resolveLightTarget(light),
  linearLuminance: hexLuminance(light.color),
}));

const sampleReports = diagnosticSamples.map((sample) => {
  const unlockedLuminance = estimateSampleLuminance(sample, "unlocked");
  const lockedLuminance = estimateSampleLuminance(sample, "locked");
  return {
    id: sample.id,
    role: sample.role,
    position: sample.position,
    unlockedLuminance: round(unlockedLuminance),
    lockedLuminance: round(lockedLuminance),
  };
});

const dynamicLightCount = lightEntries.filter((light) => light.type === "point" || light.type === "spot" || light.type === "area").length;
const shadowCastingSpotCount = lightEntries.filter((light) => light.type === "spot" && light.castShadow).length;
const pickupMinimum = minForRoles(sampleReports, ["pickup"]);
const criticalMinimum = minForRoles(sampleReports, ["readability", "combat", "pickup", "exit", "enemy"]);
const brightestSample = Math.max(...sampleReports.map((sample) => Math.max(sample.unlockedLuminance, sample.lockedLuminance)));
const centerSample = sampleReports.find((sample) => sample.id === "center_lane");
const elevatorSample = sampleReports.find((sample) => sample.id === "elevator_door");
const elevatorLockedContrast = weberContrast(elevatorSample.lockedLuminance, centerSample.lockedLuminance);
const elevatorUnlockedContrast = weberContrast(elevatorSample.unlockedLuminance, centerSample.unlockedLuminance);
const elevatorStateColorSeparation = round(colorDistance(doorStateColorVector("locked"), doorStateColorVector("unlocked")));
const reflectionLayerScore = round((shell.floorReflectionOpacity ?? 0) * (shell.floorReflectionStrength ?? 0) * 2.5);
const ambientFlattenRisk = round((lighting.ambient.intensity ?? 0) + (lighting.hemisphereIntensity ?? 0) * 0.65 + (lighting.directional?.intensity ?? 0) * 0.18);

const hardFails = [];
if (criticalMinimum < 0.16) hardFails.push(`critical luminance too low: ${criticalMinimum}`);
if (pickupMinimum < 0.22) hardFails.push(`pickup luminance too low: ${pickupMinimum}`);
if (elevatorLockedContrast < 0.12 && elevatorStateColorSeparation < 0.42) {
  hardFails.push(`locked elevator contrast/color separation too low: contrast=${elevatorLockedContrast} color=${elevatorStateColorSeparation}`);
}
if (elevatorUnlockedContrast < 0.08) hardFails.push(`unlocked elevator contrast too low: ${elevatorUnlockedContrast}`);
if (brightestSample > 1.65) hardFails.push(`overexposure risk too high: ${round(brightestSample)}`);
if (ambientFlattenRisk > 0.42) hardFails.push(`global fill is flattening the art: ${ambientFlattenRisk}`);
if (reflectionLayerScore < 0.34) hardFails.push(`floor reflection layer too weak: ${reflectionLayerScore}`);
if (dynamicLightCount > 12) hardFails.push(`dynamic light budget exceeded: ${dynamicLightCount}`);
if (shadowCastingSpotCount > 3) hardFails.push(`shadowed spot budget exceeded: ${shadowCastingSpotCount}`);

const report = {
  id: "human_protocol_level01_lighting_math_report",
  generatedAt: new Date().toISOString(),
  source: {
    registryPath: "src/game/config/roomPresentationKits.json",
    lightingPreset: lighting.id,
    shellKit: shell.id,
    mathFirstReferences: [
      "webgpu-robot-lab/docs/MATH_FIRST_AGENT_3D_ENGINE.md",
      "webgpu-robot-lab/scripts/render-human-protocol-level01-room-preview.py",
    ],
  },
  formulas: {
    linearLuminance: "Y = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear",
    weberContrast: "(mean(Y_object) - mean(Y_background)) / (mean(Y_background) + eps)",
    runtimeEstimate: "ambient + hemisphere + directional + inverse-square point/spot + projected area + floor glow/reflection proxy",
  },
  thresholds: {
    criticalMinimum: 0.16,
    pickupMinimum: 0.22,
    lockedElevatorContrast: 0.12,
    lockedElevatorColorSeparationFallback: 0.42,
    unlockedElevatorContrast: 0.08,
    brightestSampleMax: 1.65,
    ambientFlattenRiskMax: 0.42,
    reflectionLayerMinimum: 0.34,
    dynamicLightBudget: 12,
    shadowedSpotBudget: 3,
  },
  metrics: {
    ok: hardFails.length === 0,
    criticalMinimum,
    pickupMinimum,
    brightestSample: round(brightestSample),
    elevatorLockedContrast,
    elevatorUnlockedContrast,
    elevatorStateColorSeparation,
    ambientFlattenRisk,
    reflectionLayerScore,
    dynamicLightCount,
    shadowCastingSpotCount,
  },
  samples: sampleReports,
  hardFails,
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (!report.metrics.ok) {
  fail(`Lighting QA failed: ${hardFails.join("; ")}`);
}

console.log(
  `PASS lighting QA preset=${lighting.id} critical=${criticalMinimum} pickups=${pickupMinimum} elevatorLockedContrast=${elevatorLockedContrast} lights=${dynamicLightCount}`,
);

function estimateSampleLuminance(sample, state) {
  const ambient = hexLuminance(lighting.ambient.color) * lighting.ambient.intensity * 1.35;
  const hemisphere = hexLuminance("#9cefff") * (lighting.hemisphereIntensity ?? 0) * 0.42;
  const directional = hexLuminance(lighting.directional?.color ?? "#ffffff") * (lighting.directional?.intensity ?? 0) * 0.18;
  const floorReflection = (shell.floorReflectionOpacity ?? 0) * (shell.floorReflectionStrength ?? 0) * 0.58;
  const directLights = lightEntries.reduce((sum, light) => sum + estimateLightContribution(light, sample.position, state), 0);
  return round(ambient + hemisphere + directional + floorReflection + directLights);
}

function estimateLightContribution(light, samplePosition, state) {
  const color = state === "unlocked" && light.unlockedColor ? light.unlockedColor : state === "locked" && light.lockedColor ? light.lockedColor : light.color;
  const luminance = hexLuminance(color);
  const intensity = light.lockdownIntensity ?? light.intensity ?? 0;
  if (light.type === "floor_glow") {
    const position = light.worldPosition;
    const scale = light.scale ?? resolveRoomRelativeScale(light.scaleRoomRelative ?? [0.5, 0.5]);
    const normalizedX = Math.abs(samplePosition[0] - position[0]) / Math.max(0.001, scale[0] * 0.5);
    const normalizedZ = Math.abs(samplePosition[2] - position[2]) / Math.max(0.001, scale[1] * 0.5);
    const falloff = Math.max(0, 1 - Math.sqrt(normalizedX * normalizedX + normalizedZ * normalizedZ));
    return luminance * (light.lockdownOpacity ?? light.opacity ?? 0) * 4.4 * falloff;
  }

  const distance = vecDistance(light.worldPosition, samplePosition);
  if (light.type === "area") {
    const area = Math.max(0.1, (light.width ?? 1) * (light.height ?? 1));
    const targetFactor = targetAlignmentFactor(light, samplePosition, 0.3);
    return luminance * intensity * Math.sqrt(area) * targetFactor / (distance * distance + 1.1);
  }

  const distanceLimit = light.distance ?? 8;
  const rangeFalloff = Math.max(0, 1 - distance / distanceLimit);
  const inverseFalloff = 1 / (1 + (distance / Math.max(0.1, distanceLimit * 0.45)) ** 2);
  if (light.type === "spot") {
    return luminance * intensity * rangeFalloff * inverseFalloff * targetAlignmentFactor(light, samplePosition, 0.08) * 0.95;
  }
  return luminance * intensity * rangeFalloff * inverseFalloff * 0.92;
}

function targetAlignmentFactor(light, samplePosition, minimum) {
  if (!light.worldTarget) return 1;
  const lightToTarget = normalize(vecSub(light.worldTarget, light.worldPosition));
  const lightToSample = normalize(vecSub(samplePosition, light.worldPosition));
  const dot = Math.max(0, vecDot(lightToTarget, lightToSample));
  const shaped = dot ** 2.2;
  return Math.max(minimum, shaped);
}

function resolveLightPosition(light) {
  if (light.position) return light.position;
  if (light.roomRelative) return resolveRoomRelativePosition(light.roomRelative);
  return [0, 0, 0];
}

function resolveLightTarget(light) {
  if (light.target) return light.target;
  if (light.targetRoomRelative) return resolveRoomRelativePosition(light.targetRoomRelative);
  return null;
}

function resolveRoomRelativePosition(position) {
  return [room.center[0] + position[0] * room.size[0], position[1], room.center[2] + position[2] * room.size[2]];
}

function resolveRoomRelativeScale(scaleRoomRelative) {
  return [room.size[0] * scaleRoomRelative[0], room.size[2] * scaleRoomRelative[1]];
}

function hexLuminance(hex) {
  const [r, g, b] = hexLinearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function doorStateColorVector(state) {
  const statusLights = lightEntries.filter((light) => light.doorId === "service_elevator_door");
  const weighted = statusLights.reduce(
    (acc, light) => {
      const color = state === "unlocked" && light.unlockedColor ? light.unlockedColor : state === "locked" && light.lockedColor ? light.lockedColor : light.color;
      const rgb = hexLinearRgb(color);
      const weight = Math.max(0.01, light.lockdownIntensity ?? light.intensity ?? light.opacity ?? 0.01);
      acc.rgb[0] += rgb[0] * weight;
      acc.rgb[1] += rgb[1] * weight;
      acc.rgb[2] += rgb[2] * weight;
      acc.weight += weight;
      return acc;
    },
    { rgb: [0, 0, 0], weight: 0 },
  );
  if (weighted.weight <= 0) return [0, 0, 0];
  return weighted.rgb.map((channel) => channel / weighted.weight);
}

function colorDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function hexLinearRgb(hex) {
  return hexToRgb(hex).map((component) => srgbToLinear(component / 255));
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((digit) => digit + digit).join("") : normalized;
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function minForRoles(samples, roles) {
  return round(Math.min(...samples.filter((sample) => roles.includes(sample.role)).map((sample) => Math.min(sample.unlockedLuminance, sample.lockedLuminance))));
}

function weberContrast(objectLuminance, backgroundLuminance) {
  return round((objectLuminance - backgroundLuminance) / (backgroundLuminance + 0.001));
}

function vecDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= 0.00001) return [0, 0, 0];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function round(value) {
  return Number(value.toFixed(4));
}

function fail(message) {
  throw new Error(message);
}
