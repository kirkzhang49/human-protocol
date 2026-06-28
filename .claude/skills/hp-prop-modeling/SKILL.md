---
name: hp-prop-modeling
description: Procedurally model premium hard-surface 3D props for Human Protocol in headless Blender from JSON specs, texture them with a SHARED PBR material library (Codex/CC0), advanced-bake, then integrate into the /build catalog (and optionally official levels). Use when asked to add/model/refine game props, furniture, exhibits, or set-dressing — especially in batches across levels 1-10. Proven at 100 props.
---

# HP Procedural Prop Modeling (proven at 100 props)

Make game-ready props **without** paid online AI 3D tools. Blender (`/Applications/Blender.app`) + one tested spec→GLB executor (`scripts/asset-build/blender-build-prop.py`) gives full control over topology, scale, materials, baking. Creative agents emit only JSON specs; the executor turns them into premium assets. Keeps batches reliable (agents can't break Blender) and integration race-free (only the main loop edits shared registries).

## Architecture (who does what)
- **Design agents** (Workflow, one per prop) → emit a JSON **spec** (geometry + shared-material keys). They WRITE the spec to `.tmp/modeling/specs/<modelKey>.json` and return a small confirmation.
- **Executor** (`blender-build-prop.py`) → spec → premium GLB + preview PNG, advanced-baked. Main loop runs it (serial; Blender isn't parallel-safe).
- **Batch integrator** (`scripts/asset-build/integrate-prop-batch.mjs`) → wires props.ts + BuilderAssetCatalog.ts + BuilderAssetFootprints.tsx + thumbnails in one pass.
- **Cook** → `compile-builder-runtime-resource-pack.mjs` bakes the catalog; per-level `rebuild-raw-webgpu-levels.mjs --level=<id>` bakes a level.
- **Textures** → a SHARED PBR library painted externally (user's Codex) per `src/assets/textures/environment/shared-pbr/CODEX_PROMPT.md`, reused by all props.

## Build one prop
```
/Applications/Blender.app/Contents/MacOS/Blender --background --python \
  scripts/asset-build/blender-build-prop.py -- <spec.json> \
  src/assets/models-cooked/environment/props/hp_<modelKey>.glb \
  .tmp/modeling/<modelKey>.png \
  src/assets/textures/environment/builder-surfaces
```
Prints `SIZEMETERS [x,y,z]` (use for catalog/collider). Origin = base center on floor (min Z→0, never floats). The executor advanced-bakes: applies each part's bevel BEFORE join, `shade_smooth` + `shade_auto_smooth(40°)`, and resolves textures (see below).

## Spec schema (what a design agent emits)
```json
{
  "modelKey": "room_l01_p01",   // lowercase_unique; batch uses room_<lvlshort>_p<NN>
  "label": "中文名", "footprint": "pedestal|cabinet|bench|table|display_case|column|barrier|crate|books|lamp|wall_panel|generic",
  "solid": true,
  "materials": {
    "pbr_white_marble": {"color":[0.8,0.78,0.73],"metallic":0,"roughness":0.3,"texture":"pbr_white_marble","textureScale":1.0},
    "brass":  {"color":[0.83,0.6,0.22],"metallic":1,"roughness":0.26,"texture":"pbr_brass_polished"},
    "glow":   {"color":[0.3,0.95,1],"metallic":0,"roughness":0.5,"emissive":[0.3,0.95,1],"emissiveStrength":6}
  },
  "parts": [ { "shape":"cylinder","verts":24,"radius":0.45,"depth":0.12,"pos":[0,0,0.06],"material":"pbr_white_marble","bevel":0.012 } ]
}
```
- **pos is Blender Z-up** `[x,y,height]`; lowest part bottom at z≈0, stack up; meters.
- **Front faces −Y** (preview camera looks −Y→+Y) — put labels/drawers/faces on −Y. Symmetric props don't care.
- **Height ≲ 2.4m** (rooms ~3m). **16–30 parts + bevels (0.004–0.015)** read premium; emissive accents for the cold/brass mood.
- shapes: `box{size:[x,y,z]}`, `cylinder{radius,depth,verts}`, `cone{r1,r2,depth,verts}`, `sphere{radius,subdivisions}`, `torus{major,minor,verts}`; optional `rot:[deg,deg,deg]`, `bevel`.

## Shared PBR material library (THE budget-safe path to 100+)
`materials.texture` is a slug resolved by the executor in priority order:
1. `src/assets/textures/environment/shared-pbr/<slug>_basecolor|_orm|_normal.png` — the shared library (ORM = R:AO, G:roughness, B:metallic). Keys: `pbr_white_marble, pbr_dark_marble, pbr_brass_polished, pbr_brass_aged, pbr_wood_walnut, pbr_stone_concrete, pbr_steel_brushed, pbr_glass_frosted, pbr_bone_ivory, pbr_velvet_oxblood`.
2. `builder-surfaces/<slug>_color|_rough.webp` — legacy CC0 set.
3. none → material color/factor fallback (so specs render even before textures land).
Emissive accents are factor-only (no `texture`). Always give textured materials a sensible fallback `color` too.
**To (re)paint textures**: user runs Codex with `shared-pbr/CODEX_PROMPT.md` → drops 30 maps (`<key>_basecolor/_normal/_orm.png`, 1024², seamless) in `shared-pbr/` → re-build the props → re-cook.

## Batch (10–100) — proven flow
1. Planner produced `.tmp/modeling/plan100.json` (10 levels × 10 props, themed).
2. `Workflow`: N design agents (one per prop) read the plan + emit specs to `.tmp/modeling/specs/`. **HARDCODE the level list in the script** — passing it via `args` can arrive as a STRING (iterating chars → thousands of phantom tasks > the 4096 parallel cap).
3. Main loop builds all specs (run as a background shell loop; ~7–10s each with advanced bake).
4. `node scripts/asset-build/integrate-prop-batch.mjs` (idempotent; anchors on the museum cloche entry; maps footprints; group per level).
5. `compile-builder-runtime-resource-pack.mjs` → cook. `npm run qa:builder` → ALL PASS.

## Texture budget — the 256-layer hard limit (critical)
GPU caps each texture array at **256 layers per render plan**. Baked textures are **content-addressed** (`raw-webgpu-plan-geometry.mjs` filenames are `tex-<hash-of-bytes>`), so a shared texture reused by 100 props dedupes to ONE layer (builder pack stayed at 36, not 477). If you add UNIQUE textures per prop you WILL blow it (10 unique-textured props already hit 264 → raw-webgpu crashes → silent Three.js fallback = laggy + your render-plan edits don't show). Keep the shared library small; geometry carries the detail.

## Placing into official levels (optional, separate from /build)
See [[hp-official-level-image2-remaster]]: add to `levels/<lvl>/map.ts` `props[]`, then `rebuild-raw-webgpu-levels.mjs --level=<id>`. Per-level ~10 props keeps under budget. NOT auto-safe — scatter as perimeter set-dressing, avoid spawn/objectives/doors, then `qa:playthrough`.

## Gotchas
- `object.join()` DROPS non-active objects' modifiers → the executor applies each bevel per-part before join (don't revert).
- Vertex-AO is NOT usable: cook vertex format is fixed 10-float (`position3_normal3_uv2_materialIndex1_rigidJointIndex1`, no COLOR slot). Detail comes from geometry + normals + the shared ORM, not per-object AO.
- Executor self-heals: camera frames by Blender **Z** (true height); a failed `cube_project` is caught + always restores OBJECT mode (stuck EDIT mode used to corrupt later parts → the 4m sarcophagus). `UV_FAIL i`=part kept default UVs (fine); `PART_FAIL i`=part skipped; `BEVEL_FAIL i`=bevel not applied.
- Catalog QA rejects `"generic"` footprint — map every prop to a concrete FootprintFamily (no `bench` family → use `table`).
- Thumbnails: the in-app Chrome studio fails headless in sandbox — the Blender preview PNG IS a valid thumbnail.
- The cook regenerates large committed generated files (render_plan_*.json/.bin) — expected.
- Procedural primitives read "abstract" for organic subjects (skeleton) — favor hard-surface furniture for premium results.
- Related: [[hp-builder-cc0-assets]], [[hp-builder-asset-workflow]], [[hp-official-level-image2-remaster]], [[hp-room-shape-system]].
