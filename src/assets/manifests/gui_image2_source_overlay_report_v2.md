# GUI Image2 Source Overlay Report v2

## Summary

This pass creates and wires source-backed 2D overlay layers for Tool Calibration and Route Switch. Primary art comes from saved Image2/source PNGs under `image2-sources`; scripts only crop, resize, compose backing plates, compress PNGs, and write regions.

No 3D assets, Level 3 runtime logic, Skill 3 runtime, or tool/weapon cabinet assets were edited.

## Saved Image2 Sources

- `src/assets/gui/tool-calibration/image2-sources/tool_calibration_complete_ui_image2_source_v3_no_hand.png`
  - 1600x900 complete Tool Calibration Image2 UI source.
  - Used for no-hand left tool bay crop and tile crops.
- `src/assets/gui/tool-calibration/image2-sources/tool_calibration_hardware_modules_image2_source_v1.png`
  - 1536x1024 clean black-gold/cyan hardware source.
  - Used for the clean horizontal calibration rod and module cuts.
- `src/assets/gui/route-switch/image2-sources/route_switch_output_modules_image2_source_v1.png`
  - 2048x2048 Level07 route-switch Image2 parts source.
  - Used for the Route Switch output/display/button layer.
- `src/assets/gui/route-switch/image2-sources/route_switch_output_bays_image2_source_v2.png`
  - 660x680 source-backed output bay assembly from saved Image2 route-switch parts.
  - Used for complete cyan/amber/green/violet/off route output bay sprites.

## Deliverables

- `src/assets/gui/tool-calibration/tool_calibration_clean_rod_image2_layer_v1.png`
  - Primary recommended left tool bay image: clean black-gold/cyan calibration rod/canister, no hand, no skin tones, no biological form.
  - Regions: `src/assets/gui/tool-calibration/tool_calibration_clean_rod_image2_layer_v1.regions.json`
- `src/assets/gui/tool-calibration/tool_calibration_tile_module_image2_atlas_v3_no_text.png`
  - No-text source-backed tile/module atlas: cyan lit tiles, blocked sockets, glass module, energy core.
  - Regions: `src/assets/gui/tool-calibration/tool_calibration_tile_module_image2_atlas_v3_no_text.regions.json`
- `src/assets/gui/route-switch/route_switch_output_button_image2_layer_v1.png`
  - Route Switch output/display/button composition from saved Image2 route parts.
  - Regions: `src/assets/gui/route-switch/route_switch_output_button_image2_layer_v1.regions.json`
- `src/assets/gui/route-switch/route_switch_output_bays_image2_atlas_v2.png`
  - Runtime output bay atlas: `output_bay_cyan`, `output_bay_amber`, `output_bay_green`, `output_bay_violet`, `output_bay_off`.
  - Regions: `src/assets/gui/route-switch/route_switch_output_bays_image2_atlas_v2.regions.json`
- `src/assets/gui/tool-calibration/tool_calibration_left_tool_bay_image2_layer_v3.png`
  - Alternate left tool bay crop from complete UI source.

## Suggested Wiring

Use `tool_calibration_clean_rod_image2_layer_v1.png` for the left tool bay hero image, and `tool_calibration_tile_module_image2_atlas_v3_no_text.png` for source-backed tile art where baked labels must be avoided.

Use `route_switch_output_bays_image2_atlas_v2.png` for the four Route Switch output buttons. `route_switch_output_button_image2_layer_v1.png` remains a secondary panel/display layer. Keep all labels, numbers, selected state, and accessibility text in React/CSS.

## Verification

- `node scripts/asset-build/cut-tool-calibration-image2-layers.mjs`
- `node scripts/asset-build/cut-overlay-image2-source-layers.mjs`
- JSON parse check for generated regions
- Visual inspection of the clean rod, no-text tool atlas, and route output layer

Note: a new built-in image_gen Route Switch mechanical-button variant was generated in chat, but the app did not expose a filesystem path. It is not listed as a saved source or used in deliverables.
