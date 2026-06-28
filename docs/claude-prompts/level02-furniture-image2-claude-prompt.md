# Claude Prompt - Level 02 Furniture Image2 Pack

Act like a world-class hard-surface technical artist, environment prop designer, Blender pipeline engineer, and Human Protocol /build asset integrator.

You are working in:

```txt
/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol
```

## Goal

Build the Level 02 Residential Simulation furniture pack as a self-contained, merge-safe asset-pack candidate. Do not directly edit shared /build catalog or registry files. Codex will merge the generated manifest into /build after reviewing all three level packs.

Level 02 should feel like: false comfort under surveillance, warm laminate, cream upholstery, soft yellow lamps, hidden cyan scanner seams, domestic silhouettes with facility control hidden inside. It must be attractive enough that a player wants to place it, but still unsettling.

## Required References

Read these before editing:

```txt
docs/human-protocol-puzzle-image2-assert-workflow.md
docs/human-protocol-level01-05-furniture-image2-style-plan.md
docs/art/level-furniture-image2/level02-residential-simulation-furniture-image2-board.png
scripts/asset-build/generate-builder-asset-pack-registry.mjs
src/build/generatedBuilderAssetCatalog.ts
src/assets/registry/environment/generatedBuilderAssetPacks.ts
```

Use existing asset-pack schema and generated fragment conventions. Do not invent a parallel registry system.

## Scope Boundaries

You MAY create or modify only Level 02-specific paths:

```txt
scripts/asset-build/generate-level02-furniture-image2-assets.py
src/assets/textures/environment/level02-furniture-image2/**
src/assets/models-cooked/environment/level02-furniture-image2/**
src/assets/manifests/builder/hp_level02_furniture_image2_v1.json
docs/human-protocol-level02-furniture-image2-report.md
.tmp/level02-furniture-image2/**
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
room_l2_img2_modular_sofa                 label: 看护沙发          family: sofa_bench                    footprint: sofa
room_l2_img2_observation_dining_table     label: 观察餐桌          family: desk                          footprint: table
room_l2_img2_nursery_bed                  label: 儿童看护床        family: bed_or_exam_table             footprint: bed
room_l2_img2_family_portrait_console      label: 全家福管制台      family: wall_panel_or_picture_frame    footprint: wall_panel, mount: wall
room_l2_img2_service_kitchen_counter      label: 服务厨房台        family: control_console               footprint: table
room_l2_img2_scanner_wardrobe             label: 衣柜扫描舱        family: cabinet                       footprint: cabinet
room_l2_img2_camera_lamp                  label: 看护落地灯        family: wall_panel_or_picture_frame    footprint: lamp
room_l2_img2_living_end_elevator_fixture  label: 尽头电梯饰柜      family: cabinet                       footprint: cabinet
```

Group must be `居住`. Source should be `level02-image2-furniture`.

## Image2 / Atlas Requirements

From the board reference and Level 02 style, create:

```txt
src/assets/textures/environment/level02-furniture-image2/image2-sources/*.png
src/assets/textures/environment/level02-furniture-image2/hp_level02_furniture_image2_atlas.png
src/assets/textures/environment/level02-furniture-image2/hp_level02_furniture_image2_atlas.regions.json
```

The atlas must include useful regions:

```txt
laminate.wood
cream.upholstery
old.beige.plastic
warm.lamp.glass
brass.edge.trim
cyan.scanner.strip
camera.lens
stitched.fabric.patch
fake.wallpaper.fragment
hidden.service.panel
```

Hard fail: cozy stock-house furniture with no facility seams, one full board pasted onto props, readable instruction text, or large flat cards pretending to be 3D.

## Blender / GLB Requirements

Use a deterministic Python/Blender script. It can procedurally create the source PNGs/atlas with Pillow if slicing the board is not robust, but the visual language must match the board.

Each GLB:

- embeds or references the Level 02 atlas through material texture slots;
- uses small region inlays on real geometry faces;
- has named objects and named materials;
- has bevels/weighted normals;
- has sane file size;
- has no old puzzle-machine poster atlas;
- can load through Vite `?url` imports.

## Asset-Pack Manifest

Write:

```txt
src/assets/manifests/builder/hp_level02_furniture_image2_v1.json
```

It must validate with:

```bash
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest src/assets/manifests/builder/hp_level02_furniture_image2_v1.json --check --pending
```

Use schema `hp.builder.assetPack.v1`, packId `hp_level02_furniture_image2_v1`, group `居住`, and correct relative `.glb` paths.

## QA / Evidence

Run at minimum:

```bash
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest src/assets/manifests/builder/hp_level02_furniture_image2_v1.json --check --pending
git diff --check -- scripts/asset-build/generate-level02-furniture-image2-assets.py src/assets/textures/environment/level02-furniture-image2 src/assets/manifests/builder/hp_level02_furniture_image2_v1.json docs/human-protocol-level02-furniture-image2-report.md
```

If practical, also run a GLB texture audit that lists embedded images/materials with baseColorTexture.

Create evidence files under:

```txt
.tmp/level02-furniture-image2/
```

At least one contact sheet or render is required.

## Final Report

Write `docs/human-protocol-level02-furniture-image2-report.md` with:

- changed files;
- generated model keys and sizes;
- atlas regions;
- manifest validation result;
- render/contact-sheet path;
- remaining risks;
- exact commands run.

Final answer should be short and include whether the manifest is ready for Codex to merge.
