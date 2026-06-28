# Human Protocol Agent-Native Asset Lab vNext

This document turns the supplied research notes into a durable direction for the future Human Protocol asset lab. It is intentionally agent-facing: the asset lab should not become a freeform art chat or a manual DCC replacement. It should become a constraint-driven generation, validation, repair, and runtime QA loop.

Source materials:

- `/Users/zhengkaizhang/Downloads/面向 Agent 的程序化与精确建模游戏引擎研究报告.pdf`
- `/Users/zhengkaizhang/.codex/attachments/b996d584-12e0-4e05-8d69-bff6bff0620f/pasted-text.txt`

## Core Thesis

Mathematics is the truth layer. LLMs are proposal and repair layers. The engine is an agent-facing simulation operating system.

For Human Protocol, the research-backed opportunity is not to invent a new universal hand, furniture, robot, or lighting formula. The stronger path is a typed, reproducible, validator-first system:

```text
Natural-language art goal
  -> AssetSpec JSON
  -> deterministic constraint compiler
  -> geometry / rig / collision / material / lighting tasks
  -> generated artifacts
  -> authoring validators
  -> runtime validators
  -> machine-readable QA report
  -> local repair patch
  -> retry or accept
```

The LLM should propose typed JSON and patches. It should not directly own mesh truth, collision truth, animation truth, or lighting truth.

## Asset Lab Roles

The future lab should use a layered workflow rather than peer-to-peer agent chat.

| Role | LLM? | Input | Output | Rule |
| --- | --- | --- | --- | --- |
| Planner | Yes | user goal, references, budget | `AssetSpec.json` | Produces structure, not mesh. |
| Constraint Compiler | No | spec, templates | constraint graph, worker tasks | Deterministic and cacheable. |
| Geometry Worker | No | part program, grammar, dimensions | mesh, GLB/USD sidecar, thumbnails | Uses procedural primitives, Blender/OpenCascade-style authoring, or GLB refinement. |
| Rig & IK Worker | No | skeleton, joints, targets | pose, animation clips, rig report | FK/FABRIK/LM-style deterministic solve. |
| Physics & Collision Worker | No | mesh, articulation, collision policy | collision proxies, penetration report | Render mesh and collision mesh must be separate. |
| Material & Lighting Worker | No/Optional | material spec, scene kit, lighting objective | PBR material pass, lighting report | Uses scoring functions and runtime capture, not hand-tuned vibes. |
| Export Worker | No | accepted artifacts | GLB/runtime bundle, manifest entry | Deterministic exporter and stable keys. |
| Validator | No | artifacts, screenshots, runtime profile | `qa_report.json` | Hard fail first, score second. |
| Repair Agent | Yes | QA report, failure memory | small `PatchSpec.json` | Only edits scoped parameters. |

## Typed AssetSpec IR

Every generated asset should begin as a typed intermediate representation. Do not hide intent, constraints, optimization weights, or thresholds inside prompts.

This is now a blueprint-first rule. Robots, furniture, room kits, lighting,
materials, collision, animations, first-person viewmodels, and runtime exports
should each start from the relevant type-specific blueprint, then produce source
models, GLBs, manifests, and config references. See
`human-protocol-blueprint-first-asset-pipeline.md` for the game-side handoff
contract.

Minimum blocks:

- `identity`: stable asset id, category, IP/style family, intended levels/kits.
- `parameters`: dimensions, primitive parts, joints, material families, texture variants.
- `constraints`: hard geometry, symmetry, support, collision, joint limit, visibility, runtime rules.
- `objectives`: weighted soft goals such as premium silhouette, readable pickup, cinematic reflections.
- `generators`: grammar rules, procedural seeds, part templates, variant ranges.
- `validators`: hard fail thresholds and score thresholds.
- `artifacts`: expected GLB, images, screenshots, reports, and manifest entries.

Example shape:

```json
{
  "schema": "human-protocol/asset-spec@2",
  "assetId": "hp_room_maintenance_supply_cabinet_v2",
  "category": "room_prop",
  "styleFamily": "maintenance_combat_bay_v1",
  "parameters": {
    "dimensionsM": [1.1, 2.15, 0.46],
    "partProgram": [
      { "id": "body", "type": "box", "role": "cabinet_shell" },
      { "id": "doors", "type": "paired_sliding_panels", "role": "interactable_faces" },
      { "id": "handles", "type": "cylinder_pair", "role": "affordance" }
    ],
    "materialFamily": "smoked_titanium_pale_cyan",
    "texturePlan": "multi-face_trim_sheet"
  },
  "constraints": {
    "supportPolygonStable": true,
    "noFloatingParts": true,
    "doorClearanceM": 0.08,
    "collisionProxy": "convex_parts",
    "agentAffordances": ["open", "inspect"]
  },
  "objectives": {
    "premiumSilhouette": 0.32,
    "faceTextureAlignment": 0.24,
    "runtimeReadability": 0.22,
    "performanceBudget": 0.22
  },
  "validators": {
    "maxUnattachedPartCount": 0,
    "maxTextureUvStretch": 1.8,
    "maxWebRuntimeDrawCalls": 6,
    "requiresRuntimeScreenshot": true
  }
}
```

## Representations Per Asset

Each serious asset should keep more than one representation:

