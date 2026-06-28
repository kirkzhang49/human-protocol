# Human Protocol Modeling Agent Config Handoff

这份文件是给建模 agent 的对接合同。它说明模型资产怎样接进 Human Protocol 的 config，而不是让建模 agent 去理解整个游戏代码。

结论：

- 要给建模 agent 5 关 sample。
- 但不要给它“全量玩法代码”作为主要输入。
- 需要给它稳定的 config key、尺寸规则、交付 manifest、5 关房间/门/道具引用样例。

## 1. 建模 Agent 需要知道什么

建模 agent 只需要理解 4 类 key：

| Key | 谁使用 | 作用 |
| --- | --- | --- |
| `room.skinKey` | `map.rooms[]` | 决定房间整体皮肤：地面、墙、灯光、主题 |
| `door.skinKey` | `map.doors[]` | 决定门模型/门框/状态灯风格 |
| `visualKey` | 门、钥匙、互动、谜题目标、补给 | 决定具体可见道具或 fallback primitive |
| `modelKey` | 未来 asset manifest | 指向具体 GLB 模型文件 |

当前代码已经支持：

```ts
room.skinKey
door.skinKey
visualKey
materialKey
```

未来接 GLB 时建议补：

```ts
room.modelKitKey
room.heroSetPieceKey
door.modelKey
interaction.modelKey
keyItem.modelKey
puzzle.targets[].modelKey
```

建模 agent 不需要知道：

- 敌人 AI 如何运行。
- 武器怎么判定。
- localStorage 怎么存档。
- Vercel/CrazyGames 怎么部署。
- React/R3F 组件细节。

## 2. 要给 Agent 的文件

推荐给这 5 份，不要一上来给全 repo：

1. `docs/human-protocol-modeling-kit-breakdown.md`
   - 大建筑拆分、房间 kit、门 kit、交互物和 5 关资产需求。

2. `docs/human-protocol-current-asset-requirements.md`
   - 当前最高优先级资产、第一人称武器、门开关、文章问答、拾取物和 manifest 规格。

3. `docs/human-protocol-modeling-agent-config-handoff.md`
   - 本文件，说明怎么和 config 对接。

4. `src/game/visual/AssetResolver.ts`
   - 当前已有 `skinKey / visualKey / materialKey` 列表。
   - 只需要看 profile key，不需要改 renderer。

5. 当前 5 关 config sample：
   - `src/game/config/levelManifest.ts`
   - `src/game/config/levels/residentialSimulationLevel.ts`
   - `src/game/config/levels/levels03To05.ts`

如果 agent 不是代码型，只给它本文档里的 sample JSON 也够。

## 3. 当前 Config 怎样引用资产

### Room

当前房间这样配置：

```ts
{
  id: "maintenance_bay_floor",
  label: "维修主舱",
  bounds: { center: [0, 0, -3.2], size: [18, 4, 25] },
  mood: "combat",
  skinKey: "maintenance_bay_hero",
  floorMaterialKey: "maintenance_bay_wet_floor",
  wallMaterialKey: "maintenance_bay_glass_wall",
  geometry: { renderFloor: true, renderWalls: true, collisionWalls: false, accentColor: "#8df6ff" },
  aesthetic: { style: "maintenance", detail: "high" }
}
```

未来模型化后可以变成：

```ts
{
  id: "maintenance_bay_floor",
  skinKey: "maintenance_bay_hero",
  modelKitKey: "kit_maintenance_bay_hero",
  heroSetPieceKey: "hero_maintenance_repair_bay"
}
```

### Door

当前门这样配置：

```ts
{
  id: "service_elevator_door",
  label: "维修电梯门",
  fromRoomId: "maintenance_bay_floor",
  toRoomId: "service_elevator_room",
  position: [0, 0, -14.5],
  size: [3.4, 3.2, 0.35],
  yaw: 0,
  defaultState: "locked",
  skinKey: "service_elevator_hero",
  visualKey: "service_elevator_door",
  panelPosition: [1.85, 0, -14.2]
}
```

