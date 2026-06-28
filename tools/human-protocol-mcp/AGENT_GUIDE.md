# Agent Guide: Understanding Human Protocol Through MCP

This guide is for future agents joining the Human Protocol repo. Use the MCP server to build a correct mental model of the game before reading random files or proposing edits.

## First Principle

Human Protocol is a config-driven 3D escape-room game/editor.

The core chain is:

```text
BuilderProject
  -> compileBuilderProjectToLevel
  -> LevelDefinition
  -> ConfigValidator
  -> official QA / smoke campaign
  -> runtime pack / Raw WebGPU manifests
```

The rule of thumb:

- Code owns reusable verbs: doors, keys, pickups, puzzle types, combat, UI, rendering, validation.
- Config owns level nouns: rooms, order, pacing, copy, IDs, door links, puzzle placement, waves, visual references.

Do not hide level-specific progression in runtime code. Prefer config/compiler/validator changes that keep official content inspectable.

## Before You Touch Anything

Use the MCP tools in this order.

### 1. Learn The Project State

Call:

```json
{
  "tool": "project_status",
  "arguments": {}
}
```

Look for:

- repo root
- dirty worktree size
- maintained official slice
- safety boundaries
- whether another agent has active scopes

If the worktree is dirty, assume the user or another agent made those changes. Do not revert unrelated files.

### 2. Learn The Maintained Game Slice

Call:

```json
{
  "tool": "list_levels",
  "arguments": {}
}
```

Current policy:

- Level 1 and Level 2 are builder-native official levels.
- Level 3 is the museum exception path.
- Level 4+ are not default QA or maintenance targets until rebuilt.

Important sources:

- `level_01_maintenance_bay`: `src/game/config/levels/level01-maintenance-bay/level.official.builder.json`
- `level_02_residential_simulation`: `src/game/config/levels/level02-residential-simulation/level.official.builder.json`
- `level_03_human_museum`: `src/game/config/levels/level03-human-museum/level.official.builder.json`

### 3. Inspect The Level Source

Call:

```json
{
  "tool": "inspect_level_source",
  "arguments": {
    "levelId": "level_01_maintenance_bay"
  }
}
```

Use this to learn rooms, doors, puzzles, pickups, waves, lights, and IDs from the official builder source.

Do this before searching the repo. It tells you which names and IDs matter.

### 4. Compile And Validate

For a built-in runtime level, call:

```json
{
  "tool": "validate_level",
  "arguments": {
    "levelId": "level_01_maintenance_bay"
  }
}
```

For a builder JSON source, call:

```json
{
  "tool": "compile_builder_project",
  "arguments": {
    "projectPath": "src/game/config/levels/level01-maintenance-bay/level.official.builder.json"
  }
}
```

If compile or validation fails, treat the error as the first thing to understand. Do not patch around `ConfigValidator`.

### 5. Inspect Asset And Runtime Pack State

Call:

```json
{
  "tool": "list_asset_packs",
  "arguments": {
    "limit": 40
  }
}
```

Then call:

```json
{
  "tool": "inspect_runtime_pack",
  "arguments": {
    "levelId": "level_01_maintenance_bay"
  }
}
```

Use this path when debugging visuals, lighting, Raw WebGPU, generated manifests, cooked GLB loader manifests, or missing model keys.

Generated Raw WebGPU JSON is output, not source of truth. Inspect it, but do not fix bugs by editing it directly.

## Planning A Change

Before editing, ask the MCP planner.

```json
{
  "tool": "propose_level_patch",
  "arguments": {
    "levelId": "level_01_maintenance_bay",
    "intent": "Fix missing visual readiness for the human reference triptych decal.",
    "area": "asset_or_visual"
  }
}
```

Use the result to decide:

- likely files
- why each file matters
- config/compiler/runtime boundary
- risk level
- QA gates
- coordination scope

The planner does not write files. It is there to prevent blind edits.

## Coordinating With Other Agents

