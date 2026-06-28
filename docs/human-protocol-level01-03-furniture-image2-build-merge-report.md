# Human Protocol Level 01-03 Furniture Image2 Build Merge Report

Date: 2026-06-13

This pass prepared three parallel Claude Code tasks for the first three official furniture packs, accepted their outputs, and wired the resulting assets into `/build` and the Raw WebGPU builder resource path.

## Claude Prompt Handoff

Prompts written:

- `docs/claude-prompts/level01-furniture-image2-claude-prompt.md`
- `docs/claude-prompts/level02-furniture-image2-claude-prompt.md`
- `docs/claude-prompts/level03-furniture-image2-claude-prompt.md`
- `docs/claude-prompts/level01-03-furniture-parallel-merge-plan.md`

Reference boards prepared for the agents:

- `docs/art/level-furniture-image2/level01-maintenance-bay-furniture-image2-board.png`
- `docs/art/level-furniture-image2/level02-residential-simulation-furniture-image2-board.png`
- `docs/art/level-furniture-image2/level03-human-museum-furniture-image2-board.png`
- `docs/art/level-furniture-image2/level04-memory-clinic-furniture-image2-board.png`
- `docs/art/level-furniture-image2/level05-reclamation-core-furniture-image2-board.png`

## Assets Added

Three generated builder packs were accepted:

- `hp_level01_furniture_image2_v1`: 8 Maintenance Bay assets
- `hp_level02_furniture_image2_v1`: 8 Residential Simulation assets
- `hp_level03_furniture_image2_v1`: 8 Human Museum assets

Total new `/build` furniture assets: 24.

### Level 01: Maintenance Bay

- `room_l1_img2_repair_workbench` - 维修台灯桌
- `room_l1_img2_parts_cabinet` - 零件档案柜
- `room_l1_img2_battery_cart` - 供能推车
- `room_l1_img2_diagnostic_locker` - 诊断储物柜
- `room_l1_img2_folded_gurney` - 折叠维护床
- `room_l1_img2_service_stool` - 值守矮凳
- `room_l1_img2_utility_crate` - 工具箱
- `room_l1_img2_ceiling_service_light` - 顶部维修灯

### Level 02: Residential Simulation

- `room_l2_img2_modular_sofa` - 看护沙发
- `room_l2_img2_observation_dining_table` - 观察餐桌
- `room_l2_img2_nursery_bed` - 儿童看护床
- `room_l2_img2_family_portrait_console` - 全家福管制台
- `room_l2_img2_service_kitchen_counter` - 服务厨房台
- `room_l2_img2_scanner_wardrobe` - 衣柜扫描舱
- `room_l2_img2_camera_lamp` - 看护落地灯
- `room_l2_img2_living_end_elevator_fixture` - 尽头电梯饰柜

### Level 03: Human Museum

- `room_l3_img2_display_plinth` - 展柜基座
- `room_l3_img2_archive_card_cabinet` - 档案卡片柜
- `room_l3_img2_mural_lightbox` - 壁画灯箱
- `room_l3_img2_specimen_bench` - 标本长凳
- `room_l3_img2_queue_rail` - 参观栏杆
- `room_l3_img2_evidence_round_table` - 证物圆桌
- `room_l3_img2_label_terminal` - 展签终端
- `room_l3_img2_preservation_case` - 保存柜

## Files And Integration

Generated scripts:

- `scripts/asset-build/generate-level01-furniture-image2-assets.py`
- `scripts/asset-build/generate-level02-furniture-image2-assets.py`
- `scripts/asset-build/generate-level03-furniture-image2-assets.py`

Generated GLBs:

- `src/assets/models-cooked/environment/level01-furniture-image2/*.glb`
- `src/assets/models-cooked/environment/level02-furniture-image2/*.glb`
- `src/assets/models-cooked/environment/level03-furniture-image2/*.glb`

Generated source textures:

- `src/assets/textures/environment/level01-furniture-image2/`
- `src/assets/textures/environment/level02-furniture-image2/`
- `src/assets/textures/environment/level03-furniture-image2/`

Builder manifests:

- `src/assets/manifests/builder/hp_level01_furniture_image2_v1.json`
- `src/assets/manifests/builder/hp_level02_furniture_image2_v1.json`
- `src/assets/manifests/builder/hp_level03_furniture_image2_v1.json`

The packs were registered through `generate-builder-asset-pack-registry.mjs --emit`, which updated:

- `src/assets/manifests/builder/ingested-packs.json`
- `src/assets/registry/environment/generatedBuilderAssetPacks.ts`
- `src/build/generatedBuilderAssetCatalog.ts`
- `src/build/generatedBuilderAssetFootprints.ts`

Rendered thumbnails were generated and stored per pack:

- `src/assets/thumbnails/builder/hp-level01-furniture-image2-v1/`
- `src/assets/thumbnails/builder/hp-level02-furniture-image2-v1/`
- `src/assets/thumbnails/builder/hp-level03-furniture-image2-v1/`

`scripts/asset-build/generate-builder-asset-thumbnails.mjs` now routes these prefixes into the same pack folders for future reruns.

Raw WebGPU builder resources were rebuilt with:

```sh
node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs
```

Updated outputs:

- `src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json`
- `src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources_geometry.bin`

## Verification

Completed checks:

- Manifest pending checks passed for all three packs.
- Manifest integration checks passed for all three packs after registry emit.
- Thumbnail generation completed for all 24 new model keys.
- `node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs` passed with `sourceIndex=220`, `supplementalAssets=116`, `issues=0`.
- `npx tsc -b` passed before the final generated asset/manifest work.
- `npm run qa:builder` passed after thumbnails and Raw WebGPU resource rebuild.

Final `npm run qa:builder` highlights:

- `PASS builder asset index: 24/24 GLB mappings`
- `PASS builder WGPU resource map: 220/220 unique modelKeys linked across 7 imports, supplemental=116`
- `ALL PASS`

## Visual Acceptance Notes

This is accepted as a first playable `/build` furniture expansion for levels 1-3, not the final Steam-grade art pass.

Known art risks:

- Level 01 contact sheet framing is weak; several assets are partially cropped in the evidence render, so the next pass should improve camera/contact-sheet validation.
- Level 02 silhouettes are readable and thematically right, but the preview can still read flatter than desired under neutral lighting.
- Level 03 has the strongest museum material direction, but its contact sheet is more useful as atlas proof than as model-proof; it needs a stronger in-engine beauty capture.

Next recommended upgrade:

- Use the same Image2 sketch -> cut atlas -> math-first GLB bake -> QA loop, but require a close first-person render for every hero/filler asset before acceptance.
- Prioritize silhouette and physical construction over surface texture; the current puzzle-machine lesson applies here too.
