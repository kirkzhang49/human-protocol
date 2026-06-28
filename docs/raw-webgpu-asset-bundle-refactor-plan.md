# Raw WebGPU Asset Bundle Refactor Plan

## Goal

Move Human Protocol Raw WebGPU runtime assets away from one large supplemental geometry pack toward cacheable per-asset or per-family bundles:

- Global index: `public/assets/human-protocol/raw-webgpu/assets-v1/index.json`
- Bundle manifest: `public/assets/human-protocol/raw-webgpu/assets-v1/families/<family>/<modelKey>/manifest.json`
- Geometry: `geometry.raw.bin` in phase 1, `geometry.meshopt.bin` in a later phase
- Material metadata: `material.json`

The runtime lookup order is:

1. `assets-v1` prebuilt bundle by `modelKey`
2. existing official Raw plans and `builder_runtime_resources`
3. browser deep cook / procedural proxy fallback for development or missing assets

Robot/enemy assets are treated as reusable official bundles, not per-level tints.
Each `hp_enemy_*` bundle must include `geometry.raw.bin` plus a `material.json`
that preserves either its cooked GLB base-color palette texture or clearly visible
authored accent materials, so Level 1, Level 2, and later official levels can
reuse the same `modelKey` without falling back to gray proxy colors.

## Phase 1 Contract

Phase 1 splits selected Level 1/2 official runtime model geometry from:

`src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources_geometry.bin`

into small `geometry.raw.bin` files. The float32 vertex format is unchanged, so visual output should stay byte-compatible with the old pack while reducing the amount of data a web playtest needs to fetch for migrated furniture.

The source of truth is still the existing model registries, builder asset catalog, and Raw WebGPU compiler. Do not hand-edit generated render plans. Regenerate the split bundles with:

```bash
node scripts/asset-build/generate-raw-webgpu-assets-v1.mjs
```

Check drift with:

```bash
node scripts/asset-build/generate-raw-webgpu-assets-v1.mjs --check
```

Check Level 1/2 official coverage with:

```bash
node scripts/qa/raw-webgpu-assets-v1-contract.mjs
```

That contract also checks the enemy palette invariant above: generated robot
bundles must not silently regress to untextured dark/white materials.

## Texture Policy

Phase 1 keeps material texture URLs pointed at the existing shared Raw WebGPU atlas/cache entries when possible. This avoids duplicating the same WebP layer into many per-asset folders before the family atlas plan is ready.

Targets for the compression pass:

- Ordinary furniture: 512px WebP or AVIF base color.
- Reusable enemy/robot archetypes: preserve the cooked GLB palette texture or
  authored cyan/amber accent materials in the bundle; use 512-1024px WebP/AVIF
  depending on silhouette readability and reuse frequency.
- Hero props, decals, color puzzle panels/orbs, and important readable puzzle art: 1024px WebP or AVIF.
- Normal, ORM, and emissive maps: compressed, linear/sRGB flags preserved, shared by family atlas where possible.
- Prefer shared atlases for repeated families; only duplicate textures when an asset needs independent hero quality.

## Meshopt Route

`geometry.raw.bin` is intentionally a compatibility format. Phase 2 should add a meshopt encoder that writes `geometry.meshopt.bin` while preserving the manifest shape:

- same `modelKey`
- same `bounds`, `nodeChunks`, animation metadata, and material slots
- `geometry.format = "meshopt"`
- `geometry.vertexFormat` unchanged after decode
- fallback to `geometry.raw.bin` during rollout

The loader should decode meshopt into the same `Float32Array` contract used by `compileBuilderRuntimePack`.

## Budget Target

For a web demo slice of about 20 furniture/puzzle assets:

- Geometry target after meshopt: roughly 0.5-2.5 MB for ordinary low-poly furniture, higher only for hero/animated assets.
- Texture target: ordinary assets should usually stay under 0.5-1.0 MB including shared atlas contribution; hero decals/puzzle art can spend more when readability needs it.
- Avoid reintroducing a 100 MB all-assets download. Family chunks should be cacheable and independently invalidated.