未来模型化后可以变成：

```ts
{
  id: "service_elevator_door",
  skinKey: "service_elevator_hero",
  modelKey: "door_service_elevator",
  panelModelKey: "terminal_wall_cyan"
}
```

### Key / Pickup / Interaction

当前钥匙、终端、拾取物靠 `visualKey`：

```ts
{
  id: "level_02_family_key",
  label: "家属钥匙",
  roomId: "level_02_care_room",
  position: [13, 0, 0.4],
  visualKey: "large_yellow_key",
  materialKey: "access_card_gold"
}
```

未来模型化后：

```ts
{
  id: "level_02_family_key",
  visualKey: "large_yellow_key",
  modelKey: "pickup_large_yellow_key"
}
```

### Big Screen / TV

当前大屏系统已经进 config。建模 agent 做资产时不要把数字、中文、题目烘进贴图；屏幕内容由 runtime 按状态绘制。

```ts
{
  id: "level_04_body_formula_screen",
  roomId: "level_04_body_chair",
  interactionId: "level_04_body_screen_interaction",
  modelKey: "terminal_puzzle_big_screen",
  visualKey: "terminal_puzzle_big_screen",
  position: [-2.55, 1.48, -3.12],
  size: [2.55, 1.34],
  states: [
    { id: "off", mode: "off" },
    { id: "formula_hint", mode: "formula" }
  ]
}
```

Manifest 建议：

```ts
{
  modelKey: "terminal_puzzle_big_screen",
  file: "assets/models/environment/terminals/terminal_puzzle_big_screen.glb",
  category: "terminal",
  defaultVisualKey: "terminal_puzzle_big_screen",
  sizeMeters: [2.4, 1.3, 0.18],
  pivot: "back_center",
  displayModes: ["off", "digits", "color_sequence", "formula", "text"],
  materialAtlas: "terminal_screen_atlas",
  mobileCost: "low",
  tags: ["terminal", "screen", "puzzle", "config-driven"]
}
```

## 4. 建模 Agent 输出格式

每个模型必须输出一个 manifest entry。不要只丢 GLB 文件。

```ts
{
  modelKey: "door_service_elevator",
  file: "assets/models/environment/doors/hp_door_service_elevator_5m.glb",
  category: "door",
  defaultSkinKey: "service_elevator_hero",
  sizeMeters: [5.2, 3.4, 0.45],
  pivot: "bottom_center",
  collision: {
    type: "box",
    sizeMeters: [5.2, 3.4, 0.45]
  },
  animationParts: ["left_panel", "right_panel"],
  materialAtlas: "door_terminal_atlas",
  lod: {
    high: "included",
    low: "hp_door_service_elevator_5m_low.glb"
  },
  mobileCost: "medium",
  tags: ["door", "service", "hero", "maintenance"]
}
```

房间 kit manifest：

```ts
{
  modelKitKey: "kit_maintenance_bay_hero",
  category: "room_kit",
  skinKey: "maintenance_bay_hero",
  pieces: [
    "room_floor_panel_4x4",
    "room_wall_glass_4m",
    "room_wall_pipe_2m",
    "room_corner_pillar",
    "room_ceiling_rail",
    "room_ceiling_light_panel"
  ],
  recommendedRoomSize: [18, 4, 25],
  heroSetPieces: ["hero_maintenance_repair_bay", "backdrop_robot_storage_window"],
  materialAtlas: "facility_trim_atlas",
  mobileCost: "high"
}
```

## 5. 5 关 Config Sample 给 Agent 的最小版本

### Level 01

