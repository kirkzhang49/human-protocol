# AGE WebGPU Renderer Extraction Plan

Workspace deliverable: `age-render-webgpu-prototype`

Reference repo audited read-only:
`/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol`

## Goal

Extract the useful parts of `src/render/raw-webgpu/**` from a Human Protocol-specific renderer into a reusable AGE renderer slice without destabilizing the game. The first phase creates contracts, a render graph shell, platform/resource abstractions, and a Human Protocol adapter plan. It does not migrate the monolithic renderer, rebuild assets, change visuals, touch builder UI, or write into the Human Protocol repo.

Future target shape:

```text
packages/
  age-core/
  age-render-webgpu/
  age-render-three/
  age-runtime/
  age-assets/
  age-platform/

games/human-protocol/src/adapters/age/
  humanLevelToAgeScene.ts
  humanMaterialRoles.ts
  humanAssetRegistry.ts
  humanRuntimeBridge.ts
```

This prototype represents the early `age-render-webgpu` and part of `age-core` / `age-platform` contract layer.

## Hard Boundaries

- Engine core must never import Human Protocol config, `GameWorld`, UI, builder code, level IDs, weapon IDs, robot IDs, or generated manifests directly.
- Human Protocol converts its own config/runtime state into generic AGE descriptors.
- The game keeps ownership of campaign progression, input, camera feel, viewmodel overlay, HUD, telemetry semantics, and content IDs.
- Generated assets, cooked render plans, raw manifests, and asset rebuild scripts are not edited in phase 1.
- `RawWebGpuLevelRenderer.ts` is not moved wholesale. It is a future extraction target to be split behind adapters.

## Audited Sources

Required files read:

- `src/render/raw-webgpu/RawWebGpuLevelRenderer.ts`
- `src/render/raw-webgpu/RawWebGpuCanvas.tsx`
- `src/render/raw-webgpu/RawWebGpuTypes.ts`
- `src/render/raw-webgpu/RawWebGpuPipelines.ts`
- `src/render/raw-webgpu/RawWebGpuAssetLoader.ts`
- `src/render/raw-webgpu/RawWebGpuMaterialPipeline.ts`
- `src/render/raw-webgpu/RawWebGpuTextureResources.ts`
- `src/render/raw-webgpu/RawVisualDirector.ts`
- `src/render/raw-webgpu/RawMuseumEnvProfile.ts`
- `src/render/raw-webgpu/RawGlassOitPass.ts`
- `src/render/raw-webgpu/RawTransparentMaterialPass.ts`
- `src/render/raw-webgpu/RawGpuParticlePass.ts`
- `src/render/raw-webgpu/RawProjectileVfxPass.ts`
- `src/render/raw-webgpu/RawGroundingPass.ts`
- `src/render/raw-webgpu/contracts/README.md`
- `docs/raw-webgpu-pmrem-env-post-roadmap.md`
- `docs/human-protocol-raw-webgpu-paper-notes.md`

Supporting observations came from imports and neighboring raw-webgpu modules, but no files in the game repo were modified.

## Extraction Map

