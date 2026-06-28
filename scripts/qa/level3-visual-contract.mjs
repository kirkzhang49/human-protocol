#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(fileURLToPath(new URL("./visual-bake-contract.mjs", import.meta.url)));
const reportPath = "src/assets/manifests/generated/raw-webgpu/qa/level3_visual_contract_report.json";

const result = spawnSync(process.execPath, [scriptPath, "--level=level_03_human_museum", `--report=${reportPath}`], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
