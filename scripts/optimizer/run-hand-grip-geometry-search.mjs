import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = path.join(ROOT, "scripts/optimizer/hand_grip_geometry_search.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/hand_grip_geometry_search");
const options = parseOptions(process.argv.slice(2));
const reportPath = path.resolve(ROOT, options.out);
const markdownPath = path.resolve(ROOT, options.markdown);

fs.mkdirSync(path.dirname(BINARY), { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.mkdirSync(path.dirname(markdownPath), { recursive: true });

const compile = spawnSync("c++", ["-std=c++17", "-O3", "-march=native", SOURCE, "-o", BINARY], {
  cwd: ROOT,
  encoding: "utf8",
});

if (compile.status !== 0) {
  process.stderr.write(compile.stderr || compile.stdout);
  process.exit(compile.status ?? 1);
}

const run = spawnSync(BINARY, [String(options.families), String(options.candidates), String(options.seed)], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 80,
});

if (run.status !== 0) {
  process.stderr.write(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}

const report = JSON.parse(run.stdout);
report.generatedAt = new Date().toISOString();
report.referenceImage =
  "../../agents/visual-asset-agent/generated/human-protocol/sim-hand-pistol-rod-multiview-v1.png";
report.reviewPrinciple =
  "Hard grip gates run before style score: reject floating fingers, hidden palms, missing thumb clamp, fake contacts, and collision-stop corrections that are too large before aesthetic ranking.";

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(report, reportPath, markdownPath));

const total = report.cases.reduce((sum, entry) => sum + entry.candidatesEvaluated, 0);
const accepted = report.cases.reduce((sum, entry) => sum + entry.acceptedCount, 0);
const bestLine = report.cases
  .map((entry) => `${entry.id}:${entry.best.hardPassCount}/8 score=${entry.best.totalScore}`)
  .join(" ");

console.log(
  `PASS hand grip C++ search total=${total} accepted=${accepted} elapsedMs=${report.elapsedMs} report=${path.relative(
    ROOT,
    reportPath,
  )} md=${path.relative(ROOT, markdownPath)} ${bestLine}`,
);

function parseOptions(args) {
  const options = {
    families: 20000,
    candidates: 250,
    seed: 20260603,
    out: "src/assets/manifests/reports/human_protocol_hand_grip_geometry_v1_report.json",
    markdown: "docs/human-protocol-hand-grip-geometry-v1.md",
  };
  for (const arg of args) {
    if (arg.startsWith("--families=")) {
      options.families = positiveInteger(arg.slice("--families=".length), options.families);
    } else if (arg.startsWith("--candidates=")) {
      options.candidates = positiveInteger(arg.slice("--candidates=".length), options.candidates);
    } else if (arg.startsWith("--seed=")) {
      options.seed = positiveInteger(arg.slice("--seed=".length), options.seed);
    } else if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
    } else if (arg.startsWith("--markdown=")) {
      options.markdown = arg.slice("--markdown=".length);
    }
  }
  return options;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function renderMarkdown(report, reportPath, markdownPath) {
  const total = report.cases.reduce((sum, entry) => sum + entry.candidatesEvaluated, 0);
  const accepted = report.cases.reduce((sum, entry) => sum + entry.acceptedCount, 0);
  const lines = [];
  lines.push("# Human Protocol Hand Grip Geometry Search V1");
  lines.push("");
  lines.push("This is the first high-sample math pass for the simulated humanoid robot hand.");
  lines.push("It tests whether one hand can physically grip both a compact charging pistol and a one-hand baton before Blender asset generation.");
  lines.push("");
  lines.push("## Run");
  lines.push("");
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Families: ${report.families}`);
  lines.push(`- Candidates per family per case: ${report.candidatesPerFamily}`);
  lines.push(`- Total candidates across four cases: ${total.toLocaleString("en-US")}`);
  lines.push(`- Accepted candidates: ${accepted.toLocaleString("en-US")}`);
  lines.push(`- C++ elapsed: ${report.elapsedMs} ms`);
  lines.push(`- JSON report: ${path.relative(path.dirname(markdownPath), reportPath)}`);
  lines.push(`- Reference image: ${report.referenceImage}`);
  lines.push("");
  lines.push("## Principle");
  lines.push("");
  lines.push(report.reviewPrinciple);
  lines.push("");
  lines.push("Hard constraints:");
  for (const constraint of report.hardConstraints) lines.push(`- ${constraint}`);
  lines.push("");
  lines.push("Soft style constraints:");
  for (const constraint of report.softConstraints) lines.push(`- ${constraint}`);
  lines.push("");
  lines.push("## Case Results");
  lines.push("");
  lines.push("| Case | Accepted | Hard Gates | Total | Visual | Coverage | Palm Gap | Thumb Gap | Clamp Line | Stop Correction |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const entry of report.cases) {
    const best = entry.best;
    const m = best.metrics;
    const stopCorrection = m.maxCollisionStopCorrection ?? m.maxPenetration;
    lines.push(
      `| ${entry.id} | ${entry.acceptedCount.toLocaleString("en-US")} | ${best.hardPassCount}/8 | ${best.totalScore.toFixed(
        2,
      )} | ${best.visualScore.toFixed(2)} | ${m.coverageDeg.toFixed(2)} | ${m.palmSupportGap.toFixed(
        4,
      )} | ${m.thumbGap.toFixed(4)} | ${m.clampLineDistance.toFixed(4)} | ${stopCorrection.toFixed(4)} |`,
    );
  }
  lines.push("");
  lines.push("## Best Parameters");
  lines.push("");
  for (const entry of report.cases) {
    lines.push(`### ${entry.id}`);
    lines.push("");
    lines.push("Hard pass map:");
    for (const [key, value] of Object.entries(entry.best.hardPasses)) {
      lines.push(`- ${key}: ${value ? "pass" : "fail"}`);
    }
    lines.push("");
    lines.push("Candidate:");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(entry.best.candidate, null, 2));
    lines.push("```");
    lines.push("");
  }
  lines.push("## Modeling Handoff");
  lines.push("");
  lines.push("- Use the pistol cases to drive the single-hand sidearm pose.");
  lines.push("- Use the baton cases to drive the one-hand rod attack pose.");
  lines.push("- Do not accept a Blender hand if the palm support, thumb clamp, and required digit contact gates regress.");
  lines.push("- Preserve short, thick silicone fingers with a continuous rounded-square palm shell; avoid bead-like fingertip decoration.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}
