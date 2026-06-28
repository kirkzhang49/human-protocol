# Human Protocol Level 02 Auto-Rig-3D Algorithm Audit

Generated: 2026-06-19

Scope: audit the private reference repo `auto-rig-3d` at `main@adeab0c` for ideas that can improve Human Protocol Level 02 residential furniture. This is a migration plan only: no Level 02 GLB, generated Raw WebGPU JSON, renderer code, or Level 3/combat asset was changed.

## Human Protocol Boundary

Human Protocol remains the source of truth. The Level 02 target is a gentle, clean, slightly uncomfortable residential showroom. Furniture should read as real domestic furniture first; control is implied by proportion, precise gaps, thick backs, rear access plates, underside seams, and over-regular joins. Avoid large cyan strips, exposed cameras, big service panels, front-facing sci-fi consoles, random micro-lines, small balls, and visible monitoring hardware.

Existing HP rules already define the production path:

- Blueprint-first and math-first asset work, then deterministic Blender/GLB generation.
- Real texture evidence through the selective Image2 atlas and contact sheet.
- Config/manifest-owned nouns, reusable code-owned verbs.
- Builder manifest/registry/catalog/footprints/thumbnails, Raw WebGPU resource pack, and QA gates.
- Generated Raw JSON is output, not a hand-edit target.

## Files Audited

Human Protocol context:

- `AGENT.md`
- `docs/human-protocol-furniture-asset-factory-pipeline.md`
- `docs/human-protocol-level02-furniture-image2-blender-pipeline.md`
- `src/assets/manifests/builder/hp_level02_furniture_image2_v1.json`
- `scripts/asset-build/generate-level02-furniture-image2-textures.py`
- `scripts/asset-build/blender-generate-level02-furniture-image2-assets.py`

auto-rig-3d reference:

- `README.md`
- `AGENT.md`
- `docs/ARCHITECTURE.md`
- `docs/FURNITURE_GENERATION_PIPELINE.md`
- `docs/ANTI_BOXINESS_PRIMITIVE_GUIDE.md`
- `docs/V5_CLUTTER_NEGATIVE_SPACE_BREAKTHROUGH.md`
- `docs/V5_MATERIAL_CRAFT_BREAKTHROUGH.md`
- `docs/BEAUTIFY_V2_ART_DIRECTION.md`
- `docs/FURNITURE_OPTIMIZER_REPORT.md`
- `docs/FURNITURE_ROOM_OPTIMIZER_REPORT.md`
- `docs/FURNITURE_BATCH_REPORT.md`
- `cpp/scoring.cpp`
- `cpp/generator.cpp`
- `cpp/art.cpp`
- `cpp/physics.cpp`
- `scripts/furniture-optimize.mjs`
- `scripts/furniture-room-optimize.mjs`
- `scripts/furniture-batch.mjs`
- `scripts/furniture-visual-gallery.mjs`

## Useful Concepts To Absorb

### 1. Candidate scoring with explicit hard gates

auto-rig-3d ranks candidates only after basic QA passes: support graph, grounding, grip/contact sanity, and motion clearance. The useful HP translation is not the robot gates themselves; it is the structure:

- hard gate first
- score second
- report the component scores and fail masks
- keep top candidates and rejected reasons

For Level 02 furniture, this should become a reportable asset score with hard gates such as:

- footprint within manifest constraints
- pivot grounded and centered
- no visible floating fragments
- no cyan/scanner/front-service overdose
- no hidden-control hint on primary front read
- material slots and texture regions match the atlas contract
- builder thumbnail exists and is readable
- Raw WGPU resource pack can link the `modelKey`

### 2. Support graph and grounding/contact QA

The robot `supportGraph` and `feetGround` ideas are useful as furniture contact QA, not as skeleton QA. Level 02 needs grounded domestic props:

- sofas, beds, tables, chairs, wardrobes, counters, shelves, and fixtures must visually sit on floor or wall.
- legs, plinths, bases, rear panels, and wall mounts should carry the silhouette.
- any underside seam or rear plate must be attached to a plausible surface, not floating.

This can become `groundedContactScore` and a hard fail when the GLB bounds, root pivot, or contact parts imply hovering.

### 3. Anti-boxiness primitive grammar

auto-rig-3d's anti-boxiness guide is directly relevant as a pressure system, not as a robot primitive list. Useful ideas:

