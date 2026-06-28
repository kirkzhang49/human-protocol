#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_VERSION = "0.1.0";
const PKG_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const TOOL_ROOT = path.resolve(PKG_ROOT, "tools/human-protocol-mcp");
const COORDINATION_STATE_PATH = path.join(PKG_ROOT, ".tmp/human-protocol-mcp/state.json");
const MAX_OUTPUT_BYTES = 48_000;
const MAX_LOOP_RESULTS = 200;

const MAINTAINED_LEVELS = [
  "level_01_maintenance_bay",
  "level_02_residential_simulation",
  "level_03_human_museum",
];

const OFFICIAL_BUILDER_BY_LEVEL = {
  level_01_maintenance_bay: "src/game/config/levels/level01-maintenance-bay/level.official.builder.json",
  level_02_residential_simulation: "src/game/config/levels/level02-residential-simulation/level.official.builder.json",
  level_03_human_museum: "src/game/config/levels/level03-human-museum/level.official.builder.json",
};

const ASSET_QA_SUITES = {
  builder_wgpu_assets: {
    script: "qa:builder:wgpu-assets",
    supportsLevel: false,
    purpose: "Checks builder/runtime asset registry coverage against Raw WebGPU import readiness.",
  },
  visual_bake_contract: {
    script: "qa:visual-bake-contract",
    supportsLevel: true,
    purpose: "Checks official, builder-import, trial JSON, raw-plan, and runtime-pack visual contract drift.",
  },
  builder_to_official: {
    script: "qa:builder-to-official",
    supportsLevel: true,
    purpose: "Checks builder-to-official import, surfaces, raw plans, and runtime pack contracts.",
  },
};

