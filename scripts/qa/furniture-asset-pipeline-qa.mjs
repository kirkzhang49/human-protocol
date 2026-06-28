import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MANIFEST_PATH = join(ROOT, "src/assets/manifests/runtime/human_protocol_furniture_asset_factory_v1.json");
const REPORT_JSON = join(ROOT, "src/assets/manifests/reports/furniture_asset_factory_qa_report.json");
const REPORT_MD = join(ROOT, "src/assets/manifests/reports/furniture_asset_factory_qa_report.md");

const buildReadyRequiredPathFields = ["sourceBlend", "rawGlb", "cookedGlb", "thumbnail"];
const runtimeRequiredPathFields = ["sourceBlend", "cookedGlb", "thumbnail", "rawWebgpuSidecar"];
const allowedReadiness = new Set(["blueprint-ready", "source-ready", "raw-ready", "build-ready", "runtime-ready"]);
const modelKeyPattern = /^[a-z0-9][a-z0-9_:-]*[a-z0-9]$/;

if (!existsSync(MANIFEST_PATH)) {
  console.error(`Missing furniture pipeline manifest: ${relative(ROOT, MANIFEST_PATH)}`);
  process.exit(1);
}

const manifest = readJson(MANIFEST_PATH);
const report = {
  schema: "human-protocol/furniture-asset-factory-qa@1",
  generatedAt: new Date().toISOString(),
  manifest: relative(ROOT, MANIFEST_PATH),
  counts: {
    blueprints: 0,
    buildReady: 0,
    runtimeReady: 0,
    pendingAssets: 0,
    errors: 0,
    warnings: 0,
    checks: 0,
  },
  checks: [],
  assets: [],
  errors: [],
  warnings: [],
};

check("manifest schema is correct", manifest.schema === "human-protocol/furniture-asset-factory@1", {
  schema: manifest.schema,
});
check("pipeline stages exist", Array.isArray(manifest.pipelineStages) && manifest.pipelineStages.length >= 5, {
  stages: manifest.pipelineStages?.map((stage) => stage.id) ?? [],
});
check("registry targets exist", Array.isArray(manifest.registryTargets) && manifest.registryTargets.length >= 3, {
  targets: manifest.registryTargets?.map((target) => target.id) ?? [],
});

const requiredFields = Array.isArray(manifest.requiredBlueprintFields) ? manifest.requiredBlueprintFields : [];
const blueprints = Array.isArray(manifest.blueprints) ? manifest.blueprints : [];
check("blueprints array is not empty", blueprints.length > 0, { count: blueprints.length });

const seenModelKeys = new Set();
for (const asset of blueprints) {
  report.counts.blueprints += 1;
  const assetReport = {
    modelKey: asset.modelKey ?? "(missing)",
    readiness: asset.readiness ?? "(missing)",
    status: "pass",
    missingFields: [],
    pendingPaths: [],
    missingPaths: [],
    registry: [],
    warnings: [],
  };

  for (const field of requiredFields) {
    if (!hasValue(asset[field])) {
      assetReport.missingFields.push(field);
      error(`${assetReport.modelKey}: missing required field ${field}`, { field });
    }
  }

  if (typeof asset.modelKey !== "string" || !modelKeyPattern.test(asset.modelKey)) {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: modelKey must be lowercase config-safe text`, { modelKey: asset.modelKey });
  }

  if (seenModelKeys.has(asset.modelKey)) {
    assetReport.status = "fail";
    error(`${asset.modelKey}: duplicate modelKey`, { modelKey: asset.modelKey });
  }
  seenModelKeys.add(asset.modelKey);

  if (!allowedReadiness.has(asset.readiness)) {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: invalid readiness`, { readiness: asset.readiness });
  }

  validateScale(asset, assetReport);
  validateArrays(asset, assetReport);
  validateCollision(asset, assetReport);
  validateRuntimeContent(asset, assetReport);
  validatePathPlan(asset, assetReport);
  validateRegistryTargets(asset, assetReport);

  if (asset.readiness === "build-ready") report.counts.buildReady += 1;
  if (asset.readiness === "runtime-ready") report.counts.runtimeReady += 1;
  if (assetReport.pendingPaths.length > 0 || !["build-ready", "runtime-ready"].includes(asset.readiness)) report.counts.pendingAssets += 1;
  if (assetReport.missingFields.length > 0 || assetReport.missingPaths.length > 0) assetReport.status = "fail";

  report.assets.push(assetReport);
}

