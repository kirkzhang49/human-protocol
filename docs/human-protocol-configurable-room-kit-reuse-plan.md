# Human Protocol Configurable Room Kit Reuse Plan

## Goal

Turn the high-quality Level 1 room direction into a reusable, config-driven large-room kit system.

The target is not a single hand-placed room. The target is an official reference kit that the game, local LLM, and players can reuse, copy, override, and extend without renderer hardcoding.

Level 1 should become the first gold sample:

```text
large combat arena + high-quality lighting + replaceable props + configurable doors + reusable spawn/pickup anchors
```

The room identity should come mostly from space, floor, ceiling, wall panels, door state, and lighting. Furniture should be swappable content, not the definition of the room.

## Core Rule

Names such as `maintenance_combat_bay_v1` and `cyan_lockdown_arena_v1` are preset IDs only.

Official kit records live as JSON data in:

```text
src/game/config/roomPresentationKits.json
```

`RoomPresentationRegistry.ts` should keep types, resolver logic, and validation helpers only. Future art tuning should edit JSON records first, then add renderer capability only when the JSON vocabulary is missing.

They must not become renderer branches:

```ts
// Forbidden
if (roomKit === "maintenance_combat_bay_v1") {
  renderSpecialLevelOneRoom();
}
```

The renderer should only consume resolved data:

```ts
const resolvedRoom = resolveRoomPresentation(level.map, roomKitRegistry, assetRegistry);
renderRoomShell(resolvedRoom.shell);
renderRoomLighting(resolvedRoom.lighting);
renderDoors(resolvedRoom.doors);
renderPropLayout(resolvedRoom.props);
renderSpawnAnchors(resolvedRoom.spawnAnchors);
```

Code owns reusable verbs. Config owns room nouns.

## Room Kit Layers

The system should split a room kit into composable registries instead of one locked object.

```text
roomKit
  archetype
  shell
  lighting
  doors
  propSets
  layoutAnchors
  spawnLayout
  pickupLayout
  previewCamera
  environmentStates
```

### 1. Room Archetype

The archetype describes gameplay scale and expected use.

Examples:

```ts
type RoomArchetype =
  | "large_combat_arena"
  | "small_escape_room"
  | "corridor_connector"
  | "boss_chamber"
  | "story_lab";
```

For the current target, Level 1 should use:

```ts
archetype: "large_combat_arena"
```

This means:

- enough open floor space for waves
- readable enemy spawn zones
- props along sides or low-cover lanes
- strong lighting hierarchy
- door/elevator exit visible from the main combat area
- no single furniture object defines the room

### 2. Shell Kits

Shell kits define floor, ceiling, walls, trims, corner pieces, and large visual panels.

Example registry:

```ts
shellKits: {
  "hp:industrial_panel_arena_shell_v1": {
    floorKit: "hp:industrial_panel_floor_arena_v1",
    ceilingKit: "hp:deep_grid_ceiling_arena_v1",
    wallKit: "hp:maintenance_wall_screen_array_v1",
    cornerKit: "hp:dark_lab_corner_trim_v1",
    scalePolicy: "fit_room_bounds",
    doorOpeningPolicy: "cut_visual_and_collision_segments"
  }
}
```

Shell kits should be asset-first. Official campaign shell pieces should prefer GLB/model assets over primitive planes and boxes.

### 3. Lighting Presets

Lighting presets define named light rigs, not just colors.

Example registry:

```ts
lightingPresets: {
  "hp:cyan_lockdown_arena_v1": {
    mood: "combat",
    ambient: { color: "#5f7f88", intensity: 0.22 },
    fog: { color: "#05090d", near: 20, far: 62 },
    bloom: { intensity: 0.82, threshold: 0.34 },
    lights: [
      { id: "ceiling_key", type: "rect_strip", anchor: "ceiling_center", color: "#bff8ff", intensity: 1.65 },
      { id: "screen_spill", type: "screen_spill", anchor: "hero_screen", color: "#8cecff", intensity: 1.25 },
      { id: "door_status", type: "state_light", anchor: "exit_door", colorByState: { locked: "#ff4b3c", unlocked: "#64f0ff" } },
      { id: "floor_guides", type: "emissive_mesh", anchor: "floor_lanes", color: "#5fe8ff", intensity: 0.55 }
    ],
    shadows: {
      enabled: true,
      contactShadowStrength: 0.38,
      heroPropShadowBias: -0.00008
    }
  }
}
```

The important rule: visible light meshes and actual lights should share anchors and colors. This is what makes the room feel authored instead of randomly brightened.

### 4. Door Kits

Door kits define model family, frame, state visuals, opening direction, status light behavior, and optional panel anchors.

Example registry:

```ts
doorKits: {
  "hp:elevator_exit_lockable_v1": {
    archetype: "elevator_exit",
    frameModelKey: "hp_door_elevator_frame_v1",
    panelModelKey: "hp_door_elevator_panel_v1",
    doorModelKey: "hp_door_elevator_sliding_v1",
    stateMaterials: {
      locked: "hp_door_status_red_v1",
      closed: "hp_door_status_amber_v1",
      open: "hp_door_status_cyan_v1"
    },
    openAnimation: { type: "split_slide", axis: "x", distance: 1.6 },
    panelAnchor: "right_frame",
    statusLightAnchor: "top_bar"
  }
}
```

