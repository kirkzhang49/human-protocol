# Human Protocol Level 01-05 Furniture Image2 Production Report

Date: 2026-06-13

Production pass: fixed remaining visual issues in the L01-L03 Image2 furniture
packs (notably the flat L02 sofa) and built two new packs — **L04 Memory Clinic
(8 assets)** and **L05 Reclamation Core (9 assets)** — at equal-or-higher quality.
Existing modelKeys, manifest packIds, GLB paths, and `/build` wiring preserved.

Proof is in GLB material data, manifest checks, regenerated `/build` thumbnails,
contact sheets, TypeScript, builder QA, and this report — not file existence.

Machine audit: `.tmp/level01-05-furniture-image2-production/glb-audit.json`
(+ `texture-bounds-audit.json`, `bounds-grounding-texture-audit.md`).

---

## 1. Changed files

Generators (source of truth):
- `scripts/asset-build/generate-level02-furniture-image2-assets.py` (sofa + L2 audit fixes)
- `scripts/asset-build/generate-level04-furniture-image2-assets.py` (NEW)
- `scripts/asset-build/generate-level05-furniture-image2-assets.py` (NEW)
- `scripts/asset-build/generate-builder-asset-thumbnails.mjs` (added L4/L5 → pack-dir routing)

Generated assets (via the generators):
- `src/assets/models-cooked/environment/level04-furniture-image2/*.glb` (8)
- `src/assets/models-cooked/environment/level05-furniture-image2/*.glb` (9)
- `src/assets/textures/environment/level04-furniture-image2/**`, `level05-furniture-image2/**`
- `src/assets/manifests/builder/hp_level04_furniture_image2_v1.json`, `hp_level05_furniture_image2_v1.json`
- updated `src/assets/models-cooked/environment/level02-furniture-image2/*.glb` (sofa/bed/console/table)
- `src/assets/thumbnails/builder/hp-level0{2,4,5}-furniture-image2-v1/**` (+ L1/L3 refresh)

Integration (emitted by the project scripts, not hand-edited):
- `src/assets/manifests/builder/ingested-packs.json` (added L4/L5, `ingest: generated`)
- `src/assets/registry/environment/generatedBuilderAssetPacks.ts`
- `src/build/generatedBuilderAssetCatalog.ts`, `src/build/generatedBuilderAssetFootprints.ts`
- `src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json` (+ `.bin`)

## 2. L01-L03 visual fixes

- **L02 modular sofa** (7→9 materials, 336→768 verts): real seat/back cushion
  separation with dark groove fills, stitched-fabric seam strips on every seat,
  puffed cushion bevels, dark-laminate back frame + arm cheeks for **material
  contrast** vs the cream upholstery, brass arm rails, grounded plinth + corner
  feet, cyan scanner seam + enlarged camera lens. The in-engine thumbnail now
  reads as a 3-seat upholstered sofa, not a beige block.
- **L02 nursery_bed**: white clinical rails (distinct from the dark frame), added
  mid rail bar, grounding plinth, stitched pillow seam.
- **L02 family_portrait_console**: brass side columns + top cornice break the flat
  slab; enlarged hidden lens.
- **L02 observation_dining_table**: dark underframe contrast, deeper observation
  slots, camera lens added.
- L01 and L03 were left as-is — the prior polish pass already grounded them and
  gave them N/N (or intentional-solid) texture coverage; this pass confirmed they
  still pass and did not over-touch them.

## 3. L04 / L05 generated model keys

**L04 Memory Clinic** (group `诊疗`, packId `hp_level04_furniture_image2_v1`):
reclining_treatment_chair, memory_scan_arch, therapy_console, medicine_cabinet,
observation_desk, record_cabinet, surgical_light (ceiling/arm fixture),
neural_cable_trolley — all prefixed `room_l4_img2_`.

**L05 Reclamation Core** (group `核心`, packId `hp_level05_furniture_image2_v1`):
archive_server_column, identity_capsule_cabinet, data_spine_rack,
biometric_filing_throne, retrieval_conveyor_table, lockbox_pedestal,
core_memory_altar, heavy_archive_elevator_door (wall fixture), route_key_pedestal
— all prefixed `room_l5_img2_`.

### L04 clinical-material fix (iterated before sign-off)
First L04 bake rendered the white-ceramic / frosted-glass / pale-blue parts
near-black in-engine (frosted glass was alpha-blended over a dark interior;
beveled/center-UV parts shaded dark). Fixed by giving the light clinical regions
a moderate self-glow (`LIGHT_CLINIC_EMISSIVE` in the generator — a sterile sheen
kept well below bloom). Re-rendered: chair + cabinet now read clean clinical
white in both Blender and the builder thumbnail studio.

## 4. Atlas region lists

