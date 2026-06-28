import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTRY_PATH = path.join(ROOT, "src/game/config/roomPresentationKits.json");
const PLAN_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu/render_plan_level_03_human_museum.json");
const COLOR_AUDIT_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu/raw_color_quality_audit_level_03_human_museum.json");
const REPORT_PATH = path.join(ROOT, "src/assets/manifests/generated/raw-webgpu/museum_lighting_qa_level_03_human_museum.json");

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
const colorAudit = fs.existsSync(COLOR_AUDIT_PATH) ? JSON.parse(fs.readFileSync(COLOR_AUDIT_PATH, "utf8")) : null;
const lighting = registry.lightingPresets["hp:human_museum_gallery_lighting_v1"];

if (!lighting) fail("Missing hp:human_museum_gallery_lighting_v1.");
if (plan.presentation?.lightingPresetId !== "hp:human_museum_gallery_lighting_v1") {
  fail(`Plan is not using museum lighting preset: ${plan.presentation?.lightingPresetId ?? "unknown"}`);
}

const lights = plan.lights ?? [];
const semanticLights = lights.filter((light) => String(light.id ?? "").startsWith("semantic:"));
const coldSemanticLights = semanticLights.filter((light) => cyanScore(light.color) > 0.18);
const roomMetrics = roomLightMetrics(lights);
const colorRoles = Object.fromEntries((colorAudit?.roles ?? []).map((role) => [role.role, role]));
const globalTuning = plan.rawLightingAlgorithmTuning?.global ?? {};
const materials = plan.geometry?.materials ?? [];
const museumRoomMaterials = materials.filter((material) => material.category === "room" && !isGameplayColorTarget(material));
const museumGlassSurfaces = materialMetrics(
  museumRoomMaterials.filter((material) => material.visualRole === "glass_shell"),
);
const museumNeutralSurfaces = materialMetrics(
  museumRoomMaterials.filter((material) =>
    ["neutral_surface", "floor_surface", "ceiling_surface"].includes(material.visualRole),
  ),
);
const museumStructuralSurfaces = materialMetrics(
  museumRoomMaterials.filter((material) => material.visualRole === "structural_dark"),
);
const museumCyanAccents = materialMetrics(
  museumRoomMaterials.filter((material) =>
    ["cyan_emissive", "screen_label", "switch_active"].includes(material.visualRole),
  ),
);
const gameplayColoredTargets = materialMetrics(materials.filter(isGameplayColorTarget));
const requiredBossRoomLightIds = [
  "museum_archive_boss_back_cyan_rim",
  "museum_archive_boss_low_amber_armor_kick",
  "museum_archive_boss_contact_floor_trace",
];
const failures = [];
const warnings = [];
const notes = [];
const registryLightIds = new Set((lighting.lights ?? []).map((light) => light.id));
const planLightIds = new Set(lights.map((light) => light.id));

if (Object.hasOwn(globalTuning, "cyanAreaBudget")) {
  failures.push(`cyanAreaBudget must not be used by museum lighting QA, got ${globalTuning.cyanAreaBudget}`);
}
for (const lightId of requiredBossRoomLightIds) {
  if (!registryLightIds.has(lightId)) failures.push(`museum lighting preset is missing boss room light ${lightId}`);
  if (!planLightIds.has(lightId)) failures.push(`Raw render plan is missing boss room light ${lightId}`);
}
const archiveMetrics = roomMetrics.level_03_central_archive;
if (!archiveMetrics) {
  failures.push("central archive room has no lighting metrics");
} else {
  if (archiveMetrics.count < 7) failures.push(`central archive has too few authored lights for boss readability: ${archiveMetrics.count}`);
  if (archiveMetrics.cyanWeighted < 0.09) failures.push(`central archive boss rim cyan is too weak: ${archiveMetrics.cyanWeighted}`);
  if (archiveMetrics.warmWeighted < archiveMetrics.cyanWeighted * 1.65) {
    failures.push(`central archive boss rim overpowers warm museum read: cyan=${archiveMetrics.cyanWeighted} warm=${archiveMetrics.warmWeighted}`);
  }
}
if (coldSemanticLights.length > 1) {
  failures.push(`too many cold semantic lights: ${coldSemanticLights.length}`);
}
for (const [roomId, metrics] of Object.entries(roomMetrics)) {
  if (metrics.cyanWeighted > 0.18 && metrics.warmWeighted < metrics.cyanWeighted * 1.65) {
    failures.push(`${roomId} has cold wash risk cyan=${round(metrics.cyanWeighted)} warm=${round(metrics.warmWeighted)}`);
  }
  if (metrics.warmWeighted < 0.18 && !/exit/.test(roomId)) {
    warnings.push(`${roomId} has weak warm exhibit island: ${round(metrics.warmWeighted)}`);
  }
}
if (museumGlassSurfaces.count === 0) {
  warnings.push("museum room has no glass_shell material for scoped glass QA");
} else if (museumGlassSurfaces.cyan > 0.42) {
  failures.push(`museum room glass cyan pressure too high: ${museumGlassSurfaces.cyan}`);
}
if (museumNeutralSurfaces.count === 0) {
  failures.push("museum room has no neutral/floor/ceiling surfaces for scoped surface QA");
} else if (museumNeutralSurfaces.cyan > 0.22) {
  failures.push(`museum neutral surface cyan pressure too high: ${museumNeutralSurfaces.cyan}`);
}
if (museumStructuralSurfaces.count > 0 && museumStructuralSurfaces.luma > 0.18) {
  warnings.push(`museum structural surfaces may be too lifted for gallery shadows: ${museumStructuralSurfaces.luma}`);
}
if (museumCyanAccents.count > 6 || museumCyanAccents.cyan > 0.64) {
  warnings.push(
    `museum cyan accents are still prominent count=${museumCyanAccents.count} cyan=${museumCyanAccents.cyan}`,
  );
}
if ((colorRoles.glass_shell?.cyan ?? 0) > 0.72) {
  notes.push(
    `legacy aggregate glass_shell cyan=${colorRoles.glass_shell.cyan}; museum QA scopes this to room glass and tracks puzzle orbs separately`,
  );
}

