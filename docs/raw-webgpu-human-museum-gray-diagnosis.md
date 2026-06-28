# Human Museum Raw-WebGPU Gray/Flat Diagnosis

This note absorbs the findings from `/Users/zhengkaizhang/Downloads/Human Museum 在 raw-WebGPU 中发灰发平的深度诊断 (1).pdf` and maps them onto the current Human Protocol codebase.

## Short verdict

The PDF diagnosis is directionally correct.

The museum does not look gray and flat because of one missing texture or one bad light. It is a stacked failure:

1. The level 03 room lighting profiles are overfilled.
2. The raw renderer still applies museum-specific black lift, fog mixing, shell anchoring, and probe lighting that flatten large dark surfaces.
3. The raw renderer has tuned color-grade data for the museum, but that path was effectively disabled at runtime.
4. The special museum hero-floor shading path was also disabled at runtime.
5. The offscreen post-process path is intentionally hard-disabled, so raw-WebGPU is not currently benefiting from a repaired bloom/filmic chain even when the shader has hooks for it.

This means we were paying the cost of a custom museum look without consistently turning on the parts that actually help the image.

## What the code says

### 1. The museum profiles are too filled

The generated room profiles in:

- [render_plan_level_03_human_museum.json](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/render_plan_level_03_human_museum.json)
- [raw_lighting_algorithm_tuning_level_03_human_museum.json](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_lighting_algorithm_tuning_level_03_human_museum.json)

show the exact pattern called out in the PDF:

- `probe` is `0.94` across museum rooms
- `bounce.ceiling` is around `0.62` to `0.70`
- `bounce.side` is `0.63` to `0.66`
- `algorithm.material` is `1.24`
- artist exposure/contrast are also already elevated before any display transform

That is a strong recipe for midtone fill and weak negative space.

### 2. The shader still has multiple flattening stages

In [levelProxy.wgsl](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/shaders/levelProxy.wgsl):

- `room_probe_radiance()` adds wall, ceiling, and floor probe energy directly into the scene.
- `fs_main()` adds floor bounce, ceiling wash, side fill, shell anchoring, fog darkening, shell-specific luma anchors, and black-level shaping.
- `raw_output_transform()` and `raw_display_transform()` both perform custom museum tone shaping.

So even before post-process, the raw path is already doing heavy aesthetic intervention.

### 3. Our tuned museum grading existed, but was not active

The museum has a tuned color-grade file:

- [raw_visual_color_tuning_level_03_human_museum.json](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_visual_color_tuning_level_03_human_museum.json)

But before this fix:

- `rawDisplayTransformEnabled()` returned `false`
- `rawVisualColorGradeStrength()` returned `0`

That meant the museum-specific grade data was loaded but effectively ignored on the direct canvas path.

### 4. The hero floor path existed, but was not active

The specialized floor pass in [levelProxy.wgsl](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/shaders/levelProxy.wgsl) and the museum texture in [RawWebGpuLevelRenderer.ts](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/RawWebGpuLevelRenderer.ts) are only used when `rawHeroFloorEnabled()` is true.

Before this fix, `rawHeroFloorEnabled()` returned `false`, so the museum floor lost one of the few purpose-built shading passes meant to add controlled premium floor response.

### 5. The post-process chain is still intentionally disabled

In [RawWebGpuLevelRenderer.ts](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/RawWebGpuLevelRenderer.ts), render currently forces:

```ts
const postProcessEnabled = false;
```

The comment says the offscreen path was disabled because it was poisoning the command buffer during QA. That means the renderer still lacks a trustworthy offscreen filmic/bloom stage even though the codebase has hooks for it.

## What we were actually missing

The museum was not mainly missing "more lights".

It was missing a stable combination of:

1. Active display transform on the direct raw path.
2. Active museum grade parameters.
3. Less aggressive room fill in the generated lighting profiles.
4. The museum hero-floor pass.
5. Eventually, a repaired offscreen post-process chain.

The deeper PDF concern about PMREM / environment reflection / stricter PBR response is still valid, but that is a larger renderer task. The current codebase already had several higher-value fixes sitting unused.

## Fixes applied now

This pass applies conservative fixes, not a renderer rewrite:

1. `rawDisplayTransformEnabled()` now defaults to on, with URL opt-out via `rawDisplayTransform=0`.
2. `rawHeroFloorEnabled()` now defaults to on, with URL opt-out via `rawHeroFloor=0`.
3. `rawVisualColorGradeStrength()` now defaults to `1` when tuning data exists, with URL control via `rawVisualGrade=...`.
4. `RawRoomRuntime` now clamps level 03 museum lighting profiles into a safer range before sending them to the shader.

Files changed:

- [RawWebGpuQuality.ts](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/RawWebGpuQuality.ts)
- [RawVisualDirector.ts](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/RawVisualDirector.ts)
- [RawRoomRuntime.ts](/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/RawRoomRuntime.ts)

## Remaining gaps

If the museum still feels flatter than Three.js after this pass, the next real targets are:

1. Repair and re-enable the offscreen post-process path.
2. Audit base-color input and output color-space handling end to end.
3. Reduce shell-specific luma anchoring and black-lift logic inside `levelProxy.wgsl`.
4. Revisit raw material response for large non-metal surfaces instead of relying on current "material" gain.
5. Add a true environment/reflection language for premium dark surfaces rather than only room-probe approximation.
