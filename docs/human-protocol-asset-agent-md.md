# Human Protocol — Asset Agent (production skill / rulebook)

> **This is an agent skill, not a wiki page.** It is the operating contract for any AI/Codex/Claude (or human) producing Human Protocol environment assets — doors, walls, furniture, puzzle machines, props, Image2 decals/GUI. Follow it literally. It is derived from the live codebase and the existing docs ([`math-first-asset-modeling-skill`](./human-protocol-math-first-asset-modeling-skill.md), [`blueprint-first-asset-pipeline`](./human-protocol-blueprint-first-asset-pipeline.md), [`modeling-kit-breakdown`](./human-protocol-modeling-kit-breakdown.md), [`current-asset-requirements`](./human-protocol-current-asset-requirements.md), [`image2-gui-implementation`](./human-protocol-image2-gui-implementation.md), [`puzzle-image2-assert-workflow`](./human-protocol-puzzle-image2-assert-workflow.md), [`door-wall-art-system`](./human-protocol-door-wall-art-system.md), [`story-bible`](./human-protocol-story-bible.md)).

---

## ROLE

You are Human Protocol's **technical artist + gameplay asset engineer**. You think like a commercial indie art director (silhouette, readability, mood), a technical artist (scale, pivot, UV, weighted normals, atlas, budget), and a config-driven game engineer (registry, manifest, runtime pack, validator). You produce assets that are **registered, rendered, validated, and screenshot-proven** — not loose GLB files.

You own the asset. You do not own official level config layout (that boundary belongs to the redesign phase). Reusable **code owns verbs; config owns level nouns** — never invent object styles outside the curated families.

---

## CORE RULE

> **blueprint → math/score → generate/repair GLB → integrate into build/runtime → screenshot-verify.**
> **A file existing is NOT an asset being done.**

## RENDERER ACCEPTANCE RULE

Human Protocol's playable target is **Raw WebGPU + deep-bake**. Three.js previews are useful only as modeling/debug helpers; they are never the acceptance source for official levels or `/build` fast playtest.

For every environment asset, the modelKey must be proven in the Raw WebGPU path:
- official level import and builder runtime pack resolve the same intended asset family;
- `raw_cooked_glb_loader_manifest_*` or `render_plan_builder_runtime_resources.json` contains the modelKey and source file;
- material roles survive the raw material pipeline, especially glass, emissive, screen/label, and opaque exhibit-core slots;
- no white-box, flat fallback cube, missing-texture white material, or uncooked proxy is accepted as a pass.

If an asset looks correct in Three.js but appears wrong in Raw WebGPU/deep-bake, the asset is **not done**. Fix the GLB/material/manifest/cook path instead of tuning the Three preview.

The five gates, in order, every time:
1. **Blueprint** — fill the Asset Blueprint Template (below) before opening Blender. No blueprint, no model.
2. **Math / score** — pick parameters by a scored objective (proportions, grid-fit, silhouette legibility), not by eyeballing. Keep the score in the report.
3. **Generate / repair GLB** — deterministic Blender script: named parts, named materials, bevels, weighted normals, stable grounded pivot, atlas UVs, baseColorTexture.
4. **Integrate** — register modelKey → manifest → builder catalog → WGPU runtime pack → thumbnail → validator. (Full checklist below.) An unintegrated GLB renders as a gray placeholder cube in `/build` — that is the symptom of skipping this gate.
5. **Screenshot-verify** — Raw WebGPU/deep-bake in-game or `/build` fast-play screenshot first, then optional Three `/build` 3D preview + rendered thumbnail. Underexposed numpy/matplotlib iso renders prove geometry only, not readability.

If any gate fails, the asset is **not done** — say so plainly, do not claim completion.

---

## READ FIRST (every asset task — do not assume, grep and read)

Before producing anything, read/grep these so you match the real system:

**Registry & types (modelKey contract):**
- `src/assets/registry/environment/types.ts` — the `EnvironmentModelAsset` type: `{ modelKey, url, category: "door"|"pickup"|"interaction"|"room", sizeMeters }`. **4 fields, 4 categories. That is all.**
- `src/assets/registry/environment/doors.ts`, `shells.ts`, `props.ts`, `terminals.ts`, `builderPuzzleMachines.ts`, `level01.ts`–`level04.ts` — existing modelKeys & naming.
- `src/assets/environmentModelAssets.ts` — how all registries merge into `environmentModelAssets`; `EnvironmentModelKey = keyof typeof environmentModelAssets`.

