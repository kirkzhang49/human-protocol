import fs from "node:fs";
import path from "node:path";
import { readArg } from "../lib/cli.mjs";
import { gameRootFromScript, relativeToRoot, resolveFromRoot } from "../lib/paths.mjs";
import { rawWebGpuGeneratedManifestPath } from "../lib/raw-webgpu-manifests.mjs";

const ROOT = gameRootFromScript(import.meta.url);
const LEVEL_ID = readArg("--level") ?? "level_03_human_museum";
const PLAN_PATH = resolveFromRoot(ROOT, readArg("--plan") ?? rawWebGpuGeneratedManifestPath(ROOT, "renderPlan", LEVEL_ID));
const REPORT_PATH = resolveFromRoot(ROOT, readArg("--report") ?? rawWebGpuGeneratedManifestPath(ROOT, "colorQualityAudit", LEVEL_ID));
const FAIL_ON_WARN = readArg("--fail-on-warn") === "1";

if (!fs.existsSync(PLAN_PATH)) {
  console.error(`Missing render plan: ${relativeToRoot(ROOT, PLAN_PATH)}. Run npm run compile:raw-webgpu-plan first.`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
const roles = summarizeRoles(plan);
const museumScopes = summarizeMuseumScopes(plan);
const issues = auditRoles(roles, { museumScopes });
const report = {
  schemaVersion: "hp.raw-webgpu.color-quality-audit.v2",
  generatedAt: new Date().toISOString(),
  levelId: LEVEL_ID,
  plan: relativeToRoot(ROOT, PLAN_PATH),
  roleCount: roles.length,
  roles,
  museumScopes,
  issues,
  status: issues.some((issue) => issue.severity === "error") || (FAIL_ON_WARN && issues.length > 0) ? "fail" : "pass",
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

const issueText = issues.length ? ` issues=${issues.length}` : "";
console.log(`PASS raw WebGPU color quality audit level=${LEVEL_ID} roles=${roles.length}${issueText}`);
console.log(`  report=${relativeToRoot(ROOT, REPORT_PATH)}`);
for (const issue of issues.slice(0, 8)) {
  console.log(`  ${issue.severity.toUpperCase()} ${issue.role}: ${issue.message}`);
}

if (report.status === "fail") process.exit(1);

function summarizeRoles(renderPlan) {
  const groups = new Map();
  for (const material of renderPlan.geometry?.materials ?? []) {
    if (material.category === "builtin") continue;
    const role = material.visualRole ?? "default";
    const group = groups.get(role) ?? {
      role,
      count: 0,
      semanticId: material.semanticParams?.[0] ?? null,
      roleIdMismatches: 0,
      paletteMix: 0,
      luma: 0,
      chroma: 0,
      cyan: 0,
      warm: 0,
      textureCoverage: 0,
    };
    const sourceColor = tuple3(material.baseColorFactor, [1, 1, 1]);
    const color = resolvedRoleColor(sourceColor, material);
    const texture = material.textures?.find((slot) => slot.semantic === "baseColor" && Number.isFinite(slot.layer));
    const expectedId = roleId(role);
    const semanticId = material.semanticParams?.[0];
    if (semanticId !== expectedId) group.roleIdMismatches += 1;
    group.count += 1;
    group.paletteMix += number(material.paletteColorFactor?.[3], 0);
    group.luma += luma(color);
    group.chroma += chroma(color);
    group.cyan += cyanScore(color);
    group.warm += warmScore(color);
    group.textureCoverage += texture ? 1 : 0;
    group.semanticId = semanticId;
    groups.set(role, group);
  }
  return [...groups.values()]
    .sort((left, right) => left.role.localeCompare(right.role))
    .map((group) => ({
      role: group.role,
      count: group.count,
      expectedSemanticId: roleId(group.role),
      semanticId: group.semanticId,
      roleIdMismatches: group.roleIdMismatches,
      paletteMix: round(group.paletteMix / Math.max(1, group.count)),
      luma: round(group.luma / Math.max(1, group.count)),
      chroma: round(group.chroma / Math.max(1, group.count)),
      cyan: round(group.cyan / Math.max(1, group.count)),
      warm: round(group.warm / Math.max(1, group.count)),
      textureCoverage: round(group.textureCoverage / Math.max(1, group.count)),
    }));
}

function auditRoles(roles, options = {}) {
  const issues = [];
  const museumSurfaceRoles = new Map((options.museumScopes?.surfaceRoles ?? []).map((role) => [role.role, role]));
  for (const role of roles) {
    if (role.roleIdMismatches > 0) {
      issues.push({
        severity: "error",
        role: role.role,
        message: `${role.roleIdMismatches}/${role.count} materials have the wrong semantic role id`,
      });
    }
    const scopedSurfaceRole = museumSurfaceRoles.get(role.role) ?? role;
    if (
      ["neutral_surface", "floor_surface", "ceiling_surface", "structural_dark", "glass_shell"].includes(role.role) &&
      scopedSurfaceRole.count > 0 &&
      scopedSurfaceRole.cyan > 0.62
    ) {
      issues.push({
        severity: "warn",
        role: role.role,
        message: `museum room surface cyan pressure ${scopedSurfaceRole.cyan} is high; authored room material should be rebalanced`,
      });
    }
    if (["route_gold", "danger_red", "exhibit_warm", "door_locked_red", "pickup_energy", "pickup_key", "switch_inactive"].includes(role.role) && role.warm < 0.24) {
      issues.push({
        severity: "warn",
        role: role.role,
        message: `warm/accent pressure ${role.warm} is weak; accents may disappear into the blue scene`,
      });
    }
    if (["door_access_cyan", "switch_active"].includes(role.role) && role.cyan < 0.28) {
      issues.push({
        severity: "warn",
        role: role.role,
        message: `status cyan pressure ${role.cyan} is weak; access affordance may read as a flat wall prop`,
      });
    }
    if (role.paletteMix <= 0.01 && role.role !== "default") {
      issues.push({
        severity: "warn",
        role: role.role,
        message: "role has no palette mix, so the offline solver is not affecting it",
      });
    }
  }
  return issues;
}

function summarizeMuseumScopes(renderPlan) {
  if (renderPlan.presentation?.lightingPresetId !== "hp:human_museum_gallery_lighting_v1") return null;
  const materials = (renderPlan.geometry?.materials ?? []).filter((material) => material.category !== "builtin");
  const roomMaterials = materials.filter((material) => material.category === "room" && !isGameplayColorTarget(material));
  return {
    surfaceRoles: summarizeMaterialGroups(
      roomMaterials.filter((material) =>
        ["neutral_surface", "floor_surface", "ceiling_surface", "structural_dark", "glass_shell"].includes(
          material.visualRole ?? "default",
        ),
      ),
      (material) => material.visualRole ?? "default",
    ),
    cyanAccents: summarizeMaterialGroup(
      roomMaterials.filter((material) =>
        ["cyan_emissive", "screen_label", "switch_active"].includes(material.visualRole ?? "default"),
      ),
      "museum_room_cyan_accents",
    ),
    gameplayColoredTargets: summarizeMaterialGroup(materials.filter(isGameplayColorTarget), "gameplay_colored_targets"),
  };
}

function summarizeMaterialGroups(materials, keyForMaterial) {
  const groups = new Map();
  for (const material of materials) {
    const key = keyForMaterial(material);
    groups.set(key, [...(groups.get(key) ?? []), material]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([role, groupMaterials]) => summarizeMaterialGroup(groupMaterials, role));
}

function summarizeMaterialGroup(materials, role) {
  const summary = {
    role,
    count: 0,
    luma: 0,
    chroma: 0,
    cyan: 0,
    warm: 0,
    textureCoverage: 0,
    materials: [],
  };
  for (const material of materials) {
    const sourceColor = tuple3(material.baseColorFactor, [1, 1, 1]);
    const color = resolvedRoleColor(sourceColor, material);
    const texture = material.textures?.find((slot) => slot.semantic === "baseColor" && Number.isFinite(slot.layer));
    summary.count += 1;
    summary.luma += luma(color);
    summary.chroma += chroma(color);
    summary.cyan += cyanScore(color);
    summary.warm += warmScore(color);
    summary.textureCoverage += texture ? 1 : 0;
    summary.materials.push(material.name);
  }
  const count = Math.max(1, summary.count);
  return {
    role,
    count: summary.count,
    luma: round(summary.luma / count),
    chroma: round(summary.chroma / count),
    cyan: round(summary.cyan / count),
    warm: round(summary.warm / count),
    textureCoverage: round(summary.textureCoverage / count),
    materials: summary.materials.sort(),
  };
}

function isGameplayColorTarget(material) {
  return /^puzzle_orb_/i.test(String(material.name ?? ""));
}

function roleId(role) {
  return (
    {
      default: 0,
      neutral_surface: 1,
      floor_surface: 2,
      ceiling_surface: 3,
      structural_dark: 4,
      glass_shell: 5,
      exhibit_warm: 6,
      cyan_emissive: 7,
      route_gold: 8,
      danger_red: 9,
      screen_label: 10,
      robot_body: 11,
      door_locked_red: 12,
      door_access_cyan: 13,
      pickup_health: 14,
      pickup_energy: 15,
      pickup_ammo: 16,
      pickup_key: 17,
      switch_active: 18,
      switch_inactive: 19,
    }[role] ?? 0
  );
}

function resolvedRoleColor(color, material) {
  const palette = Array.isArray(material.paletteColorFactor) ? material.paletteColorFactor : [0, 0, 0, 0];
  const semantic = Array.isArray(material.semanticParams) ? material.semanticParams : [0, 0, 0, 0];
  const mixValue = clamp(number(palette[3], 0) * clamp(number(semantic[1], 0.4) + 0.16, 0, 1), 0, 0.96);
  if (mixValue <= 0.001) return color;
  const y = Math.max(luma(color), 0.012);
  const paletteColor = tuple3(palette, [color[0], color[1], color[2]]);
  const paletteY = Math.max(luma(paletteColor), 0.012);
  const role = material.visualRole ?? "default";
  const directWeight =
    role === "glass_shell"
      ? 0.86
      : role === "structural_dark" || role === "ceiling_surface"
        ? 0.58
        : role === "floor_surface"
          ? 0.46
          : ["door_locked_red", "pickup_energy", "pickup_key", "switch_inactive"].includes(role)
            ? 0.24
            : ["door_access_cyan", "switch_active"].includes(role)
              ? 0.18
          : 0;
  const preserveTarget = paletteColor.map((value) => value * (y / paletteY));
  const directTarget = paletteColor.map((value) => value * mix(0.74, 1.14, smoothstep(0.10, 0.72, y)));
  const target = preserveTarget.map((value, index) => mix(value, directTarget[index], directWeight));
  return color.map((value, index) => clamp(mix(value, target[index], mixValue), 0, 1.5));
}

function tuple3(value, fallback) {
  return Array.isArray(value) && value.length >= 3 ? [number(value[0], fallback[0]), number(value[1], fallback[1]), number(value[2], fallback[2])] : fallback;
}

function luma(color) {
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

function number(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
