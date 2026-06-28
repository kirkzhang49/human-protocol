# Human Protocol Blueprint-First Asset Pipeline

Human Protocol should treat WGPU Robot Lab as the source workspace for high-quality
robot, furniture, room-kit, lighting, material, physics, and export assets. From
now on, new modeling work starts from a blueprint. Runtime config consumes the
accepted blueprint outputs; it should not become the place where temporary art
decisions are hidden.

## Rule

```text
gameplay/art need
  -> typed blueprint
  -> math/objective/constraint report
  -> generated or refined source model
  -> GLB/textures/collision/animation bundle
  -> Human Protocol manifest and LevelDefinition config
```

Do not directly add blocky models, one-off doors, invisible pickups, hardcoded
robot colors, or room-only lighting hacks without first recording the blueprint.

For assets that become selectable or playable in `/build`, the handoff is not
complete until the asset also passes the Raw WebGPU resource map contract in
`docs/human-protocol-builder-wgpu-resource-map.md`. A GLB registry entry and a
catalog tile are only the first half; fast playtest must resolve the same
`modelKey` from official Raw level imports or the `builder_runtime_resources`
supplemental pack.

## Blueprint Types Human Protocol Consumes

### RoomKitBlueprint

Use for official rooms and reusable arena families, for example
`maintenance_combat_bay_v1` or `cyan_lockdown_arena_v1`.

Human Protocol config may choose:

- shell size and kit id;
- floor, wall, ceiling module variants;
- prop slots and semantic zones;
- enemy spawn zones, nav lanes, pickup zones, exit/elevator slot;
- lighting preset and red/blue final-door state.

The blueprint owns:

- compatible modules and dimensions;
- collision and nav assumptions;
- light sample points and QA camera views;
- accepted material families and performance budget.

### RoomPropBlueprint

Use for cabinets, repair beds, work tables, terminals, big screens, elevators,
medical kits, energy blocks, keys, doors, lockers, and readable items.

Human Protocol config may choose:

- placement, interactable id, pickup amount, lock state, and puzzle wiring;
- supported material or texture variant;
- visible/open/closed/locked state where the blueprint supports it.

The blueprint owns:

- named faces and texture assignment;
- support polygon and collision proxy;
- interaction affordance names;
- readability requirements under room lighting.

### MechaFrameBlueprint

Use for maintenance enemies, flying drones, shield/technical robots, boss robots,
and any future player-facing robot frame.

Human Protocol config may choose:

- enemy tier id, spawn group, behavior profile, health, damage, patrol/combat role;
- accepted visual profile id;
- supported animation clip ids.

The blueprint owns:

- proportions, sockets, joints, collision capsules, and silhouette class;
- allowed material families and accent ratios;
- required animation slots such as `idle`, `move`, `attack`, `hit`, and `death`;
- room-light readability and red/cyan conflict limits.

### EnemyVisualBlueprint

Use for robot colors, emissive cores, roughness, metalness, and lighting response.

Human Protocol config may choose a profile and small supported overrides. The
blueprint/report owns the visual score under Level 01 lighting:

- silhouette contrast;
- cyan core readability;
- red conflict penalty;
- metal specular score;
- emissive bloom penalty;
- horror restraint;
- room light harmony.

### AnimationBlueprint

Use for robot actions, door/elevator states, repair pod open/close, hover, tool
swings, hit, and death clips.

Human Protocol config may choose timing policy when supported, for example small
enemies showing hit reaction every two hits. The blueprint owns clip names,
duration, impact frame, recovery, loop policy, and joint/socket expectations.

### LightingBlueprint

Use for official level lighting and reusable mood families.

Human Protocol config may choose:

- kit lighting profile;
- final door locked/unlocked color state;
- local intensity multipliers inside safe ranges.

The blueprint owns:

- key/fill/rim/ambient ratios;
- exposure, bloom, fog, emissive budget;
- contact shadow, floor reflection, wall gradient, ceiling structure, pickup
  readability, and enemy silhouette requirements.

### MaterialTextureBlueprint

Use for image2/PBR texture sets, trim sheets, emissive masks, decals, and variants.

Human Protocol config may choose accepted variants. The blueprint owns face-to-map
assignment, UV density, map names, palette ratios, and compression policy.

### PhysicsCollisionBlueprint

Use for pickup stacking, enemy feet, hover projection, room navigation, doors,
furniture support, and interactable hit boxes.

Human Protocol config may choose gameplay values like pickup reward or lock
status. The blueprint owns collider type, bounds, mass, friction, no-overlap
policy, support rules, and nav blockers.

### ExportRuntimeBlueprint

Use for the final bridge into Human Protocol.

It must identify:

- source blueprint path;
- WGPU source blend path;
- GLB and texture paths;
- Human Protocol manifest key;
- LevelDefinition/config keys;
- animation clip names;
- collision profile;
- validation commands and report paths.

## Required Handoff Shape

Every accepted asset handoff should include:

```json
{
  "schema": "human-protocol/asset-handoff@1",
  "blueprintId": "wgpu:room-kit:maintenance-combat-bay:v1",
  "assetId": "hp_room_maintenance_combat_bay_v1",
  "sourceWorkspace": "webgpu-robot-lab",
  "artifacts": {
    "blueprint": "asset-lab/specs/room-kit/hp_room_maintenance_combat_bay_v1.blueprint.json",
    "report": "asset-lab/reports/hp_room_maintenance_combat_bay_v1-qa.json",
    "glb": "public/assets/rooms/hp_room_maintenance_combat_bay_v1.glb",
    "textures": ["public/assets/rooms/textures/hp_room_maintenance_combat_bay_v1-basecolor.png"]
  },
  "humanProtocol": {
    "manifestKey": "hp_room_maintenance_combat_bay_v1",
    "configKeys": ["roomKit", "lightingProfile", "exitDoorProfile"],
    "requiredQa": ["npm run build", "npm run smoke:campaign"]
  },
  "decision": "accepted"
}
```

## Official Level Requirement

Official levels should use blueprint-backed kits and assets wherever art quality
matters. A LevelDefinition may assemble a room from reusable kit names and
supported config knobs, but it should not encode low-level geometry, untracked
model variants, or lighting values that contradict the accepted blueprint report.

If Level 01 becomes the sample combat room, the room should be reproducible from
its `RoomKitBlueprint`, `LightingBlueprint`, prop blueprints, enemy visual
blueprints, and export handoff records.
