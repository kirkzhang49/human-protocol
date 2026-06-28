# AGE Escape-Room Renderer v1 — Handoff

Status: AGE now controls measurable, visible rendering decisions behind opt-in
URL flags. The default runtime (no flags) is byte-for-byte the old raw WebGPU
renderer path. This is the first pixel-backed AGE usage, not a renderer swap.

## Architecture

```text
LevelDefinition / Builder config
  -> raw/cooked render plan (generated, untouched by AGE work)
  -> Human adapter (games/human-protocol/src/adapters/age/**)
  -> AgeRenderPlan + AgeEscapeRoomVisualProfile + AgeSceneFrame
  -> AGE passes or raw compatibility layer (current stage)
  -> eventually AGE renderer backend (AgeWebGpuRenderer + AgeRenderGraph)
```

The escape-room thesis: AGE beats a generic scene renderer by treating room
knowledge as first-class rendering data — room/portal visibility, per-room
lighting profiles and light budgets, semantic material roles, gameplay-derived
contact records, and door state. All of that flows through generic contracts in
`packages/age-render-webgpu`; Human Protocol semantics stop at the adapter.

## URL flags

| Flag | Effect |
| --- | --- |
| *(none)* | Exactly the pre-AGE raw renderer. No AGE code runs in the frame loop. |
| `?ageBridge=1` | Once per ~60 frames: builds an `AgeSceneFrame` from the live `GameWorld`, validates it (`validateAgeSceneFrameRuntime`), compares against raw renderer counts, shows a fixed overlay, logs `[HumanProtocol] AGE bridge`, and emits `age_bridge_stats` perf events. |
| `?ageVisualProfile=1` | Raw renderer consumes the derived `AgeEscapeRoomVisualProfile`: per-room tone (exposure/contrast/saturation/warmth), ambient/key/local light intensity scales by room mood, per-room/per-tier local light budgets with room-aware selection (`ageSelectRoomLights`), bloom strength/threshold intent, fog near/far scales, contact-shadow strength/radius, and emissive role boost re-packed through the existing material pipeline. |
| `?ageGrounding=1` | `AgeGroundingPass` plans dynamic contact shadows from shared `AgeContactRecord` data and encodes the contact-shadow draws. Any plan/encode error flips `ageGroundingFailed` and reverts to the raw pass automatically. |
| `?ageGrounding=parity` | AGE plans quads and reports counts in bridge stats, but the raw pass keeps drawing (zero pixel risk). |

Flags compose: `?ageBridge=1&ageVisualProfile=1&ageGrounding=1` is the full
v1 experience. `?ageGrounding=…` works with or without the visual profile (it
falls back to `ageDefaultEscapeRoomVisualProfile.grounding`).

## What AGE controls today (behind flags)

- **Room tone + light budgets** (`?ageVisualProfile=1`): per-room artist values
  and mood-derived ambient/key scales, derived from cooked `lightingProfiles`,
  room moods, and art-direction directives in `humanEscapeRoomVisualProfile.ts`.
  Light budgets come from the compiled visibility scenarios (real per-room,
  per-tier data), enforced through the generic `ageSelectRoomLights` with a
  reserved ambience slot.
- **Emissive role boost**: AGE role tuning re-packs the material buffer once at
  configure time (`applyAgeMaterialRoleTuning`), boosting emissive strength for
  `emissive-accent` / `route-marker` / `danger-marker` / `screen-label` /
  `interactive-active` roles. Boost magnitude scales with the level's emissive
  material share.
- **Bloom/fog intent**: profile-level bloom strength/threshold and fog
  near/far scales applied in `writeBloom` / `writeCamera`.
- **Contact/grounding shadows**: with the visual profile, strength/radius of
  all existing shadow planes; with `?ageGrounding=1`, the dynamic-entity quads
  themselves are planned by `AgeGroundingPass.planQuads` from
  `humanAgeContactsFromWorld` records (same records the bridge validates) and
  encoded by `AgeGroundingPass.encodeContactShadows`.
- **Validation + parity telemetry** (`?ageBridge=1`): schema/runtime warnings,
  AGE-vs-raw instance/shadow/light counts, portal open counts.

## What is still raw-renderer owned

- Device/context lifecycle, pipelines, bind groups, shaders, all buffers.
- Static plan instance writing, room visibility evaluation (`RawRoomRuntime`),
  door open animation, enemy skinning/animation palettes.
- Static plan-instance shadow planes (only *dynamic entity* grounding is AGE-planned).
- Post chain (bloom composite, FXAA, display transform), glass OIT,
  transparent fallback, GPU particles, projectile VFX, hero floor.
