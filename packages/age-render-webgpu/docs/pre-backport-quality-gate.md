# Pre-Backport Quality Gate

This checklist defines what must be true before any AGE renderer work is copied or imported into Human Protocol.

## Required Shape

- Engine code lives outside the game or in a package-style namespace.
- Human Protocol-specific conversion lives in an adapter folder.
- Existing raw WebGPU renderer behavior remains unchanged until adapter parity tests pass.
- No generated assets, cooked manifests, builder UI files, or asset rebuild scripts are modified as part of the first backport.

## Folder Boundaries

Recommended engine/package folders:

```text
src/adapters/      generic adapter contracts only
src/animation/     model-agnostic clip, sampler, pose, palette records
src/backends/      backend registry and backend implementations
src/contracts/     asset and render-plan schemas
src/core/          small shared types, disposables, math, renderer context
src/diagnostics/   validation and pre-backport readiness checks
src/features/      feature flags and renderer capability toggles
src/graph/         render graph, pass lifecycle, frame targets
src/lighting/      lights, environment profiles, emissive extraction
src/materials/     material roles, material record packing, transparency policy
src/passes/        pass implementations grouped by render feature
src/pipelines/     pipeline descriptors and registries
src/platform/      browser/desktop/mobile storage, telemetry, device hooks
src/platform/browser/
                   browser-only platform/storage factories; not part of generic runtime assumptions
src/quality/       quality tiers, budgets, runtime policy
src/resources/     asset registry, geometry, textures, buffers
src/scene/         scene descriptors, runtime state, frame re-exports
src/shaders/       shader descriptors and registries
src/vfx/           projectile/effect/particle records and budgets
src/visibility/    room/portal/state visibility resolvers
```

Human Protocol adapter folders after backport:

```text
games/human-protocol/src/adapters/age/
  humanAssetRegistry.ts
  humanLevelToAgeScene.ts
  humanMaterialRoles.ts
  humanRuntimeBridge.ts
```

The engine package must not import anything from that adapter folder.

## Machine Checks

Before backport:

- `npm exec --package typescript@5.6.3 -- tsc -p tsconfig.check.json --noEmit` passes in the prototype.
- `npm exec --package typescript@5.6.3 -- tsc -p tsconfig.json --noEmit` passes for runtime-only source.
- `npm exec --package tsx -- tsx tests/smoke/validatePrototype.ts` passes.
- `validateAgeRenderGraph()` returns no errors for the default WebGPU graph.
- `validateAgePreBackportReadiness()` exists and can be used by the first Human smoke test.
- `tests/fixtures/minimalAgeFixture.ts` validates as a minimal asset bundle, render plan, and scene frame.
- `examples/human-protocol-adapter-shape/` typechecks without importing Human Protocol code.
- `find <human-protocol> -path '*age-render-webgpu-prototype*'` returns nothing.

After the first type-only backport:

- A pure adapter test converts one loaded raw render plan into `AgeRenderPlan`.
- The test asserts instance/material/geometry counts, duplicate material indexes, and missing geometry warnings.
- The adapter test should be modeled after `examples/human-protocol-adapter-shape/humanProtocolAdapterShape.ts`.
- No browser/dev-server visual QA is needed for type-only backport, because runtime behavior must not change.

## Human Adapter Parity Targets

The adapter must be able to produce:

- `AgeAssetBundleDescriptor` from the existing generated raw plan, geometry binary, texture descriptors, and cooked GLB manifest metadata.
- `AgeRenderPlan` from `RawRenderPlan`.
- `AgeSceneFrame` from `GameWorld`, but only inside `humanRuntimeBridge.ts`.
- Generic projectile and particle records, without leaking weapon IDs into engine passes.
- Generic animation sampler/palette records, without leaking robot family IDs into engine core.

## Stop Conditions

Do not backport if:

- The prototype has TypeScript errors.
- A planned engine file imports Human Protocol game modules.
- Test fixtures or examples are exported from `src/index.ts`.
- Browser-only helpers are placed back into generic `platform/` root files.
- The first backport requires modifying `RawWebGpuLevelRenderer.ts` behavior.
- The first backport requires asset rebuilds.
- The first backport touches `/build`, `src/build/**`, generated manifests, cooked render plans, or raw asset outputs.