- **L01**: enamel panel, brushed steel, cyan lens, rubber gasket, hazard edge, screw heads, vent grille, grime corner, edge wear.
- **L02**: laminate.wood, cream.upholstery, old.beige.plastic, warm.lamp.glass, brass.edge.trim, cyan.scanner.strip, camera.lens, stitched.fabric.patch, fake.wallpaper.fragment, hidden.service.panel.
- **L03**: smoked display glass, black enamel plinth, aged brass frame, cyan scanner, amber exhibit lamp glass, dark velvet, archive drawer front, glass glare, dust/grime, floor plaque.
- **L04**: frosted_medical_glass, white_ceramic_panel, pale_blue_plastic, stainless_rail, cyan_screen_glass, memory_vial_glass, restraint_strap_fabric, rubber_cable_loop, sterile_gasket, circular_sensor.
- **L05**: graphite_powdercoat, black_recess_plate, aged_brass_rail, copper_bus_bar, amber_archive_glass, cyan_identity_scan_strip, white_identity_ceramic_plate, rubber_cable_socket, drawer_front, edge_wear, circular_core_lens.

## 5. Bounds / grounding table

Full per-asset table: `.tmp/level01-05-furniture-image2-production/bounds-grounding-texture-audit.md`.
Grounding summary (floor pieces groundY = 0):
- L01 7/8 (8th = ceiling_service_light, top pivot, documented)
- L02 8/8
- L03 7/8 (8th = mural_lightbox, wall pivot, documented)
- L04 8/8 (surgical_light grounded at arm base; ceiling-placed via manifest mount note)
- L05 8/9 (9th = heavy_archive_elevator_door, wall pivot groundY −1.32, documented)

## 6. Material texture coverage (baseColorTexture)

- L01: 5-8 textured materials/model (remaining slots are intentional solid rubber/dark-recess).
- L02: **N/N** (every material textured), min 7/7.
- L03: **N/N**.
- L04: **N/N** (8 models).
- L05: **N/N** (9 models).
All GLBs embed 1+ images and per-material `baseColorTexture`; verified by the
audit JSON and the texture-gate `node` reader. GLB sizes: L04 199-226 KB,
L05 215-234 KB, L02 ≤ 330 KB — all within budget.

## 7. Thumbnail / contact-sheet / evidence paths

- `/build` thumbnails (in-engine WebGPU, texture-visible): `src/assets/thumbnails/builder/hp-level0{1..5}-furniture-image2-v1/*.webp` (41 total).
- Contact sheets: `.tmp/level01-03-furniture-polish/level02/level02-contact-sheet.png`, `.tmp/level04-furniture-image2/level04-image2-contact-sheet.png`, `.tmp/level05-furniture-image2/level05-furniture-image2-contact-sheet.png`.
- Beauty renders: `.tmp/level04-furniture-image2/level04-beauty-{treatment_chair,memory_scan_arch}.png`; `.tmp/level05-furniture-image2/level05-beauty-{core_memory_altar,archive_server_column}.png`; `.tmp/level01-03-furniture-polish/level02/level02-beauty-sofa.png`.
- L04 fix verification renders: `.tmp/level01-05-furniture-image2-production/l4check-{medicine_cabinet,treatment_chair}.png`.
- GLB audits: `.tmp/level01-05-furniture-image2-production/glb-audit.json`, `texture-bounds-audit.json`, `bounds-grounding-texture-audit.md`; per-pack `.tmp/level0{4,5}-furniture-image2/glb-texture-audit.json`.

## 8. Commands run + results

```text
python3 scripts/asset-build/generate-level02-furniture-image2-assets.py     # OK (sofa + L2 fixes)
python3 scripts/asset-build/generate-level04-furniture-image2-assets.py     # OK (8 GLBs)  [re-run after clinical-emissive fix]
python3 scripts/asset-build/generate-level05-furniture-image2-assets.py     # OK (9 GLBs)  [re-run after footprintFamily fix]
node .../generate-builder-asset-pack-registry.mjs --manifest hp_level01..05_furniture_image2_v1.json --check --pending  # 5× PASS structural
node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit    # emitted 9 generated packs
node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs    # PASS issues=0, sourceIndex=237, supplemental=133
node scripts/asset-build/generate-builder-asset-thumbnails.mjs --only room_l1..l5_img2_   # all thumbnails captured (41)
npx tsc -b --pretty false                                                   # exit 0
npm run qa:builder                                                          # ALL PASS (thumbnail 193/193, WGPU 237/237)
git diff --check                                                            # clean
```

## 9. Remaining risks

