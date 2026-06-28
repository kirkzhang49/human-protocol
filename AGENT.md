# Human Protocol Agent Notes

## Current WebGPU Bug-Fix Track

- Acceptance is based on Raw WebGPU and deep-baked runtime packs. Three.js-only fixes do not count as done for playable trial or official levels.
- Work with the existing dirty worktree. Do not revert changes you did not make.
- For Level 3 visual bugs, inspect the baked/runtime render path first: `src/render/raw-webgpu`, `src/build/runtime-pack`, asset registries/resolvers, and directly related Level 3 config.
- For recurring official/build visual regressions, move the guard into a reusable VisualBakeContract runner instead of adding renderer-level level-id patches. The contract should compare official config, builder import/trial data, Raw render plans, runtime visual registries, and builder resource packs.
- Keep VisualBakeContract flexible: derive expected roles from `LevelDefinition` and source layers by default, then apply shared `globalRules`, `roleRules`, reusable `familyProfiles`, and only small `levelOverrides`. Do not create one complete hand-written visual contract per official level.
- Keep the display-case asset remake separate from this bug-fix track. Do not rewrite the tool/sound/body exhibit asset family here.
- For Skill 3, use durable model/material keys that can survive WebGPU/deep-bake. Avoid temporary white proxy geometry as the final visual.
- For elevator and route-switch issues, identify the actual baked instance/model/material source before patching visual symptoms.

## Playtest To Official Pipeline

- Official levels edited through `/build` are admin source proposals, not a second permanent version. Promote them by syncing source semantics, then rebuilding generated outputs.
- When the user provides an exported official `/build` JSON, first compare it with the official source:

  ```bash
  npm run qa:builder-to-official -- --level=<officialLevelId> --draft=/absolute/path/to/export.hp.config.json
  ```

- Keep the source chain aligned: official `LevelDefinition`, `builderProjectFromBuiltInLevel`, `data/ai/campaign/rb_l*.builder.json`, `data/ai/campaign/rb_l*.level.json`, dev remake fixtures, Raw WebGPU compiler output, and builder runtime pack.
- Do not hand-patch `render_plan_*.json` as the root fix. Fix source config, bridge/compiler/runtime-pack logic, asset registry, or material resources, then rebuild.
- For official room surface edits, the official Raw plan must reflect builder-authored floor/wall/ceiling semantics through `officialBuilderSurfaceBridge`; legacy shell floors/walls/ceilings and hero floor overlays must not visually cover the bridged surfaces.
- Use focused QA for the edited level, then the broader gate when shared compiler/runtime behavior changed:

  ```bash
  npm run qa:builder-to-official -- --level=<officialLevelId>
  npm run qa:visual-bake-contract
  npm run qa:builder:wgpu-assets
  npm run qa:builder
  ```

- Read `docs/HUMAN_PROTOCOL_PLAYTEST_TO_OFFICIAL_PIPELINE.md` before promoting official `/build` edits. Read `docs/HUMAN_PROTOCOL_PLAYTEST_TO_OFFICIAL_PIPELINE_IMPROVEMENT_PLAN.md` for goal-review ideas only; do not execute that plan unless the user explicitly asks.

## Mandatory 3D Asset Production Pipeline

Every newly generated or materially polished Human Protocol 3D asset must use
the repo-local asset factory pipeline, not an ad hoc prompt-to-mesh pass. Start
from `docs/human-protocol-furniture-asset-factory-pipeline.md`; for Level 02
residential furniture also read
`docs/human-protocol-level02-furniture-image2-blender-pipeline.md`.

- Begin with a blueprint: role, stable `modelKey`, meter scale, silhouette,
  material slots, texture strategy, collision proxy, expected placement,
  hidden-control hints, and QA evidence.
- Use GPT/Image2 as concept, material, trim-sheet, atlas, metadata, and QA
  support. Deterministic Blender scripts and source `.blend` files own final
  geometry; generated Raw JSON is never hand-patched as the root fix.
- Keep code responsible for reusable verbs such as generation, atlas cutting,
  cooking, registry emission, thumbnails, and QA. Keep config/manifests
  responsible for level nouns such as model keys, scale, roles, fixtures, and
  material intent.
- For texture work, prefer low-noise atlases or trim sheets with exact UV
  regions. Do not paste whole concept art onto objects, add random decorative
  lines/spheres, or use dirty procedural grime to fake detail.
- Every Image2 or generated bitmap source must record prompt, tool/model or
  call id when available, source image path, crop mapping, license label,
  reference inputs, derivative processing, and dependent generated outputs in a
  repo-local provenance ledger. Chat history is not source metadata.
- Rebuild the complete chain after meaningful asset edits: GLB/source blend,
  manifest, generated builder registry/catalog/footprints, builder
  thumbnails, Raw WebGPU packs when runtime-facing, TypeScript, and relevant
  QA commands.
- Level 02 furniture must read first as clean residential furniture. Surveillance
  or control cues may appear only as restrained proportion, door gaps, thick
  backs, small rear access plates, underside seams, or overly regular joins.
  Avoid obvious cyan strips, exposed cameras, large service panels, proxy
  cubes, floating patches, and sci-fi front faces.
