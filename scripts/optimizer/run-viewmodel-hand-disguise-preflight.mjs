import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = path.join(ROOT, "scripts/optimizer/hand_viewmodel_disguise_preflight_v2.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/hand_viewmodel_disguise_preflight_v2");
const options = parseOptions(process.argv.slice(2));

fs.mkdirSync(path.dirname(BINARY), { recursive: true });

const compile = spawnSync("c++", ["-std=c++17", "-O3", "-march=native", SOURCE, "-o", BINARY], {
  cwd: ROOT,
  encoding: "utf8",
});

if (compile.status !== 0) {
  process.stderr.write(compile.stderr || compile.stdout);
  process.exit(compile.status ?? 1);
}

const args = [
  "--candidates",
  String(options.candidates),
  "--seed",
  String(options.seed),
  "--variants",
  String(options.variants),
  "--top",
  String(options.top),
];

if (options.threads) {
  args.push("--threads", String(options.threads));
}

const run = spawnSync(BINARY, args, {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 80,
});

if (run.status !== 0) {
  process.stderr.write(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}

process.stdout.write(run.stdout);
console.log("PASS Human Protocol viewmodel hand disguise preflight");

function parseOptions(args) {
  const options = {
    candidates: 1000000,
    seed: 20260603,
    variants: 20000,
    top: 64,
    threads: 0,
  };
  for (const arg of args) {
    if (arg.startsWith("--candidates=")) {
      options.candidates = positiveInteger(arg.slice("--candidates=".length), options.candidates);
    } else if (arg.startsWith("--seed=")) {
      options.seed = positiveInteger(arg.slice("--seed=".length), options.seed);
    } else if (arg.startsWith("--variants=")) {
      options.variants = positiveInteger(arg.slice("--variants=".length), options.variants);
    } else if (arg.startsWith("--top=")) {
      options.top = positiveInteger(arg.slice("--top=".length), options.top);
    } else if (arg.startsWith("--threads=")) {
      options.threads = positiveInteger(arg.slice("--threads=".length), options.threads);
    }
  }
  return options;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
