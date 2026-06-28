# Human Protocol /build WGPU Resource Map Rule

This is the required rule for every asset that becomes selectable or playable in
`/build`.

## Rule

Every `/build` asset must resolve by stable `modelKey` to an already baked Raw
WebGPU resource. Runtime playtest must not cook GLBs as a normal path.

The accepted chain is:

```text
asset pack manifest / hand-authored registry
  -> environmentModelAssets / rawViewmodelCookAssets / enemyModelAssets
  -> builderPropCatalog or other /build catalog surface
  -> BuilderRuntimeAssetIndex modelKey map
  -> official Raw level imports OR builder_runtime_resources supplemental pack
  -> /build fast Raw playtest
```

Missing WGPU resources are an offline resource-pack problem, not a runtime
fallback feature.

## Playtest Pack Cache

Builder playtest packs are stored in IndexedDB (`hp-builder-runtime-packs`).
`localStorage` only stores lightweight latest-pack pointers, so clearing
`localStorage` does not remove the baked geometry/textures. A normal browser
profile can therefore keep showing an old pack while incognito, with an empty
IndexedDB, shows a fresh bake.

Current cache rules:

- rebaking clears old records for both the current `projectId` and the compiled
  `levelId`, scoped to the selected bake mode (`fast`/`deep`);
- generated playtest URLs include the exact `packId`, and the Raw loader only
  loads that record when `packId` is present;
- fast packs are treated as ready only immediately after the current `/build`
  session generates them; historical fast pointers are shown as stale so a Raw
  asset/GLB rebake cannot be hidden by unchanged builder JSON;
- `BUILDER_RUNTIME_PACK_ENGINE_VERSION` is bumped whenever compiler/runtime
  changes would make old packs visually stale;
- `BUILDER_RUNTIME_PACK_ENGINE_VERSION` must also be bumped whenever
  `compileBuilderProjectToLevel` or generated trial/remake data changes gameplay
  semantics for the same `BuilderProject` JSON: door lock meaning, wave/boss
  triggers, puzzle completion routing, objective chains, exit/elevator unlocks,
  pickup/key requirements, or any other rule that changes the playable
  `LevelDefinition`. This version is part of `builderProjectHash`; without the
  bump, `/build` can incorrectly reuse an old deep pack whose rooms, robot
  spawn anchors, doors, and gameplay config were compiled under the previous
  rules.
- `/build?clearRuntimePacks=1` remains the manual full reset path and keeps the
  map draft.

## What Not To Do

- Do not put all `/build` assets into `level_01_maintenance_bay`.
- Do not make compatibility/proxy playtest look more complete than Raw.
- Do not add a runtime "if missing, cook this GLB" path for normal fast playtest.
- Do not duplicate a `modelKey` in the supplemental pack if an official Raw level
  pack already has it ready.
- Do not add a new `/build` catalog entry without making the WGPU source map pass.

## Source Map Shape

`src/build/runtime-pack/BuilderRuntimeAssetIndex.ts` owns the source map:

- `BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS`: official Raw level packs that
  can supply baked geometry by `modelKey`.
- `BUILDER_NATIVE_RAW_RESOURCE_PACK_ID`: currently `builder_runtime_resources`,
  the supplemental resource-only pack.
- `BUILDER_NATIVE_RAW_SOURCE_LEVEL_IDS`: official packs plus the supplemental
  pack; runtime searches these imports by `modelKey`.
- `builderWgpuResourceIndexForLevels(levels)`: the complete resource contract for
  `/build`, including all campaign furniture, `/build` catalog furniture, robots,
  pickups, viewmodels, and hands.

`src/build/runtime-pack/nativeRawEnemyModels.ts` loads these source imports and
copies the baked vertices/material references into a builder runtime pack. It is
the consumer of the map, not a place to invent new asset ids.

## Supplemental Pack

`tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs` builds the
supplemental `builder_runtime_resources` pack.

It must:

- scan all official Raw source level plans first;
- collect only resource-index `modelKey`s that are not already ready in those
  official packs;
- also collect forced parity keys from
  `BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS`, even when an official Raw
  pack already has them;
- bake those missing keys into `render_plan_builder_runtime_resources.json` and
  `render_plan_builder_runtime_resources_geometry.bin`;
- keep `issues` at zero;
- remain resource-only: no gameplay rooms, instances, doors, or level content.