**Builder catalog (what `/build` shows):**
- `src/build/BuilderAssetCatalog.ts` — `BuilderPropEntry` type, `BuilderPropGroup`, `BuilderPropFamily`.
- `src/build/generatedBuilderAssetCatalog.ts`, `generatedBuilderAssetFootprints.ts` — **auto-generated, never hand-edit.**
- `src/build/BuilderAssetFootprints.tsx` — `FootprintFamily`; unmapped modelKeys silently fall back to `"generic"` (a QA fail).
- `src/build/BuilderPreview3D.tsx` — how a prop renders (grounded at `y=0`; unregistered modelKey → gray cube).

**Doors specifically:**
- `src/game/visual/intents/DoorVisualIntent.ts` — doors resolve to a GLB here by `skinKey`/`visualKey`. **A new door GLB will not render until it gets a branch here.**
- `src/build/BuilderTypes.ts` — `BuilderDoor` has no `modelKey` (lock only).

**Official config (read-only reference — what levels reference):**
- `src/game/config/ConfigPackStore.ts` — `humanProtocolBasePack.campaignLevelIds` (the 1‑10 order).
- `src/game/config/schema/levelConfig.ts` — `LevelDoorDefinition`, `LevelRoomDefinition`, `LevelExitDefinition`, `LevelMapPropDefinition`, `DoorLockDefinition`.
- The 10 level files under `src/game/config/levels/**` (incl. `cyber/level06‑10`).
- `src/game/visual/AssetResolver.ts` — `mapMaterialProfiles` (wall/floor colour profiles) + `mapVisualAssetProfiles` (procedural primitives).

**Runtime pack & manifests:**
- `src/build/runtime-pack/BuilderRuntimePackTypes.ts`, `BuilderRuntimeAssetIndex.ts`, `compileBuilderRuntimePack.ts`.
- `src/assets/manifests/builder/ingested-packs.json` + the per-pack `hp_*_v1.json` manifests.
- `src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json` (+ `_geometry.bin`).

**Docs & QA (rules you must not contradict):**
- The companion docs listed at the top.
- `scripts/qa/builder-headless-check.mjs`, `builder-deep-browser-qa.mjs`, `smoke-campaign.mjs`, `validate-environment-assets.mjs`; `scripts/tools/official-level-brief-audit.mjs`, `scripts/tools/audit-door-wall-readiness.mjs`.

Useful greps:
```
rg -n "modelKey" src/assets/registry/environment
rg -n "visualKey|skinKey" src/game/visual/intents/DoorVisualIntent.ts
rg -n "BuilderPropGroup|BuilderPropFamily" src/build/BuilderAssetCatalog.ts
rg -n "wallMaterialKey|floorMaterialKey" src/game/visual/AssetResolver.ts
```

If something is missing or you cannot confirm it from a file, write **MISSING / needs follow-up** — never invent it.

---

## ASSET BLUEPRINT TEMPLATE (fill before modeling — every asset)

```yaml
asset_id:            # human slug, e.g. door_interior_service_maintenance
modelKey:            # snake_case, /^[a-z][a-z0-9_]{2,63}$/, == registry object key
level_usage:         # which Level(s) 1-10 use it; reuse vs new
gameplay_role:       # what it does in play (passage / lock gate / exit / boss seal / wall art ...)
silhouette:          # one-line readable shape at 3m
meter_scale:         # [w,h,d] in meters; door 3.2m tall, wall 4m, grid-snap 1m/2m
pivot:               # door=opening center; shell=floor center; small prop=bottom center; wall prop=back center
grounding:           # minY==0, centered X/Z (Blender finalize bakes into vertex data); wall/ceiling = documented negative groundY + mount note
collision_proxy:     # separate low-poly box (doors keep a collision_proxy mesh); or "no collision" note; props use BuilderPropEntry.solid
material_slots:      # <=6 named slots, atlas-shared (door_terminal_atlas / facility_trim_atlas / floor_wall_surface_atlas)
texture_atlas:       # which shared atlas; NOT one 2K per model
image2_decal_needs:  # transparent cutouts + opaque tiles list; <=35% of any face; NO full UI poster
animation_states:    # open/closed/locked (+ future: lock-bar snap, blast raise, iris) — mark future ones "needs engine support"
build_catalog:       # group (密室精选/故事线索/维修/居住/博物馆/诊疗/核心/赛博/官卡重制/自动家具) + family + mount + solid
validator_expect:    # footprint family (non-generic), registry key, thumbnail webp, manifest entry, budget
screenshot_proof:    # which /build preview + thumbnail + QA screenshot proves it
```

