# Claude Prompt - Level 03 Furniture Image2 Pack

Act like a world-class hard-surface technical artist, museum exhibit prop designer, Blender pipeline engineer, and Human Protocol /build asset integrator.

You are working in:

```txt
/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol
```

## Goal

Build the Level 03 Human Museum furniture pack as a self-contained, merge-safe asset-pack candidate. Do not directly edit shared /build catalog or registry files. Codex will merge the generated manifest into /build after reviewing all three level packs.

Level 03 should feel like: humanity as exhibit, smoked display glass, black enamel plinths, aged brass frames, amber exhibit lighting, archive drawers, controlled viewing rails. It must read as premium museum horror, not generic gallery decor.

## Required References

Read these before editing:

```txt
docs/human-protocol-puzzle-image2-assert-workflow.md
docs/human-protocol-level01-05-furniture-image2-style-plan.md
docs/art/level-furniture-image2/level03-human-museum-furniture-image2-board.png
scripts/asset-build/generate-builder-asset-pack-registry.mjs
src/build/generatedBuilderAssetCatalog.ts
src/assets/registry/environment/generatedBuilderAssetPacks.ts
```

Use existing asset-pack schema and generated fragment conventions. Do not invent a parallel registry system.

## Scope Boundaries

You MAY create or modify only Level 03-specific paths:

```txt
scripts/asset-build/generate-level03-furniture-image2-assets.py
src/assets/textures/environment/level03-furniture-image2/**
src/assets/models-cooked/environment/level03-furniture-image2/**
src/assets/manifests/builder/hp_level03_furniture_image2_v1.json
docs/human-protocol-level03-furniture-image2-report.md
.tmp/level03-furniture-image2/**
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
room_l3_img2_display_plinth          label: 展柜基座          family: display_case                 footprint: display_case
room_l3_img2_archive_card_cabinet    label: 档案卡片柜        family: drawer_chest                 footprint: cabinet
room_l3_img2_mural_lightbox          label: 壁画灯箱          family: wall_panel_or_picture_frame  footprint: wall_panel, mount: wall
room_l3_img2_specimen_bench          label: 标本长凳          family: sofa_bench                   footprint: sofa
room_l3_img2_queue_rail              label: 参观栏杆          family: wall_panel_or_picture_frame  footprint: barrier
room_l3_img2_evidence_round_table    label: 证物圆桌          family: desk                         footprint: table
room_l3_img2_label_terminal          label: 展签终端          family: control_console              footprint: pedestal
room_l3_img2_preservation_case       label: 保存柜            family: display_case                 footprint: display_case
```

Group must be `博物馆`. Source should be `level03-image2-furniture`.

## Image2 / Atlas Requirements

From the board reference and Level 03 style, create:

```txt
src/assets/textures/environment/level03-furniture-image2/image2-sources/*.png
src/assets/textures/environment/level03-furniture-image2/hp_level03_furniture_image2_atlas.png
src/assets/textures/environment/level03-furniture-image2/hp_level03_furniture_image2_atlas.regions.json
```

The atlas must include useful regions:

```txt
smoked.display.glass
black.enamel.plinth
aged.brass.frame
cyan.scanner.strip
amber.exhibit.glass
dark.velvet.strip
archive.drawer.front
glass.glare.mask
dust.grime.mask
blank.floor.plaque
security.camera.lens
```

Hard fail: generic museum props, one full board pasted onto props, readable instruction text, or glass that renders as flat grey cards.

## Blender / GLB Requirements

Use a deterministic Python/Blender script. It can procedurally create the source PNGs/atlas with Pillow if slicing the board is not robust, but the visual language must match the board.

Each GLB:

- embeds or references the Level 03 atlas through material texture slots;
- uses small region inlays on real geometry faces;
- has named objects and named materials;
- has bevels/weighted normals;
- has sane file size;
- has no old puzzle-machine poster atlas;
- can load through Vite `?url` imports.

## Asset-Pack Manifest

Write:

```txt
src/assets/manifests/builder/hp_level03_furniture_image2_v1.json
```

It must validate with:

```bash
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest src/assets/manifests/builder/hp_level03_furniture_image2_v1.json --check --pending
```

Use schema `hp.builder.assetPack.v1`, packId `hp_level03_furniture_image2_v1`, group `博物馆`, and correct relative `.glb` paths.

## QA / Evidence

Run at minimum:

```bash
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest src/assets/manifests/builder/hp_level03_furniture_image2_v1.json --check --pending
git diff --check -- scripts/asset-build/generate-level03-furniture-image2-assets.py src/assets/textures/environment/level03-furniture-image2 src/assets/manifests/builder/hp_level03_furniture_image2_v1.json docs/human-protocol-level03-furniture-image2-report.md
```

If practical, also run a GLB texture audit that lists embedded images/materials with baseColorTexture.

Create evidence files under:

```txt
.tmp/level03-furniture-image2/
```

At least one contact sheet or render is required.

## Final Report

Write `docs/human-protocol-level03-furniture-image2-report.md` with:

- changed files;
- generated model keys and sizes;
- atlas regions;
- manifest validation result;
- render/contact-sheet path;
- remaining risks;
- exact commands run.

Final answer should be short and include whether the manifest is ready for Codex to merge.
