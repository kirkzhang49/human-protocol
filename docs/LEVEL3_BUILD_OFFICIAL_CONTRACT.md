# Level 3 Build / Official Visual Contract

Level 3 now treats official config, builder trial, builder runtime pack, and Raw WebGPU as one contract:

- Official map nouns own stable hero props: `room_museum_last_human_tool_vitrine`, `room_museum_voice_archive_case`, and `room_museum_skeleton_vitrine`.
- `/build` trial `data/ai/campaign/rb_l3.builder.json` must carry the same three exhibit modelKeys exactly once.
- The same three hero exhibit modelKeys are forced into `builder_runtime_resources`
  through `BUILDER_FORCE_SUPPLEMENTAL_RESOURCE_MODEL_KEYS`. They may also exist
  in official Raw, but `/build` playtests need their own auditable resource-pack
  coverage so preview GLBs, official Raw, and build/trial WebGPU do not drift.
- Route switch interactions render through `builder_route_switch_console`; route materials named `route_parts_lit` and `route_parts_flat` must stay colored, never pure white fallback surfaces.
- The official exit interaction relies on explicit elevator threshold/button props. The exit room sets `geometry.renderCeiling:false`; Raw WebGPU must not synthesize an extra builder exit pad, panel, high-opacity floor glow, ceiling fixture, wall-wash fixture, or residential lamp in that room.
- AI/build generated exit rooms must stay clean. `scripts/ai/buildCampaign.ts`, `src/build/devGenerateRoom.ts`, and starter builder data must not auto-place `light_residential_lamp_warm` in exit rooms.
- `/build` runtime resources must include all native `hp_enemy_*` robot modelKeys directly. Robots may also exist in official Raw plans, but the builder resource pack owns them so stale/missing source-level hydration cannot fall back to white proxy cubes.
- Skill 3 is configured by `src/game/config/ultimateAbilityConfig.ts`: current `coreBomb` uses `throw_then_detonate`, spends its `coreCell` on `resourceSpendPhase:"throw"`, shows `ability_protocol_breach_charge_v1` while held and in flight, then auto-explodes after the throw/landing fuse. It must not reuse `pickup_energy_cell_amber` or `ability_core_bomb_proxy` as the deployed bomb visual, and it must not require a third manual detonation press.
- Level 3 room surfaces are now authored in `authoringMetadata.builderEnvironment.rooms`, not by editing generated Raw JSON. The official source, `data/ai/campaign/rb_l3.builder.json`, `data/ai/campaign/rb_l3.level.json`, and `src/build/devRemakeProjects.ts` must agree on:
  - floor: `floor_photo_marble`
  - wall: `wall_hp_museum_limestone_panel`
  - ceiling: `ceiling_hp_museum_coffered_limestone`
- Official Raw WebGPU consumes those builder surface presets through `tools/raw-webgpu-compiler/raw-webgpu-builder-surfaces.mjs`. When a non-exit room has authored surface overrides, the compiler removes old shell floor/wall/ceiling instances and appends procedural `builder:floor:*`, `builder:walls:*`, and `builder:ceiling:*` geometry with copied base-color texture layers.
- `src/render/raw-webgpu/RawRoomRuntime.ts` disables the legacy Level 3 hero-floor overlay when `render_plan_level_03_human_museum.json` declares `officialBuilderSurfaceBridge.enabled`, so the old full-room/old-shell floor texture cannot cover the baked builder floor.

This Level 3 guard is now a focused fixture inside the reusable `VisualBakeContract` runner. The old command remains for compatibility, but Level 3 is no longer the only visual/build/runtime contract.

Run the generic all-level guard after visual/build pipeline changes:

```bash
npm run qa:visual-bake-contract
```

The all-level report is written to `src/assets/manifests/generated/raw-webgpu/qa/visual_bake_contract_report.json`.

The report covers formal official campaign Levels 1-5 across `official`, `builder-import`, `trial-json`, `raw-plan`, and `runtime-pack` source layers. Warnings name semantic drift by role/modelKey/source layer; hard errors still block white/proxy assets, missing robot runtime resources, undeclared exit fixtures, duplicate exit pads, and Skill 3 pickup/proxy reuse.

When the Level 3 hero exhibit GLBs are rebaked, update/check this chain in one
pass:

- Source bake: `scripts/asset-build/blender-bake-level03-hero-exhibits-image2.py`,
  `src/assets/source_blend/level03/*case_v2.blend`, and
  `src/assets/manifests/runtime/human_protocol_level03_hero_exhibits_image2_v1.json`.
- Runtime registry/catalog: `src/assets/registry/environment/level03.ts`,
  `src/build/BuilderAssetCatalog.ts`, and `src/build/BuilderAssetFootprints.tsx`
  if sizes or modelKeys change.
- Official/build semantics: `src/game/config/levels/level03-human-museum/map.ts`,
  `scripts/ai/buildCampaign.ts`, `data/ai/campaign/rb_l3.builder.json`, and
  `data/ai/campaign/rb_l3.level.json`.
- Raw/runtime outputs: rebuild official Raw if the GLB changed, then run
  `node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs`.
  The three hero keys must be ready in
  `src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json`.

Run the guard after visual/build pipeline changes:

```bash
npm run qa:level3:visual-contract
```

This focused wrapper calls the generic runner with `--level=level_03_human_museum`. Its report is written to `src/assets/manifests/generated/raw-webgpu/qa/level3_visual_contract_report.json`.

When Level 3 surface presets are changed in `/build` and exported as JSON, sync the official source first, then rebuild. Do not patch `render_plan_level_03_human_museum.json` by hand. The minimum source files are:

- `src/game/config/levels/level03-human-museum/level.ts`
- `data/ai/campaign/rb_l3.builder.json`
- `data/ai/campaign/rb_l3.level.json`
- `src/build/devRemakeProjects.ts`
- `src/build/official-bridge/SurfaceKitBridge.ts` if the official import default kit should change

Then run:

```bash
npm run raw-webgpu:level03:rebuild
npm run qa:level3:visual-contract
npm run qa:visual-bake-contract
```
