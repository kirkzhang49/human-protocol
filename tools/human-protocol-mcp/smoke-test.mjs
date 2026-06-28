#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("./server.mjs", import.meta.url));
const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "inherit"] });
const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
let nextId = 1;

rl.on("line", (line) => {
  const message = JSON.parse(line);
  const resolver = pending.get(message.id);
  if (resolver) {
    pending.delete(message.id);
    resolver(message);
  }
});

function request(method, params) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve) => pending.set(id, resolve));
}

const init = await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "hp-mcp-smoke" } });
const tools = await request("tools/list", {});
const status = await request("tools/call", { name: "project_status", arguments: {} });
const levels = await request("tools/call", { name: "list_levels", arguments: {} });
const inspect = await request("tools/call", {
  name: "inspect_level_source",
  arguments: { levelId: "level_01_maintenance_bay" },
});
const validate = await request("tools/call", {
  name: "validate_level",
  arguments: { levelId: "level_01_maintenance_bay" },
});
const compile = await request("tools/call", {
  name: "compile_builder_project",
  arguments: { projectPath: "src/game/config/levels/level01-maintenance-bay/level.official.builder.json" },
});
const assets = await request("tools/call", { name: "list_asset_packs", arguments: { limit: 5 } });
const runtimePack = await request("tools/call", {
  name: "inspect_runtime_pack",
  arguments: { levelId: "level_01_maintenance_bay" },
});
const officialQa = await request("tools/call", {
  name: "run_official_qa",
  arguments: { levelId: "level_01_maintenance_bay" },
});
const patchPlan = await request("tools/call", {
  name: "propose_level_patch",
  arguments: {
    levelId: "level_01_maintenance_bay",
    intent: "Fix a missing Raw WebGPU visual asset without editing generated manifests.",
    area: "asset_or_visual",
  },
});
const assetQa = await request("tools/call", {
  name: "run_asset_qa",
  arguments: { suite: "builder_wgpu_assets", levelId: "all" },
});
const claimScope = await request("tools/call", {
  name: "claim_scope",
  arguments: {
    scope: "mcp_smoke:level_01_maintenance_bay",
    agentId: "hp-mcp-smoke",
    reason: "Verify coordination state tools.",
    ttlMinutes: 5,
  },
});
const recordLoop = await request("tools/call", {
  name: "record_loop_result",
  arguments: {
    agentId: "hp-mcp-smoke",
    scope: "mcp_smoke:level_01_maintenance_bay",
    status: "done",
    done: "Smoke-verified MCP coordination tools.",
    evidence: "claim_scope, record_loop_result, list_active_scopes, and release_scope returned structured results.",
    problems: "None in the coordination layer.",
    risk: "Low; writes only ignored .tmp state.",
    next: "Keep code-writing tools separate from coordination tools.",
  },
});
const activeScopes = await request("tools/call", { name: "list_active_scopes", arguments: {} });
const releaseScope = await request("tools/call", {
  name: "release_scope",
  arguments: {
    scope: "mcp_smoke:level_01_maintenance_bay",
    agentId: "hp-mcp-smoke",
  },
});

const assetQaResult = JSON.parse(assetQa.result.content[0].text);
const claimScopeResult = JSON.parse(claimScope.result.content[0].text);
const recordLoopResult = JSON.parse(recordLoop.result.content[0].text);
const activeScopesResult = JSON.parse(activeScopes.result.content[0].text);
const releaseScopeResult = JSON.parse(releaseScope.result.content[0].text);

console.log(
  JSON.stringify(
    {
      initialize: init.result?.serverInfo,
      toolCount: tools.result?.tools?.length ?? 0,
      projectStatus: JSON.parse(status.result.content[0].text).ok,
      officialSourceCount: JSON.parse(levels.result.content[0].text).officialBuilderSources.length,
      level01Rooms: JSON.parse(inspect.result.content[0].text).counts.rooms,
      validateLevel01: JSON.parse(JSON.parse(validate.result.content[0].text).stdout).ok,
      compileLevel01: JSON.parse(JSON.parse(compile.result.content[0].text).stdout).ok,
      assetSampleCount: JSON.parse(assets.result.content[0].text).files.length,
      runtimePackFiles: JSON.parse(runtimePack.result.content[0].text).files.filter((file) => !file.missing).length,
      officialQaLevel01: JSON.parse(officialQa.result.content[0].text).ok,
      patchPlannerWritesFiles: JSON.parse(patchPlan.result.content[0].text).writesFiles,
      assetQaToolResponded: typeof assetQaResult.exitCode === "number",
      assetQaCurrentOk: assetQaResult.ok,
      assetQaCurrentExitCode: assetQaResult.exitCode,
      coordinationClaimed: claimScopeResult.ok,
      coordinationRecorded: recordLoopResult.ok,
      coordinationActiveDuringSmoke: activeScopesResult.activeScopes.some((claim) => claim.scope === "mcp_smoke:level_01_maintenance_bay"),
      coordinationReleased: releaseScopeResult.released,
    },
    null,
    2,
  ),
);

child.stdin.end();
child.kill();