```ts
rooms: [
  { id: "maintenance_bay_floor", skinKey: "maintenance_bay_hero", modelKitKey: "kit_maintenance_bay_hero", heroSetPieceKey: "hero_maintenance_repair_bay" },
  { id: "service_elevator_room", skinKey: "service_exit_red", modelKitKey: "kit_service_exit_red" }
],
doors: [
  { id: "service_elevator_door", skinKey: "service_elevator_hero", modelKey: "door_service_elevator" }
],
interactions: [
  { id: "pickup_iron_rod", visualKey: "iron_rod_pickup", modelKey: "pickup_iron_rod_world" },
  { id: "pickup_pistol", visualKey: "pistol_pickup", modelKey: "pickup_pistol_world" },
  { id: "use_service_elevator", visualKey: "service_elevator_panel", modelKey: "exit_panel_service" }
]
```

### Level 02

```ts
rooms: [
  { id: "level_02_recovery_foyer", skinKey: "residential_sim_dark", modelKitKey: "kit_residential_foyer" },
  { id: "level_02_living_room", skinKey: "residential_sim_dark", modelKitKey: "kit_residential_living", heroSetPieceKey: "hero_residential_false_home" },
  { id: "level_02_care_room", skinKey: "hazard_yellow_service", modelKitKey: "kit_hazard_service_room" },
  { id: "level_02_light_room", skinKey: "sterile_blue_lab", modelKitKey: "kit_sterile_light_room" }
],
doors: [
  { id: "level_02_living_room_door", skinKey: "residential_access_clean", modelKey: "door_residential_clean" },
  { id: "level_02_care_room_door", skinKey: "yellow_access_service", modelKey: "door_yellow_access" },
  { id: "level_02_light_room_door", skinKey: "red_locked_blast", modelKey: "door_red_lockdown" },
  { id: "level_02_family_exit_door", skinKey: "red_locked_blast", modelKey: "door_red_lockdown_large" }
],
keyItems: [
  { id: "level_02_family_key", visualKey: "large_yellow_key", modelKey: "pickup_large_yellow_key" }
],
puzzles: [
  { id: "level_02_light_sequence", targetModelKey: "puzzle_lamp_orb", clueModelKey: "floor_sequence_marker" }
]
```

### Level 03

```ts
rooms: [
  { id: "level_03_entry_hall", skinKey: "museum_gallery", modelKitKey: "kit_museum_entry" },
  { id: "level_03_gallery_lobby", skinKey: "museum_gallery", modelKitKey: "kit_museum_gallery" },
  { id: "level_03_tool_exhibit", skinKey: "museum_gallery", modelKitKey: "kit_museum_exhibit", heroSetPieceKey: "exhibit_tool_case" },
  { id: "level_03_voice_exhibit", skinKey: "museum_gallery", modelKitKey: "kit_museum_exhibit", heroSetPieceKey: "exhibit_voice_case" },
  { id: "level_03_body_exhibit", skinKey: "sterile_blue_lab", modelKitKey: "kit_body_exhibit", heroSetPieceKey: "hero_museum_body_case" },
  { id: "level_03_central_archive", skinKey: "red_reclamation_core", modelKitKey: "kit_archive_boss_room", heroSetPieceKey: "hero_central_archive_core" },
  { id: "level_03_exit_room", skinKey: "service_exit_red", modelKitKey: "kit_service_exit_red" }
],
doors: [
  { id: "level_03_lobby_door", modelKey: "door_archive_gate" },
  { id: "level_03_tool_door", modelKey: "door_yellow_access" },
  { id: "level_03_voice_door", modelKey: "door_yellow_access" },
  { id: "level_03_body_door", modelKey: "door_residential_clean" },
  { id: "level_03_archive_door", modelKey: "door_archive_gate_large" },
  { id: "level_03_exit_door", modelKey: "door_red_lockdown" }
],
keyItems: [
  { id: "level_03_tool_chip", modelKey: "pickup_archive_chip_tool" },
  { id: "level_03_voice_chip", modelKey: "pickup_archive_chip_voice" },
  { id: "level_03_body_chip", modelKey: "pickup_archive_chip_body" }
]
```