- boxes can be structural carriers, but should not be the whole visual language.
- repeated extents and flat front/side profiles should be penalized.
- details should cluster around functional anchors, not sprinkle evenly.
- primary/secondary/accent mass hierarchy keeps readability.

HP furniture translation:

- sofa/armchair: rounded cushions, rolled arms, piping loops, feet, soft back, not stacked blocks.
- table: thin slab, shaped edge, slender legs, underframe.
- wardrobe/elevator fixture: door panels, plinth, cornice, handles, reveal gaps, not a flat cabinet box.
- kitchen: counter overhang, sink, faucet, drawers, handles.

### 4. Negative space scoring

The V5 negative-space work is valuable because it measured a failure mode: more cutouts can raise silhouette interest but also increase clutter. For Level 02, the right migration is conservative:

- reward large, readable voids and furniture construction gaps.
- penalize tiny scatter cuts, repeated short grooves, and high-frequency seams.
- prefer fewer larger counterforms: chair under-seat void, table leg clearance, shelf openings, wardrobe kick plate, sofa base reveal.

This should improve aesthetics without adding random detail.

### 5. Material craft and value hierarchy

The material-craft report is useful for its discipline: material gains must come from real rendered behavior, not score loosening. For HP Level 02:

- material harmony should reward restrained warm oak, walnut, ivory fabric, warm white laminate, muted brass, porcelain, warm lamp glass, and low-saturation book accents.
- value separation should make large forms readable in builder thumbnails.
- cavity/seam scoring should only count real recessed seams, bevels, panel reveals, and contact shadows.
- cyan should be treated as a strong penalty except for intentionally tiny warm/cool status details, and Level 02 currently should use warm lamp emission only.

### 6. Parent-relative visual delta

Beautify v2's strongest transferable rule is that an improvement must be visible, not just a numeric nudge:

- compare front/side silhouette occupancy grids.
- require a minimum outline delta for a "new pass" claim.
- cap or penalize variants that score higher but look identical.
- penalize boxiness regressions even if another channel improves.

This is highly relevant to future Level 02 v6 polish: a sofa, bed, or armchair pass should show silhouette and contact improvement in thumbnails, not only updated metadata.

### 7. Visual gallery and contact-sheet comparison

The furniture scripts write markdown reports plus contact sheets. This maps cleanly to HP:

- builder thumbnail overview for all 10 model keys.
- atlas/contact-sheet evidence for Image2 regions.
- front/side/top or builder-card comparison before and after a v6 run.
- score table with current, best, delta, top candidates, and penalties.

The important rule is: gallery order, report rank, and selected output must agree.

### 8. Room layout optimizer ideas

auto-rig-3d's room optimizer scores door clearance, central path, usable floor, visual balance, focal visibility, clue spacing, start-to-first clue, and final clue-to-exit. For this Level 02 audit, do not migrate a room generator. Do absorb the room-aware vocabulary for future QA:

- furniture footprint should not block critical paths.
- anchor furniture should frame residential staging.
- clue/hero furniture should be visible without turning the room into a sci-fi control room.
- repeated wall-hugging cabinets should be checked for showroom monotony.

## Not Suitable For Direct Migration

Do not directly port these auto-rig-3d assumptions into HP Level 02 furniture:

- canonical robot rig, bone lists, `parentBone`, limb chains, humanoid/quadruped profile checks.
- weapon grip, sword/gun sockets, forearm clearance, attack/idle/walk/pose motion clearance.
- backpack embed and combat/equipment anchors.
- visible debug vocabulary such as bones, sockets, contacts, part IDs, gates, candidate breakdowns in normal product UI.
- robot material roles like white/dark/cyan armor as the default Level 02 palette.
- humanoid support dominance and locomotion identity scoring.
- C++ JSON string parsing or schema shortcuts as a production pattern; HP already has structured scripts/manifests and should use them.
- any prompt-to-mesh or generated Raw JSON patching path.

## Reusable Verbs To Add To HP

These are good candidates for reusable QA/scoring verbs in `scripts/asset-build` or `scripts/qa`, fed by the existing manifest, Blender report, thumbnails, and optional GLB inspection:

