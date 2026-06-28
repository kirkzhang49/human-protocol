## Raw WebGPU Compiler

This directory contains the formal raw-WebGPU render-plan compiler for Human Protocol.

### Entry point

- `compile-raw-webgpu-render-plan.mjs`
- `compile-builder-runtime-resource-pack.mjs`

### Purpose

The compiler builds the generated runtime artifacts used by the raw-WebGPU renderer, including:

- render plans
- geometry bins
- asset sidecars
- lighting/material/palette tuning application
- the `/build` supplemental Raw WebGPU resource pack (`builder_runtime_resources`)

### Module layout

- `compile-raw-webgpu-render-plan.mjs`: top-level compiler entry
- `compile-builder-runtime-resource-pack.mjs`: resource-only pack for `/build`
  modelKeys that are not already ready in official Raw level packs
- `raw-webgpu-plan-assets.mjs`: asset instance writing and asset records
- `raw-webgpu-plan-geometry.mjs`: compiled geometry extraction and packing
- `raw-webgpu-plan-instances.mjs`: config-driven instance placement rules
- `raw-webgpu-plan-lighting.mjs`: raw lighting profile generation
- `raw-webgpu-render-plan-rules.mjs`: asset and node inclusion/exclusion rules
- `raw-webgpu-tuning-inputs.mjs`: manifest-driven tuning loaders and summaries
- `raw-webgpu-asset-sidecars.mjs`: per-asset runtime sidecar emission
- `raw-webgpu-glb-metadata.mjs`: cached GLB metadata helpers
- `raw-webgpu-plan-utils.mjs`: shared compiler utilities

### Notes

- These files were moved out of `scripts/` so the compiler chain has a clear ownership boundary.
- QA scripts, experiments, and solvers still live in `scripts/` for now.
- `/build` assets must follow `docs/human-protocol-builder-wgpu-resource-map.md`:
  official Raw level imports are reused by `modelKey`, and only missing unique
  keys go into `builder_runtime_resources`. Do not put the global `/build`
  catalog into `level_01`, and do not add runtime GLB baking as the normal fast
  playtest path.
