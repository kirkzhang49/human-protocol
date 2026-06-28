# Human Protocol CC0 Surface and Door Asset Plan

Date: 2026-06-16

This note is the maintenance contract for upgrading official levels 1-5 and the
`/build` playtest path with license-clean floor, wall, ceiling, and door assets.
It is intentionally separate from `docs/asset-license-ledger.md`: the ledger is
for assets that are already imported or shipping, while this file tracks the
curated candidate pool and ingestion rules.

## Current Builder Preview Issue

Some `/build` wall/floor/ceiling presets can appear white after painting because
photo PBR presets were allowed to switch to `PhotoMaterial` as soon as a preset
had an albedo URL, even if the actual `TextureLoader` map had not loaded yet or
failed to load. The stable behavior is:

- Photo preset with loaded albedo map: render the tiled photo PBR material.
- Photo preset while loading or after load failure: render the procedural
  color/pattern fallback.
- Brush preview: always use the procedural preview, so hover painting stays
  immediate and deterministic.

The runtime pack still treats builder photo surfaces as authoring metadata plus
procedural fallback unless a surface kit explicitly maps the builder preset to
a cooked raw-WebGPU shell model/material. This is the right boundary: editor
visuals can be rich, but official/playtest parity must come from the shared
surface kit bridge.

## License-Safe Source Policy

Preferred sources:

- ambientCG: CC0 PBR materials, strong for floors/walls/ceilings.
  Official license page: https://docs.ambientcg.com/license/
- Poly Haven: CC0 HDRIs, PBR materials, and some high-quality 3D props.
  Official license page: https://polyhaven.com/license
- Kenney: CC0 game-ready stylized 3D kits, useful for prototypes, modular
  placeholders, and clean low-poly doors/panels.
  Official support/license page: https://kenney.nl/support
- Quaternius: CC0 low-poly modular 3D kits, especially sci-fi interiors,
  doors, wall pieces, consoles, and props.
  Official site: https://quaternius.com/

Avoid for core shipping assets unless each individual file is reviewed:

- Sketchfab or marketplace assets with mixed licenses.
- Non-commercial, no-derivatives, editorial-only, or attribution-confusing
  assets.
- GPL/code-like/copyleft asset packs that could complicate redistribution.
- AI-generated texture packs without archived commercial-use terms.

## Ingestion Contract

Every external asset batch must land as four linked records:

1. Source archive:
   `docs/provenance/external-assets/<source>/<asset-id>/source/`
2. License proof snapshot:
   `docs/provenance/external-assets/<source>/<asset-id>/license.md`
3. Processed game asset:
   - PBR textures:
     `src/assets/textures/environment/<pack-or-level>/`
   - Cooked model assets:
     `src/assets/models-cooked/environment/external-cc0/<asset-id>/`
4. Ledger row:
   `docs/asset-license-ledger.md`, with source URL, status `cc0`, processing
   notes, and the exact derived files.

No candidate asset should be treated as cleared just because its website says
"free". The local license snapshot and ledger row are the clearance point.

## Recommended Level Kits

## Implemented Shared Surface Kits

These are the current first-class kits shared by official maps, `/build`
imports, `/build` playtest runtime packs, and raw-WebGPU model collection.

| Level | Display name | shellKit | Builder floor | Builder wall/ceiling | Official materials | Runtime shell models |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | L1 维修舱金属套件 | `hp:industrial_panel_arena_shell_v4_image2_floor` | `floor_maintenance_metal` | `wall_maintenance_metal` | `maintenance_bay_wet_floor` / `maintenance_bay_glass_wall` | `room_floor_tile_maintenance` / `room_wall_panel_maintenance` / `room_ceiling_panel_maintenance` |
| 2 | L2 居住模拟木墙套件 | `hp:residential_false_home_shell_v1` | `floor_residential_wood` | `wall_residential_wood` | `residential_floor` / `residential_wall` | `room_floor_tile_residential` / `room_wall_panel_residential` / `room_ceiling_panel_residential` |
| 3 | L3 人类博物馆石墙套件 | `hp:human_museum_gallery_shell_v1` | `floor_museum_stone` | `wall_museum_stone` | `museum_floor` / `museum_wall` | `room_floor_tile_museum` / `room_wall_panel_museum` / `room_ceiling_panel_museum` |
| 4 | L4 记忆诊所瓷板套件 | `hp:memory_clinic_shell_v1` | `floor_memory_clinic_tile` | `wall_memory_clinic_panel` | `memory_clinic_floor` / `memory_clinic_wall` | `room_floor_tile_clinic` / `room_wall_panel_clinic` / `room_ceiling_panel_clinic` |
| 5 | L5 回收核心暗金属套件 | `hp:reclamation_core_shell_v1` | `floor_reclamation_core_metal` | `wall_reclamation_core_panel` | `reclamation_core_floor` / `reclamation_core_wall` | `room_floor_tile_core` / `room_wall_panel_core` / `room_ceiling_panel_core` |

