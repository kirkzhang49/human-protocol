import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = path.join(ROOT, "scripts/optimizer/hand_viewmodel_disguise_preflight_v2.cpp");
const BINARY = path.join(ROOT, "node_modules/.tmp/hand_viewmodel_disguise_preflight_v2");
const REPORT_PATH = path.join(
  ROOT,
  "src/assets/manifests/reports/human_protocol_viewmodel_hand_disguise_preflight_v2.json",
);
const REPORT_MD_PATH = path.join(ROOT, "docs/human-protocol-viewmodel-hand-disguise-preflight-v2.md");
const SWEEP_JSON = path.join(
  ROOT,
  "src/assets/manifests/reports/human_protocol_viewmodel_hand_direction_sweep_v2.json",
);
const SWEEP_MD = path.join(ROOT, "docs/human-protocol-viewmodel-hand-direction-sweep-v2.md");
const options = parseOptions(process.argv.slice(2));
const originalReport = fs.existsSync(REPORT_PATH) ? fs.readFileSync(REPORT_PATH, "utf8") : null;
const originalReportMd = fs.existsSync(REPORT_MD_PATH) ? fs.readFileSync(REPORT_MD_PATH, "utf8") : null;

fs.mkdirSync(path.dirname(BINARY), { recursive: true });
fs.mkdirSync(path.dirname(SWEEP_JSON), { recursive: true });
fs.mkdirSync(path.dirname(SWEEP_MD), { recursive: true });

const compile = spawnSync("c++", ["-std=c++17", "-O3", "-march=native", SOURCE, "-o", BINARY], {
  cwd: ROOT,
  encoding: "utf8",
});

if (compile.status !== 0) {
  process.stderr.write(compile.stderr || compile.stdout);
  process.exit(compile.status ?? 1);
}

const runReports = [];
const passCandidates = [];