1. **L05 heavy_archive_elevator_door** is a wall fixture (groundY −1.32, `mount:"wall"`); the runtime must place it at wall-centre height, not floor it.
2. **L04 surgical_light** is grounded at the arm base for stable export; the manifest carries a ceiling mount note — placement should hang it from the ceiling.
3. **L04 clinical self-glow**: the light clinic materials use a small emissive to read sterile-white; if a future bloom pass is added, cap emissive ≤ ~0.45/channel (current values) to avoid wash-out.
4. **L05/L04 verts are lean** on some pieces (texture + bevels carry the read); fine for furniture, but sub-0.5 m inspection is simple.
5. Agent iso/contact renders are underexposed (numpy/matplotlib, no PBR) — geometry/silhouette proof only; the **WebGPU `/build` thumbnails** are the texture-visible proof and all read correctly.
6. L01 retains intentional solid (non-textured) rubber/recess material slots — not a coverage gap.
7. ~~L05 Reclamation Core furniture reads too dark in low-light /build thumbnails (route_key_pedestal lower body, black core blocks).~~ **RESOLVED 2026-06-13 (low-light readability polish, §10).**

## 10. Low-light readability polish pass (2026-06-13)

Resolves caveat #7 and adds a route-switch denied feedback. No new systems;
modelKeys / packIds / manifest paths / catalog keys unchanged; official 1-10
levels untouched.

### A. L05 low-light readability (RESOLVED)
`scripts/asset-build/generate-level05-furniture-image2-assets.py`:
- Lifted the graphite palette out of near-black so big masses show silhouette +
  bevel edge + panel faces in low light, while staying dark graphite (not
  brightened, not cyber): `GRAPHITE_DARK (22,24,26)→(38,42,48)`,
  `GRAPHITE_MID (42,46,50)→(58,64,72)`, `GRAPHITE_HI (68,74,80)→(92,100,110)`,
  `BLACK_RECESS (8,9,10)→(14,16,19)`.
- **route_key_pedestal**: body switched flat `bevel_box` → `face_box` (graphite
  gradient gives vertical form), + 4 edge-wear corner strips (silhouette), a
  brass mid service-band (functional layer), and a cyan vertical service slit
  (interaction accent). The lower 2/3 now reads as the main mass in 256px.
- **archive_server_column / identity_capsule_cabinet / data_spine_rack**: main
  bodies switched `bevel_box` → `face_box` so the side faces show the graphite
  gradient instead of a flat dark center-sample; brass corner rails/pillars keep
  the bevel-edge silhouette. Each now has 3 readable layers (outline / functional
  face / cyan-amber interaction).
- **core_memory_altar / lockbox_pedestal / conveyor / throne / elevator door**:
  benefit from the graphite lift; not otherwise restructured.
- Identity preserved: black-gold-cyan-amber Reclamation Core mood; no whole-block
  brightening, no CSS light pollution. Manifest bounds unchanged (no registry
  re-emit needed); WGPU resource pack re-cooked (issues=0); L05 thumbnails
  regenerated.

### B. RouteSwitch denied feedback
`src/ui/RouteSwitchOverlay.tsx` + `src/styles/overlays.css`: clicking an output
with no key still calls `world.chooseRouteSwitchState` (unchanged runtime
semantics + world warning) but now triggers an **overlay-local** denied reaction —
amber key-lens pulse (`rs-key-denied-pulse`, 500ms) + clicked-plate micro-shake
(`rs-plate-denied-shake`, 420ms), cleared after 520ms via a tracked timer; a
nonce restarts the animation on re-click. No project/config/map state, no big
text, close button + mobile layout + the keyed 0.78s dial→apply→reveal→close flow
all unchanged; `prefers-reduced-motion` suppresses the motion.

### Evidence (this pass)
- `.tmp/l05-readability-after/contact-or-overview.png` — 9-up montage of the
  regenerated in-engine L05 thumbnails on a dark backdrop.
- `.tmp/l05-readability-after/route-key-pedestal-thumbnail.png`,
  `.tmp/l05-readability-after/core-memory-altar-thumbnail.png` — real `/build`
  WebGPU thumbnails.
- `.tmp/route-switch-denied-after.png` — denied state rendered from the real
  overlays.css denied rules, frozen at the amber peak (CSS-state render via
  headless Chrome, **not** a live playtest capture; runtime is proven by
  `route-switch-runtime-qa`).

### Verification (this pass)
- `npx tsc -b --pretty false` → 0
- `npm run qa:builder` → ALL PASS (thumbnail 193/193, WGPU 237/237)
- `node scripts/qa/route-switch-runtime-qa.mjs` → ALL PASS (21/21)
- `git diff --check` → clean
- GLB audit: L05 still 9 assets, N/N texture coverage, floor pieces groundY=0
  (elevator door wall fixture exception unchanged).

### Residual visual note
`data_spine_rack` is the darkest of the towers — it now has readable brass
chevron edges + cyan blade lenses + amber slots (3 layers) but its far side stays
intentionally dark graphite; acceptable for the archive-core mood. The
route-switch denied evidence is a CSS-state render, not a live browser capture.