The L5 builder style is still exported as `hazard` in `RoomAestheticStyle`
because the schema does not have a `core` aesthetic enum. The shell, builder
presets, room skin, and material keys remain `reclamation_core_*`.

### Level 1: Maintenance Bay

Goal: damaged service facility, robot maintenance, metal/black rubber/cyan
utility lighting.

Good source families:

- ambientCG: brushed metal, diamond plate, scratched concrete, worn rubber.
- Quaternius Modular Sci-Fi / Sci-Fi Essentials: doors, wall modules, access
  panels, cable props, consoles.
- Kenney Factory Kit / City Kit Industrial: simple industrial silhouettes for
  quick builder placeholders.

Builder/shared mapping:

- Floor: metal plate or dark rubber.
- Wall: maintenance metal, concrete, industrial panel.
- Ceiling: dark service panels with strip lights.
- Door: service elevator, maintenance access, locked utility door.

### Level 2: Residential Simulation

Goal: false home, warm but slightly wrong, domestic surfaces hiding service
infrastructure.

Good source families:

- ambientCG: wood floors, plaster, wallpaper-like fabric, painted walls.
- Poly Haven: selected indoor HDRI or furniture props if style-compatible.
- Kenney: simple furniture/door placeholders only if they can be reskinned to
  the Human Protocol art direction.

Builder/shared mapping:

- Floor: wood/parquet.
- Wall: warm panel, plaster, false wallpaper.
- Ceiling: flat painted ceiling with subtle service seams.
- Door: apartment/interior door plus hidden service variant.

### Level 3: Human Museum

Goal: strongest near-term target. Museum shell should be identical between
official Level 3 and `/build` official import/playtest.

Good source families already aligned:

- ambientCG: marble, aged brass, concrete/stone, wood walnut.
- Poly Haven: museum/gallery HDRI for IBL.
- Quaternius or custom cooked assets: gallery doors and modular wall panels
  only when they match current L3 proportions.

Builder/shared mapping:

- Floor: museum stone, marble, or guided route stone.
- Wall: museum stone, dark marble, warm gallery wall.
- Ceiling: museum ceiling panel, not generic wall fallback once a real ceiling
  shell exists.
- Door: gallery door and service elevator door must use the same cooked model
  keys in official and builder runtime.

### Level 4: Memory Clinic

Goal: clinic/lab cleanliness with emotional horror underneath.

Good source families:

- ambientCG: clean ceramic tile, white/gray concrete, frosted glass.
- Poly Haven: clinical or neutral indoor HDRI if available.
- Quaternius Sci-Fi Essentials: monitors, scanner props, medical-ish panels.

Builder/shared mapping:

- Floor: lab tile, clean vinyl/ceramic.
- Wall: sterile panel, observation glass, medical rail wall.
- Ceiling: soft clinic panels with vents and light strips.
- Door: clinic service door and observation-room door.

### Level 5: Reclamation Core

Goal: heavy core room, dark industrial metal, hazard accents, boss-scale door.

Good source families:

- ambientCG: dark metal, concrete, grating, worn paint, hazard-compatible base
  surfaces.
- Quaternius Sci-Fi Modular / Essentials: modular corridor, large doors,
  machinery, crates, terminals.
- Kenney industrial kits: only as silhouette placeholders or low-risk kitbash
  sources.

Builder/shared mapping:

- Floor: dark metal, hazard stripe, grated/plate floor.
- Wall: core metal panel, concrete, power conduit wall.
- Ceiling: industrial service ceiling with red/amber lighting.
- Door: boss terminal door and blast door segment.

## Refactor Boundary

The maintainable architecture should stay as:

- Builder authoring presets: human-friendly surface IDs, colors, and optional
  editor-only photo PBR maps.
- SurfaceKit bridge: maps builder surface IDs to official shell/model/material
  keys.
- Official level config: owns story, objectives, puzzle gating, enemy waves,
  and canonical room kit IDs.
- Runtime pack compiler: consumes the same bridge so `/build` playtest and
  official level rendering use the same model keys.

Future work should add imported CC0 assets to the bridge, not hard-code them
inside individual level maps. That keeps official and builder parity alive.

## Next Import Batch

Recommended first batch:

1. Level 3 museum: marble/stone/walnut/brass PBR variants plus gallery door
   shell parity.
2. Level 1 maintenance: metal plate, concrete, rubber, service door variants.
3. Level 5 core: dark metal, hazard-compatible floor, blast door variants.
4. Level 2 and Level 4: lighter domestic/clinic kits after the shared bridge is
   proven on the high-impact levels.

Acceptance criteria for every imported batch:

- `npm run qa:builder` passes.
- Official Level 3 import to builder and builder playtest use the same
  floor/wall/ceiling/door model keys where the bridge declares parity.
- Missing texture requests fall back to procedural materials instead of white
  surfaces.
- Every external asset has a provenance folder and a ledger row before it is
  considered release-safe.
