# Premium Door Family Restore Report (L2 / L4 / L5 — and the L1/L6/L7/L8 industrial pass)

Date: 2026-06-13

Goal: close the door quality gap on official L2/L4/L5 without touching level
progression. They relied on the generic stretched/tint-only security door; now
they use three premium reusable door families. The old Level 3 exit elevator
system is untouched and still passes. No level layouts/IDs/locks/progression
changed — only door art (visualKey/materialKey).

> **Follow-up pass (industrial family + premium Image2):** L1/L6/L7/L8's generic
> yellow doors now use a 4th **industrial** family, all four families got a
> premium Image2 material upgrade, and a UV bug that was darkening textures was
> fixed. Full audit is now **21 → 2 door issues** (the only 2 left are the L3
> museum doors' state-tint material, which must stay intact). See §11 below.

## 1. Changed files

New door families (geometry-owned silhouette + painted material identity):
- `scripts/asset-build/generate-door-family-glbs.py` (NEW) — produces the 3 GLBs + atlas.
- `src/assets/models-cooked/environment/doors/hp_door_{residential_access,clinic_memory,reclamation_archive}.glb` (NEW, 286–296 KB, grounded, 4.4×3.3 m so they never stretch).
- `src/assets/textures/environment/doors/hp_door_family_atlas.png` (+ `.regions.json`, image2-sources/) (NEW).

Engine registration / resolution:
- `src/assets/registry/environment/doors.ts` — 3 new door modelKeys + urls + sizeMeters.
- `src/game/visual/AssetResolver.ts` — `mapVisualProfiles` adds `clinic_memory_door` (sterile_lab_wall) + `reclamation_archive_door` (museum_wall) as `primitive:"door"`; `residential_access_door` profile materialKey service_elevator_metal → residential_wall.
- `src/game/visual/intents/DoorVisualIntent.ts` — 3 branches: residential_access_door → door_residential_access, clinic_memory_door → door_clinic_memory, reclamation_archive_door → door_reclamation_archive (service_elevator / museum / identity branches unchanged).

Level door art (ART-ONLY visualKey/materialKey; ids/locks/positions byte-identical):
- `src/game/config/levels/level02-residential-simulation/map.ts` — light_room_door materialKey terminal_red → residential_wall (living/care already residential_access_door).
- `src/game/config/levels/level04-memory-clinic/map.ts` — childhood/rescue/body doors → `clinic_memory_door` + `sterile_lab_wall`; theater_door materialKey terminal_red → service_elevator_metal (kept elevator family).
- `src/game/config/levels/level05-reclamation-core/map.ts` — north/east/west/archive doors → `reclamation_archive_door` + `museum_wall`; platform_door materialKey terminal_red → service_elevator_metal (kept elevator family).

Audit:
- `scripts/tools/audit-door-wall-readiness.mjs` — REAL_DOOR_GLBS += the 3 new GLBs; DOOR_STYLE_FAMILY adds clinic/reclamation + retags residential (2_residential).

## 2. Door families

| family | visualKey → GLB | used by | look (verified in Blender render) |
|---|---|---|---|
| residential | residential_access_door → door_residential_access | L2 (living/care/light), L9 home doors (free upgrade) | warm wood/cream recessed panels on a slate frame, cyan observation lenses + center seam + blue status — domestic surface hiding clinical hardware |
| clinic | clinic_memory_door → door_clinic_memory | L4 (childhood/rescue/body) | white ceramic body, frosted-glass vision windows, cyan status strip, rubber gasket seam — sterile ward door |
| reclamation | reclamation_archive_door → door_reclamation_archive | L5 (north/east/west/archive) | graphite base, aged-brass rails, amber archive slits, cyan identity scan — heavy archive-core door, low-light readable |

Exits keep `service_elevator_hero`/`service_elevator_door`; museum keeps
`museum_gallery_door`; identity keeps `door_identity_archive`.

## 3. Audit result (materially better, not renamed)

`node scripts/tools/audit-door-wall-readiness.mjs` → doors-with-issues **21 → 6**.
- All L2/L4/L5 interior doors now resolve to the new families and report **ok**
  (no GENERIC_DOOR_GLB / STRETCHED_GENERIC / TINT_ONLY_MATERIAL / UNRESOLVED).
- L9 home doors upgraded for free (residential_access_door now → real GLB).
- Remaining 6 are out of scope: L1/L6/L7/L8 `yellow_access_door` interiors and
  L3 museum doors with a state-tint material (L3 must stay intact).

## 4. QA results (all green)

- `npx tsc -b --pretty false` → 0
- `npm run qa:builder` → ALL PASS (SSR shell render ok; builder catalog unaffected)
- `node scripts/qa/builder-exit-elevator-check.mjs` → ALL PASS (exit elevator intact)
- `node scripts/qa/route-switch-runtime-qa.mjs` → ALL PASS (39/39)
- `npm run smoke:campaign` → PASS, all 10 levels (L1→L10)
- `git diff --check` (repo root) → clean

Adversarial review (3 perspectives, all **clean**, 0 blockers):
- Regression sweep: no other level worsened; L9 upgraded, L3 unchanged; L9's
  inline `materialKey: service_elevator_metal` shadows the residential profile
  change (resolveDoorMaterial precedence), so L9 has no new tint.
- Validator + pipeline: no official-level validator rejects the new
  visualKeys/materialKeys; all 3 GLBs registered; intent + profiles present.
- Gameplay-ID preservation: field-extraction diff of L2/L4/L5 shows **zero**
  differences in any non-art field (id/lock/type/key/wave/from/to/position/size);
  only visualKey/materialKey changed.

## 5. Evidence

True material-visible Blender EEVEE renders (the generator's painter's-algorithm
previews were underexposed; these sample baseColorTexture):
- residential (L2 door): `.tmp/door-families/residential_access-blender.png` (+ `-crop`)
- clinic (L4 door): `.tmp/door-families/clinic_memory-blender.png` (+ `-crop`)
- reclamation (L5 door): `.tmp/door-families/reclamation_archive-blender.png` (+ `-crop`)
- render script: `scripts/qa/render-door-families-blender.py`
- GLB audit: `.tmp/door-families/door-family-audit.json`
- door readiness audit: `.tmp/door-wall-readiness/door-wall-readiness.md`

(Doors are level assets, not /build catalog entries, so there is no `.webp`
thumbnail-studio output; the Blender close-ups are the per-family evidence and
each is exactly the GLB the corresponding level now renders.)

## 6. Remaining risks

- In-engine official-level 3D capture was not produced: official levels render
  from precompiled raw-webgpu render plans, and recompiling them is level-remaster
  work (explicitly out of scope). The door families are production-ready and
  resolve via DoorVisualIntent + the three.js ConfiguredDoorRenderer path; the
  remaster pass will consume them (and should recompile the raw plans).
- L5 builder furniture `room_l5_img2_heavy_archive_elevator_door` (a /build prop,
  not a level door) was lifted out of near-black in the prior L05 readability
  pass; the new `door_reclamation_archive` is the production level-door for L5
  interiors.
- Out-of-scope generic interiors remain on L1/L6/L7/L8 (`yellow_access_door`) —
  a future pass can point them at residential/clinic/reclamation or a 7th
  industrial family; not part of this L2/L4/L5 task.

---

## 11. Industrial door family + premium Image2 pass (L1 / L6 / L7 / L8)

Closes the remaining generic-yellow interiors and raises all four families.

### Changed files
- `scripts/asset-build/generate-door-family-glbs.py` — adds the industrial family
  (`hp_door_industrial_access.glb`), premium-passes all tile painters, and fixes
  a UV-V double-inversion bug (`_uv_rect`/`_uv_center`).
- `src/assets/models-cooked/environment/doors/hp_door_industrial_access.glb` (NEW)
  + all 4 door GLBs regenerated; `src/assets/textures/environment/doors/` atlas.
- `src/assets/registry/environment/doors.ts` — `door_industrial_access` modelKey.
- `src/game/visual/AssetResolver.ts` — `industrial_access_door` door profile
  (materialKey `hazard_hall_wall`).
- `src/game/visual/intents/DoorVisualIntent.ts` — `industrial_access_door` AND
  legacy `yellow_access_door` → `door_industrial_access`.
- Level door art (ART-ONLY; ids/locks/positions byte-identical): L1 alcove
  (`level01-maintenance-bay/map.ts`), L6 foyer-alcove, L7 holding, L8 coolant
  (`cyber/level0{6,7,8}*.ts`) → `industrial_access_door` + `hazard_hall_wall`.
- `scripts/tools/audit-door-wall-readiness.mjs` — industrial GLB in real-GLB set
  + family map.

### Industrial family look
Heavy maintenance/power blast door: brushed/riveted steel leaves, dark iron
frame, a **yellow-and-black hazard caution stripe** (the old "yellow" lives on as
a hazard band, not a flat tint), corner bolts, a louvered vent, recessed lock
bar, small cyan status lens. Cyan accent; yellow only in the hazard stripe.

### Premium Image2 pass (all 4 families)
Brushed-steel directional grain + anisotropic streaks, aged-brass patina +
highlight seam, frosted-glass diffusion + bevel, warm wood grain, cream
micro-speckle, diagonal hazard tile, cross/hex screws + bolts, panel seams, edge
wear, louver slats, recessed inset shadows. No baked text/logos.

### UV bug fix (improved every door)
The generator's tile UVs were V-inverted twice (PIL top-origin → trimesh export
flip → Blender importer top-origin read), landing samples in the atlas's dark
background fill. The dark families masked it; the warm residential door exposed
it (rendered cold blue-grey). Pre-inverting V once in `_uv_rect`/`_uv_center`
fixed it — so **all four** doors now sample their correct tiles (residential
center mean RGB 81,86,89 → 174,165,150 warm; clinic/archive/industrial richer).

