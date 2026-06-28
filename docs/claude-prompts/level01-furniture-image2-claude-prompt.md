# Claude Prompt - Level 01 Furniture Image2 Pack

Act like a world-class hard-surface technical artist, Blender pipeline engineer, and Human Protocol /build asset integrator.

You are working in:

```txt
/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol
```

## Goal

Build the Level 01 Maintenance Bay furniture pack as a self-contained, merge-safe asset-pack candidate. Do not directly edit shared /build catalog or registry files. Codex will merge the generated manifest into /build after reviewing all three level packs.

Level 01 should feel like: cold repair-object facility, white enamel metal, brushed steel, black rubber, cyan diagnostics, tiny amber hazard marks. It must look like premium physical sci-fi furniture in builder iso view and first-person WebGPU, not like flat UI pasted onto cubes.

## Required References

Read these before editing:

```txt
docs/human-protocol-puzzle-image2-assert-workflow.md
docs/human-protocol-level01-05-furniture-image2-style-plan.md
docs/art/level-furniture-image2/level01-maintenance-bay-furniture-image2-board.png
scripts/asset-build/generate-builder-asset-pack-registry.mjs
src/build/generatedBuilderAssetCatalog.ts
src/assets/registry/environment/generatedBuilderAssetPacks.ts
```

Use existing asset-pack schema and generated fragment conventions. Do not invent a parallel registry system.

## Scope Boundaries

You MAY create or modify only Level 01-specific paths:

```txt
scripts/asset-build/generate-level01-furniture-image2-assets.py
src/assets/textures/environment/level01-furniture-image2/**
src/assets/models-cooked/environment/level01-furniture-image2/**
src/assets/manifests/builder/hp_level01_furniture_image2_v1.json
docs/human-protocol-level01-furniture-image2-report.md
.tmp/level01-furniture-image2/**
```

Do NOT edit:

```txt
src/assets/environmentModelAssets.ts
src/assets/registry/environment/generatedBuilderAssetPacks.ts
src/build/generatedBuilderAssetCatalog.ts
src/build/generatedBuilderAssetFootprints.ts
src/build/BuilderAssetCatalog.ts
src/build/BuilderAssetFootprints.tsx
```

Do not revert any existing user/Codex/Claude changes.

## Assets To Build

Create 8 furniture GLBs, each with distinct silhouette, measured bounds, grounded pivot, named parts, bevels, weighted normals, and atlas UVs:

```txt
room_l1_img2_repair_workbench          label: 维修台灯桌        family: desk                         footprint: table
room_l1_img2_parts_cabinet             label: 零件档案柜        family: cabinet                      footprint: cabinet
room_l1_img2_battery_cart              label: 供能推车          family: storage_crate                 footprint: crate
room_l1_img2_diagnostic_locker          label: 诊断储物柜        family: cabinet                      footprint: cabinet
room_l1_img2_folded_gurney             label: 折叠维护床        family: bed_or_exam_table             footprint: bed
room_l1_img2_service_stool             label: 值守矮凳          family: chair                        footprint: chair
room_l1_img2_utility_crate             label: 工具箱            family: storage_crate                 footprint: crate
room_l1_img2_ceiling_service_light      label: 顶部维修灯        family: wall_panel_or_picture_frame   footprint: lamp, mount: ceiling
```

Group must be `维修`. Source should be a new source id such as `level01-image2-furniture`.

## Image2 / Atlas Requirements

From the board reference and Level 01 style, create:

```txt
src/assets/textures/environment/level01-furniture-image2/image2-sources/*.png
src/assets/textures/environment/level01-furniture-image2/hp_level01_furniture_image2_atlas.png
src/assets/textures/environment/level01-furniture-image2/hp_level01_furniture_image2_atlas.regions.json
```

The atlas must include useful regions, not a full poster:

```txt
enamel.panel
brushed.steel.strip
cyan.glass.lens
rubber.gasket
hazard.edge.strip
screw.cross
vent.grille
grime.corner
edge.wear
diagnostic.screen.glass
```

Hard fail: one board image pasted onto furniture fronts, readable instruction text on GLBs, or floating decorative planes that are not proud inlays on real surfaces.

## Blender / GLB Requirements

Use a deterministic Python/Blender script. It can procedurally create the source PNGs/atlas with Pillow if slicing the board is not robust, but the visual language must match the board.

Each GLB:

- embeds or references the Level 01 atlas through material texture slots;
- uses small region inlays on real geometry faces;
- has named objects and named materials;
- has bevels/weighted normals;
- has sane file size;
- has no old puzzle-machine poster atlas;
- can load through Vite `?url` imports.

## Asset-Pack Manifest

Write:

```txt
src/assets/manifests/builder/hp_level01_furniture_image2_v1.json
```

It must validate with:

```bash
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest src/assets/manifests/builder/hp_level01_furniture_image2_v1.json --check --pending
```

Use schema `hp.builder.assetPack.v1`, packId `hp_level01_furniture_image2_v1`, group `维修`, and correct relative `.glb` paths.

## QA / Evidence

Run at minimum:

```bash
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest src/assets/manifests/builder/hp_level01_furniture_image2_v1.json --check --pending
git diff --check -- scripts/asset-build/generate-level01-furniture-image2-assets.py src/assets/textures/environment/level01-furniture-image2 src/assets/manifests/builder/hp_level01_furniture_image2_v1.json docs/human-protocol-level01-furniture-image2-report.md
```

If practical, also run a GLB texture audit that lists embedded images/materials with baseColorTexture.

Create evidence files under:

```txt
.tmp/level01-furniture-image2/
```

At least one contact sheet or render is required.

## Final Report

Write `docs/human-protocol-level01-furniture-image2-report.md` with:

- changed files;
- generated model keys and sizes;
- atlas regions;
- manifest validation result;
- render/contact-sheet path;
- remaining risks;
- exact commands run.

Final answer should be short and include whether the manifest is ready for Codex to merge.