Level 1 should use an elevator/exit-style door as the endpoint. It can be locked red and later unlocked blue, but it should not behave like a password door unless the level config adds that lock type.

### 5. Prop Sets

Prop sets are swappable furniture and interactable families.

Example registry:

```ts
propSets: {
  "hp:repair_bay_props_v1": {
    required: [
      { anchor: "left_service_cluster", modelKey: "hp_repair_cabinet_v2" },
      { anchor: "center_low_table", modelKey: "hp_utility_table_v2" },
      { anchor: "rear_hero_screen", modelKey: "hp_big_screen_terminal_v2" }
    ],
    optional: [
      { anchor: "side_shelf_a", modelKey: "hp_supply_locker_v2", weight: 0.8 },
      { anchor: "floor_pickup_a", modelKey: "hp_repair_kit_v2", weight: 1.0 },
      { anchor: "floor_pickup_b", modelKey: "hp_core_cell_v2", weight: 1.0 }
    ]
  }
}
```

Furniture can change per level. The arena shell, light hierarchy, and spawn-readable floor should remain stable.

### 6. Layout Anchors

Layout anchors let LLM/player configs place content without hand-measuring every prop.

Example:

```ts
layoutAnchorSets: {
  "hp:large_arena_anchors_v1": {
    anchors: [
      { id: "rear_hero_screen", roomRelative: [0, 0, -0.42], yaw: 0, role: "hero_wall" },
      { id: "exit_door", roomRelative: [0.42, 0, -0.44], yaw: 0, role: "exit" },
      { id: "left_service_cluster", roomRelative: [-0.35, 0, -0.18], yaw: 0.25, role: "prop_cluster" },
      { id: "center_low_table", roomRelative: [-0.08, 0, -0.05], yaw: -0.1, role: "cover_prop" },
      { id: "floor_pickup_a", roomRelative: [0.1, 0, 0.04], yaw: 0, role: "pickup_readable" },
      { id: "spawn_northwest", roomRelative: [-0.42, 0, -0.34], yaw: 0, role: "enemy_spawn" },
      { id: "spawn_southeast", roomRelative: [0.36, 0, 0.30], yaw: 3.14, role: "enemy_spawn" }
    ]
  }
}
```

Anchor positions should resolve against room bounds. This lets the same kit fit a larger or smaller room.

### 7. Spawn And Pickup Layouts

Large combat rooms need gameplay-safe layout presets.

Example:

```ts
spawnLayouts: {
  "hp:perimeter_wave_spawns_v1": {
    anchors: ["spawn_northwest", "spawn_northeast", "spawn_southwest", "spawn_southeast"],
    maxSimultaneousGroups: 3,
    minDistanceFromPlayerStart: 8,
    lineOfSightPolicy: "partial_cover"
  }
}

pickupLayouts: {
  "hp:readable_center_pickups_v1": {
    anchors: ["floor_pickup_a", "floor_pickup_b", "side_table_pickup"],
    visibilityPolicy: "glow_beacon_when_critical",
    avoidCombatLaneRadius: 1.2
  }
}
```

This keeps item visibility and wave pacing reusable.

### 8. Art Preview Camera

Official room kits should include optional preview cameras for visual QA.

Example:

```ts
previewCameras: {
  "hp:wide_room_showcase_v1": {
    positionMode: "room_relative",
    position: [-0.46, 0.34, 0.48],
    target: [0.03, 0.14, -0.12],
    fov: 58,
    purpose: "art_qa"
  }
}
```

This camera is not normal gameplay. It is a repeatable way to compare Level 1 against the WGPU lab-quality reference.

## Level-Level Usage

A level should reference kit IDs and optional overrides.

Proposed map-level visual block:

```ts
map: {
  id: "level_01_map",
  schemaVersion: "hp.map.v1",
  presentation: {
    roomKit: "hp:maintenance_combat_bay_v1",
    lightingPreset: "hp:cyan_lockdown_arena_v1",
    previewCamera: "hp:wide_room_showcase_v1",
    overrides: {
      propDensity: "medium",
      floorWear: 0.58,
      ceilingLightIntensity: 1.08,
      doorStateStyle: "lockdown_red_to_cyan",
      pickupVisibility: "critical_items_high"
    }
  },
  rooms: [...],
  doors: [...],
  props: [...],
  spawnGroups: [...]
}
```

The `presentation` block should not replace existing room/door/prop data immediately. It should become the reusable default layer. Explicit room, door, prop, pickup, and spawn config can still override it.

## Official Level 1 Target Kit

The first official kit should be:

