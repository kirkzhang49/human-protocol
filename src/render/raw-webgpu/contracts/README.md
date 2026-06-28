# Raw WebGPU Level Contract

Raw WebGPU levels are loaded from generated manifests rather than ad-hoc runtime fallbacks. A level is considered renderable when these files exist under `src/assets/manifests/generated/raw-webgpu`:

- `render_plan_<levelId>.json`
- `render_plan_<levelId>_geometry.bin`
- optional `raw_robot_animation_bridge_<levelId>.json`
- optional `raw_cooked_glb_loader_manifest_<levelId>.json`

Texture color-space rules are centralized in `RawWebGpuContracts.ts`:

- sRGB: `baseColor`, `emissive`
- linear: `metallicRoughness`, `normal`, `occlusion`, `ao`

Use `scripts/asset-build/rebuild-raw-webgpu-levels.mjs` for rebuild orchestration. Runtime code should use `rawWebGpuGeneratedAssetFilename()` instead of hand-written generated filenames.
