import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MANIFEST_PATH = join(ROOT, "src/assets/manifests/runtime/human_protocol_furniture_asset_factory_v1.json");
const REPORT_PATH = join(ROOT, "src/assets/manifests/reports/furniture_asset_factory_qa_report.json");
const QA_SCRIPT = join(ROOT, "scripts/qa/furniture-asset-pipeline-qa.mjs");
const listOnly = process.argv.includes("--list");

if (!existsSync(MANIFEST_PATH)) {
  console.error(`Missing furniture asset factory manifest: ${relative(ROOT, MANIFEST_PATH)}`);
  process.exit(1);
}

const manifest = readJson(MANIFEST_PATH);
printHeader(manifest);
printStages(manifest);

if (listOnly) {
  printBlueprintSummary(manifest);
  process.exit(0);
}

const qa = spawnSync(process.execPath, [QA_SCRIPT], {
  cwd: ROOT,
  stdio: "inherit",
  encoding: "utf8",
});
if (qa.status !== 0) process.exit(qa.status ?? 1);

const report = existsSync(REPORT_PATH) ? readJson(REPORT_PATH) : null;
if (report) printNextActions(report);

function printHeader(input) {
  console.log("");
  console.log("Human Protocol furniture asset factory");
  console.log(`  manifest: ${relative(ROOT, MANIFEST_PATH)}`);
  console.log(`  schema: ${input.schema}`);
  console.log("");
}

function printStages(input) {
  console.log("Pipeline stages:");
  for (const stage of input.pipelineStages ?? []) {
    console.log(`  ${stage.id.padEnd(25)} ${stage.gate}`);
  }
  console.log("");
}

function printBlueprintSummary(input) {
  console.log("Blueprints:");
  for (const asset of input.blueprints ?? []) {
    console.log(`  ${String(asset.readiness).padEnd(15)} ${asset.modelKey}`);
  }
  console.log("");
}

function printNextActions(report) {
  console.log("");
  console.log("Pipeline next actions:");
  for (const asset of report.assets ?? []) {
    if (["build-ready", "runtime-ready"].includes(asset.readiness) && asset.status === "pass") {
      console.log(`  ready   ${asset.modelKey} (${asset.readiness})`);
      continue;
    }
    const pending = asset.pendingPaths?.map((row) => row.field).join(", ") || "source generation";
    console.log(`  build   ${asset.modelKey}: ${pending}`);
  }
  console.log("");
  console.log(`Reports:`);
  console.log(`  ${relative(ROOT, REPORT_PATH)}`);
  console.log(`  src/assets/manifests/reports/furniture_asset_factory_qa_report.md`);
  console.log("");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