```ts
roomKits: {
  "hp:maintenance_combat_bay_v1": {
    archetype: "large_combat_arena",
    shellKit: "hp:industrial_panel_arena_shell_v1",
    lightingPreset: "hp:cyan_lockdown_arena_v1",
    doorKit: "hp:elevator_exit_lockable_v1",
    defaultPropSet: "hp:repair_bay_props_v1",
    layoutAnchorSet: "hp:large_arena_anchors_v1",
    spawnLayout: "hp:perimeter_wave_spawns_v1",
    pickupLayout: "hp:readable_center_pickups_v1",
    previewCamera: "hp:wide_room_showcase_v1"
  }
}
```

This is an official template, not an engine feature. A player pack can copy it, rename it, and change its child kits.

## Player And LLM Reuse

### Fast LLM Reuse

A local LLM can safely reuse the official kit with minimal thinking:

```ts
presentation: {
  roomKit: "hp:maintenance_combat_bay_v1"
}
```

This should produce a coherent, high-quality large combat room.

### User Copy And Override

A user can define a new kit in their pack:

```ts
roomKits: {
  "my_pack:blue_factory_arena_v1": {
    extends: "hp:maintenance_combat_bay_v1",
    shellKit: "my_pack:blue_factory_shell_v1",
    lightingPreset: "my_pack:blue_alarm_arena_v1",
    defaultPropSet: "my_pack:factory_cover_props_v1",
    overrides: {
      propDensity: "low",
      floorWear: 0.82,
      fogFar: 70
    }
  }
}
```

### Local Overrides Without New Kit

A level can override a few fields without defining a new kit:

```ts
presentation: {
  roomKit: "hp:maintenance_combat_bay_v1",
  overrides: {
    lightingPreset: "hp:cyan_lockdown_arena_v1",
    propDensity: "sparse",
    doorStateStyle: "minimal_cyan",
    spawnLayout: "hp:two_side_wave_spawns_v1"
  }
}
```

## Namespacing

Official IDs should use the `hp:` namespace.

Examples:

```text
hp:maintenance_combat_bay_v1
hp:cyan_lockdown_arena_v1
hp:elevator_exit_lockable_v1
hp:industrial_panel_floor_arena_v1
```

Custom packs should use a pack namespace:

```text
my_pack:blue_factory_arena_v1
creator_name:sterile_trial_room_v2
```

Unqualified names can be accepted for hand-authored internal configs, but exported player packs should be normalized to namespaced IDs.

## Resolver Rules

The resolver should:

1. Load official registry.
2. Load pack registry.
3. Resolve `extends` chains.
4. Merge room kit defaults.
5. Apply level-level overrides.
6. Resolve anchor-relative positions against room bounds.
7. Resolve model/material/texture references through the asset registry.
8. Produce one normalized `ResolvedRoomPresentation`.

The renderer should not know whether the data came from an official kit, copied kit, or level override.

## Validator Rules

The validator should catch:

- missing kit IDs
- missing asset/model/material keys
- cyclic `extends`
- room kits with no shell kit
- large combat rooms with no spawn layout
- large combat rooms with insufficient open floor area
- door kits that do not match door lock/exit requirements
- lighting presets with unsupported light types
- generated packs using forbidden arbitrary object families
- pickup anchors hidden behind large props
- player starts too close to wave spawn anchors
- preview cameras outside room bounds

Generated authoring profiles should still be constrained by `human-protocol-config-authoring-boundary.md`.

## Renderer Migration Rule

Do not add more level-specific visual branches to `Arena.tsx`, `MapGeometryRenderer.tsx`, or door/lighting renderers.

Preferred flow:

```text
LevelDefinition
  -> resolveRoomPresentation
  -> ResolvedRoomPresentation
  -> ConfiguredRoomShell
  -> ConfiguredMapLighting
  -> ConfiguredDoorRenderer
  -> ConfiguredPropRenderer
```

Existing `skinKey`, `visualKey`, and `modelKey` fields can remain for compatibility. New room-level polish should move toward kit registries.

## Level 1 Visual Direction

Level 1 should become:

```text
Maintenance Combat Bay
```

Not a small repair bedroom, not a narrow escape room.

The visual target:

- large readable combat floor
- detailed metal panel floor with subtle grime and cyan guide lines
- dark ceiling grid with visible depth and strip lights
- back-wall screen and service systems as the focal point
- elevator exit door embedded into the architecture
- red locked state that can turn blue/cyan after unlock
- furniture grouped along edges and low-cover lanes
- medical kit, energy cell, key, repair cabinet, and screen readable from gameplay distance
- enough brightness for humans to play, with cinematic shadow still preserved

## First Execution Batch

After this document is approved, the first implementation batch should be:

1. Add room kit registry types and official registry file.
2. Add `presentation` support to map config.
3. Add `resolveRoomPresentation`.
4. Add validator checks for kit IDs and asset references.
5. Convert Level 1 to reference `hp:maintenance_combat_bay_v1`.
6. Add an art-preview camera query mode for Level 1.
7. Upgrade Level 1 lighting via `hp:cyan_lockdown_arena_v1`.
8. Upgrade Level 1 door through `hp:elevator_exit_lockable_v1`.
9. Re-render browser screenshots for art preview and normal gameplay.

The asset pass should happen through this config layer, not as direct renderer special cases.
