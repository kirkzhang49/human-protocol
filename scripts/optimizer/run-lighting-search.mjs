import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = path.join(ROOT, "scripts/optimizer/lighting_search_level01.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/lighting_search_level01");
const options = parseOptions(process.argv.slice(2));
const reportPath = path.resolve(ROOT, options.out);

fs.mkdirSync(path.dirname(BINARY), { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const compile = spawnSync("c++", ["-std=c++17", "-O3", "-march=native", SOURCE, "-o", BINARY], {
  cwd: ROOT,
  encoding: "utf8",
});

if (compile.status !== 0) {
  process.stderr.write(compile.stderr || compile.stdout);
  process.exit(compile.status ?? 1);
}

const run = spawnSync(BINARY, [String(options.families), String(options.candidates), options.objective], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 20,
});

if (run.status !== 0) {
  process.stderr.write(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}

JSON.parse(run.stdout);
fs.writeFileSync(reportPath, run.stdout);
const report = JSON.parse(run.stdout);

console.log(
  `PASS lighting C++ search objective=${report.objective ?? options.objective} candidates=${report.candidatesEvaluated} elapsedMs=${report.elapsedMs} current=${report.current.score} best=${report.best.score} report=${path.relative(ROOT, reportPath)}`,
);

function parseOptions(args) {
  const options = {
    families: 800,
    candidates: 25000,
    objective: "v1",
    out: "src/assets/manifests/reports/human_protocol_level01_lighting_cpp_search_report.json",
  };
  for (const arg of args) {
    if (arg.startsWith("--families=")) {
      options.families = positiveInteger(arg.slice("--families=".length), options.families);
    } else if (arg.startsWith("--candidates=")) {
      options.candidates = positiveInteger(arg.slice("--candidates=".length), options.candidates);
    } else if (arg.startsWith("--objective=")) {
      options.objective = parseObjective(arg.slice("--objective=".length));
    } else if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
    }
  }
  if (options.out === "src/assets/manifests/reports/human_protocol_level01_lighting_cpp_search_report.json") {
    if (options.objective === "v2") {
      options.out = "src/assets/manifests/reports/human_protocol_level01_lighting_objective_v2_report.json";
    } else if (options.objective === "v3") {
      options.out = "src/assets/manifests/reports/human_protocol_level01_lighting_objective_v3_report.json";
    }
  }
  return options;
}

function parseObjective(value) {
  if (value === "v3") return "v3";
  return value === "v2" ? "v2" : "v1";
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