const TOOLS = [
  {
    name: "project_status",
    description: "Summarize the Human Protocol project state, maintained QA slice, dirty worktree size, and MCP safety boundaries.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_levels",
    description: "List official builder-native levels, legacy/TS level folders, and smoke config files.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "inspect_level_source",
    description: "Inspect an official builder JSON source and return high-level project counts without compiling or changing files.",
    inputSchema: {
      type: "object",
      properties: {
        levelId: {
          type: "string",
          enum: MAINTAINED_LEVELS,
        },
      },
      required: ["levelId"],
      additionalProperties: false,
    },
  },
  {
    name: "validate_level",
    description: "Validate a built-in level through the existing ConfigValidator via Vite SSR.",
    inputSchema: {
      type: "object",
      properties: {
        levelId: { type: "string" },
      },
      required: ["levelId"],
      additionalProperties: false,
    },
  },
  {
    name: "compile_builder_project",
    description: "Compile a BuilderProject JSON, then validate the generated LevelDefinition through the existing compiler and ConfigValidator.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path inside the Human Protocol repo. Official builder docs are accepted; their .project field is compiled.",
        },
      },
      required: ["projectPath"],
      additionalProperties: false,
    },
  },
  {
    name: "run_official_qa",
    description: "Run the allowlisted official builder-source QA script for one maintained level or the default maintained slice.",
    inputSchema: {
      type: "object",
      properties: {
        levelId: {
          type: "string",
          enum: ["all", ...MAINTAINED_LEVELS],
          default: "all",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_smoke_campaign",
    description: "Run the allowlisted smoke campaign QA script.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "run_asset_qa",
    description: "Run an allowlisted asset/visual contract QA suite. Some underlying project scripts may refresh generated report JSON.",
    inputSchema: {
      type: "object",
      properties: {
        suite: {
          type: "string",
          enum: Object.keys(ASSET_QA_SUITES),
        },
        levelId: {
          type: "string",
          enum: ["all", ...MAINTAINED_LEVELS],
          default: "all",
        },
      },
      required: ["suite"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_level_patch",
    description: "Create a read-only patch plan for a Human Protocol level change, including likely files, boundaries, risks, and QA gates.",
    inputSchema: {
      type: "object",
      properties: {
        levelId: {
          type: "string",
          enum: MAINTAINED_LEVELS,
        },
        intent: {
          type: "string",
          description: "Human-readable change request, bug, or improvement goal.",
        },
        area: {
          type: "string",
          enum: ["auto", "level_content", "puzzle_or_door", "asset_or_visual", "compiler_or_validator", "ui_runtime", "qa_or_docs"],
          default: "auto",
        },
      },
      required: ["levelId", "intent"],
      additionalProperties: false,
    },
  },
  {
    name: "claim_scope",
    description: "Claim a Human Protocol work scope in ignored .tmp coordination state so concurrent agents can avoid conflicts.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          description: "Stable scope such as level_01_maintenance_bay:asset_or_visual or runtime-pack.",
        },
        agentId: {
          type: "string",
          description: "Human-readable agent/session identifier.",
        },
        reason: {
          type: "string",
          description: "Short reason for the claim.",
        },
        ttlMinutes: {
          type: "number",
          minimum: 5,
          maximum: 1440,
          default: 120,
        },
      },
      required: ["scope", "agentId", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "release_scope",
    description: "Release a previously claimed Human Protocol work scope from ignored .tmp coordination state.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string" },
        agentId: { type: "string" },
      },
      required: ["scope", "agentId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_active_scopes",
    description: "List active and recently expired Human Protocol work-scope claims from ignored .tmp coordination state.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "record_loop_result",
    description: "Record a Done/Evidence/Problems/Risk/Next loop result in ignored .tmp coordination state.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        scope: { type: "string" },
        status: {
          type: "string",
          enum: ["done", "blocked", "needs_followup"],
          default: "done",
        },
        done: { type: "string" },
        evidence: { type: "string" },
        problems: { type: "string" },
        risk: { type: "string" },
        next: { type: "string" },
      },
      required: ["agentId", "scope", "done", "evidence", "problems", "risk", "next"],
      additionalProperties: false,
    },
  },
  {
    name: "list_asset_packs",
    description: "List builder/runtime/generated manifest files relevant to the asset and Raw WebGPU pipelines.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          minimum: 1,
          maximum: 80,
          default: 40,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "inspect_runtime_pack",
    description: "Inspect generated Raw WebGPU render-plan and cooked-loader manifest files for a level.",
    inputSchema: {
      type: "object",
      properties: {
        levelId: { type: "string" },
      },
      required: ["levelId"],
      additionalProperties: false,
    },
  },
];

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  void handleMessage(line);
});

async function handleMessage(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    return sendError(null, -32700, "Parse error", String(error));
  }

  if (message.id === undefined) return;

  try {
    if (message.method === "initialize") {
      return sendResult(message.id, {
        protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "human-protocol-mcp", version: SERVER_VERSION },
      });
    }
    if (message.method === "tools/list") {
      return sendResult(message.id, { tools: TOOLS });
    }
    if (message.method === "tools/call") {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      const result = await callTool(name, args);
      return sendResult(message.id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: result.ok === false,
      });
    }
    return sendError(message.id, -32601, `Unknown method: ${message.method}`);
  } catch (error) {
    return sendError(message.id, -32603, error?.message ?? "Internal error", { stack: error?.stack });
  }
}