| Source | Current responsibility | Extraction classification | Phase 1 decision |
| --- | --- | --- | --- |
| `RawWebGpuLevelRenderer.ts` | Device/context setup, GPU buffers, bind groups, pipeline ownership, frame encoding, room visibility, GameWorld dynamic instances, enemy animation, pickups, projectiles, particles, door visual state, post path. | Mixed. Engine orchestration plus heavy Human Protocol adapter logic. | Do not move. Use as future split target. Prototype exposes `AgeWebGpuRenderer`, `AgeRenderGraph`, `AgeSceneFrame`, and pass contracts that this file can gradually feed. |
| `RawWebGpuCanvas.tsx` | React component, GameLoop, input, camera rig, quality governor, failure fallback, Three.js viewmodel overlay, Human perf events. | Human Protocol integration shell. | Keep in game. Future replacement should instantiate AGE backend through `humanRuntimeBridge`, but React/GameLoop stay game-owned. |
| `RawWebGpuTypes.ts` | Raw render plan, rooms, instances, material/texture/light contracts, visibility scenarios, GPU globals, draw batches. | Mostly generic contracts, with game-specific `RenderQualityTier` import and raw naming. | Prototype adds `AgeRenderPlanContracts`, `AgeAssetContracts`, `AgeSceneFrame`, and generic `AgeDrawBatch`. |
| `RawWebGpuPipelines.ts` | Bind group layouts and render pipelines for opaque, glass overlay/OIT, transparent, shadow, contact shadow, hero floor, bloom/post. | Engine candidate, but shader entry points and labels are still raw/Human-specific. | Prototype adds per-pass graph shell. Real migration should split pipelines by pass and keep shader modules package-local. |
| `RawWebGpuAssetLoader.ts` | Vite glob resolver for generated raw manifests; fetches plan, geometry binary, robot animation bridge, cooked GLB manifest. | Boundary module. Asset fetching is generic; generated filename/glob policy is Human adapter. | Prototype adds `AgeAssetRegistry`, bundle contracts, storage adapter. Human adapter should register existing generated assets. |
| `RawWebGpuMaterialPipeline.ts` | Packs material records, default materials, role inference from material names/categories, role numeric mapping. | Split. Binary material packing is engine; inference regexes are game/content adapter. | Prototype adds `AgeMaterialPipeline` and generic `AgeMaterialRolePolicy`. Human role mapping belongs in `humanMaterialRoles.ts`. |
| `RawWebGpuTextureResources.ts` | Texture array creation, fallback fills, concurrency-limited image loading, hero floor texture special case. | Mostly generic resource loader, with Human labels and hero floor content. | Prototype adds texture descriptors/loader contracts. Real engine should own arrays/fallbacks; Human adapter owns hero-floor texture selection. |
| `RawVisualDirector.ts` | Runtime visual corrections from render-plan metrics, URL params, diagnostics, color grade tuning. | Mixed. Metrics/grade machinery can be engine; museum color policy and debug URL controls are adapter/platform. | Prototype keeps only lighting/env contracts. Future `AgeVisualDirector` should be data-driven and platform-param injected. |
| `RawMuseumEnvProfile.ts` | Chooses museum env profile by level id or URL param. | Human content policy with generic env concept underneath. | Prototype adds `AgeEnvironmentProfile`. Human adapter chooses profile IDs; engine consumes profile descriptors. |
| `RawGlassOitPass.ts` | Weighted OIT accum/reveal textures and resolve for transparent draw batches. | Strong engine candidate. | Prototype adds `AgeGlassOitPass` shell and `AgeFrameTargets.glassOit`. Real port should depend on generic transparent draw lists. |
| `RawTransparentMaterialPass.ts` | Sorted alpha fallback for transparent material batches. | Engine candidate. | Prototype adds `AgeTransparentPass` shell. |
| `RawGpuParticlePass.ts` | Compute particle simulation/rendering, but emitter extraction reads `GameWorld` pickups/enemies and quality tiers. | Split. GPU pass is engine; emitter extraction is game adapter. | Prototype adds generic `AgeParticleEmitterRecord` and `AgeGpuParticlesPass`. |
| `RawProjectileVfxPass.ts` | Projectile/effect billboard rendering, but weapon/effect typing reads `GameWorld` IDs. | Split. GPU billboard pass is engine; weapon/effect color/type mapping is game adapter. | Prototype adds generic `AgeProjectileRecord` and `AgeProjectileVfxPass`. |
| `RawGroundingPass.ts` | Contact-shadow draw of shadow batches. | Engine candidate, but batch production is adapter/runtime. | Prototype adds `AgeGroundingPass`. Next real pass should consume object-bound decal/contact records. |
| `contracts/README.md` | Generated raw asset contract and texture color-space rules. | Contract seed. | Prototype promotes this idea into `AgeAssetContracts`. |
| `raw-webgpu-pmrem-env-post-roadmap.md` | Roadmap for offscreen post, museum env profile, minimal PMREM. | Architecture input. | Captured as graph/post/env roadmap, not implemented in phase 1. |
| `human-protocol-raw-webgpu-paper-notes.md` | WBOIT, emissive lights, contact shadows, probes, render graph, compact records, loader milestones. | Architecture input. | Prototype directly reflects render graph, OIT, emissive-light, environment, and asset registry boundaries. |

## Generic Engine Candidates

These can become `age-render-webgpu` or adjacent packages after dependency cleanup:

- Renderer backend lifecycle: device request, context configure, resize, dispose.
- Render graph: pass ordering, frame targets, transient target ownership.
- GPU resource wrappers: buffers, texture arrays, samplers, material buffers.
- Shader/pipeline factories per pass.
- Packed geometry and draw batch contracts.
- Material record packing and role policy evaluation.
- Texture color-space contract and fallback textures.
- Opaque forward renderer.
- Weighted blended OIT and sorted transparent fallback.
- Contact shadow/grounding pass.
- GPU particle and projectile billboard passes, after adapter-provided records.
- Post chain: offscreen color target, bloom, tone/display transform, FXAA.
- Environment profiles and future prefiltered env contracts.

## Human Protocol Adapter Responsibilities

The adapter layer may import Human Protocol code. The engine must not.

Proposed files:

```text
games/human-protocol/src/adapters/age/
  humanLevelToAgeScene.ts
  humanMaterialRoles.ts
  humanAssetRegistry.ts
  humanRuntimeBridge.ts
```

Responsibilities:

- `humanLevelToAgeScene.ts`
  - Convert Human `LevelDefinition`, existing raw render plans, rooms, instances, and visibility data into `AgeRenderPlan`.
  - Preserve game IDs only in adapter metadata when needed; do not require engine branches on those IDs.
- `humanMaterialRoles.ts`
  - Map raw roles like doors, pickups, route markers, screens, glass, robot body, danger markers into generic or namespaced `AgeMaterialRole` values.
  - Own regex/name inference that is currently inside `RawWebGpuMaterialPipeline.ts`.
- `humanAssetRegistry.ts`
  - Wrap existing generated raw assets, geometry binaries, cooked GLB manifests, and robot animation bridges as `AgeAssetBundleDescriptor`.
  - Keep Vite `import.meta.glob` and generated filename rules out of engine core.
- `humanRuntimeBridge.ts`
  - Convert `GameWorld` each frame into `AgeSceneFrame`: camera, quality tier, lighting frame, generic instances, draw batches, projectile records, particle emitters.
  - Map weapon/effect/pickup/enemy semantics into generic VFX records before the engine sees them.

## Must Stay In Game For Now

- `GameWorld`, `GameLoop`, input handlers, player/camera rig, campaign progression.
- UI, HUD, React canvas component, Three.js viewmodel overlay.
- Builder UI and all `src/build/**`.
- Level/puzzle/door/key/weapon/robot IDs and gameplay rules.
- Asset compiler scripts, generated manifests, raw generated assets, cooked render plans.
- Existing `RawRoomRuntime` until a generic room/portal visibility contract is proven.
- Existing visual tuning, PMREM/post visual changes, and any quality rebalancing.

## Prototype Structure Created

```text
age-render-webgpu-prototype/
  package.json
  tsconfig.json
  docs/extraction-plan.md
  src/core/
    AgeRenderBackend.ts
    AgeWebGpuRenderer.ts
    AgeRendererContext.ts
    AgeSceneFrame.ts
    AgeGpuDevice.ts
    AgeMath.ts
    AgeTypes.ts
    AgeDisposables.ts
  src/backends/
    AgeBackendRegistry.ts
    webgpu/AgeWebGpuRenderer.ts
  src/graph/
    AgeRenderGraph.ts
    AgeRenderPass.ts
    AgeGraphResource.ts
    AgeFrameTargets.ts
    AgeFrameEncoder.ts
    AgeFallbackPolicy.ts
    AgeRenderGraphValidation.ts
    createAgeWebGpuRenderGraph.ts
  src/adapters/
    AgeAdapterContracts.ts
  src/animation/
    AgeAnimationContracts.ts
  src/diagnostics/
    AgeDiagnostics.ts
    AgePreBackportValidation.ts
    AgeSchemaValidation.ts
  src/features/
    AgeFeatureFlags.ts
  src/pipelines/
    AgePipelineRegistry.ts
  src/quality/
    AgeQualityPolicy.ts
  src/scene/
    AgeSceneDescriptor.ts
    AgeSceneFrame.ts
  src/shaders/
    AgeShaderModuleRegistry.ts
  src/vfx/
    AgeVfxRecords.ts
  src/visibility/
    AgeVisibility.ts
  src/resources/
    AgeAssetRegistry.ts
    AgeGeometryResources.ts
    AgeTextureResources.ts
    AgeBufferAllocator.ts
  src/materials/
    AgeMaterialRoles.ts
    AgeMaterialPipeline.ts
    AgeTransparentPolicy.ts
  src/lighting/
    AgeLightingProfile.ts
    AgeEnvironmentProfile.ts
    AgeEmissiveLightExtraction.ts
  src/passes/
    opaque/AgeOpaquePass.ts
    transparent/AgeTransparentPass.ts
    glass/AgeGlassOitPass.ts
    particles/AgeGpuParticlesPass.ts
    projectiles/AgeProjectileVfxPass.ts
    grounding/AgeGroundingPass.ts
    post/AgePostProcessPass.ts
  src/platform/
    AgePlatformAdapter.ts
    AgeStorageAdapter.ts
    AgeTelemetryAdapter.ts
    browser/
      createBrowserAgePlatformAdapter.ts
      createBrowserAgeStorageAdapter.ts
      index.ts
  src/contracts/
    AgeAssetContracts.ts
    AgeRenderPlanContracts.ts
    AgeSchemaVersions.ts
  tests/fixtures/
    minimalAgeFixture.ts
  tests/smoke/
    validatePrototype.ts
  examples/
    human-protocol-adapter-shape/
      humanProtocolAdapterShape.ts
  src/index.ts
```