### Result
- Door audit **21 → 2** issues (only L3 museum `body`/`archive` state-tint, kept
  intact). L1/L6/L7/L8 all resolve to `door_industrial_access` and report `ok`.
- All 4 GLBs grounded (minY 0), 4.4×3.3 m (no stretch), 116–165 KB, fully
  textured.

### QA (all green) + adversarial review (3 perspectives, 0 blockers)
- `tsc -b --pretty false` 0 · `qa:builder` ALL PASS (thumbnails 231/231, WGPU
  275/275) · `smoke:campaign` 10/10 · `builder-exit-elevator-check` ALL PASS ·
  `route-switch-runtime-qa` ALL PASS · `git diff --check` clean.
- Reviews clean: (1) the `yellow_access_door→industrial` remap is render-only —
  the builder runtime pack uses **procedural** door geometry (the GLB is never
  loaded there), builder QA doesn't pin door modelKey, and validators still
  accept `yellow_access_door`; so builder-generated locked doors simply render the
  nicer industrial door on the three.js path (an upgrade). (2) industrial family
  fully registered; no validator rejects `industrial_access_door`/`hazard_hall_wall`.
  (3) L1/L6/L7/L8 edits art-only; L2/L4/L5 + L3 unchanged.

### Evidence (true Blender material renders)
`.tmp/door-families/{residential_access,clinic_memory,reclamation_archive,industrial_access}-blender.png`
(render script `scripts/qa/render-door-families-blender.py`).

### Remaining risks
- Only L3's two museum doors still carry a state-tint materialKey — left intact
  per "do not touch L3". A future pass could give the museum door a non-tint base
  material.
- In-engine official-level 3D capture still pending the level-remaster pass
  (recompiles the raw-webgpu render plans), which consumes these families.
