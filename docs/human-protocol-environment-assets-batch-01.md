# Human Protocol Environment Assets Batch 01

This batch follows `docs/human-protocol-current-asset-requirements.md` and focuses on room props, interactable props, and first-person readable items. First-person arms and weapons are intentionally out of scope for this repo session.

## Generated Assets

Manifest:

```text
src/assets/manifests/runtime/human_protocol_environment_assets.json
```

Models:

```text
src/assets/models/environment/props/hp_pickup_large_yellow_key.glb
src/assets/models/environment/props/hp_pickup_medkit_white_red.glb
src/assets/models/environment/props/hp_pickup_energy_cell_amber.glb
src/assets/models/environment/props/hp_pickup_memory_chip_cluster.glb
src/assets/models/environment/props/hp_pickup_ammo_magazine.glb
src/assets/models/environment/props/hp_prop_small_floor_shadow_disc.glb
src/assets/models/environment/props/hp_switch_panel_wall_cyan.glb
src/assets/models/environment/props/hp_switch_panel_wall_red.glb
src/assets/models/environment/props/hp_switch_panel_floor_lever.glb
src/assets/models/environment/props/hp_switch_state_light_cyan.glb
src/assets/models/environment/props/hp_switch_state_light_amber.glb
src/assets/models/environment/props/hp_switch_state_light_red.glb
src/assets/models/environment/props/hp_prop_archive_book_open.glb
src/assets/models/environment/terminals/hp_terminal_archive_reader.glb
src/assets/models/environment/terminals/hp_terminal_quiz_panel_red.glb
src/assets/models/environment/terminals/hp_terminal_quiz_panel_cyan.glb
src/assets/models/environment/doors/hp_door_identity_archive.glb
```

Atlases:

```text
src/assets/textures/environment/props_pickups_atlas.jpg
src/assets/textures/environment/switch_panel_atlas.jpg
src/assets/textures/environment/archive_reader_atlas.jpg
src/assets/textures/environment/door_terminal_atlas.jpg
```

## Current Config Mapping

Recommended initial renderer mapping:

```text
visualKey: "large_yellow_key" -> modelKey: "pickup_large_yellow_key"
visualKey: "maintenance_crate", pickup type repairKit -> modelKey: "pickup_medkit_white_red"
visualKey: "maintenance_crate", pickup type coreCell -> modelKey: "pickup_energy_cell_amber"
visualKey: "yellow_access_card" / "family_access_card" -> modelKey: "pickup_memory_chip_cluster"
visualKey: "direction_keypad_panel", materialKey terminal_red -> modelKey: "terminal_quiz_panel_red"
visualKey: "direction_keypad_panel", switch interaction -> modelKey: "switch_panel_wall_cyan" or "switch_panel_wall_red"
visualKey: "archive_book" -> modelKey: "prop_archive_book_open"
visualKey: "exit_panel" -> modelKey: "terminal_archive_reader"
door id: "level_05_identity_door" -> modelKey: "door_identity_archive"
```

Level05 direct targets:

```text
level_05_archive_book -> prop_archive_book_open
level_05_archive_quiz_panel -> terminal_quiz_panel_red
level_05_identity_door -> door_identity_archive
level_05_west_lock_key -> pickup_large_yellow_key
level_05_med_01 / level_05_med_02 -> pickup_medkit_white_red
level_05_cell_01 -> pickup_energy_cell_amber
```

## Validation

```text
npm run assets:environment:generate
npm run assets:environment:validate
npm run build
```

The manifest keeps `defaultVisualKey` so a future renderer can prefer `modelKey` and fall back to the existing primitive visual when a model is unavailable.
