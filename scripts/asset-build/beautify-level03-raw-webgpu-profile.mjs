import { spawnSync } from "node:child_process";
import { hasArg, readArg } from "../lib/cli.mjs";

const LEVEL_ID = "level_03_human_museum";
const args = process.argv.slice(2);
const dryRun = hasArg("--dry-run", args);
const quick = hasArg("--quick", args);
const includeBuild = !hasArg("--no-build", args);
const colorFamilies = readArg("--color-families", args) ?? (quick ? "12000" : null);
const colorCandidates = readArg("--color-candidates", args) ?? (quick ? "96" : null);
const paletteFamilies = readArg("--palette-families", args) ?? (quick ? "6000" : null);
const paletteCandidates = readArg("--palette-candidates", args) ?? (quick ? "180" : null);

const steps = [
  {
    label: "build-official source QA",
    command: ["npm", "run", "qa:build-official"],
  },
  {
    label: "level03 lighting profile solver",
    command: ["node", "scripts/optimizer/run-level03-age-museum-lighting-solver.mjs"],
  },
  {
    label: "compile optimizer baseline plan",
    command: [
      "node",
      "tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs",
      `--level=${LEVEL_ID}`,
      "--no-raw-visual-color-tuning",
      "--no-raw-role-palette-tuning",
      "--no-raw-material-pipeline",
    ],
  },
  {
    label: "level03 visual color profile solver",
    command: [
      "node",
      "scripts/optimizer/run-level03-raw-color-grade-optimizer.mjs",
      `--level=${LEVEL_ID}`,
      ...(colorFamilies ? [`--families=${colorFamilies}`] : []),
      ...(colorCandidates ? [`--candidates=${colorCandidates}`] : []),
    ],
  },
  {
    label: "compile color-tuned palette input plan",
    command: [
      "node",
      "tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs",
      `--level=${LEVEL_ID}`,
      "--no-raw-role-palette-tuning",
      "--no-raw-material-pipeline",
    ],
  },
  {
    label: "level03 role palette profile solver",
    command: [
      "node",
      "scripts/optimizer/run-raw-webgpu-role-palette-solver.mjs",
      `--level=${LEVEL_ID}`,
      ...(paletteFamilies ? [`--families=${paletteFamilies}`] : []),
      ...(paletteCandidates ? [`--candidates=${paletteCandidates}`] : []),
    ],
  },
  {
    label: "official and builder Raw WebGPU rebuild",
    command: [
      "node",
      "scripts/asset-build/rebuild-raw-webgpu-levels.mjs",
      `--level=${LEVEL_ID}`,
      "--level3-lighting",
      "--write-threejs-bridge",
      ...(includeBuild ? ["--build"] : []),
    ],
  },
  {
    label: "VisualBakeContract",
    command: ["npm", "run", "qa:visual-bake-contract"],
  },
  {
    label: "builder WGPU resource audit",
    command: ["npm", "run", "qa:builder:wgpu-assets"],
  },
];

console.log(
  `[HumanProtocol] Level 3 Raw WebGPU beautify profile quick=${quick ? "on" : "off"} build=${includeBuild ? "on" : "off"} dryRun=${dryRun ? "on" : "off"}`,
);

for (const step of steps) {
  runStep(step.label, step.command);
}

console.log("\n[HumanProtocol] Level 3 Raw WebGPU beautify profile complete.");

function runStep(label, command) {
  console.log(`  ${dryRun ? "dry-run" : "run"} ${label}: ${command.join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });
  if (result.status === 0) return;
  console.error(`[HumanProtocol] Level 3 Raw WebGPU beautify profile failed at ${label}.`);
  process.exit(result.status ?? 1);
}