for (const seed of options.seeds) {
  const args = [
    "--candidates",
    String(options.candidates),
    "--seed",
    String(seed),
    "--variants",
    String(options.variants),
    "--top",
    String(options.top),
  ];
  if (options.threads) args.push("--threads", String(options.threads));

  const run = spawnSync(BINARY, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80,
  });
  if (run.status !== 0) {
    process.stderr.write(run.stderr || run.stdout);
    process.exit(run.status ?? 1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  runReports.push({
    seed,
    candidateCount: report.candidateCount,
    elapsedSeconds: report.elapsedSeconds,
    statusCounts: report.statusCounts,
    best: compactCandidate(report.best, seed),
    singleBestCandidate: compactCandidate(report.singleBestCandidate, seed),
  });

  for (const candidate of report.topCandidates) {
    if (candidate.status !== "pass" || candidate.issues.length) continue;
    passCandidates.push(compactCandidate(candidate, seed));
  }
}

const uniquePassCandidates = dedupeCandidates(passCandidates);
const directions = buildDirections(uniquePassCandidates);
const sweep = {
  schema: "human-protocol/viewmodel-hand-direction-sweep@2",
  generatedAt: new Date().toISOString(),
  formula: "human-disguise-hand-v2-direction-sweep-from-parfit-gated-wgpu-v8",
  acceptanceRule:
    "Only status=pass candidates with no issues are eligible. Direction scores are used after hard gates, never instead of hard gates.",
  options,
  runReports,
  passCandidateCount: uniquePassCandidates.length,
  directions,
};

fs.writeFileSync(SWEEP_JSON, `${JSON.stringify(sweep, null, 2)}\n`);
fs.writeFileSync(SWEEP_MD, renderMarkdown(sweep));
if (originalReport) fs.writeFileSync(REPORT_PATH, originalReport);
if (originalReportMd) fs.writeFileSync(REPORT_MD_PATH, originalReportMd);

console.log(
  `PASS direction sweep seeds=${options.seeds.join(",")} passCandidates=${uniquePassCandidates.length} json=${path.relative(
    ROOT,
    SWEEP_JSON,
  )} md=${path.relative(ROOT, SWEEP_MD)}`,
);

function buildDirections(candidates) {
  const specs = [
    {
      id: "human_silicone",
      name: "Human Silicone",
      goal: "First glance should read as a warm human-like silicone hand, with palm visible and no clamp silhouette.",
      score: (c) =>
        c.score * 0.35 +
        c.m.palmVisibleAreaFromCamera * 28 +
        c.m.shellContinuityIndex * 10 +
        c.m.fiveFingerSilhouetteIndex * 8 +
        c.m.visualComplexityIndex * 8 -
        c.params.fingerKnuckleSwell * 220,
    },
    {
      id: "stubby_robot_disguise",
      name: "Stubby Robot Disguise",
      goal: "Short, slightly thick fingers for a game-readable robot-human hand, without bead fingers.",
      score: (c) =>
        c.score * 0.32 +
        c.m.stubbyFingerIndex * 22 +
        c.m.cuteThicknessIndex * 18 +
        rangePeak(c.m.fingerDiameterPalmRatio, 0.47, 0.06) * 18 +
        rangePeak(c.m.meanFingerBaseRadius, 0.18, 0.025) * 10,
    },
    {
      id: "palm_grip_cover",
      name: "Palm Grip Cover",
      goal: "Prioritize the failure we kept seeing: palm must cover and press onto the pistol grip, not only fingers.",
      score: (c) =>
        c.score * 0.28 +
        c.m.palmHandleCoverIndex * 28 +
        c.m.palmGripContactDepth * 24 +
        c.m.palmGripContactIndex * 18 +
        c.m.fingerWrapArcScore * 12,
    },
    {
      id: "root_continuity",
      name: "Root Continuity",
      goal: "Finger roots grow from the palm with minimal gap risk and no tube-insert look.",
      score: (c) =>
        c.score * 0.3 +
        c.m.rootAttachmentIndex * 26 +
        c.m.minRootGapScore * 22 +
        c.params.knuckleBridgeScale * 5 +
        c.params.palmBridgeScale * 5 -
        c.params.fingerKnuckleSwell * 160,
    },
    {
      id: "thumb_opposition",
      name: "Thumb Opposition",
      goal: "Make the thumb clamp readable and stable for pistol and baton reuse.",
      score: (c) =>
        c.score * 0.3 +
        c.m.thumbOppositionIndex * 30 +
        c.m.contactConstraintIndex * 16 +
        c.m.fingerWrapArcScore * 16 +
        rangePeak(c.params.thumbOppositionScale, 1.32, 0.12) * 12,
    },
    {
      id: "low_risk_balanced",
      name: "Low Risk Balanced",
      goal: "A conservative candidate with all visible-failure risk penalties at zero and no metric near a hard threshold.",
      score: (c) =>
        c.score * 0.42 +
        thresholdMargin(c) * 28 -
        c.m.palmHiddenByGunPenalty * 200 -
        c.m.fingerOnlySilhouettePenalty * 200 -
        c.m.boxLikePalmPenalty * 200 -
        c.m.illegalPenetrationPenalty * 200,
    },
  ];

  return specs.map((spec) => {
    const ranked = candidates
      .map((candidate) => ({ ...candidate, directionScore: Number(spec.score(candidate).toFixed(4)) }))
      .sort((a, b) => b.directionScore - a.directionScore || b.score - a.score)
      .slice(0, 5);
    return {
      id: spec.id,
      name: spec.name,
      goal: spec.goal,
      selected: ranked[0] ?? null,
      alternates: ranked.slice(1),
    };
  });
}

function compactCandidate(candidate, seed) {
  return {
    seed,
    candidateId: candidate.candidateId,
    variantId: candidate.variantId,
    variantName: candidate.variantName,
    status: candidate.status,
    score: candidate.score,
    params: candidate.params,
    m: candidate.summaryMetrics,
    issues: candidate.issues,
  };
}

function dedupeCandidates(candidates) {
  const bestByKey = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.variantId}:${candidate.candidateId}`;
    const previous = bestByKey.get(key);
    if (!previous || candidate.score > previous.score) bestByKey.set(key, candidate);
  }
  return [...bestByKey.values()];
}

function rangePeak(value, target, width) {
  const d = (value - target) / Math.max(width, 0.00001);
  return Math.exp(-d * d);
}

function thresholdMargin(c) {
  const margins = [
    (c.m.fingerDiameterPalmRatio - 0.44) / 0.04,
    (0.6 - c.m.fingerDiameterPalmRatio) / 0.04,
    (c.m.rootAttachmentIndex - 0.94) / 0.04,
    (c.m.palmHandleCoverIndex - 0.9) / 0.04,
    (c.m.palmVisibleAreaFromCamera - 0.5) / 0.08,
    (0.4 - c.m.fingerProjectedAreaShare) / 0.03,
    (c.m.palmGripContactDepth - 0.84) / 0.05,
    (c.m.fingerWrapArcScore - 0.76) / 0.08,
  ];
  return Math.max(0, Math.min(1, Math.min(...margins)));
}

function renderMarkdown(sweep) {
  const lines = [];
  lines.push("# Human Protocol Viewmodel Hand Direction Sweep V2");
  lines.push("");
  lines.push("This sweep tries multiple visual/structural directions after the Parfit-gated hard pass.");
  lines.push("A direction winner must already be `status=pass` with no issues; direction scoring never overrides hard gates.");
  lines.push("");
  lines.push("## Run");
  lines.push("");
  lines.push(`- Generated at: ${sweep.generatedAt}`);
  lines.push(`- Seeds: ${sweep.options.seeds.join(", ")}`);
  lines.push(`- Candidates per seed: ${sweep.options.candidates.toLocaleString("en-US")}`);
  lines.push(`- Variants: ${sweep.options.variants.toLocaleString("en-US")}`);
  lines.push(`- Unique pass candidates in top pool: ${sweep.passCandidateCount.toLocaleString("en-US")}`);
  lines.push("");
  lines.push("## Direction Winners");
  lines.push("");
  lines.push("| Direction | Winner | Score | Direction | Key reason |");
  lines.push("| --- | --- | ---: | ---: | --- |");
  for (const direction of sweep.directions) {
    const c = direction.selected;
    if (!c) {
      lines.push(`| ${direction.name} | none | 0 | 0 | no pass candidate found |`);
      continue;
    }
    lines.push(
      `| ${direction.name} | ${c.candidateId} / ${c.variantName} | ${c.score.toFixed(3)} | ${c.directionScore.toFixed(
        2,
      )} | palm=${c.m.palmVisibleAreaFromCamera.toFixed(3)}, cover=${c.m.palmHandleCoverIndex.toFixed(
        3,
      )}, root=${c.m.rootAttachmentIndex.toFixed(3)}, fingerShare=${c.m.fingerProjectedAreaShare.toFixed(3)} |`,
    );
  }
  lines.push("");
  lines.push("## Details");
  lines.push("");
  for (const direction of sweep.directions) {
    lines.push(`### ${direction.name}`);
    lines.push("");
    lines.push(direction.goal);
    lines.push("");
    const candidates = [direction.selected, ...direction.alternates].filter(Boolean);
    for (const c of candidates) {
      lines.push(
        `- ${c.candidateId} seed=${c.seed} variant=${c.variantId} ${c.variantName} score=${c.score.toFixed(
          3,
        )} direction=${c.directionScore.toFixed(2)} palm=${c.m.palmVisibleAreaFromCamera.toFixed(
          4,
        )} cover=${c.m.palmHandleCoverIndex.toFixed(4)} root=${c.m.rootAttachmentIndex.toFixed(
          4,
        )} stubby=${c.m.stubbyFingerIndex.toFixed(4)} wrap=${c.m.fingerWrapArcScore.toFixed(4)}`,
      );
    }
    lines.push("");
  }
  lines.push("## Modeling Handoff");
  lines.push("");
  lines.push("- Use `low_risk_balanced` if the next Blender pass must minimize repeated mistakes.");
  lines.push("- Use `palm_grip_cover` if the hand still appears behind or inside the pistol grip.");
  lines.push("- Use `human_silicone` if the geometry passes but still reads too robotic.");
  lines.push("- Keep `status=pass` and `issues=[]` as non-negotiable before Blender generation.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseOptions(args) {
  const options = {
    candidates: 1000000,
    seeds: [20260603, 20260604, 20260605],
    variants: 20000,
    top: 192,
    threads: 0,
  };
  for (const arg of args) {
    if (arg.startsWith("--candidates=")) {
      options.candidates = positiveInteger(arg.slice("--candidates=".length), options.candidates);
    } else if (arg.startsWith("--seeds=")) {
      options.seeds = arg
        .slice("--seeds=".length)
        .split(",")
        .map((seed) => positiveInteger(seed, 0))
        .filter(Boolean);
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