| Verb | Purpose | Inputs | Output |
| --- | --- | --- | --- |
| `scoreFurnitureSilhouette` | Penalize stacked boxes, repeated extents, weak role silhouette, and unreadable soft furniture | GLB bounds/parts or Blender report plus thumbnails | `silhouetteReadability`, `boxinessPenalty`, notes |
| `scoreGroundedContact` | Confirm floor/wall contact and plausible support mass | GLB bounds, manifest mount, footprint family | `groundedContactScore`, hard fail mask |
| `scoreClutterRestraint` | Penalize random micro-lines, tiny balls, busy seams, noisy texture overuse | Blender object names/material roles/texture regions plus thumbnails | `clutterPenalty`, offending patterns |
| `scoreMaterialHarmony` | Reward Level 02 palette discipline and value hierarchy | material names/roles, atlas regions, texture report | `materialHarmonyScore`, palette warnings |
| `scoreThumbnailReadability` | Ensure 10 assets read in builder catalog | builder thumbnail files and dimensions, optional image stats | `thumbnailReadabilityScore`, crop/contrast warnings |
| `scoreHiddenControlRestraint` | Ensure control hints stay rear/underside/subtle | blueprint `hiddenControlHint`, object/material names, forbidden tokens | `hiddenControlRestraintScore`, hard fails for front cyan/camera/service panels |
| `rankFurnitureCandidates` | Keep top-K candidate metadata consistent with selected output | candidate reports from Blender/math search | sorted table, monotonic score assertion |
| `emitFurniturePolishGallery` | Produce before/after contact sheets for review | thumbnails or generated preview renders | markdown gallery plus image sheet |

These verbs should remain generic. The manifest owns `modelKey`, size, family, footprint, role tags, texture atlas, and Level 02 residential intent.

## How This Lands In The Existing Pipeline

### Texture atlas: `generate-level02-furniture-image2-textures.py`

Keep the current selective atlas strategy. Add scoring only as report metadata:

- count which regions are real imagegen source crops vs deterministic fallback.
- flag regions that should stay evidence-only if too noisy: fabric and stone are already treated this way.
- add `materialHarmonyScore` and `textureNoiseRisk` per region.
- keep `hp_level02_furniture_image2_contact_sheet.png` as visual evidence.

Do not create unique high-resolution wraps per object. The atlas should remain low-noise and shared.

### Blender generation: `blender-generate-level02-furniture-image2-assets.py`

This is the right home for shape and material scoring because it already owns:

- 10 model-key blueprints
- silhouette text
- hidden-control hints
- constraints
- bevels and weighted normals
- material roles
- texture region assignment
- report and manifest writing

Future v6 should add a report-only score block per asset:

- `silhouetteReadability`
- `groundedContact`
- `boxinessPenalty`
- `negativeSpace`
- `clutterPenalty`
- `materialHarmony`
- `hiddenControlRestraint`
- `textureRegionUse`
- `thumbnailIntent`
- `recommendation`

Only after the report is useful should it drive candidate selection. Do not hand-patch generated GLBs or Raw JSON.

### Builder thumbnails

Use builder thumbnails as the main readability acceptance view:

- all 10 keys must have `.webp` thumbnails under `src/assets/thumbnails/builder/hp-level02-furniture-image2-v1/`.
- create a contact sheet or markdown overview for the pack.
- compare old vs new thumbnails before claiming v6 improvement.
- reject changes where score improves but thumbnail role becomes less domestic.

### Raw WebGPU compile

After actual asset edits, run the existing route:

```bash
node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs
npm run qa:visual-bake-contract
npm run qa:builder:wgpu-assets
npm run qa:builder
npx tsc -p tsconfig.app.json --noEmit
```

The audit recommends no direct edits to `src/assets/manifests/generated/raw-webgpu/**`.

### QA gates

The first low-risk implementation should be report-only:

```bash
node scripts/qa/level02-furniture-aesthetic-audit.mjs
```

Suggested output:

- `src/assets/manifests/reports/level02_furniture_aesthetic_audit_report.json`
- `src/assets/manifests/reports/level02_furniture_aesthetic_audit_report.md`

Inputs should be the manifest, Blender report, texture report, thumbnail paths, and optional GLB JSON inspection. This script can fail only on hard contract issues at first, and warn on aesthetic scores until calibrated.

## Model-Key Recommendations For The Next V6 Polish

