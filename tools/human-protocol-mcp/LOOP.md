# Human Protocol MCP Execution Loop

This document defines the repeatable loop for using `human-protocol-mcp` as a safe control layer for Human Protocol development.

## Goal

Give an AI agent a small set of reliable tools to understand the current Human Protocol project state, inspect official level sources, verify compiler/runtime contracts, and report next steps without guessing or editing unrelated files.

The v0 server is intentionally conservative:

- read-only project inspection
- allowlisted QA commands
- maintained official slice only
- no direct file mutation tools
- ignored `.tmp` coordination state for agent claims and loop results
- no hidden runtime logic outside the existing compiler, validator, and QA scripts

Some allowlisted project QA scripts refresh generated report files. The MCP layer should surface that as part of the command result; it should not pretend those scripts are pure reads.

## Current Core Loop

Run the loop in this order.

1. Call `project_status`.
   Check repo root, maintained level policy, safety mode, and dirty worktree size.

2. Call `list_levels`.
   Confirm which official builder sources, level folders, and smoke configs exist.

3. Pick a target from the maintained slice.
   Default targets are `level_01_maintenance_bay`, `level_02_residential_simulation`, and `level_03_human_museum`.

4. Inspect source and generated assets.
   Use `inspect_level_source`, `list_asset_packs`, and `inspect_runtime_pack` before assuming where a bug lives.

5. Validate and compile.
   Use `validate_level` for built-in runtime levels and `compile_builder_project` for builder JSON sources.

6. Run the smallest relevant QA gate.
   Use `run_official_qa` for builder-source parity and `run_smoke_campaign` for campaign-level integrity.

7. Report in a fixed shape.
   Every agent loop should end with:

```text
Done:
Evidence:
Problems:
Risk:
Next:
```

## Self-Review Rubric

Before proposing any next action, the agent should answer these questions:

- Did I inspect the source of truth before judging runtime output?
- Did I stay inside Level 1/2 builder-native rules and Level 3 museum exception rules?
- Did I avoid treating generated Raw WebGPU JSON as the source of truth?
- Did I use existing compiler, validator, and QA scripts instead of inventing a parallel checker?
- Did I produce evidence from commands or tool output, not vibes?
- Did I leave unrelated dirty worktree changes alone?

## Verified v0 Evidence

The local smoke harness exercises the server through stdio JSON-RPC and calls the core tools.

Command:

```bash
node tools/human-protocol-mcp/smoke-test.mjs
```

Latest verified summary:

```json
{
  "initialize": {
    "name": "human-protocol-mcp",
    "version": "0.1.0"
  },
  "toolCount": 15,
  "projectStatus": true,
  "officialSourceCount": 3,
  "level01Rooms": 3,
  "validateLevel01": true,
  "compileLevel01": true,
  "assetSampleCount": 5,
  "runtimePackFiles": 3,
  "officialQaLevel01": true,
  "patchPlannerWritesFiles": false,
  "assetQaToolResponded": true,
  "assetQaCurrentOk": false,
  "assetQaCurrentExitCode": 1,
  "coordinationClaimed": true,
  "coordinationRecorded": true,
  "coordinationActiveDuringSmoke": true,
  "coordinationReleased": true
}
```

Focused verification already covered:

- `validate_level` on `level_01_maintenance_bay`
- `compile_builder_project` on Level 1 official builder JSON
- `run_official_qa` on `level_01_maintenance_bay`
- `run_smoke_campaign` on the maintained campaign slice
- `propose_level_patch` for a Level 1 asset/visual fix plan
- `run_asset_qa` wrapper around `qa:builder:wgpu-assets`
- `claim_scope`, `record_loop_result`, `list_active_scopes`, and `release_scope`

Current `run_smoke_campaign` result is PASS. It reports two existing built-in config warnings for `obj_reach_exit` static graph completion in Level 2 and Level 3; those warnings predate this MCP layer and do not fail the campaign smoke gate.

Current `run_asset_qa` with `builder_wgpu_assets` returns exit code 1 because the underlying project QA reports existing Raw WebGPU readiness gaps for `decal_human_reference_triptych` and `puzzle_orb_pedestal`. The tool is working correctly by preserving the failing project state.

## Implemented Loops

### v1: Better Asset QA Surface

Implemented as `run_asset_qa`.

Supported suites:

- `builder_wgpu_assets`
- `visual_bake_contract`
- `builder_to_official`

Acceptance:

- allowlisted command only: done
- no direct write surface in MCP itself: done
- output includes pass/fail, duration, stdout, stderr, suite, and purpose: done
- README documents generated-report caveat: done

### v2: Patch Planning Without Writes

Implemented as `propose_level_patch`.

It should return:

- target files
- exact reason each file is involved
- intended config/compiler/runtime boundary
- QA gates required after the change
- risk level

It does not write files. Human approval or a separate coding pass should perform the edit.

### v3: Agent Coordination

Implemented as ignored `.tmp` state tools.

Tools:

- `claim_scope`
- `release_scope`
- `list_active_scopes`
- `record_loop_result`

The state file is `.tmp/human-protocol-mcp/state.json`, which is ignored by git. This lets agents coordinate without changing game source files.

Acceptance:

- scope claims include agent, reason, claim time, and expiry: done
- conflicts return structured `ok: false` results: done
- loop results use the fixed `Done / Evidence / Problems / Risk / Next` shape: done
- smoke harness verifies claim/record/list/release: done

## Next Implementation Loops

### v4: Safe Write Mode

Only add write-capable tools after the read-only/planner/coordination layers are boring and reliable.

Write mode must require:

- narrow file allowlist
- dry-run patch preview
- path escaping checks
- post-edit `git diff --check`
- relevant QA gate selection
- explicit report of files changed

### v5: Real Play QA Bridge

After v4, add a tool that launches the existing real playthrough/browser QA and returns screenshots or structured failure summaries. Keep visual/browser verification separate from source edits.

## Recommended Next Goal

The next useful goal is:

```text
Implement v4 safe write mode with dry-run patch preview and strict file allowlists, then verify it on a docs-only patch before allowing game source edits.
```

That is the next step toward a larger multi-agent workflow. Do not jump directly from coordination to broad code-writing tools.
