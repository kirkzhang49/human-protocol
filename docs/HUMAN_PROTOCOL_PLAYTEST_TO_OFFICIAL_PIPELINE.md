# Human Protocol Playtest To Official Pipeline

Status: operational handoff for official-level admin edits.

This pipeline exists for the case where an official level is imported into `/build`, edited as an admin playtest draft, exported as JSON, and then promoted back into official source. The goal is one semantic level with several generated views, not two hand-maintained versions.

## June 2026 Level 3 Success

The Level 3 museum surface fix proved the intended flow:

- `/build` exported the desired museum surfaces in `authoringMetadata.builderEnvironment.rooms`.
- Official source was synced to the same floor, wall, and ceiling presets.
- Trial JSON was synced so local `/build` imports and AI campaign fixtures did not drift.
- The Raw WebGPU compiler learned to bridge official builder surfaces into the official render plan instead of reusing stale shell floor/wall/ceiling geometry.
- The runtime disabled the legacy hero floor overlay when the official builder surface bridge is enabled.
- QA now verifies source layers, the Raw render plan, and the builder runtime pack instead of relying on screenshots or guessing.

The important root cause was not a verify script overwriting the museum. The official Raw plan did not previously consume the builder-authored room surface semantics, and one legacy floor overlay could visually cover the newly baked floor.

## Source Of Truth

Generated Raw JSON is an output. Do not patch generated render plans as the root fix.

Raw WebGPU lighting and color are per-level responsibilities. `renderer=raw-webgpu`
selects the backend; it must not be treated as a global art-direction preset. If a
level needs a different look, change that level's official source, compiler input,
or level tuning, then rebuild its Raw plan. See
`docs/raw-webgpu-per-level-lighting-policy.md`.

For an official `/build` edit, sync source layers in this order:

1. `/build` exported draft JSON, usually `hp.config.v1` or `hp.builder.v1`.
2. Official `LevelDefinition`, especially `authoringMetadata.builderEnvironment`.
3. Builder official import bridge, when the source cannot round-trip yet.
4. Trial fixtures under `data/ai/campaign/rb_l*.builder.json` and `data/ai/campaign/rb_l*.level.json`.
5. Dev remake fixtures such as `src/build/devRemakeProjects.ts`, if they mirror the same official playtest.
6. Raw WebGPU compiler or runtime-pack source, when generated output does not reflect the official semantics.
7. Generated Raw WebGPU render plans and public baked assets, produced by rebuild commands.

## Key Files

- `src/game/config/levels/<level>/level.ts`: official level source and builder environment metadata.
- `src/build/BuilderLevelImport.ts`: official level to builder project import path.
- `src/build/official-bridge/SurfaceKitBridge.ts`: reusable bridge for official surface semantics.
- `src/build/runtime-pack/compileBuilderRuntimePack.ts`: builder deep-bake/runtime pack path.
- `tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs`: official Raw WebGPU plan compiler.
- `tools/raw-webgpu-compiler/raw-webgpu-builder-surfaces.mjs`: official builder surface geometry/material bridge.
- `src/render/raw-webgpu/RawRoomRuntime.ts`: runtime behavior for bridged official surfaces.
- `src/assets/manifests/generated/raw-webgpu/render_plan_<level>.json`: generated official Raw plan.
- `src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json`: generated builder runtime resource plan.
- `scripts/qa/builder-to-official-pipeline-qa.mjs`: playtest to official pipeline QA.
- `scripts/qa/visual-bake-contract.mjs`: broader official/build visual contract QA.

## Promotion Workflow

Use this workflow when the user gives an edited `/build` JSON for an official level.

1. Save the exported JSON outside generated manifests.
2. Run a draft comparison before editing source:

   ```bash
   npm run qa:builder-to-official -- --level=level_03_human_museum --draft=/absolute/path/to/export.hp.config.json
   ```

3. Sync the official source and related trial fixtures. Prefer source config and reusable bridge/compiler logic over generated output edits.
4. Rebuild the affected Raw WebGPU output:

   ```bash
   npm run raw-webgpu:level03:rebuild
   ```

   For other official levels, use the appropriate raw rebuild command or `npm run raw-webgpu:rebuild:all` when the compiler changed generically.

5. Run focused QA:

   ```bash
   npm run qa:builder-to-official -- --level=level_03_human_museum --draft=/absolute/path/to/export.hp.config.json
   npm run qa:level3:visual-contract
   npm run qa:builder:wgpu-assets
   npm run qa:builder
   ```

6. Run broader QA when generic compiler/runtime behavior changed:

   ```bash
   npm run qa:builder-to-official
   npm run qa:visual-bake-contract
   npx tsc -p tsconfig.app.json --noEmit
   ```

7. Browser-check the official level and `/build` playtest route if visible materials, lighting, props, or interactions changed.

## Pipeline QA Command

`npm run qa:builder-to-official` runs `scripts/qa/builder-to-official-pipeline-qa.mjs`.

Supported arguments:

- `--level=<officialLevelId>`: focus on one formal campaign level.
- `--draft=<absolutePath>`: compare an exported `/build` draft against official, trial, Raw, and runtime-pack layers.
- `--report=<path>`: write a report to a custom path.

Default report:

```text
src/assets/manifests/generated/raw-webgpu/qa/builder_to_official_pipeline_report.json
```

Report schema:

```text
human-protocol/builder-to-official-pipeline@1
```

Report layers:

- `draft-json`: optional exported `/build` proposal.
- `official`: current official `LevelDefinition`.
- `builder-import`: `builderProjectFromBuiltInLevel`.
- `trial-builder-json`: `data/ai/campaign/rb_l*.builder.json`.
- `trial-level-json`: `data/ai/campaign/rb_l*.level.json`.
- `raw-plan`: generated official Raw WebGPU render plan.
- `runtime-pack`: builder deep-bake runtime resource pack.

Current gates:

- Official levels import through the builder path and compile/validate cleanly.
- Effective floor/wall/ceiling surface presets stay synced across draft, official, builder import, and trial JSON.
- Raw official plans enable `officialBuilderSurfaceBridge` when official builder surface overrides exist.
- Raw official plans contain `builder:floor:<room>`, `builder:walls:<room>`, and `builder:ceiling:<room>` instances for eligible rooms.
- Raw official plans do not keep stale shell floor/wall/ceiling instances in the same eligible rooms.
- Raw official plans and builder runtime packs carry the expected surface texture assets.

This is a surface-first v1 gate. Do not treat a pass as proof that every prop,
robot, pickup, skill, fixture, lighting choice, material role, or cache path is
fully covered. The broader target is a flexible `VisualBakeContract` runner that
derives expected semantic roles from source data and applies layered
`globalRules`, `roleRules`, `familyProfiles`, and small `levelOverrides`.

## Current Known Risks

As of the Level 3 success pass, the focused Level 3 command passes, including comparison against the exported museum draft.

The default all-formal-level command reports existing builder import problems outside this Level 3 surface fix:

- Level 2 generated import uses disallowed `visualKey: "none"` for two interactions.
- Level 4 generated import has a theater-code room/door/puzzle placement mismatch.
- Level 5 generated import has three keys without bound key doors.

These are useful failures. They mean the new all-level gate is already catching formal-level import debt, not that the Level 3 playtest-to-official surface pipeline regressed.