## Core API Shape

The phase-1 API names requested by the task are present:

- `AgeRenderBackend`
- `AgeWebGpuRenderer`
- `AgeRendererContext`
- `AgeRenderGraph`
- `AgeRenderPass`
- `AgeFrameTargets`
- `AgeSceneFrame`
- `AgeAssetRegistry`
- `AgeMaterialRole`
- `AgePlatformAdapter`

Important intended flow:

```text
Human config/assets/runtime
  -> Human adapter
  -> AgeAssetRegistry + AgeRenderPlan + AgeSceneFrame
  -> AgeRenderBackend
  -> AgeWebGpuRenderer
  -> AgeRenderGraph
  -> pass sequence
```

The engine receives generic frame records and generic asset descriptors. It never asks whether the level is a museum, whether a weapon is a rail lance, or whether an enemy is a specific robot family.

## Render Graph Direction

Initial graph order:

```text
opaque
grounding
glass OIT
transparent fallback
projectile VFX
GPU particles
post
```

This is intentionally simpler than the final roadmap. Later graph nodes should add:

- shadow map
- clustered/forward+ light build
- mini G-buffer extraction
- emissive-derived light upload
- analytic room probe
- planar/SSR reflection
- bloom prefilter/blur
- tone map/display transform
- final present

`AgeFrameTargets` is the first placeholder for transient color, depth, glass OIT, bloom, and post targets. Real implementation should allocate/destroy these through an engine-owned frame target manager.

`AgeGraphResource` lets each pass describe typed resource reads/writes such as `color-target`, `depth-target`, `texture-array`, `storage-buffer`, and `frame-data`. String ids still work for lightweight call sites.

Pass lifecycle is split into `setup`, `createPipelines`, `createResources`, `resize`, `updateFrameData`, `encode`, and legacy-compatible `execute`.

## Steam And iOS Direction

Do not hardcode the browser as the runtime. Use `AgePlatformAdapter`:

- `detectCapabilities()` probes WebGPU, mobile-like input/runtime constraints, storage support, and other host facts.
- `requestWebGpuDevice()` is optional. If unavailable or rejected, `AgeFallbackPolicy` switches to another backend such as `age-render-three`.
- `AgeStorageAdapter` abstracts URL, bundle, local file, and packaged app resource loading.
- Asset bundles should be addressable and content-hashed so desktop packaged builds can preload them and mobile builds can choose smaller bundles.
- Runtime feature decisions must be probe-based: offscreen post, float color target, texture arrays, compute, OIT formats, and storage buffers can be disabled independently.
- iOS path should be treated as a runtime fallback decision, not a compile-time assumption. A non-WebGPU renderer must remain viable.

## Migration Plan

Phase 1: external prototype, complete in this workspace.

- Add contracts and render graph skeleton.
- Write extraction map and adapter boundary.
- Typecheck prototype.
- Verify no Human Protocol files changed.

Phase 2: safe type-only backport.