async function callTool(name, args) {
  switch (name) {
    case "project_status":
      return projectStatus();
    case "list_levels":
      return listLevels();
    case "inspect_level_source":
      return inspectLevelSource(args.levelId);
    case "validate_level":
      return runNodeHelper("validate-level.mjs", [String(args.levelId ?? "")], 60_000);
    case "compile_builder_project":
      return runNodeHelper("compile-builder-project.mjs", [safeRepoPath(args.projectPath)], 60_000);
    case "run_official_qa":
      return runOfficialQa(args.levelId ?? "all");
    case "run_smoke_campaign":
      return runCommand("npm", ["run", "smoke:campaign"], 120_000);
    case "run_asset_qa":
      return runAssetQa(args.suite, args.levelId ?? "all");
    case "propose_level_patch":
      return proposeLevelPatch(args);
    case "claim_scope":
      return claimScope(args);
    case "release_scope":
      return releaseScope(args);
    case "list_active_scopes":
      return listActiveScopes();
    case "record_loop_result":
      return recordLoopResult(args);
    case "list_asset_packs":
      return listAssetPacks(args.limit ?? 40);
    case "inspect_runtime_pack":
      return inspectRuntimePack(String(args.levelId ?? ""));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function projectStatus() {
  const pkg = JSON.parse(await readFile(path.join(PKG_ROOT, "package.json"), "utf8"));
  const git = await runCommand("git", ["status", "--short"], 10_000, { doNotThrow: true });
  const statusLines = (git.stdout ?? "").split("\n").filter(Boolean);
  const untracked = statusLines.filter((line) => line.startsWith("??")).length;
  const modified = statusLines.filter((line) => !line.startsWith("??")).length;
  return {
    ok: true,
    repoRoot: PKG_ROOT,
    packageName: pkg.name,
    nodeEngine: pkg.engines?.node ?? null,
    maintainedOfficialSlice: {
      builderNative: ["level_01_maintenance_bay", "level_02_residential_simulation"],
      museumException: "level_03_human_museum",
      excludedByDefault: "Level 4+ are not default QA targets until rebuilt.",
    },
    safety: {
      mode: "read-only project inspection plus ignored .tmp coordination state and allowlisted QA commands",
      writesProjectFiles: false,
      writesIgnoredTmpState: true,
      coordinationStatePath: path.relative(PKG_ROOT, COORDINATION_STATE_PATH),
      allowedCommands: [
        "npm run qa:build-official",
        "npm run smoke:campaign",
        "npm run qa:builder:wgpu-assets",
        "npm run qa:visual-bake-contract",
        "npm run qa:builder-to-official",
        "Vite SSR validate/compile helpers",
      ],
      pathPolicy: "project paths must resolve inside the Human Protocol repo",
    },
    dirtyWorktree: {
      total: statusLines.length,
      modified,
      untracked,
      sample: statusLines.slice(0, 30),
    },
  };
}

async function listLevels() {
  const levelsDir = path.join(PKG_ROOT, "src/game/config/levels");
  const entries = await readdir(levelsDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const official = [];
  for (const [levelId, rel] of Object.entries(OFFICIAL_BUILDER_BY_LEVEL)) {
    official.push(await officialBuilderSummary(levelId, rel));
  }
  const smokeDir = path.join(PKG_ROOT, "src/game/config/smoke");
  const smokeFiles = (await readdir(smokeDir)).filter((name) => name.endsWith(".ts")).sort();
  return {
    ok: true,
    officialBuilderSources: official,
    levelFolders: folders,
    smokeConfigs: smokeFiles.map((file) => `src/game/config/smoke/${file}`),
  };
}

async function inspectLevelSource(levelId) {
  const rel = OFFICIAL_BUILDER_BY_LEVEL[levelId];
  if (!rel) throw new Error(`No maintained official builder source allowlisted for ${levelId}`);
  return officialBuilderSummary(levelId, rel, { includeProjectStats: true });
}

async function officialBuilderSummary(levelId, rel, options = {}) {
  const abs = path.join(PKG_ROOT, rel);
  const raw = await readFile(abs, "utf8");
  const doc = JSON.parse(raw);
  const project = doc.project ?? {};
  const summary = {
    ok: true,
    levelId,
    path: rel,
    schemaVersion: doc.schemaVersion,
    documentId: doc.documentId,
    title: doc.title,
    campaign: doc.campaign ?? null,
    projectId: project.projectId ?? null,
    projectTitle: project.title ?? null,
    counts: {
      rooms: project.rooms?.length ?? 0,
      doors: project.doors?.length ?? 0,
      puzzles: project.puzzles?.length ?? 0,
      pickups: project.pickups?.length ?? 0,
      robotWaves: project.robotWaves?.length ?? project.waves?.length ?? 0,
      lights: project.lights?.length ?? 0,
      materials: project.materials?.length ?? 0,
    },
  };
  if (options.includeProjectStats) {
    summary.ids = {
      rooms: (project.rooms ?? []).map((room) => room.id).slice(0, 40),
      doors: (project.doors ?? []).map((door) => door.id).slice(0, 40),
      puzzles: (project.puzzles ?? []).map((puzzle) => puzzle.id).slice(0, 40),
    };
  }
  return summary;
}

async function runOfficialQa(levelId) {
  if (levelId && levelId !== "all" && !MAINTAINED_LEVELS.includes(levelId)) {
    throw new Error(`run_official_qa only allows: all, ${MAINTAINED_LEVELS.join(", ")}`);
  }
  const args = ["run", "qa:build-official"];
  if (levelId && levelId !== "all") args.push("--", `--level=${levelId}`);
  return runCommand("npm", args, 90_000);
}

async function runAssetQa(suite, levelId) {
  const config = ASSET_QA_SUITES[suite];
  if (!config) throw new Error(`Unknown asset QA suite: ${suite}`);
  if (levelId && levelId !== "all" && !MAINTAINED_LEVELS.includes(levelId)) {
    throw new Error(`run_asset_qa only allows: all, ${MAINTAINED_LEVELS.join(", ")}`);
  }
  if (levelId && levelId !== "all" && !config.supportsLevel) {
    throw new Error(`${suite} does not support a focused levelId.`);
  }
  const args = ["run", config.script];
  if (levelId && levelId !== "all") args.push("--", `--level=${levelId}`);
  const result = await runCommand("npm", args, 150_000);
  return {
    ...result,
    suite,
    purpose: config.purpose,
    mayRefreshReports: true,
  };
}

async function proposeLevelPatch(args) {
  const levelId = String(args.levelId ?? "");
  const rel = OFFICIAL_BUILDER_BY_LEVEL[levelId];
  if (!rel) throw new Error(`No maintained official builder source allowlisted for ${levelId}`);
  const intent = String(args.intent ?? "").trim();
  if (!intent) throw new Error("intent is required");
  const area = inferPatchArea(intent, args.area ?? "auto");
  const levelSource = await officialBuilderSummary(levelId, rel, { includeProjectStats: true });
  const fileCandidates = [];
  const add = async (projectPath, role, reason) => {
    fileCandidates.push(await fileCandidate(projectPath, role, reason));
  };

  await add(rel, "source-of-truth", "Official maintained builder JSON for this level.");
  await add(path.dirname(rel), "level-folder", "Level-local source shell, copy, and adjacent official assets live here.");

  if (area === "puzzle_or_door" || area === "compiler_or_validator") {
    await add("src/build/compileBuilderProjectToLevel.ts", "compiler", "Builder project changes flow through this compiler before becoming LevelDefinition.");
    await add("src/game/config/ConfigValidator.ts", "validator", "Reference, lock-chain, reachability, and authoring errors should be caught here.");
    await add("scripts/qa/build-official-source-qa.mjs", "qa", "Builder-source parity check for official levels.");
  }

  if (area === "asset_or_visual") {
    await add("src/build/runtime-pack/BuilderRuntimeAssetIndex.ts", "runtime-pack", "Maps builder/official content to Raw WebGPU resource-pack coverage.");
    await add("src/assets/environmentModelAssets.ts", "asset-registry", "Runtime model registry for environment and builder visual keys.");
    await add("src/assets/manifests/builder/ingested-packs.json", "asset-manifest", "Builder asset pack ingestion index.");
    await add(`src/assets/manifests/generated/raw-webgpu/render_plan_${levelId}.json`, "generated-audit-input", "Generated Raw WebGPU render plan to inspect, not edit.");
    await add(`src/assets/manifests/generated/raw-webgpu/raw_cooked_glb_loader_manifest_${levelId}.json`, "generated-audit-input", "Generated cooked-loader manifest to inspect, not edit.");
    await add("scripts/qa/builder-wgpu-resource-audit.mjs", "qa", "Asset readiness and Raw WebGPU source coverage audit.");
    await add("scripts/qa/visual-bake-contract.mjs", "qa", "Visual contract audit across official, builder, trial, raw, and runtime layers.");
  }

  if (area === "ui_runtime") {
    await add("src/game/core", "runtime-directory", "Gameplay state/progress behavior lives here; inspect before changing interaction behavior.");
    await add("src/ui", "ui-directory", "HUD, controls, pause, and player-facing surfaces live here.");
    await add("src/render", "render-directory", "3D/WebGPU rendering and visual affordances live here.");
  }

  if (area === "qa_or_docs") {
    await add("scripts/qa", "qa-directory", "Existing project QA should be extended before inventing parallel test paths.");
    await add("tools/human-protocol-mcp/LOOP.md", "mcp-docs", "Update the agent loop if this change affects future tool usage.");
  }

  const qaGates = qaGatesForArea(levelId, area);
  const risk = riskForArea(area);
  return {
    ok: true,
    writesFiles: false,
    levelId,
    intent,
    inferredArea: area,
    levelSource,
    fileCandidates,
    recommendedToolSequence: [
      { tool: "project_status", arguments: {} },
      { tool: "inspect_level_source", arguments: { levelId } },
      { tool: "compile_builder_project", arguments: { projectPath: rel } },
      ...qaGates.map((gate) => ({ tool: gate.tool, arguments: gate.arguments })),
    ],
    qaGates,
    risk,
    coordination: {
      suggestedScope: `${levelId}:${area}`,
      avoidConcurrentScopes: concurrentScopeWarnings(area),
      reportFormat: ["Done", "Evidence", "Problems", "Risk", "Next"],
    },
    guardrails: [
      "Do not edit generated Raw WebGPU JSON as a source fix.",
      "Keep Level 1/2 builder-native content in official builder JSON.",
      "Keep Level 3 museum exception behavior unless the requested change targets it explicitly.",
      "Use ConfigValidator and existing QA scripts as acceptance gates.",
      "Leave unrelated dirty worktree changes untouched.",
    ],
  };
}

async function claimScope(args) {
  const scope = cleanScope(args.scope);
  const agentId = cleanAgentId(args.agentId);
  const reason = String(args.reason ?? "").trim();
  if (!reason) throw new Error("reason is required");
  const ttlMinutes = clampNumber(args.ttlMinutes ?? 120, 5, 1440);
  const state = await loadCoordinationState();
  const now = Date.now();
  pruneExpiredScopes(state, now);
  const existing = state.scopes[scope];
  if (existing && existing.agentId !== agentId) {
    return {
      ok: false,
      conflict: true,
      scope,
      existing,
      message: `Scope ${scope} is already claimed by ${existing.agentId} until ${existing.expiresAt}.`,
    };
  }
  const claim = {
    scope,
    agentId,
    reason,
    claimedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMinutes * 60_000).toISOString(),
  };
  state.scopes[scope] = claim;
  await saveCoordinationState(state);
  return {
    ok: true,
    writesProjectFiles: false,
    writesIgnoredTmpState: true,
    statePath: path.relative(PKG_ROOT, COORDINATION_STATE_PATH),
    claim,
  };
}

async function releaseScope(args) {
  const scope = cleanScope(args.scope);
  const agentId = cleanAgentId(args.agentId);
  const state = await loadCoordinationState();
  pruneExpiredScopes(state, Date.now());
  const existing = state.scopes[scope];
  if (!existing) {
    await saveCoordinationState(state);
    return { ok: true, released: false, scope, message: "No active claim existed for this scope." };
  }
  if (existing.agentId !== agentId) {
    return {
      ok: false,
      conflict: true,
      scope,
      existing,
      message: `Scope ${scope} is claimed by ${existing.agentId}; ${agentId} cannot release it.`,
    };
  }
  delete state.scopes[scope];
  await saveCoordinationState(state);
  return { ok: true, released: true, scope, agentId };
}

async function listActiveScopes() {
  const state = await loadCoordinationState();
  const expired = pruneExpiredScopes(state, Date.now());
  if (expired.length) await saveCoordinationState(state);
  return {
    ok: true,
    writesProjectFiles: false,
    statePath: path.relative(PKG_ROOT, COORDINATION_STATE_PATH),
    activeScopes: Object.values(state.scopes).sort((a, b) => a.scope.localeCompare(b.scope)),
    expiredPruned: expired,
    recentLoopResults: state.loopResults.slice(-20),
  };
}

async function recordLoopResult(args) {
  const agentId = cleanAgentId(args.agentId);
  const scope = cleanScope(args.scope);
  const state = await loadCoordinationState();
  pruneExpiredScopes(state, Date.now());
  const activeClaim = state.scopes[scope] ?? null;
  const result = {
    recordedAt: new Date().toISOString(),
    agentId,
    scope,
    status: ["done", "blocked", "needs_followup"].includes(args.status) ? args.status : "done",
    done: String(args.done ?? "").trim(),
    evidence: String(args.evidence ?? "").trim(),
    problems: String(args.problems ?? "").trim(),
    risk: String(args.risk ?? "").trim(),
    next: String(args.next ?? "").trim(),
    activeClaimMatchesAgent: activeClaim?.agentId === agentId,
  };
  for (const key of ["done", "evidence", "problems", "risk", "next"]) {
    if (!result[key]) throw new Error(`${key} is required`);
  }
  state.loopResults.push(result);
  state.loopResults = state.loopResults.slice(-MAX_LOOP_RESULTS);
  await saveCoordinationState(state);
  return {
    ok: true,
    writesProjectFiles: false,
    writesIgnoredTmpState: true,
    statePath: path.relative(PKG_ROOT, COORDINATION_STATE_PATH),
    result,
  };
}

async function listAssetPacks(limit) {
  const roots = [
    "src/assets/manifests/builder",
    "src/assets/manifests/runtime",
    "src/assets/manifests/generated/raw-webgpu",
    "src/assets/manifests/reports",
  ];
  const files = [];
  for (const root of roots) {
    files.push(...(await listJsonLikeFiles(path.join(PKG_ROOT, root), root)));
  }
  const sorted = files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    ok: true,
    count: sorted.length,
    returned: Math.min(limit, sorted.length),
    files: sorted.slice(0, limit),
  };
}

async function inspectRuntimePack(levelId) {
  const safeLevelId = levelId.replace(/[^a-zA-Z0-9_]/g, "");
  if (!safeLevelId) throw new Error("levelId is required");
  const candidates = [
    `src/assets/manifests/generated/raw-webgpu/render_plan_${safeLevelId}.json`,
    `src/assets/manifests/generated/raw-webgpu/raw_cooked_glb_loader_manifest_${safeLevelId}.json`,
    `src/assets/manifests/generated/raw-webgpu/asset_sidecars_${safeLevelId}.json`,
  ];
  const files = [];
  for (const rel of candidates) {
    const abs = path.join(PKG_ROOT, rel);
    try {
      const st = await stat(abs);
      const raw = await readFile(abs, "utf8");
      const parsed = JSON.parse(raw);
      files.push({
        path: rel,
        bytes: st.size,
        summary: summarizeJson(parsed),
      });
    } catch (error) {
      files.push({ path: rel, missing: true });
    }
  }
  return { ok: true, levelId: safeLevelId, files };
}

async function listJsonLikeFiles(absRoot, relRoot) {
  const found = [];
  let names;
  try {
    names = await readdir(absRoot, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of names) {
    const abs = path.join(absRoot, entry.name);
    const rel = `${relRoot}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...(await listJsonLikeFiles(abs, rel)));
    } else if (entry.name.endsWith(".json") || entry.name.endsWith(".md")) {
      const st = await stat(abs);
      found.push({ path: rel, bytes: st.size });
    }
  }
  return found;
}

async function loadCoordinationState() {
  try {
    const raw = await readFile(COORDINATION_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: "human-protocol-mcp-coordination@1",
      scopes: parsed.scopes && typeof parsed.scopes === "object" ? parsed.scopes : {},
      loopResults: Array.isArray(parsed.loopResults) ? parsed.loopResults : [],
    };
  } catch {
    return {
      schemaVersion: "human-protocol-mcp-coordination@1",
      scopes: {},
      loopResults: [],
    };
  }
}

async function saveCoordinationState(state) {
  await mkdir(path.dirname(COORDINATION_STATE_PATH), { recursive: true });
  const tmpPath = `${COORDINATION_STATE_PATH}.${process.pid}.tmp`;
  const stableState = {
    schemaVersion: "human-protocol-mcp-coordination@1",
    updatedAt: new Date().toISOString(),
    scopes: state.scopes ?? {},
    loopResults: state.loopResults ?? [],
  };
  await writeFile(tmpPath, `${JSON.stringify(stableState, null, 2)}\n`);
  await rename(tmpPath, COORDINATION_STATE_PATH);
}

function pruneExpiredScopes(state, nowMs) {
  const expired = [];
  for (const [scope, claim] of Object.entries(state.scopes ?? {})) {
    if (Date.parse(claim.expiresAt) <= nowMs) {
      expired.push(claim);
      delete state.scopes[scope];
    }
  }
  return expired;
}

function cleanScope(value) {
  const scope = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9:_./-]{1,140}$/.test(scope)) {
    throw new Error("scope must be 1-140 chars using letters, numbers, colon, underscore, slash, dot, or dash");
  }
  return scope;
}

function cleanAgentId(value) {
  const agentId = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9:_./-]{1,100}$/.test(agentId)) {
    throw new Error("agentId must be 1-100 chars using letters, numbers, colon, underscore, slash, dot, or dash");
  }
  return agentId;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

async function fileCandidate(projectPath, role, reason) {
  const abs = path.join(PKG_ROOT, projectPath);
  try {
    const st = await stat(abs);
    return {
      path: projectPath,
      role,
      reason,
      exists: true,
      type: st.isDirectory() ? "directory" : "file",
    };
  } catch {
    return {
      path: projectPath,
      role,
      reason,
      exists: false,
      type: "missing",
    };
  }
}

function inferPatchArea(intent, requestedArea) {
  if (requestedArea && requestedArea !== "auto") return requestedArea;
  const text = intent.toLowerCase();
  if (/(asset|visual|wgpu|webgpu|raw|render|lighting|light|material|glb|model|texture|decal|pack|manifest)/.test(text)) return "asset_or_visual";
  if (/(door|key|lock|puzzle|switch|orb|objective|wave|enemy|spawn|pickup|room|level)/.test(text)) return "puzzle_or_door";
  if (/(compiler|compile|schema|validator|validate|definition|authoring)/.test(text)) return "compiler_or_validator";
  if (/(hud|ui|control|mobile|touch|pointer|pause|menu|button|overlay)/.test(text)) return "ui_runtime";
  if (/(test|qa|smoke|doc|readme|mcp|loop)/.test(text)) return "qa_or_docs";
  return "level_content";
}

function qaGatesForArea(levelId, area) {
  const gates = [
    {
      tool: "compile_builder_project",
      arguments: { projectPath: OFFICIAL_BUILDER_BY_LEVEL[levelId] },
      reason: "The official builder source must still compile into a valid LevelDefinition.",
    },
    {
      tool: "run_official_qa",
      arguments: { levelId },
      reason: "Official source parity should pass for the touched maintained level.",
    },
  ];
  if (area === "asset_or_visual") {
    gates.push(
      {
        tool: "run_asset_qa",
        arguments: { suite: "builder_wgpu_assets", levelId: "all" },
        reason: "Asset registry and Raw WebGPU resource readiness must remain coherent.",
      },
      {
        tool: "run_asset_qa",
        arguments: { suite: "visual_bake_contract", levelId },
        reason: "Visual/source-layer contract should pass for the focused level.",
      },
    );
  }
  if (area === "puzzle_or_door" || area === "compiler_or_validator" || area === "ui_runtime") {
    gates.push({
      tool: "run_smoke_campaign",
      arguments: {},
      reason: "Progression, runtime interactions, and campaign integrity can be affected.",
    });
  }
  return gates;
}

function riskForArea(area) {
  if (area === "compiler_or_validator" || area === "ui_runtime") return "high";
  if (area === "asset_or_visual" || area === "puzzle_or_door") return "medium";
  if (area === "qa_or_docs") return "low";
  return "medium";
}

function concurrentScopeWarnings(area) {
  if (area === "compiler_or_validator") return ["all level_content", "puzzle_or_door", "asset_or_visual"];
  if (area === "asset_or_visual") return ["runtime-pack", "raw-webgpu-build", "asset-registry"];
  if (area === "puzzle_or_door") return ["same-level level_content", "compiler_or_validator"];
  if (area === "ui_runtime") return ["render", "game-core", "mobile-controls"];
  return ["same-file edits"];
}

function summarizeJson(value) {
  if (!value || typeof value !== "object") return { type: typeof value };
  const summary = {
    keys: Object.keys(value).slice(0, 30),
  };
  for (const key of ["schemaVersion", "levelId", "title", "bakeMode", "engineVersion"]) {
    if (value[key] !== undefined) summary[key] = value[key];
  }
  if (value.counts && typeof value.counts === "object") summary.counts = value.counts;
  if (Array.isArray(value.resources)) summary.resources = value.resources.length;
  if (Array.isArray(value.instances)) summary.instances = value.instances.length;
  if (Array.isArray(value.meshes)) summary.meshes = value.meshes.length;
  if (Array.isArray(value.materials)) summary.materials = value.materials.length;
  return summary;
}

async function runNodeHelper(scriptName, args, timeoutMs) {
  return runCommand(process.execPath, [path.join(TOOL_ROOT, "helpers", scriptName), ...args], timeoutMs);
}

async function runCommand(command, args, timeoutMs, options = {}) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: PKG_ROOT,
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES * 2,
        env: { ...process.env, FORCE_COLOR: "0" },
      },
      (error, stdout, stderr) => {
        const result = {
          ok: !error,
          command: [command, ...args].join(" "),
          durationMs: Date.now() - startedAt,
          exitCode: error?.code ?? 0,
          signal: error?.signal ?? null,
          stdout: truncate(stdout),
          stderr: truncate(stderr),
        };
        if (error && !options.doNotThrow) resolve(result);
        else resolve(result);
      },
    );
  });
}

function safeRepoPath(inputPath) {
  if (!inputPath || typeof inputPath !== "string") throw new Error("projectPath is required");
  const abs = path.isAbsolute(inputPath) ? path.resolve(inputPath) : path.resolve(PKG_ROOT, inputPath);
  if (!abs.startsWith(`${PKG_ROOT}${path.sep}`) && abs !== PKG_ROOT) {
    throw new Error(`Path escapes Human Protocol repo: ${inputPath}`);
  }
  return path.relative(PKG_ROOT, abs);
}

function truncate(text) {
  const value = text ?? "";
  if (value.length <= MAX_OUTPUT_BYTES) return value;
  return `${value.slice(0, MAX_OUTPUT_BYTES)}\n...[truncated ${value.length - MAX_OUTPUT_BYTES} chars]`;
}

function sendResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function sendError(id, code, message, data) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } })}\n`);
}