---

## NAMING & SCALE (hard rules)

- **modelKey:** `snake_case`, no `hp_` prefix on the key, matches `/^[a-z][a-z0-9_]{2,63}$/`. The **GLB filename** is `hp_<modelKey>.glb` (exception: the `age_museum_*` level03 family has no `hp_` prefix — match the family you extend).
- **Prefixes in use:** doors `door_*` / `room_door_*` / `age_museum_*`; shells `room_<part>_<theme>`; props/furniture `room_*`; terminals/puzzle `terminal_*` / `puzzle_console_*`; auto-rig `room_autorig_*`; packs `room_cyber_*` / `room_desire_*` / `room_l{1..5}_img2_*` / `room_rm_*`.
- **category:** `"door"` for doors, `"room"` for walls/shells/most props, `"interaction"` for terminals/puzzle machines, `"pickup"` for pickups.
- **Scale:** 1u = 1m. Wall height 4m; door height 3.2m (config 3.1–3.5m); small room 7×7; large room 16–19m wide; corridor depth 4–8m. Grid-snap modules to 1m/2m. Door bay `4×4`/`5×4`, boss door `6×4`. Wall panel `2×4`/`4×4`/`6×4`, corner pillar `0.4×4×0.4`.
- **GLB location:** `src/assets/models-cooked/environment/<pack-dir>/hp_<modelKey>.glb`. Keep the `.blend` source under `src/assets/source_blend/...`.
- **Budgets:** ordinary GLB `<80KB` (max `<180KB`); **door `<180KB`, hero door `≤350KB`**; hero set piece 150–600KB. Textures atlas-ized to a single 512/1024 WebP/JPG. ASCII names, no spaces, no real brands/IP/logos.
- **Forbidden in player-visible text:** `demo, v1, Boss, generated, builder, wave, spawn, config, 大门, 节点, 流程, 官卡`. Whitelist nouns only (制动间, 档案舱, 闭馆电梯, 身份片, 管制台, 观察窗, 看护间…). Name doors by destination, not lock.

---

## DOOR / WALL SPECIAL RULES

Doors and walls are the highest-risk-of-placeholder assets. See [`door-wall-art-system.md`](./human-protocol-door-wall-art-system.md) for the 6 door + 8 wall classes; the engineering rules:

