# WGPU Room Prop Replacement Handoff

Generated from `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room` for the Human Protocol escape-room art pass.

## Asset Pack

- Manifest: `src/assets/manifests/runtime/human_protocol_wgpu_room_prop_replacements.json`
- GLB roots:
  - `src/assets/models/environment/props`
  - `src/assets/models/environment/terminals`
  - `src/assets/models/environment/doors`
- Texture root: `src/assets/textures/environment/wgpu-room-props`

## Replacement Intent

These GLBs are high-fidelity, uncompressed review/desktop-grade replacements. They intentionally prioritize recognizable silhouettes and richer Blender geometry over the older low-budget mobile placeholders.

Existing Human Protocol model keys replaced in their current `hp_*.glb` paths include:

- `pickup_large_yellow_key`
- `pickup_medkit_white_red`
- `pickup_energy_cell_amber`
- `pickup_memory_chip_cluster`
- `pickup_ammo_magazine`
- `prop_archive_book_open`
- `terminal_archive_reader`
- `terminal_quiz_panel_red`
- `door_identity_archive`
- `switch_panel_wall_cyan`
- `switch_panel_wall_red`
- `switch_panel_floor_lever`
- `switch_state_light_cyan`
- `switch_state_light_amber`
- `switch_state_light_red`

Additional room props now available by model key include:

- `room-door-security`
- `room-terminal-wall`
- `room-fuse-box`
- `room-locker-low`
- `room-maintenance-supply-cabinet`
- `room-table-utility`
- `room-chair-service`
- `room-crate-stack`
- `room-ceiling-strip-light`
- `terminal_puzzle_big_screen`
- `terminal_code_keypad`
- `terminal_direction_ring`
- `prop_archive_folder_stack`

## Runtime Notes

- The big screen asset exposes static geometry for `off`, `digits`, and `color_sequence` display modes; render live code digits or color order through the game runtime instead of baking puzzle answers into texture.
- The medkit, energy cell, key, and maintenance cabinet now have geometry-level identification details, so they remain readable even when texture resolution is reduced later.
- The pack will exceed the old mobile GLB budget. Run Draco/meshopt/KTX2 or a project-specific optimization pass before treating it as mobile production-ready.