| modelKey | Next use of auto-rig ideas | Do not add |
| --- | --- | --- |
| `room_l2_img2_modular_sofa` | Use anti-boxiness and negative-space scoring to emphasize one long soft mass, rounded cushions, rolled arms, low plinth shadow, and a small rear/underside hint. Thumbnail should read as sofa before "care device." | Cyan seams, visible camera buttons, repeated tiny fabric marks, extra small spheres. |
| `room_l2_img2_observation_dining_table` | Score thin tabletop, leg clearance, underframe contact, and negative space under the table. Material harmony should favor walnut top plus muted brass/chrome legs. Hidden control is only an under-lip seam. | Top scanner slots, control console face, heavy box base. |
| `room_l2_img2_nursery_bed` | Use grounded contact and silhouette hierarchy: soft mattress first, sparse guard rail second, rear plate/underside seam as accent. Penalize any crib-like rail clutter that overwhelms the soft bed shape. | Lab bed rails, cyan strips, panelized medical base. |
| `room_l2_img2_family_portrait_console` | Use material craft scoring for frame depth, wall backplate thickness, art panel value separation, and subtle underside slot. It can be eerie by being too thick and too exact. | Obvious surveillance lens, big service panel, debug/terminal face. |
| `room_l2_img2_service_kitchen_counter` | Score domestic kitchen nouns: counter overhang, sink, faucet, drawers, handles, kick plate, clean stone/laminate. Hidden-control restraint should put access only on rear or underside. | Front console buttons, cyan backsplash, sci-fi scanning surface. |
| `room_l2_img2_scanner_wardrobe` | Use boxiness penalty to break the plain slab with real doors, plinth, cornice, handles, and precise reveal gaps. The "scanner" should be implied by over-regular center split and thick rear board. | Visible scan line, glowing vertical strip, camera disk. |
| `room_l2_img2_camera_lamp` | Rename-in-practice visually: it should read as floor lamp. Score warm shade, slim pole, weighted base, tiny collar/pinhole only if nearly invisible in first read. | Exposed lens, cyan eye, big sensor head. |
| `room_l2_img2_living_end_elevator_fixture` | Treat as built-in residential cabinet/elevator disguise. Score door symmetry, lintel/jamb/kick plate, too-perfect center split, and shallow wall contact. Use thumbnail readability to ensure it reads as cabinet, not door machinery. | Sci-fi elevator panel, bright call buttons on front, external control box. |
| `room_l2_img2_observation_bookshelf` | Use negative-space and clutter scoring carefully: open shelves and book rhythm should create readable domestic voids; books should be staggered but not noisy. Hidden plate can live at rear/lower back. | Many random book colors, glowing shelf strips, surveillance devices. |
| `room_l2_img2_carekeeper_armchair` | Use soft-furniture anti-boxiness: rounded cushion, rolled arms, back pillow, small feet, piping loops. Grounding/contact score should ensure it does not hover or become a block pile. | Robot-chair hybrid parts, front service face, visible monitoring lens. |

## Suggested Score Shape

For Level 02, a first report-only score can be:

```text
overall =
  0.18 * silhouetteReadability
+ 0.14 * groundedContact
+ 0.14 * materialHarmony
+ 0.12 * thumbnailReadability
+ 0.10 * hiddenControlRestraint
+ 0.08 * negativeSpace
+ 0.08 * textureEvidence
+ 0.06 * configManifestIntegrity
- 0.14 * boxinessPenalty
- 0.12 * clutterPenalty
- 0.10 * sciFiFrontFacePenalty
- 0.20 * hardContractFailure
```

Hard fail examples:

- missing from `hp_level02_furniture_image2_v1.json`
- missing thumbnail
- missing cooked GLB
- mount/footprint mismatch
- front-facing large cyan/camera/service panel token in object/material metadata
- Raw WGPU resource pack missing modelKey after a real asset pass

## Recommendation

Proceed to a real Level 02 furniture v6 polish only after adding or drafting the report-only aesthetic QA. The safest next step is:

1. Implement a non-mutating `level02-furniture-aesthetic-audit` script that reads current manifest/reports/thumbnails and emits warnings.
2. Run the existing texture and Blender scripts only when the scoring language is clear.
3. Generate v6 candidates per asset, not one global random pass.
4. Review builder thumbnail contact sheets before accepting any GLB changes.
5. Rebuild builder registry/thumbnails/Raw WGPU pack and run the full QA gate.

auto-rig-3d is useful here as a measured optimization and reporting discipline, not as a furniture source or robot rig template.
