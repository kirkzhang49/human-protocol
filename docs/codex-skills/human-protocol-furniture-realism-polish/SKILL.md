---
name: human-protocol-furniture-realism-polish
description: Use when Human Protocol furniture, props, Image2-derived GLBs, or Level 5 v3 assets look like stickers, blocks, disconnected rods, floating details, or low-quality generated assets and need a repeatable realism polish pass with audit evidence, builder pack emit, and Raw WebGPU verification.
---

# Human Protocol Furniture Realism Polish

Use this after `human-protocol-math-first-asset-modeling` and `human-protocol-image2-build-webgpu-pipeline` when assets technically have textures but still feel fake.

## Core Rule

Do not defend a sticker-looking asset with texture evidence. Fix the asset.

Realism comes from:

1. **No-gap geometry**: rods, arms, hinges, legs, handles, panels, and feet must connect by endpoint math or intentional overlap. Add collars, sockets, bridges, or inset shadows at joints.
2. **Clean silhouette**: remove player-facing bead rows, status dots, loose screws, stray bars, and decorative tiny parts unless they are gameplay-readable.
3. **Material hierarchy**: separate ceramic, rubber, graphite, brass, glass, screen, and emissive slots with restrained roughness/metallic values.
4. **Texture as material**: Image2 crops are material regions, not posters. UV visible surfaces into seams, ribs, wear, gaskets, glass, and trim.
5. **PBR follow-up**: baseColor-only GLBs remain first-pass. For production polish, derive or author normal/roughness/occlusion maps, then prove them in glTF.

## Workflow

1. **Audit first**
   - Run `node scripts/qa/level05-v3-furniture-realism-audit.mjs` for Level 5 v3 furniture.
   - Inspect `src/assets/manifests/reports/level05_reclamation_furniture_image2_v3_realism_audit.md`.
   - Identify high-risk assets by clutter, no-gap, and baseColor-only material limits.

2. **Fix geometry before texture**
   - Use endpoint helpers such as `rod_between(start, end, ...)` for arms and supports.
   - Remove or merge front-facing tiny detail nodes if they read as junk.
   - Add connector geometry only when it hides a real join: `socket`, `collar`, `bridge`, `gasket`, `integrated_knuckle`.
   - Prefer fewer, better named parts over many tiny mesh fragments.

3. **Polish material slots**
   - Keep cyan and red sparse; red is danger/error only.
   - Use high roughness for rubber/fabric, lower roughness for glass, higher metallic for brass/graphite.
   - If the user complains about sticker texture, inspect glTF materials for `normalTexture`, `occlusionTexture`, and `metallicRoughnessTexture`; missing PBR layers are a real limitation.

4. **Regenerate and emit**
   - Run the relevant batch generator.
   - Run `node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest <pack> --check --pending`.
   - Run `node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit --manifest <pack>`.
   - Run `node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest <pack> --check`.
   - Run `node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs`.

5. **Verify before claiming**
   - Re-run the realism audit.
   - Confirm new/changed modelKeys are present in Raw WebGPU.
   - Confirm official Level 5 config still has no new `room_l5_v3_` references unless the user explicitly approved placement.
   - Report old unrelated audit failures separately.

## Acceptance Gates

- GLB has no accidental front clutter for the user-reported asset.
- All named mesh nodes use baseColorTexture.
- All mesh nodes have area UV; center-sampled UV count is zero.
- Critical rods/arms/supports use endpoint-based connection or visible socket/collar overlap.
- Builder pack structural and integration checks pass.
- Raw WebGPU resource compile passes.
- Browser/contact-sheet visual evidence is shown or explicitly marked pending.