report.counts.errors = report.errors.length;
report.counts.warnings = report.warnings.length;
report.counts.checks = report.checks.length;

mkdirSync(dirname(REPORT_JSON), { recursive: true });
writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(REPORT_MD, renderMarkdown(report));

console.log(`Furniture asset factory QA`);
console.log(`  manifest: ${relative(ROOT, MANIFEST_PATH)}`);
console.log(`  blueprints: ${report.counts.blueprints}`);
console.log(`  build-ready: ${report.counts.buildReady}`);
console.log(`  runtime-ready: ${report.counts.runtimeReady}`);
console.log(`  pending/non-runtime: ${report.counts.pendingAssets}`);
console.log(`  errors: ${report.counts.errors}`);
console.log(`  warnings: ${report.counts.warnings}`);
console.log(`  report: ${relative(ROOT, REPORT_JSON)}`);

if (report.errors.length > 0) {
  for (const issue of report.errors.slice(0, 12)) console.error(`ERROR ${issue.message}`);
  process.exit(1);
}

function validateScale(asset, assetReport) {
  const scale = asset.scaleMeters;
  const required = ["width", "height", "depth", "readDistance"];
  if (!scale || typeof scale !== "object") {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: scaleMeters must be an object`, {});
    return;
  }
  for (const key of required) {
    const value = scale[key];
    if (!Number.isFinite(value) || value <= 0) {
      assetReport.status = "fail";
      error(`${assetReport.modelKey}: scaleMeters.${key} must be positive`, { value });
    }
  }
  if (Number.isFinite(scale.width) && Number.isFinite(scale.depth) && Math.max(scale.width, scale.depth) > 3.0) {
    warn(`${assetReport.modelKey}: large furniture footprint should be checked against navigation`, {
      width: scale.width,
      depth: scale.depth,
    });
  }
}

function validateArrays(asset, assetReport) {
  for (const field of ["silhouette", "materialSlots", "textureSources", "states"]) {
    if (!Array.isArray(asset[field]) || asset[field].length === 0) {
      assetReport.status = "fail";
      error(`${assetReport.modelKey}: ${field} must be a non-empty array`, {});
    }
  }
  for (const slot of asset.materialSlots ?? []) {
    if (!slot || typeof slot.name !== "string" || !slot.name.trim()) {
      assetReport.status = "fail";
      error(`${assetReport.modelKey}: material slot missing name`, { slot });
    }
  }
}

function validateCollision(asset, assetReport) {
  const collision = asset.collisionProxy;
  if (!collision || typeof collision !== "object") {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: collisionProxy must be an object`, {});
    return;
  }
  if (typeof collision.type !== "string" || !collision.type) {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: collisionProxy.type is required`, {});
  }
  if (!Array.isArray(collision.halfSizeMeters) || collision.halfSizeMeters.length !== 3) {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: collisionProxy.halfSizeMeters must be [x,y,z]`, {});
    return;
  }
  for (const value of collision.halfSizeMeters) {
    if (!Number.isFinite(value) || value <= 0) {
      assetReport.status = "fail";
      error(`${assetReport.modelKey}: collisionProxy half sizes must be positive`, { halfSizeMeters: collision.halfSizeMeters });
      break;
    }
  }
}

function validateRuntimeContent(asset, assetReport) {
  const runtimeContent = asset.runtimeContent;
  if (!runtimeContent || typeof runtimeContent !== "object") {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: runtimeContent must be an object`, {});
    return;
  }
  if (!Array.isArray(runtimeContent.baked) || !Array.isArray(runtimeContent.dynamic)) {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: runtimeContent requires baked and dynamic arrays`, {});
  }
}

