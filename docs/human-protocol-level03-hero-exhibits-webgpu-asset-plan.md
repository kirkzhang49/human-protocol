# Human Protocol Level 3 Hero Exhibits WebGPU Asset Plan

Status: first-round asset blueprint handoff, 2026-06-16.

## Scope

This handoff is for the Level 3 Human Museum hero exhibits:

- Tool exhibit
- Sound/voice exhibit
- Body exhibit

It deliberately does not touch runtime bug-fix files for skill 3, elevator white semicircles, or router color. The playable acceptance target is Raw WebGPU/deep-bake. Three.js previews are auxiliary only.

## Pipeline Read

Relevant local docs and code inspected:

- `docs/human-protocol-asset-agent-md.md`
- `docs/human-protocol-blueprint-first-asset-pipeline.md`
- `docs/human-protocol-internal-asset-factory-v1.md`
- `docs/human-protocol-current-asset-requirements.md`
- `scripts/asset-build/generate-level03-exhibit-trial-assets.mjs`
- `scripts/asset-build/blender-generate-level03-museum-assets.py`
- `src/assets/registry/environment/level03.ts`
- `src/assets/manifests/generated/age/human_protocol_level03_museum_age_layout_v1.json`
- `src/assets/manifests/generated/raw-webgpu/raw_cooked_glb_loader_manifest_level_03_human_museum.json`
- `src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json`

Current contract: Level 3 keeps the build-facing `room_museum_*` keys as the
stable semantic names. Preview GLBs, official Raw, trial JSON, and
`builder_runtime_resources` must all resolve these same modelKeys:

- `room_museum_last_human_tool_vitrine`
- `room_museum_voice_archive_case`
- `room_museum_skeleton_vitrine`

Older `age_museum_*` assets can remain as source/legacy alternatives, but they
are not the authority for the official/build Level 3 hero exhibit contract.

## Blueprint Spec

The machine-readable spec is:

`src/assets/specs/level03/level03_hero_exhibits_webgpu_v1.asset-spec.json`

It defines:

- role and story function
- canonical modelKey and build aliases
- silhouette and scale in meters
- readable faces and use distances
- material slots and Raw WebGPU material roles
- Image2 atlas parts
- collision and placement constraints
- transparency/opacity contract
- next generation and QA commands

## Transparency Fix

The core rule for all three assets:

- Outer glass only: alpha about `0.18` to `0.34`.
- Inner exhibit core: opaque, alpha `1.0`.
- Glass cannot carry the main readable object.
- Tool, waveform/body core, labels, trims, and underlights need separate geometry/material slots.

This directly addresses the current complaint that the tool/sound/body areas feel too transparent or not materially present.

## Asset Keys To Connect

Canonical official/build/deep-bake keys:

- `room_museum_last_human_tool_vitrine`
- `room_museum_voice_archive_case`
- `room_museum_skeleton_vitrine`

These three keys are also listed in
`BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS` so `/build` WebGPU playtests do
not depend only on an official Raw source import.

## Next Generation Step

Create or fork this script:

`scripts/asset-build/blender-generate-level03-hero-exhibits-v2.py`

Recommended command:

```bash
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender \
  $BLENDER --background \
  --python scripts/asset-build/blender-generate-level03-hero-exhibits-v2.py \
  -- --spec src/assets/specs/level03/level03_hero_exhibits_webgpu_v1.asset-spec.json
```

Expected outputs:

- `src/assets/models-cooked/environment/level03/age_museum_display_case_tool.glb`
- `src/assets/models-cooked/environment/level03/age_museum_voice_booth.glb`
- `src/assets/models-cooked/environment/level03/age_museum_body_reference_case.glb`
- `src/assets/source_blend/level03/age_museum_display_case_tool_v2.blend`
- `src/assets/source_blend/level03/age_museum_voice_booth_v2.blend`
- `src/assets/source_blend/level03/age_museum_body_reference_case_v2.blend`
- `src/assets/textures/environment/level03-hero-exhibits-webgpu-v1/level03_hero_exhibits_webgpu_v1_atlas.png`
- `src/assets/textures/environment/level03-hero-exhibits-webgpu-v1/level03_hero_exhibits_webgpu_v1_atlas.regions.json`
- `src/assets/manifests/builder/hp_level03_hero_exhibits_webgpu_v1.json`

## WebGPU QA

After generation, run the raw asset/cook path before claiming success:

```bash
node scripts/asset-build/build-raw-webgpu-cooked-loader-manifest.mjs
node scripts/asset-build/build-raw-webgpu-material-pipeline.mjs
node scripts/asset-build/rebuild-raw-webgpu-levels.mjs
node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs
npm run qa:visual-bake-contract
npm run qa:builder:wgpu-assets
npm run assets:environment:validate
npm run build
```

Manual screenshots should prove the three assets in:

- Level 3 official Raw WebGPU at use distance.
- Build deep-bake Level 3 at use distance.
- A close view showing opaque core geometry behind thin glass.

## Known Risk

The repo still contains cooked `age_museum_*` assets and several
`room_museum_*` alternatives. Do not swap a Level 3 hero exhibit by changing only
the preview GLB. A valid bake updates the GLB/source blend/manifest, registry,
official config, trial JSON, official Raw plan, and builder runtime resource
pack together.