Claim a scope before doing real work.

```json
{
  "tool": "claim_scope",
  "arguments": {
    "scope": "level_01_maintenance_bay:asset_or_visual",
    "agentId": "agent-name-or-session-id",
    "reason": "Investigating missing Raw WebGPU readiness for Level 1 decal.",
    "ttlMinutes": 120
  }
}
```

If the tool returns a conflict, stop and choose another scope or ask the user.

When done, record the loop result:

```json
{
  "tool": "record_loop_result",
  "arguments": {
    "agentId": "agent-name-or-session-id",
    "scope": "level_01_maintenance_bay:asset_or_visual",
    "status": "done",
    "done": "What changed or what was learned.",
    "evidence": "Commands, MCP outputs, or files inspected.",
    "problems": "Failures, warnings, or unknowns.",
    "risk": "Residual risk.",
    "next": "Recommended next step."
  }
}
```

Then release the scope:

```json
{
  "tool": "release_scope",
  "arguments": {
    "scope": "level_01_maintenance_bay:asset_or_visual",
    "agentId": "agent-name-or-session-id"
  }
}
```

Coordination state lives in ignored `.tmp/human-protocol-mcp/state.json`. It is not a source file.

## Choosing QA Gates

Use the smallest gate that proves the thing you touched.

For official source parity:

```json
{
  "tool": "run_official_qa",
  "arguments": {
    "levelId": "level_01_maintenance_bay"
  }
}
```

For campaign progression:

```json
{
  "tool": "run_smoke_campaign",
  "arguments": {}
}
```

For asset and visual contract work:

```json
{
  "tool": "run_asset_qa",
  "arguments": {
    "suite": "builder_wgpu_assets",
    "levelId": "all"
  }
}
```

Supported asset QA suites:

- `builder_wgpu_assets`
- `visual_bake_contract`
- `builder_to_official`

Known current state: `builder_wgpu_assets` can return exit code 1 because the underlying project QA reports existing Raw WebGPU readiness gaps for `decal_human_reference_triptych` and `puzzle_orb_pedestal`. Preserve that signal; do not hide it.

## How To Understand A Bug

Use this decision path.

### Level progression bug

1. `inspect_level_source`
2. `compile_builder_project`
3. `validate_level`
4. `run_official_qa`
5. `run_smoke_campaign`

Likely files:

- official builder JSON
- `src/build/compileBuilderProjectToLevel.ts`
- `src/game/config/ConfigValidator.ts`
- runtime interaction/state code under `src/game/core`

### Visual or asset bug

1. `inspect_level_source`
2. `inspect_runtime_pack`
3. `run_asset_qa` with `builder_wgpu_assets`
4. `run_asset_qa` with `visual_bake_contract`

Likely files:

- official builder JSON
- `src/build/runtime-pack/BuilderRuntimeAssetIndex.ts`
- `src/assets/environmentModelAssets.ts`
- builder asset manifests under `src/assets/manifests/builder`
- Raw WebGPU generation scripts, if the source contract is correct but output is stale

### UI or controls bug

1. `project_status`
2. `propose_level_patch` with `area: "ui_runtime"`
3. inspect `src/ui`, `src/game/core`, and `src/render`
4. run campaign smoke, then browser/manual QA if visuals changed

## Do Not Do These Things

- Do not edit generated Raw WebGPU manifests as the source fix.
- Do not resurrect old Level 1/2 legacy source content to fix builder-native official levels.
- Do not bypass `ConfigValidator`.
- Do not add one-off runtime branches for a level-specific puzzle unless the user explicitly asks for a temporary exception.
- Do not expose debug IDs, raw config dumps, or demo labels in normal player UI.
- Do not run broad destructive commands or revert unrelated dirty files.

## Final Report Shape

Every agent should end with:

```text
Done:
Evidence:
Problems:
Risk:
Next:
```

That shape is intentionally boring. It keeps long-running multi-agent work legible.
