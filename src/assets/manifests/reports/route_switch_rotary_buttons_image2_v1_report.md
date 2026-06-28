# Route Switch Rotary Buttons Image2 v1

## Scope

Runtime-only 2D overlay atlas for Route Switch output buttons. This does not
touch Level 3 data, key logic, builder output, Raw WebGPU JSON, or route-switch
world behavior.

The v1 atlas is now packed as vertical rotary selector modules: a large
twistable Image2 knob sits above a separate cut Image2 target badge. The earlier
long lower nameplate cut was rejected for this UI and is no longer packed into
the runtime atlas.

The overlay now also places those four modules into a shared Image2 rack so the
route switch reads as one integrated control desk. A matching 3D
`builder_route_switch_console` GLB has been rebaked from a dedicated Image2
texture kit to keep the world object and the 2D overlay in the same style.

## Sources

- `src/assets/gui/route-switch/image2-sources/route_switch_rotary_controller_image2_source_v2.png`
  - OpenAI Image2/generated source sheet for route-switch rotary controls.
  - Used for the circular controller frames, locked face, selected amber face,
    and enabled cyan face.
  - Provenance: `src/assets/manifests/reports/route_switch_rotary_controller_image2_source_v2_provenance.json`
- `src/assets/gui/route-switch/image2-sources/route_switch_icon_language_image2_source_v1.png`
  - OpenAI Image2/generated source sheet for route-switch icon language.
  - Used for the title emblem, authorization marks, and footer branching icon.
  - Provenance: `src/assets/manifests/reports/route_switch_icon_language_image2_source_v1_provenance.json`
- `src/assets/gui/route-switch/image2-sources/route_switch_target_badges_ancient_image2_source_v1.png`
  - OpenAI Image2/generated source sheet for ancient target badges.
  - Used for the four player-facing output meanings: door, terminal, robot,
    and output gate.
  - Provenance: `src/assets/manifests/reports/route_switch_target_badges_ancient_image2_source_v1_provenance.json`
- `src/assets/gui/route-switch/image2-sources/route_switch_integrated_output_module_image2_source_v1.png`
  - OpenAI Image2/generated source sheet for the integrated output module
    housing.
  - Used behind each knob so the knob and lower target badge read as one
    physical selector.
  - Provenance: `src/assets/manifests/reports/route_switch_integrated_output_module_image2_source_v1_provenance.json`
- `src/assets/gui/route-switch/image2-sources/route_switch_output_rack_image2_source_v1.png`
  - OpenAI Image2/generated source for the shared four-slot output rack.
  - Used as the background hardware that unifies the four selector modules.
  - Provenance: `src/assets/manifests/reports/route_switch_output_rack_image2_source_v1_provenance.json`
- `src/assets/textures/environment/builder-puzzle-machines/image2-sources/route_switch_router_console_image2_source_v1.png`
  - OpenAI Image2/generated 3D texture kit matching the 2D overlay style.
  - Used by the rebaked `builder_route_switch_console` GLB.
  - Provenance: `src/assets/manifests/reports/route_switch_router_console_image2_source_v1_provenance.json`

License label: `owned-generated-output`.

## Generated Outputs

- `src/assets/gui/route-switch/route_switch_output_rotary_buttons_image2_v1.png`
- `src/assets/gui/route-switch/route_switch_output_rotary_buttons_image2_v1.regions.json`
- `src/assets/gui/route-switch/route_switch_output_rack_image2_v1.png`
- `src/assets/gui/route-switch/route_switch_output_rack_image2_v1.regions.json`
- `src/assets/textures/environment/builder-puzzle-machines/hp_route_switch_console_image2_atlas_v1.png`
- `src/assets/textures/environment/builder-puzzle-machines/hp_route_switch_console_image2_atlas_v1.regions.json`
- `src/assets/models-cooked/environment/builder-puzzle-machines/hp_builder_route_switch_console.glb`
- `src/assets/source_blend/builder-puzzle-machines/hp_builder_route_switch_console_image2_v2.blend`

Regions:

- `button_enabled`
- `button_disabled`
- `button_selected`
- `button_rotating_0`
- `button_rotating_1`
- `button_rotating_2`
- `button_rotating_3`

## Script

`node scripts/asset-build/cut-route-switch-rotary-buttons-image2.mjs`

`node scripts/asset-build/cut-route-switch-output-rack-image2.mjs`

`/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/asset-build/generate-builder-puzzle-machine-glbs.py -- builder_route_switch_console`

The rotary script crops saved Image2 knob pixels, keys the flat black source
background to alpha, resizes the source-painted knob frames, packs a transparent
PNG atlas, and writes fixed `[x, y, w, h]` regions. It intentionally does not
pack the rejected long nameplate cut. It also applies a darker material pass to
the knob pixels so the rotary buttons read as smoked metal rather than flat
bright UI discs.

The icon-language script separately crops edge-connected black background to
alpha while preserving internal dark metal badge faces. The four output target
badges now come from the ancient medallion source sheet, removing the earlier
modern blue line/dot visual language.

The rack script keys only flood-connected exterior black pixels and preserves
the dark recessed socket cavities. The Blender bake keeps the canonical
`builder_route_switch_console` modelKey, embeds
`hp_route_switch_console_image2_atlas_v1`, and maps the new Image2 regions onto
real chassis, deck, side, rack, rotary, key-lens, and empty badge geometry.

## Runtime Boundary

Image2 atlases own the visible mechanical selector knob, disabled lock face,
selected amber face, source-painted rotating knob frames, title emblem, target
badges, authorization marks, and footer icon. React/CSS owns hidden labels,
aria, layout, glow, click state, and frame-opacity animation.

The 3D GLB owns the neutral world object silhouette and materials. Runtime still
owns selected output, target meaning, authorization, reveal timing, localization,
and accessibility.