### Level 04

```ts
rooms: [
  { id: "level_04_waiting_room", skinKey: "memory_clinic", modelKitKey: "kit_clinic_waiting" },
  { id: "level_04_childhood_chair", skinKey: "memory_clinic", modelKitKey: "kit_clinic_chair_room", heroSetPieceKey: "hero_clinic_memory_chair_warm" },
  { id: "level_04_rescue_chair", skinKey: "memory_clinic", modelKitKey: "kit_clinic_chair_room", heroSetPieceKey: "hero_clinic_memory_chair_cyan" },
  { id: "level_04_body_chair", skinKey: "hazard_yellow_service", modelKitKey: "kit_clinic_chair_room", heroSetPieceKey: "hero_clinic_memory_chair_red" },
  { id: "level_04_therapy_theater", skinKey: "red_reclamation_core", modelKitKey: "kit_therapy_theater", heroSetPieceKey: "hero_therapy_theater_core" },
  { id: "level_04_exit_room", skinKey: "service_exit_red", modelKitKey: "kit_service_exit_red" }
],
doors: [
  { id: "level_04_childhood_door", modelKey: "door_clinic_soft_lock" },
  { id: "level_04_rescue_door", modelKey: "door_clinic_soft_lock" },
  { id: "level_04_body_door", modelKey: "door_clinic_soft_lock" },
  { id: "level_04_theater_door", modelKey: "door_red_lockdown" },
  { id: "level_04_exit_door", modelKey: "door_red_lockdown" }
],
interactions: [
  { id: "level_04_childhood_terminal", modelKey: "terminal_memory_chair" },
  { id: "level_04_rescue_terminal", modelKey: "terminal_memory_chair" },
  { id: "level_04_body_terminal", modelKey: "terminal_memory_chair_red" }
]
```

### Level 05

```ts
rooms: [
  { id: "level_05_core_entry", skinKey: "maintenance_service", modelKitKey: "kit_core_entry" },
  { id: "level_05_lock_hub", skinKey: "red_reclamation_core", modelKitKey: "kit_three_lock_hub", heroSetPieceKey: "hero_three_lock_hub" },
  { id: "level_05_north_lock", skinKey: "sterile_blue_lab", modelKitKey: "kit_core_lock_room_blue" },
  { id: "level_05_east_lock", skinKey: "maintenance_service", modelKitKey: "kit_core_lock_room_cyan" },
  { id: "level_05_west_lock", skinKey: "red_reclamation_core", modelKitKey: "kit_core_lock_room_red" },
  { id: "level_05_platform", skinKey: "red_reclamation_core", modelKitKey: "kit_reclamation_platform", heroSetPieceKey: "hero_reclamation_core_platform" },
  { id: "level_05_identity_file", skinKey: "identity_archive_white", modelKitKey: "kit_identity_archive_white", heroSetPieceKey: "hero_identity_archive_file" }
],
doors: [
  { id: "level_05_hub_door", modelKey: "door_red_lockdown" },
  { id: "level_05_north_door", modelKey: "door_yellow_access" },
  { id: "level_05_east_door", modelKey: "door_yellow_access" },
  { id: "level_05_west_door", modelKey: "door_yellow_access" },
  { id: "level_05_platform_door", modelKey: "door_core_platform_gate" },
  { id: "level_05_identity_door", modelKey: "door_identity_archive" }
],
keyItems: [
  { id: "level_05_north_lock_key", modelKey: "pickup_lock_key_blue" },
  { id: "level_05_east_lock_key", modelKey: "pickup_lock_key_cyan" },
  { id: "level_05_west_lock_key", modelKey: "pickup_large_yellow_key" }
],
puzzles: [
  { id: "level_05_north_lock_sequence", targetModelKey: "puzzle_energy_orb", clueModelKey: "floor_sequence_marker" }
]
```

## 6. 现有 Key 和新 Model Key 的关系

