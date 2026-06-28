---
name: human-protocol-image2-build-webgpu-pipeline
description: Use when moving Human Protocol Image2 or generated bitmap asset families into provenance ledgers, /build asset packs, builder catalogs, environment modelKey registries, thumbnails, and Raw WebGPU builder resource maps without hand-patching generated Raw JSON.
---

# Human Protocol Image2 Build WebGPU Pipeline

Work in the standalone Human Protocol repo root, for example `/Users/zhengkaizhang/Documents/human-protocol`.

Core rule: Image2/generated bitmap art is source evidence, not the final runtime
contract. Record provenance, convert source manifests into builder packs, emit
registry/catalog fragments, then rebuild the builder Raw WebGPU resource pack.
Do not hand-edit generated Raw WebGPU JSON.

## Provenance

For every Image2/generated bitmap source, check repo-local provenance first:

- `AGENT.md`
- `docs/asset-license-ledger.md`
- `src/assets/manifests/reports/*image2*source*provenance*.{md,json}`
- `src/assets/manifests/reports/*image2*texture_report.json`

Record prompt, tool/call id when available, generating account when known,
generation date, source image paths, crop mapping, license label, reference
inputs, and derivative outputs.

Use:

```text
openai-generated-output-user-owned-subject-to-openai-terms
```

for OpenAI-generated project output. If source/prompt/account/date are recorded
and the asset is project-generated generic material art, classify it as:

```text
owned-generated-output
```

If a tool does not expose call IDs, record `not-exposed-by-...`; do not call the
asset unknown-license just because the call id is unavailable.

## Build Conversion

If the asset family already has `hp.builder.assetPack.v1`, validate and emit it:

```sh
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest <pack.json> --check --pending
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit --manifest <pack.json>
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest <pack.json> --check
```

If it only has a runtime asset-factory manifest, convert first:

```sh
node scripts/asset-build/convert-runtime-asset-factory-to-builder-pack.mjs \
  --input src/assets/manifests/runtime/<factory>.json \
  --output src/assets/manifests/builder/<pack>.json \
  --pack-id <pack_id> \
  --label "<display label>" \
  --group <builder group> \
  --source <source id>
```

The emit path updates:

- `src/assets/manifests/builder/ingested-packs.json`
- `src/assets/registry/environment/generatedBuilderAssetPacks.ts`
- `src/build/generatedBuilderAssetCatalog.ts`
- `src/build/generatedBuilderAssetFootprints.ts`

## WebGPU Map

Builder Raw WebGPU consumes `builderPropCatalog` through
`src/build/runtime-pack/BuilderRuntimeAssetIndex.ts`. After emit, rebuild:

```sh
node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs
```

Acceptance: `issues=0` and new modelKeys are present in
`src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json`.

## Thumbnails And QA

For thumbnails:

```sh
node scripts/asset-build/generate-builder-asset-thumbnails.mjs --only <model_key_prefix>
```

Patch `packDirFor()` when introducing a new reusable family prefix.

Minimum QA:

```sh
node scripts/qa/builder-wgpu-resource-audit.mjs
git diff --check -- <touched files>
```

Use `npm run qa:builder` for full `/build` acceptance.
