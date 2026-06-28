# GUI Overlay Image2 Redraw Blueprint v3

## Goal

Redraw Tool Calibration and Route Switch as purpose-built Image2 source sheets, then crop them with fixed math-owned coordinates. This replaces the failed old approach of mining unrelated parts and forcing them into the UI.

## Route Switch Source

Expected source path:

`src/assets/gui/route-switch/image2-sources/route_switch_console_redraw_source_v3.png`

Required contents:

- `output_bay_cyan`
- `output_bay_amber`
- `output_bay_green`
- `output_bay_violet`
- `route_backplate`

Layout rule:

- Top row: four identical vertical colored bay buttons, evenly spaced.
- Bottom row: one wide rear console backplate.
- Flat matte black gutters, no text, no labels, no logo.

## Tool Calibration Source

Expected source path:

`src/assets/gui/tool-calibration/image2-sources/tool_calibration_redraw_source_v4.png`

Required contents:

- `tool_hero`
- `tile_straight_off`
- `tile_straight_on`
- `tile_corner_off`
- `tile_corner_on`
- `tile_tee_off`
- `tile_tee_on`
- `tile_cross_off`
- `tile_cross_on`
- `tile_blocked`
- `tile_core`
- `tile_entry`
- `tile_output`
- `tool_grid_backplate`

Layout rule:

- Left third: one horizontal premium calibration tool.
- Right side: 4x3 grid of square mechanical tile modules.
- Bottom strip: one wide dark grid backplate.
- Flat matte black gutters, no baked `IN`, `OUT`, `CORE`, Chinese, or English text.

## Runtime Boundary

- Image2 owns the tool render, colored route buttons, tile material identity, backplates, bevels, screws, gaskets, glass, and glow.
- React/CSS owns all live text, labels, localization, counters, selection state, and accessibility.
- The cut script may crop, remove flat black, pack, compress, and write regions JSON only.

## Cut Command

```bash
python3 scripts/asset-build/cut-redrawn-overlay-image2-atlases.py
```

Outputs:

- `src/assets/gui/route-switch/route_switch_console_redraw_atlas_v3.png`
- `src/assets/gui/route-switch/route_switch_console_redraw_atlas_v3.regions.json`
- `src/assets/gui/tool-calibration/tool_calibration_redraw_atlas_v4.png`
- `src/assets/gui/tool-calibration/tool_calibration_redraw_atlas_v4.regions.json`