建模 agent 输出新模型时，不要改旧 key。旧 key 是当前游戏能跑的 fallback。

| 当前 key | 新 modelKey |
| --- | --- |
| `service_elevator_door` | `door_service_elevator` |
| `yellow_access_door` | `door_yellow_access` |
| `residential_access_door` | `door_residential_clean` |
| `large_yellow_key` | `pickup_large_yellow_key` |
| `family_access_card` | `pickup_access_module` |
| `yellow_access_card` | `pickup_archive_chip` |
| `three_color_order_panel` | `terminal_wall_cyan` |
| `exit_panel` | `exit_panel_red` |
| `maintenance_crate` | `pickup_repair_kit` or `prop_supply_crate` |
| `puzzle_orb_blue` | `puzzle_energy_orb_blue` |
| `puzzle_orb_red` | `puzzle_energy_orb_red` |
| `puzzle_orb_yellow` | `puzzle_energy_orb_yellow` |

规则：

- `visualKey` 保留，用作低配/未加载 fallback。
- `modelKey` 是高配模型。
- 如果模型加载失败，游戏仍能用 `visualKey` 画出占位物。

## 7. Agent 交付目录

建模 agent 每批交付应该长这样：

```text
assets/models/environment/doors/hp_door_service_elevator_5m.glb
assets/models/environment/doors/hp_door_service_elevator_5m_low.glb
assets/models/environment/props/hp_pickup_large_yellow_key.glb
assets/models/environment/hero/hp_hero_maintenance_repair_bay.glb
assets/textures/environment/door_terminal_atlas.webp
assets/textures/environment/props_pickups_atlas.webp
assets/manifests/human_protocol_environment_assets.json
```

Manifest 必须包含：

- `modelKey`
- `file`
- `category`
- `sizeMeters`
- `pivot`
- `collision`
- `materialAtlas`
- `mobileCost`
- `tags`
- `notes`

## 8. 怎么验证 Agent 产物能接 Config

接入前做 5 个检查：

1. Manifest 里的 `modelKey` 全部唯一。
2. 5 关 sample 里引用的 `modelKey` 全部存在。
3. 每个门都有 collision proxy 和动画分件。
4. 每个拾取物 pivot 在底部中心，能直接放到 `position: [x,0,z]`。
5. 每个 room kit 能用当前房间 `bounds.size` 拼出房间，不需要手工改代码。

接入后加一个 QA：

```text
npm run art:qa
```

未来可以扩展成：

```text
npm run model:qa
```

检查：

- `modelKey` 是否缺失。
- 文件是否存在。
- 模型尺寸是否超出 room/door config。
- mobileCost 是否超预算。
- GLB 是否超过单文件预算。

## 9. 最佳给 Agent Prompt

可以直接把下面这段给建模 agent：

```text
You are building modular GLB environment assets for Human Protocol, a mobile-first first-person sci-fi escape combat game. Do not make whole maps. Create reusable room kits, doors, interactable props, hero set pieces, and backdrops that can be referenced by config keys.

Use 1 unit = 1 meter. Standard room height is 4m. Doors are 3.2m high. Every asset must have a stable modelKey, correct pivot, simple collision proxy, mobile cost tag, and optional low LOD. Avoid real brands, copyrighted logos, and text-heavy decals. Assets must be compatible with the provided 5-level config sample.

Output GLB files plus a JSON manifest. The game will connect assets by room.skinKey, door.skinKey, visualKey fallback, and future modelKey.
```

## 10. 最重要的交接方式

给建模 agent 的不是“做一个漂亮房间”，而是：

```text
这里是 5 关 config sample。
这里是每个 room/door/prop 会用的 key。
这里是尺寸和 pivot。
这里是 manifest 格式。
你输出的每个模型都必须能被这些 key 直接调用。
```

这样做，模型资产就能和当前 config-driven 关卡系统配合，后期本地 LLM 生成关卡也能复用。