This pack is not `level_01`. It is the extra key map for assets that are valid in
`/build` but are not naturally present in an already baked official Raw level.
Forced parity keys are for official/build comparison assets that must remain
visible in `/build` playtests even if official source-level hydration changes.

## Adding A New Asset To /build

1. Add or ingest the asset through the real registry path:

   ```bash
   node scripts/asset-build/generate-builder-asset-pack-registry.mjs \
     --manifest src/assets/asset-packs/<packId>/manifest.json \
     --check --pending

   node scripts/asset-build/generate-builder-asset-pack-registry.mjs \
     --emit --manifest src/assets/asset-packs/<packId>/manifest.json
   ```

2. Confirm it appears under the correct runtime registry:

   - environment/furniture/pickups/viewmodels: `environmentModelAssets`
   - hands: `rawViewmodelCookAssets`
   - robots: `enemyModelAssets`
   - selectable furniture: `builderPropCatalog`

3. Rebuild Raw resources:

   ```bash
   node scripts/asset-build/rebuild-raw-webgpu-levels.mjs --level=<changed-level>
   ```

   The rebuild script refreshes `builder_runtime_resources` by default. If only
   the `/build` catalog changed and no official level changed, run:

   ```bash
   node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs
   ```

   If the asset is an official/build parity fixture that must be visible in both
   official Raw and `/build` WebGPU playtests, add its `modelKey` to
   `BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS` before this step.

   For Level 3 museum GLB fixtures, especially the tool/voice/body vitrines,
   the Three.js lossless bridge must also write the public bundle, not only
   audit the bridge manifest:

   ```bash
   npm run raw-webgpu:level03:rebuild
   ```

   That command passes `--write-threejs-bridge`, so
   `public/assets/human-protocol/raw-webgpu/level_03_human_museum/threejs-lossless`
   is rebuilt with the current `.glb.br` sidecars. If the manifest knows a GLB
   but `threejs-lossless` is stale, normal browser profiles can keep showing old
   official/build assets.

   `/build` WebGPU playtests persist generated runtime packs in the
   `hp-builder-runtime-packs` IndexedDB database. A normal profile can therefore
   show old geometry while an incognito profile shows the fresh bake if a stale
   packId is reused. The plain "试玩" launch now regenerates the cheap fast pack
   every time instead of trusting `projectHash` alone, because official Raw/GLB
   assets can change without changing the builder project JSON. For manual
   cleanup, open:

   ```text
   http://127.0.0.1:5173/build?clearRuntimePacks=1
   ```

   This removes the localStorage pack pointers and deletes the
   `hp-builder-runtime-packs` IndexedDB database; close old playtest tabs first
   if the browser reports the database deletion as blocked.

   `/build`'s "official/remake" dropdown is generated separately from the same
   campaign source:

   ```bash
   scripts/ai/run.sh buildCampaign.ts --emit-ts
   ```

   Run this after changing trial/remake semantics such as hosted puzzle props;
   otherwise `data/ai/campaign/rb_l*.builder.json` can be correct while
   `src/build/devRemakeProjects.ts` still feeds `/build` an old snapshot.

4. Run the required checks:

   ```bash
   npm run qa:builder:wgpu-assets
   npm run qa:builder
   npm run build
   npm run smoke:campaign
   ```

5. In `qa:builder`, the important line is:

   ```text
   PASS builder WGPU resource map: <N>/<N> unique modelKeys linked across <M> imports, supplemental=<K>
   ```

   The numbers may change, but coverage must be complete.

   For a focused missing-asset list, run:

   ```bash
   npm run qa:builder:wgpu-assets
   ```

   It audits direct `/build` catalog rows and raw builder manifest rows. If
   something is visible in `/build` but not baked or linked, the output names the
   `modelKey`, source manifest, and failed stage.

## When A New Official Raw Level Pack Is Added

If a new official level gets generated Raw assets and should serve `/build`
resources:

1. Add its level id to `BUILDER_OFFICIAL_NATIVE_RAW_SOURCE_LEVEL_IDS`.
2. Run `node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs`.
3. Run `npm run qa:builder`.

QA must prove that the supplemental pack does not duplicate any key now supplied
by the official Raw level pack.

## Failure Meaning

If `/build` shows a proxy cube or reports a missing WGPU resource for an asset
that should exist, fix the resource map or regenerate the Raw resource pack. Do
not fix it by adding a runtime GLB bake fallback.