- Quality governor, perf telemetry semantics, React canvas shell, viewmodel overlay.
- The Three.js fallback renderer and every default (flag-less) code path.

## Key files

Engine (`packages/age-render-webgpu`):
- `src/escape-room/AgeEscapeRoomVisualProfile.ts` — profile contracts +
  `ageRoomVisualProfileFor` / `ageRoomLightBudgetFor` / `ageSelectRoomLights`.
- `src/passes/grounding/AgeGroundingPass.ts` — `planQuads` (policy math) +
  `encodeContactShadows` (draw encoding). No game imports.

Human adapter (`games/human-protocol/src/adapters/age/`):
- `humanEscapeRoomVisualProfile.ts` — raw plan -> generic profile derivation.
- `humanAgeRuntimeFlags.ts` — URL flag parsing.
- `humanAgeDebugBridge.ts` — `?ageBridge=1` sampling/stats/formatting.
- `humanRuntimeBridge.ts` — `humanAgeContactsFromWorld` shared contact records.

Runtime integration:
- `src/render/raw-webgpu/RawWebGpuLevelRenderer.ts` —
  `configureAgeIntegration`, `ageDebugParityStats`, AGE overrides in
  `writeLighting` / `writeCamera` / `writeBloom` / `writeShadowPlane` /
  `writeDynamicInstances` / `encodeScenePass`.
- `src/render/raw-webgpu/RawWebGpuCanvas.tsx` — flag wiring, bridge sampling,
  overlay.

## How a future game adopts AGE

1. Produce a render plan (any source) and convert it with your own adapter to
   `AgeRenderPlan` + `AgeAssetBundleDescriptor` (see `humanLevelToAgeScene.ts`
   / `humanAssetRegistry.ts` as the reference implementation).
2. Derive an `AgeEscapeRoomVisualProfile` from your level data — room moods,
   per-room lighting, light placement. Never put game IDs in engine code.
3. Bridge your world state per frame into `AgeSceneFrame` (instances,
   contacts, portal states, animation states) like `humanRuntimeBridge.ts`.
4. Validate with `validateAgePreBackportReadiness` + `validateAgeSceneFrameRuntime`
   in a headless smoke before rendering anything.
5. Consume AGE passes incrementally from your renderer (grounding first), or —
   once the AGE backend owns buffers — hand the frame to `AgeWebGpuRenderer`.

## Exact next pass to port after grounding

**`RawTransparentMaterialPass` -> `AgeTransparentPass`** (sorted-alpha
fallback). Reasons: it already consumes only draw batches + pipeline + bind
groups (same host-owned-resources shape proven by grounding), it has no
GameWorld reads, and its batch selection policy (`RawTransparentBatchPolicy`)
maps directly onto `AgeTransparentPolicy` / material roles. Port shape:

1. Add `planTransparentBatches(batches, policy)` + `encode(renderPass, ctx)` to
   `AgeTransparentPass`, mirroring the grounding pass host contract.
2. Move `rawTransparentMaterialIndexSet` / instance-id policy into the Human
   adapter as a `AgeMaterialRole`-driven mapping.
3. Flag `?ageTransparent=1|parity` with the same fail-revert pattern.

After that: `RawGlassOitPass` (needs frame targets — first pass to exercise
`AgeFrameTargets` for real), then texture/material buffer ownership.

## What still prevents a full AGE renderer swap

- AGE owns no GPU resources: device, swapchain, buffers, texture arrays,
  pipelines, and WGSL all live in the raw renderer. `AgeWebGpuRenderer` and the
  render graph are still shells.
- Static scene path (room visibility -> instance buffer -> draw batches) is
  raw-owned and has no AGE parity test yet beyond counts.
- Robot animation sampling and rigid-joint palettes have engine contracts but
  no engine implementation.
- Post chain and OIT are raw-owned and depend on offscreen targets the AGE
  frame-target manager does not allocate yet.
- Shader contracts (bind group layouts, instance float layout) are implicit in
  raw WGSL; AGE needs its shader-module registry filled before owning draws.

## Verification (2026-06-11)

- `packages/age-render-webgpu`: `npm run typecheck`, `npm run typecheck:runtime`,
  `npm run test:smoke` — pass (smoke now covers grounding quads + light selection).
- `games/human-protocol`: `npm run smoke:campaign`, `npm run smoke:age-adapter`
  — pass (adapter smoke now checks profiles, budgets, grounding quads on all
  5 cooked plans). `npx vite build` — pass. `tsc -b` currently fails only in
  `src/build/BuilderPreview3D.tsx`, a pre-existing in-progress builder refactor
  unrelated to AGE.
- Browser visual QA of the flags was not run in this pass; flags are designed
  to fail toward raw behavior.