const report = {
  schemaVersion: "hp.museum-lighting-qa.v2",
  generatedAt: new Date().toISOString(),
  levelId: "level_03_human_museum",
  preset: lighting.id,
  plan: path.relative(ROOT, PLAN_PATH),
  metrics: {
    ok: failures.length === 0,
    lightCount: lights.length,
    semanticLightCount: semanticLights.length,
    coldSemanticLightCount: coldSemanticLights.length,
    roomMetrics,
    museumSurfaces: {
      glass_shell: museumGlassSurfaces,
      neutral_floor_ceiling: museumNeutralSurfaces,
      structural_dark: museumStructuralSurfaces,
      cyan_accents: museumCyanAccents,
    },
    gameplayColoredTargets,
    colorRoles: {
      glass_shell: colorRoles.glass_shell ?? null,
      neutral_surface: colorRoles.neutral_surface ?? null,
      structural_dark: colorRoles.structural_dark ?? null,
      exhibit_warm: colorRoles.exhibit_warm ?? null,
    },
  },
  failures,
  warnings,
  notes,
};

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length > 0) {
  fail(`Museum lighting QA failed: ${failures.join("; ")}`);
}

console.log(
  `PASS museum lighting QA preset=${lighting.id} lights=${lights.length} semantic=${semanticLights.length} coldSemantic=${coldSemanticLights.length} report=${path.relative(ROOT, REPORT_PATH)}`,
);

function roomLightMetrics(lightList) {
  const byRoom = {};
  for (const light of lightList) {
    const roomId = light.roomId ?? "global";
    byRoom[roomId] ??= { count: 0, cyanWeighted: 0, warmWeighted: 0, intensity: 0 };
    const intensity = Math.max(0, Number(light.intensity ?? light.opacity ?? 0));
    byRoom[roomId].count += 1;
    byRoom[roomId].intensity += intensity;
    byRoom[roomId].cyanWeighted += cyanScore(light.color) * intensity;
    byRoom[roomId].warmWeighted += warmScore(light.color) * intensity;
  }
  return Object.fromEntries(
    Object.entries(byRoom).map(([roomId, value]) => [
      roomId,
      {
        count: value.count,
        cyanWeighted: round(value.cyanWeighted),
        warmWeighted: round(value.warmWeighted),
        intensity: round(value.intensity),
      },
    ]),
  );
}

function materialMetrics(materialList) {
  const totals = { luma: 0, chroma: 0, cyan: 0, warm: 0 };
  for (const material of materialList) {
    const rgb = rgbFromMaterial(material);
    totals.luma += lumaScore(rgb);
    totals.chroma += chromaScore(rgb);
    totals.cyan += cyanScoreRgb(rgb);
    totals.warm += warmScoreRgb(rgb);
  }
  const divisor = Math.max(1, materialList.length);
  return {
    count: materialList.length,
    luma: round(totals.luma / divisor),
    chroma: round(totals.chroma / divisor),
    cyan: round(totals.cyan / divisor),
    warm: round(totals.warm / divisor),
    materials: materialList.map((material) => material.name).sort(),
  };
}

function isGameplayColorTarget(material) {
  return /^puzzle_orb_/i.test(String(material.name ?? ""));
}

function cyanScore(color) {
  return cyanScoreRgb(hexRgb(color));
}

function warmScore(color) {
  return warmScoreRgb(hexRgb(color));
}

function cyanScoreRgb([r, g, b]) {
  return clamp(Math.min(g, b) - r * 0.85, 0, 1);
}

function warmScoreRgb([r, g, b]) {
  return clamp(r * 0.65 + g * 0.35 - b, 0, 1);
}

function lumaScore([r, g, b]) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function chromaScore([r, g, b]) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function rgbFromMaterial(material) {
  const color = Array.isArray(material.baseColorFactor) ? material.baseColorFactor : [0, 0, 0];
  return [
    clamp(Number(color[0] ?? 0), 0, 1),
    clamp(Number(color[1] ?? 0), 0, 1),
    clamp(Number(color[2] ?? 0), 0, 1),
  ];
}

function hexRgb(value) {
  const normalized = String(value ?? "#000000").trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return [0, 0, 0];
  const number = Number.parseInt(normalized, 16);
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(6));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