- Add the AGE prototype as a local package or copy only type-level contracts into a temporary internal namespace.
- Create `games/human-protocol/src/adapters/age/humanMaterialRoles.ts`.
- Create a no-render test or smoke script that maps one existing raw render plan into `AgeRenderPlan`.
- Run `validateAgePreBackportReadiness()` against the converted `AgeRenderPlan` and registered bundle descriptors.
- Do not change `RawWebGpuCanvas` or `RawWebGpuLevelRenderer` behavior.

Phase 3: asset registry wrapper.

- Wrap `RawWebGpuAssetLoader.ts` output as `AgeAssetBundleDescriptor`.
- Keep existing generated manifest names and Vite glob resolver in Human adapter.
- Add assertions that the AGE bundle resolves the same geometry/material/texture counts as the current raw path.

Phase 4: frame adapter beside existing renderer.

- Add `humanRuntimeBridge.ts` that converts `GameWorld` into `AgeSceneFrame`.
- Compare adapter-produced draw batches against current `RawWebGpuLevelRenderer.writeInstances()` output in a debug/test path.
- Existing renderer continues shipping.

Phase 5: pass-by-pass extraction.

- Move easiest passes first: `RawGroundingPass`, `RawTransparentMaterialPass`, `RawGlassOitPass`.
- Next move texture/material buffers.
- Last split `RawWebGpuLevelRenderer` orchestration and dynamic Human instance writers.

Phase 6: backend selection and fallback.

- Let Human Protocol choose `age-render-webgpu` when available and `age-render-three` fallback otherwise.
- Keep quality governor and perf telemetry in game integration code.

## Exact First Safe Backport Step

The first safe backport should be type-only and behavior-free:

1. Add an adapter folder in Human Protocol:

```text
src/adapters/age/
  humanMaterialRoles.ts
  humanLevelToAgeScene.ts
```

2. Copy or import only these prototype contracts:

```text
AgeMaterialRole
AgeRenderPlan
AgeRenderPlanMaterial
AgeAssetBundleDescriptor
AgeSceneFrame
```

3. Implement `humanMaterialRoles.ts` as a pure mapping function from existing raw material roles/names to AGE roles.

4. Implement `humanLevelToAgeScene.ts` as a pure converter from an already-loaded `RawRenderPlan` into `AgeRenderPlan`.

5. Add a unit/smoke check that loads no GPU resources and asserts counts/IDs only.
6. Add `validateAgePreBackportReadiness()` to that smoke check, allowing warnings for missing optional geometry but failing on duplicate material indexes or invalid draw batches.

This creates the adapter seam without touching renderer behavior, generated assets, build UI, or visual output.

## Pre-Backport Quality Gate

See `docs/pre-backport-quality-gate.md` for the operational checklist. In short:

- TypeScript must pass in the external prototype.
- Runtime-only `tsconfig.json` must not include `examples/` or `tests/`.
- The default render graph must validate without errors.
- The minimal fixture and Human adapter shape example must typecheck.
- Human Protocol adapter code must be pure conversion code for the first backport.
- Engine files must not import Human Protocol runtime, config, generated manifests, builder modules, weapon IDs, robot IDs, or level IDs.

## Risks And Open Questions

- Shader contracts are still implicit in current WGSL entry points. The extracted engine needs a shader module registry and versioned bind group contract.
- Current material role inference is powerful but content-specific. It should not leak into core.
- `RawWebGpuLevelRenderer` uses Three.js math types heavily. AGE core must decide whether to depend on a math package, use plain arrays, or provide a tiny math layer.
- Texture array budgets and color-space handling need validation across low-end GPUs and mobile runtimes.
- Weighted OIT currently depends on broad transparent batch selection. Future extraction should split glass/transparent draw lists earlier.
- Offscreen post is architecturally important but currently risky in the source roadmap. It should be graph-isolated with feature-level fallback.
- Room visibility and selected lights are close to generic, but current runtime still depends on Human world state. Extract only after adapter parity tests exist.
- Robot animation bridge is a loader/runtime boundary. Generic engine can consume animation palettes, but Human adapter should own model-family and action mapping.
- Steam packaging and iOS fallback require asset bundle discipline before renderer changes: no direct generated path assumptions inside core.

## Non-Goals For Phase 1

- No visual tuning.
- No PMREM implementation.
- No asset rebuilds.
- No generated manifest changes.
- No edits to `src/build/**`.
- No migration of `RawWebGpuLevelRenderer.ts` as a whole file.
- No Human Protocol game directory writes.