function validatePathPlan(asset, assetReport) {
  const pathPlan = asset.pathPlan ?? {};
  if (!pathPlan || typeof pathPlan !== "object") {
    assetReport.status = "fail";
    error(`${assetReport.modelKey}: pathPlan must be an object`, {});
    return;
  }

  for (const [field, relPath] of Object.entries(pathPlan)) {
    if (typeof relPath !== "string" || !relPath.trim()) continue;
    const absolute = join(ROOT, relPath);
    const exists = existsSync(absolute);
    const row = {
      field,
      path: relPath,
      exists,
      bytes: exists && statSync(absolute).isFile() ? statSync(absolute).size : null,
    };
    const requiredPathFields = requiredPathFieldsFor(asset.readiness);
    if (requiredPathFields.includes(field) && !exists) {
      assetReport.missingPaths.push(row);
      error(`${asset.modelKey}: ${asset.readiness} path missing: ${field}`, row);
    } else if (!exists) {
      assetReport.pendingPaths.push(row);
    }
  }

  const requiredPathFields = requiredPathFieldsFor(asset.readiness);
  if (requiredPathFields.length > 0) {
    for (const field of requiredPathFields) {
      if (!pathPlan[field]) {
        assetReport.status = "fail";
        error(`${asset.modelKey}: ${asset.readiness} pathPlan missing ${field}`, {});
      }
    }
  }
}

function validateRegistryTargets(asset, assetReport) {
  for (const target of manifest.registryTargets ?? []) {
    const absolute = join(ROOT, target.path);
    const contains = String(target.contains ?? "").replaceAll("{modelKey}", asset.modelKey ?? "");
    const exists = existsSync(absolute);
    const found = exists && readFileSync(absolute, "utf8").includes(contains);
    const row = { id: target.id, path: target.path, found };
    assetReport.registry.push(row);
    if (asset.readiness === "runtime-ready" && !found) {
      assetReport.status = "fail";
      error(`${asset.modelKey}: runtime-ready asset missing registry target ${target.id}`, row);
    }
  }
}

function check(message, pass, detail = {}) {
  report.counts.checks += 1;
  report.checks.push({ message, pass: Boolean(pass), detail });
  if (!pass) error(message, detail);
}

function error(message, detail = {}) {
  report.errors.push({ message, detail });
}

function warn(message, detail = {}) {
  report.warnings.push({ message, detail });
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function renderMarkdown(input) {
  const lines = [];
  lines.push("# Furniture Asset Factory QA Report");
  lines.push("");
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push("");
  lines.push(`- Blueprints: ${input.counts.blueprints}`);
  lines.push(`- Build-ready: ${input.counts.buildReady}`);
  lines.push(`- Runtime-ready: ${input.counts.runtimeReady}`);
  lines.push(`- Pending/non-runtime: ${input.counts.pendingAssets}`);
  lines.push(`- Errors: ${input.counts.errors}`);
  lines.push(`- Warnings: ${input.counts.warnings}`);
  lines.push("");
  lines.push("## Assets");
  lines.push("");
  for (const asset of input.assets) {
    lines.push(`- ${asset.status === "pass" ? "PASS" : "FAIL"} ${asset.modelKey} (${asset.readiness})`);
    if (asset.pendingPaths.length > 0) lines.push(`  - pending paths: ${asset.pendingPaths.map((row) => row.field).join(", ")}`);
    if (asset.missingPaths.length > 0) lines.push(`  - missing paths: ${asset.missingPaths.map((row) => row.field).join(", ")}`);
  }
  if (input.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    lines.push("");
    for (const issue of input.errors) lines.push(`- ${issue.message}`);
  }
  if (input.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    lines.push("");
    for (const issue of input.warnings) lines.push(`- ${issue.message}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function requiredPathFieldsFor(readiness) {
  if (readiness === "build-ready") return buildReadyRequiredPathFields;
  if (readiness === "runtime-ready") return runtimeRequiredPathFields;
  return [];
}