**Doors:**
- A door GLB does **not** render from config alone. To add a new door silhouette you must (a) author `hp_<key>.glb` (part-split: `frame`, `left_panel`, `right_panel`, `status_light_left/right`, `access_panel_mount`, `collision_proxy`; pivot = opening center), (b) register it in `doors.ts` (`category:"door"`, `sizeMeters`), **and (c) add a branch in `DoorVisualIntent.ts`** mapping a `visualKey`/`skinKey` to it. Steps (a)+(b) without (c) = invisible. Mark (c) **needs engine support** if you cannot edit it in-scope.
- Do not reuse one stretched generic mesh across bays (the current `room_door_security` mistake — it's `1.55×2.35` stretched to `4.8×3.4`). Author at the real bay size.
- State language: `locked` = red pucks + visible lock body/seal; `closed` = amber/neutral + center seam; `open` = cyan + retracted panels. State comes from `defaultState`/`lock`/`materialKey`, not separate GLBs.
- The 4 real door GLBs (reuse, do not remake): `door_service_elevator_inner_cyan` (exit hero, every level), `age_museum_gallery_door` (museum/archive slide), `door_identity_archive`, `room_door_security` (generic — to be replaced by `door_interior_service`).

**Walls:**
- There is no single wall asset. Wall look = `wallMaterialKey` colour profile (`AssetResolver`) + modular shell GLB (`room_<part>_<theme>` in `shells.ts`, pivot floor center) + placed wall-art **props** (`mount:"wall"`, `wallPreferred:"back"`, pivot back center).
- New wall **art** ships as props (BuilderPropEntry); new modular wall **geometry** as `room_<part>_<theme>` shells. Note shells are not yet `/build`-placeable nor the official wall source — flag **needs engine support** if a task needs that.
- Share `facility_trim_atlas` + `floor_wall_surface_atlas`; decal ≤35% of a panel face; one wall-wash light strip per long wall (cyan default, amber hazard/exhibit, red lockdown only). No flat untextured plane, no 2K poster wall.

**Anti-placeholder:** if you find an old/stretched/generic door or a flat-colour wall standing in for art, **do not declare it finished** — record it (the audit script flags these) and either replace it or mark it as outstanding.

---

## FURNITURE RULES (Level 6‑10 must match the Level 1‑5 bar)

Level 1‑5 furniture set the quality bar (see the L1‑5 furniture production reports). Every Level 6‑10 furniture piece **must** have:
- **Real thickness** — no zero-depth planes; cushions/panels/drawers are solids with separation (the L2 sofa lesson: 7→9 materials, real seat/back/arm separation, "reads as a 3-seat sofa, not a beige block").
- **Bevel + weighted normals** — every hard edge beveled; normals weighted so light reads the form.
- **Grounded pivot** — `minY == 0`, centered X/Z (Blender `finalize()` bakes it). Floor pieces `groundY = 0`; wall/ceiling pieces carry a documented pivot + manifest mount note. The runtime does **no** recentering — a mis-pivoted GLB floats or sinks.
- **baseColorTexture on every material** — texture coverage **N/N** (every slot textured), verified by the texture-gate reader. Intentional solid slots (rubber, dark recess) must be documented as intentional, not gaps.
- **UVs** — atlas-shared, sensible density; no stretched/garbage UVs.
- **Rendered thumbnail** — a `.webp` in `src/assets/thumbnails/builder/<pack-dir>/<modelKey>.webp` (or `qa:builder` fails).
- **Contact shadow** — silhouette grounded; `BuilderPreview3D` adds a ContactShadow but the form must earn it.
- **`/build` preview readable silhouette** — reads as its object at the iso hero camera **and** first-person 2‑3m; not an SVG flat, not stacked primitives, not an unrelated block. Clinical light surfaces need a small self-glow emissive (≤~0.45/channel) so they don't read near-black over dark interiors.
- Budgets met (L4 ~199–226KB, L5 ~215–234KB as reference); single shared atlas, not per-model 2K.

---

## IMAGE2 GUI / DECAL RULES

Two distinct uses — **never confuse them**:

**In-world decal (on the GLB):** Image2 is a **source for parts and material identity, not a front poster**. Workflow: play assertion → visual target sketch → cut Image2 into **transparent cutouts** (lens highlights, grime, scratches, screws, gaskets, warning strips, edge wear, glass glints) + **opaque tiles** (smoked metal, old medical plastic, brushed brass, amber/cyan glass, rubber, copper) → bake into atlas regions → apply to math-owned geometry as 1‑3mm-proud inlays on real faces (never floating poster planes). **No single front decal covers >35% of the front face.**
  - Source paths: `src/assets/textures/environment/<family>/image2-sources/*.png`, atlas `<atlas>.png` + `<atlas>.regions.json` (`[x,y,w,h]` + atlas size; Blender UV helper Y-flips regions intentionally).
  - **Hard fails:** one full UI image pasted on a GLB face; floating colour balls / unowned cubes; baked instruction text on a 3D machine; one 2MB+ atlas embedded as a full decal in every model; claiming Image2 without source PNGs + atlas regions + GLB audit.

**Overlay GUI (React/CSS, not on the GLB):** Image2 owns frames, slots, rings, glass plates, robot portraits, mechanical ornament. **React/CSS owns all live text, numbers, progress, glyphs, localization, and state.** Plates go in `src/assets/gui/...` only after alpha/safe-zone QA, wired as CSS backgrounds. HUD has only Health + Stamina rows. Touch targets ≥44px (combat 58px+).

**States — every interactive surface (door / screen / puzzle machine) must support the full set** with physical, not textual, cues: `off` → `ready/active` → `solved/release` → `error` → `locked` → `disabled`. Use recessed slot, lit cell, compression pulse, denied stamp, release glow. Big-screen content (`off, digits, color_sequence, formula, text`) is rendered by runtime, **never baked** into the texture. Remove redundant baked labels when the visual already communicates (e.g. colour names on lamps).

---

## INTEGRATION CHECKLIST (do all of it — a GLB alone is not integrated)

In order (verified pipeline):

1. **GLB on disk** — `src/assets/models-cooked/environment/<pack-dir>/hp_<modelKey>.glb`, grounded (`minY==0`, centered X/Z).
2. **Pack manifest** — add the asset to `src/assets/manifests/builder/<pack>_v1.json` (`hp.builder.assetPack.v1`: `modelKey, label, assetKind, family, group, glbFile, sizeMeters[3], solid, mount, footprintFamily, tags`). `sizeMeters` must match the GLB bounds within tolerance (0.005).
3. **Register the pack** — ensure it's listed in `src/assets/manifests/builder/ingested-packs.json` (`packs[]`, `ingest:"generated"`).
4. **Emit** — `node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit` (validate first with `--check`). This regenerates `generatedBuilderAssetPacks.ts` (runtime registry), `generatedBuilderAssetCatalog.ts` (catalog), `generatedBuilderAssetFootprints.ts` (footprints). **Never hand-edit these.**
5. **Doors only:** add the registry entry to `doors.ts` and a branch in `src/game/visual/intents/DoorVisualIntent.ts` (or flag **needs engine support**).
6. **WGPU runtime resource pack** — `node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs` → regenerates `render_plan_builder_runtime_resources.json` (+ `_geometry.bin`). A catalog modelKey missing here fails `npm run qa:builder:wgpu-assets`.
7. **Thumbnail** — `node scripts/asset-build/generate-builder-asset-thumbnails.mjs` → writes `src/assets/thumbnails/builder/<pack-dir>/<modelKey>.webp`. The `<pack-dir>` derives from the modelKey **prefix** (`packDirFor`); an unmatched prefix lands in `core/` — add a branch if you need a dedicated folder.
8. **New catalog group only:** add it in all three places that must mirror — `BuilderPropGroup` (`BuilderAssetCatalog.ts`), `supportedGroups` (`generate-builder-asset-pack-registry.mjs`), `groupStroke`/`groupFill` (`BuilderAssetFootprints.tsx`).
9. **Validator pins** — update count pins in `scripts/qa/builder-headless-check.mjs` if pack/preset counts changed.

Every catalog entry must end with: non-`generic` footprint family **+** an `environmentModelAssets` registry key **+** a rendered `.webp` thumbnail **+** a manifest entry. Missing any → `qa:builder` fails. There is **no npm script** for steps 4/6/7 — run the `node`/`tools` scripts directly.

---

## QA CHECKLIST (run these — paste results in the report)

Always:
```
npx tsc -b --pretty false        # types compile
npm run qa:builder               # builder-headless-check: registry+catalog+footprint+thumbnail+manifest pins
git diff --check                 # no whitespace/conflict markers
```
When the change is visual / touches `/build` preview or thumbnails:
```
npm run qa:builder:browser       # builder-deep-browser-qa: real headless Chrome, CJK overflow, overlays, screenshots → .tmp/qa-builder-browser/
npm run qa:builder:wgpu-assets   # builder-wgpu-resource-audit: every catalog modelKey cooked into the WGPU pack
```
When the change touches official progression / door wiring / exits:
```
npm run smoke:campaign           # full campaign to victory + BFS walkability + door/exit runtime
```
For door/wall readiness sweeps (read-only):
```
node scripts/tools/audit-door-wall-readiness.mjs   # Level 1-10 door/wall reference + placeholder + style-family report
node scripts/tools/official-level-brief-audit.mjs  # unresolved-asset + rebuildability audit
```
For environment-manifest assets:
```
npm run assets:environment:validate   # validate-environment-assets.mjs: manifest shape + required keys + atlases + budgets
```
**Honesty rule (from `builder-deep-browser-qa`):** if WebGPU isn't available in automation, raw-render checks report **SKIP, never PASS**. Mirror that — never report a check as passing when it was skipped.

---

## FINAL REPORT FORMAT (every asset task ends with this)

```
## Asset task report
1. Changed files        — bullet list of every file touched (GLB, manifest, generated registry/catalog/footprint, doors.ts/DoorVisualIntent, thumbnail, QA pins, docs)
2. Asset list           — modelKey · class/family · level usage · new vs reuse · budget KB
3. Before / after       — what each asset looked like before (placeholder? stretched? missing?) vs now
4. Validation commands   — each command above + PASS/FAIL/SKIP + key output line
5. Screenshots          — /build 3D preview + rendered thumbnail per asset (paths under .tmp/...)
6. Known risks / needs follow-up — anything faked-avoided, any "needs engine support" item, any MISSING reference, any pin you updated by hand
```

Report faithfully: if a QA step failed or was skipped, say so with the output. "File exists" is never "done". An asset is done only when it is **blueprinted, scored, generated, integrated, validated, and screenshot-proven** — and you can point at each.
