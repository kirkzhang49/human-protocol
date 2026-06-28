# Human Protocol MCP

`human-protocol-mcp` exposes a small, safe tool layer for the Human Protocol 3D game/editor project.

The first version is intentionally read-only except for allowlisted QA commands. It wraps the existing project systems instead of reimplementing game logic:

- official builder JSON inspection
- `ConfigValidator` validation via Vite SSR
- `compileBuilderProjectToLevel` compilation via Vite SSR
- official builder-source QA
- smoke campaign QA
- asset/runtime manifest inspection
- allowlisted asset/visual contract QA
- read-only patch planning
- ignored `.tmp` coordination state for concurrent agents

## Why This Exists

Human Protocol is config-driven:

```text
BuilderProject -> compileBuilderProjectToLevel -> LevelDefinition -> ConfigValidator -> QA/runtime pack
```

The MCP server gives AI agents a stable way to inspect that chain without guessing which files to read or which command to run.

Future agents should start with [`AGENT_GUIDE.md`](./AGENT_GUIDE.md). It explains how to use MCP to understand the game before editing.

## Tools

| Tool | Purpose | Writes files |
|---|---|---|
| `project_status` | Repo, maintained slice, dirty worktree summary, safety boundaries | No |
| `list_levels` | Official builder sources, level folders, smoke configs | No |
| `inspect_level_source` | Counts and IDs from an official builder JSON | No |
| `validate_level` | Runs `validateLevelConfig` against a built-in level | No |
| `compile_builder_project` | Compiles a builder JSON and validates the generated level | No |
| `run_official_qa` | Runs `npm run qa:build-official` for `all` or one maintained level | No direct writes, but project scripts may refresh generated reports |
| `run_smoke_campaign` | Runs `npm run smoke:campaign` | No direct writes |
| `run_asset_qa` | Runs allowlisted asset/visual QA suites such as builder WGPU readiness or visual bake contracts | No direct MCP writes, but project scripts may refresh generated reports |
| `propose_level_patch` | Produces a read-only patch plan with likely files, risk, coordination scope, and QA gates | No |
| `claim_scope` | Claims a non-overlapping work scope for one agent/session | Writes ignored `.tmp` state only |
| `release_scope` | Releases a claimed work scope | Writes ignored `.tmp` state only |
| `list_active_scopes` | Lists active scope claims and recent loop results | May prune expired ignored `.tmp` state |
| `record_loop_result` | Records a `Done / Evidence / Problems / Risk / Next` loop result | Writes ignored `.tmp` state only |
| `list_asset_packs` | Lists manifest files under builder/runtime/generated/reports | No |
| `inspect_runtime_pack` | Summarizes generated Raw WebGPU manifests for one level | No |

## Run A Local Smoke Test

From `games/human-protocol`:

```bash
node tools/human-protocol-mcp/smoke-test.mjs
```

The smoke harness calls the server through stdio JSON-RPC and checks initialization, tool listing, project status, maintained level discovery, Level 1 source inspection, validation, compilation, asset manifest listing, runtime pack inspection, official QA, read-only patch planning, the asset QA wrapper, and coordination claim/record/list/release.

## Example MCP Client Configuration

Use an absolute path to `server.mjs`:

```json
{
  "mcpServers": {
    "human-protocol": {
      "command": "node",
      "args": [
        "/Users/zhengkaizhang/Documents/human-protocol/tools/human-protocol-mcp/server.mjs"
      ]
    }
  }
}
```

## Safety Boundaries

- The MCP server does not edit files directly.
- `projectPath` arguments must resolve inside the Human Protocol repo.
- Command execution is allowlisted.
- Some allowlisted project QA scripts write or refresh generated reports; the MCP layer reports that rather than hiding it.
- Coordination tools write only ignored `.tmp/human-protocol-mcp/state.json`.
- Level 1/2 builder-native sources remain the official production slice.
- Level 3 remains the museum exception path.
- Level 4+ are not default QA gates until rebuilt.

## Next Loop

The practical onboarding guide lives in [`AGENT_GUIDE.md`](./AGENT_GUIDE.md), and the repeatable execution loop lives in [`LOOP.md`](./LOOP.md).

Short version:

1. Inspect project status and maintained sources.
2. Validate or compile before judging runtime output.
3. Run the smallest relevant QA gate.
4. Report `Done / Evidence / Problems / Risk / Next`.
5. Use coordination scopes before parallel agents touch related areas.
6. Keep code-write tools behind a future explicit safe-write layer.