- Program representation: AssetSpec, part program, shape grammar, solver config.
- Authoring representation: Blender/GLB/USD sidecar, high-fidelity mesh, material assignments.
- Runtime representation: GLB plus compressed textures, collision proxies, interaction metadata.
- Solver representation: SDF, simplified convex parts, skeleton, puzzle graph, or lighting sample points.

This prevents the common failure where a model looks fine in Blender but is not playable, collidable, readable, or repairable.

## Domain Rules

For furniture and room props:

- Prefer part programs, symmetry, parameterized dimensions, support polygons, CSG/SDF-style cuts, and explicit affordances.
- Drawer, door, handle, key slot, cabinet, bed, table, and terminal faces must have named parts and agent-readable interaction roles.
- Texture plans should specify face groups instead of one giant wrap when the asset has readable symbols.

For rooms and escape-game spaces:

- Use room graph plus shape grammar.
- Every kit should compile to geometry, nav/collision, lighting samples, puzzle dependency graph, and runtime QA points.
- A room is not accepted unless the graph proves there is no softlock and the runtime playthrough reaches its goal.

For robots and articulated assets:

- Use a kinematic tree with named joints, limits, collision shapes, and animation slots.
- Use FK/FABRIK for preview, LM/DLS-style refinement for final clips, and separate collision proxies.
- Hit reactions should not constantly interrupt locomotion; gameplay animation policy belongs in config/QA.

For lighting:

- Do not chase a single perfect visual by hand.
- Define a feasible region using PBR sanity, exposure, contact shadow proxy, floor reflection composition, pickup readability, enemy silhouette, and runtime screenshot review.
- The existing Level 01 Objective v2 is a first step; future versions should add screenshot sampling and better GI/reflection proxies before replacing room kit parameters.

## Validator Stack

Hard fail before soft score.

Hard validators:

- JSON schema valid, all ids unique, no unknown keys in strict specs.
- GLB loads in runtime.
- Required manifest entry exists.
- No detached/floating named parts.
- Collision proxy exists and is simpler than render mesh.
- Interactable affordances are named and reachable.
- Required pickup/key/medical/energy assets are visually readable.
- Puzzle graph is solvable and has no softlocks.
- Runtime build/playthrough passes.

Soft scores:

- Premium silhouette.
- Face texture alignment.
- Material/PBR consistency.
- Contact shadow and floor reflection quality.
- Enemy/pickup readability under kit lighting.
- LOD/triangle/draw-call budget.
- Repairability: how small the next patch can be.

## Report Contract

Every substantial asset pass should produce a report with this shape:

```json
{
  "schema": "human-protocol/asset-lab-report@2",
  "assetId": "stable_asset_id",
  "specHash": "sha256-or-content-hash",
  "sourceSpec": "relative/path/to/spec.json",
  "artifacts": [
    { "kind": "glb", "path": "src/assets/models/...", "status": "generated" },
    { "kind": "screenshot", "path": "src/assets/renders/...", "status": "reviewed" }
  ],
  "validators": {
    "hardFails": [],
    "softScores": {},
    "runtimeChecks": {}
  },
  "repair": {
    "allowed": true,
    "nextPatchScope": ["parameters", "materials", "lighting"],
    "blockedReasons": []
  },
  "decision": "accept | reject | report-only"
}
```

## Integration With Current Human Protocol Files

Current repo hooks:

- `src/assets/manifests/runtime/human_protocol_environment_assets.json`: environment asset entries.
- `src/assets/manifests/runtime/human_protocol_wgpu_room_prop_replacements.json`: WGPU room prop replacement entries.
- `src/assets/manifests/reports/human_protocol_asset_iteration_records.json`: substantial art pass memory.
- `src/assets/manifests/reports/human_protocol_level01_lighting_objective_v2_report.json`: current math-first lighting objective report.
- `scripts/optimizer/generate-environment-assets.mjs`: existing procedural environment generator.
- `scripts/qa/validate-environment-assets.mjs`: existing manifest validator.
- `scripts/optimizer/run-lighting-search.mjs`: current math-first lighting search runner.

Future agents should add AssetSpec and report files next to these manifests rather than relying on chat history.

## MVP Roadmap

1. AssetSpec v2 schema and templates for room prop, pickup, robot, room kit, lighting kit.
2. Deterministic compiler that turns AssetSpec into worker tasks and manifest stubs.
3. Furniture/room prop generator using part programs and named affordances.
4. Runtime GLB loader QA with screenshot, collision proxy, triangle count, draw-call estimate, and manifest checks.
5. Repair loop that only edits scoped JSON patches from validator reports.
6. Failure memory: store spec hash, failure reason, repair patch, and accepted result.
7. Human-facing preview UI that shows spec diff, QA report, screenshots, and retry branches.

## Non-Goals

- Do not train a custom 3D foundation model for the first milestone.
- Do not let agents output long freeform mesh scripts as the source of truth.
- Do not use one giant visual mesh as collision/solver/runtime truth.
- Do not optimize lighting or geometry by sample count alone when the objective is under-specified.
- Do not accept assets that only look good in a still render but fail runtime collision, readability, or manifest constraints.

## Immediate Next Use

For the next serious asset batch, ask the agent to:

1. Write an `AssetSpec.json` for each target asset.
2. Generate or refine the asset.
3. Produce GLB + collision proxy + manifest entry.
4. Run manifest/build/runtime QA.
5. Write an `asset-lab-report@2`.
6. Only then update official level config or room kits.
