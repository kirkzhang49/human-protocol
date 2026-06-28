# Human Protocol Level 01 Lighting And Asset Handoff

这份文档给 asset / Wgpu Robot Lab / 建模灯光 agent 使用。目标是把第一关 `维修舱 01` 做成真正有压迫感的高级科幻密室，而不是明亮测试大厅里摆了几个 GLB。

## 1. 当前问题

现在第一关加了 GLB 后反而不够高级，主要不是资产数量问题，而是场景导演问题：

- 全局光太平均，地面、墙、道具都被冷蓝光铺平，黑暗不够黑。
- 道具像被摆在空大厅里，没有形成“维修舱正在回收你”的叙事。
- 玩家一眼看穿整条直通路，缺少密室遮挡和局部发现。
- UI 和大字对白压住了空间氛围，玩家看不到第一眼的恐怖场景。
- GLB 没有足够 contact shadow / grime / occlusion，显得漂浮和干净。
- 缺少第一关专属 hero set piece：维修台、机械臂、玻璃后机器人仓、红色封锁电梯。

结论：下一步不要先加更多普通道具，先做“光效 + 维修舱 hero set piece + 贴花遮挡层”。

## 2. 第一关目标画面

玩家进入后应该感觉：

```text
我不是站在大厅里。
我是刚从一张维修床/实验台边醒来。
四周大部分是黑的，只有几条冷青医疗灯还亮着。
远处红色电梯门锁死，像唯一出口。
玻璃后有机器人仓和机械臂，说明这里不是安全房间。
地上有铁棒和手枪，但它们像是被临时丢在维修舱地面上，不是 UI 奖励。
```

关键词：

- dark maintenance bay
- cold medical cyan
- red lockdown elevator
- wet metal floor
- glass robot storage
- repair arms
- low visibility
- high contrast
- horror without gore

## 3. 灯光设计

### 3.1 光照层级

第一关光照应该由 5 层组成：

| Layer | 作用 | 视觉 |
| --- | --- | --- |
| Base darkness | 压暗全局，保留黑暗 | 房间大面积接近黑蓝色 |
| Cyan medical strips | 指出维修舱身份 | 侧墙、天花、维修台边缘的冷青灯 |
| Red elevator lockdown | 给玩家目标和危险 | 远处电梯门/门框红光，地面有红反光 |
| Prop contact / AO | 让 GLB 接地 | 每个桌、柜、床、箱子底部有暗影 |
| Haze / bloom cards | 做空间深度 | 少量红/蓝雾光片、灰尘、屏幕光 |

### 3.2 Runtime 光效建议

给 code agent 的实现方向：

```text
ambientLight: 从 0.34 降到 0.12-0.18
hemisphereLight: 降低天空白，保留很弱地面暗蓝
main directional: 降到 1.2-1.7，只保留轮廓
red elevator point/area light: 强一点，距离短，集中在出口门
cyan side point/strip light: 放在维修台、玻璃墙和侧墙
fog: 更暗，near 10-14, far 36-48
bloom: 只让灯条和屏幕亮，不让整面墙亮
```

不要：

- 不要让所有墙板发光。
- 不要让地面均匀泛蓝。
- 不要让 GLB 表面全体高亮。
- 不要加大量动态点光，优先用 emissive 材质和低成本光片。

### 3.3 镜头构图

第一眼应该有 3 个层次：

| 距离 | 内容 | 目的 |
| --- | --- | --- |
| Foreground | 玩家手、维修床边缘、掉落铁棒/手枪、局部阴影 | “我刚醒来” |
| Midground | 两侧维修台、机械臂、玻璃机器人仓、冷青灯 | “这里是维修/实验空间” |
| Background | 红色电梯门、封锁灯、远处机器人影子 | “我要逃出去” |

当前中间太空。需要用维修床、线缆、侧柜、半遮挡墙件把空间压小。

## 4. 必做资产清单

优先级从高到低。

### 4.1 Hero Set Piece

#### `hero_maintenance_repair_bay`

第一关最重要资产。不是普通桌子，是玩家醒来的维修/实验台。

```json
{
  "modelKey": "hero_maintenance_repair_bay",
  "category": "hero_set_piece",
  "defaultRoomSkinKey": "maintenance_bay_hero",
  "sizeMeters": [3.2, 1.25, 1.4],
  "pivot": "bottom_center",
  "collision": { "type": "box", "sizeMeters": [3.2, 0.45, 1.4] },
  "parts": ["bed_base", "side_rail_left", "side_rail_right", "head_console", "cyan_status_strips", "dark_contact_shadow"],
  "materialAtlas": "hp_level01_repair_bay_atlas.webp",
  "mobileCost": "medium",
  "tags": ["level01", "hero", "maintenance", "wake_up"]
}
```

视觉要求：

- 黑灰金属维修台，不是医院白床。
- 边缘有冷青灯条。
- 台面有束缚槽、维修轨道、线缆接口，但不要血腥。
- 能放在玩家身后/身侧，不堵主通道。

#### `hero_maintenance_repair_arm_cluster`

维修机械臂组，放在维修床旁或天花轨道上。

```json
{
  "modelKey": "hero_maintenance_repair_arm_cluster",
  "category": "hero_set_piece",
  "sizeMeters": [2.2, 2.6, 1.4],
  "pivot": "bottom_center",
  "parts": ["ceiling_mount", "arm_a", "arm_b", "tool_clamp", "scanner_head", "amber_fault_light"],
  "animationHints": ["idle_slow_sway", "fault_twitch"],
  "mobileCost": "medium",
  "tags": ["level01", "repair_arm", "horror", "noncombat"]
}
```

视觉要求：

- 像工业维修臂/手术臂，不像攻击武器。
- 一只夹具臂、一只扫描臂。
- 末端工具清楚，但不能细到移动端看不见。
- 可以只做静态版本，但要给 pivot，后续可以动。

### 4.2 Background And Room Depth

#### `backdrop_robot_storage_window_dark`

玻璃后机器人仓。最适合做恐怖感，成本低，不影响碰撞。

```json
{
  "modelKey": "backdrop_robot_storage_window_dark",
  "category": "backdrop",
  "sizeMeters": [7.5, 3.2, 0.35],
  "pivot": "bottom_center",
  "collision": { "type": "none" },
  "parts": ["glass_panel", "shadow_robot_silhouettes", "cyan_storage_lights", "red_warning_dot"],
  "materialAtlas": "hp_level01_robot_storage_atlas.webp",
  "mobileCost": "low",
  "tags": ["level01", "backdrop", "robot_storage", "horror"]
}
```

视觉要求：

- 玻璃后只需要影子和低亮灯，不要清楚机器人正脸。
- 远处像有很多维修单位待机。
- 黑暗玻璃 + 少量青色竖灯 + 1-2 个红色小点。
- 不要高亮到抢走玩家对出口的注意力。

#### `room_wall_occluder_maintenance_half_panel`

半高/侧边遮挡墙件，用来打破大空房。

```json
{
  "modelKey": "room_wall_occluder_maintenance_half_panel",
  "category": "room",
  "sizeMeters": [2.4, 1.45, 0.32],
  "pivot": "bottom_center",
  "collision": { "type": "box", "sizeMeters": [2.4, 1.45, 0.32] },
  "tags": ["level01", "occluder", "maintenance"]
}
```

要求：

- 做成维修隔断、设备柜背板、玻璃/金属混合。
- 用于两侧，不放在正中主路。
- 主要作用是遮挡和投影，不是装饰。

### 4.3 Door / Exit Lighting

#### `door_service_elevator_red_lockdown_light_kit`

给第一关电梯门用的红色封锁灯，不是新门本体。

```json
{
  "modelKey": "door_service_elevator_red_lockdown_light_kit",
  "category": "door_light_kit",
  "sizeMeters": [4.2, 3.4, 0.18],
  "pivot": "bottom_center",
  "parts": ["top_red_bar", "side_red_strips", "floor_red_reflection_card", "warning_lenses"],
  "materialAtlas": "hp_level01_lockdown_lights_atlas.webp",
  "tags": ["level01", "exit", "lockdown", "red_light"]
}
```

要求：

- 电梯方向必须一眼是目标。
- 红光集中在门框和地面反光，不要整面墙全红。
- 做几个可拆灯条，runtime 可以按门状态显示。

### 4.4 Light Fixtures

这些资产通用，后面关卡也能用。

| Model Key | 用途 | 尺寸建议 | Pivot |
| --- | --- | --- | --- |
| `light_ceiling_flicker_cyan_2m` | 冷青闪烁天花灯 | `[2.0, 0.12, 0.18]` | center |
| `light_wall_medical_strip_cyan_1m` | 墙面医疗灯条 | `[0.12, 1.0, 0.08]` | back_center |
| `light_wall_fault_red_small` | 小红故障灯 | `[0.22, 0.22, 0.08]` | back_center |
| `light_floor_guide_cyan_broken` | 地面破碎导向灯 | `[1.2, 0.03, 0.12]` | bottom_center |
| `light_floor_red_reflection_card` | 电梯红光地面反射片 | `[2.5, 0.02, 1.1]` | bottom_center |

要求：

- 灯具本体要有实体壳，不只是发光 plane。
- 发光区域要小而亮。
- 灯条材质要支持 emissive。
- 破损灯条可以不规则亮灭，后续 runtime 用材质透明度控制。

### 4.5 Decal / Texture Atlases

#### `hp_level01_shadow_grime_decal_atlas.webp`

第一关需要一个贴花图集，比新模型更重要。

Atlas 内容：

```text
contact_shadow_soft_01
contact_shadow_hard_01
oil_smear_dark_01
wet_floor_patch_01
floor_scratch_cluster_01
cable_shadow_01
warning_stripe_worn_01
glass_dirt_streak_01
panel_edge_dark_01
```

要求：

- 不要文字。
- 透明 WebP/PNG source，runtime 可转 WebP alpha。
- 贴花颜色偏黑蓝/灰，不要彩色。
- 移动端看起来像阴影和脏污，不像贴纸。

#### `hp_level01_volumetric_light_cards.webp`

低成本雾光/光束卡片。

Atlas 内容：

```text
cyan_side_haze_soft
red_elevator_haze_soft
dust_mote_sparse
screen_glow_rect_soft
ceiling_light_bloom_streak
```

要求：

- 黑底或透明 alpha。
- 不能有硬边。
- 不要做成烟雾很浓，第一关是冷设备间，不是舞台烟。

## 5. 第一关摆放建议

以当前 `maintenance_bay_floor` 为基础：

```text
玩家 spawn: [0, 0, 8]
出口电梯: [0, 0, -14.5]
主路线: z 8 -> -14.5
```

建议构图：

```text
Foreground:
  hero_maintenance_repair_bay 放在玩家背后/侧后，第一次回头能看到。
  铁棒/手枪在玩家前方 2-4m 内，地面有小 contact shadow。

Left midground:
  repair_arm_cluster + diagnostic console + cyan side strip.

Right midground:
  storage cabinet / half panel / dark cable spine.

Background:
  service elevator door + red lockdown light kit.
  behind/side wall: robot storage window dark.
```

不要：

- 不要在主路线正中摆大桌子。
- 不要在第一眼画面里放太多平行长桌。
- 不要让所有道具对称。对称会像展厅，不像事故现场。

## 6. Runtime / Config 对接建议

目标：一个关卡 config 能定义“维修舱 01”这种高级场景，但不要让玩家/LLM 随便控制每个材质和颜色，避免变成拼贴感。

建议分 3 层：

```text
Level config
  -> room.visualDirectorKey 选择一套场景导演预设
  -> room.heroSetPieces / room.roomProps 放少量关键资产
  -> room.lightRigKey / decalSetKey / backdropKey 选择光效和贴花包

Asset registry
  -> 把 modelKey / textureKey / decalSetKey 映射到真实 GLB/WebP

Renderer
  -> 根据 config 自动摆放、开关、LOD、光强、fog、贴花
```

也就是说，config 不是直接说“创建一个红色灯，强度 2.2，放这里，再创建一个蓝色灯……”，而是说：

```text
这个房间是 maintenance_bay_lockdown。
它有维修床、机械臂、机器人仓、红色电梯封锁灯。
它使用 shadow_grime 贴花和 volumetric_light_cards。
```

代码负责把它变成一致的高级画面。

### 6.1 当前短期接法

短期不改很多 schema，也可以直接根据现有字段挂预设：

```ts
room.skinKey === "maintenance_bay_hero"
```

renderer 自动加：

```text
hero_maintenance_repair_bay
hero_maintenance_repair_arm_cluster
backdrop_robot_storage_window_dark
door_service_elevator_red_lockdown_light_kit
hp_level01_shadow_grime_decal_atlas
hp_level01_volumetric_light_cards
light_rig_maintenance_bay_lockdown
```

优点：

- 最快。
- 第一关立刻变好。
- 不影响 2-5 关 config。

缺点：

- 其他关卡想自由复用这套，需要继续扩 schema。

### 6.2 推荐中期 schema

给 `LevelRoomDefinition` 增加这些字段：

```ts
export interface RoomVisualDirectorConfig {
  key: string;
  intensity?: "low" | "medium" | "high";
  darkness?: "soft" | "dark" | "blackout";
  targetDoorId?: string;
  heroMoment?: "wake_up" | "combat" | "puzzle" | "boss" | "exit";
}

export interface RoomHeroSetPieceConfig {
  id: string;
  modelKey: string;
  position?: Vec3Tuple;
  yaw?: number;
  scale?: number;
  collision?: boolean;
  startsHidden?: boolean;
  showWhen?: LevelEventTriggerDefinition;
  hideWhen?: LevelEventTriggerDefinition;
}

export interface RoomBackdropConfig {
  id: string;
  modelKey: string;
  wall?: "north" | "east" | "south" | "west";
  position?: Vec3Tuple;
  yaw?: number;
  scale?: number;
  parallax?: "none" | "subtle";
}

export interface RoomLightRigConfig {
  key: string;
  ambient?: number;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  accent?: string;
  danger?: string;
  targetDoorId?: string;
  flicker?: "none" | "subtle" | "fault";
}

export interface RoomDecalSetConfig {
  key: string;
  density?: "low" | "medium" | "high";
  contactShadows?: boolean;
  floorGrime?: boolean;
  glassDirt?: boolean;
}
```

然后房间可以变成：

```ts
{
  id: "maintenance_bay_floor",
  label: "维修主舱",
  bounds: { center: [0, 0, -3.2], size: [18, 4, 25] },
  mood: "combat",
  skinKey: "maintenance_bay_hero",
  aesthetic: { style: "maintenance", detail: "high" },
  visualDirector: {
    key: "maintenance_bay_lockdown",
    intensity: "high",
    darkness: "dark",
    targetDoorId: "service_elevator_door",
    heroMoment: "wake_up"
  },
  lightRig: {
    key: "light_rig_maintenance_bay_lockdown",
    ambient: 0.15,
    fogColor: "#03070a",
    fogNear: 12,
    fogFar: 42,
    flicker: "fault",
    targetDoorId: "service_elevator_door"
  },
  decalSet: {
    key: "hp_level01_shadow_grime_decal_atlas",
    density: "high",
    contactShadows: true,
    floorGrime: true,
    glassDirt: true
  },
  backdrops: [
    {
      id: "robot_storage_west",
      modelKey: "backdrop_robot_storage_window_dark",
      wall: "west",
      scale: 1
    }
  ],
  heroSetPieces: [
    {
      id: "wake_repair_bay",
      modelKey: "hero_maintenance_repair_bay",
      position: [-2.8, 0, 6.8],
      yaw: 0.25,
      collision: true
    },
    {
      id: "wake_repair_arm_cluster",
      modelKey: "hero_maintenance_repair_arm_cluster",
      position: [-4.1, 0, 5.8],
      yaw: 0.4
    }
  ]
}
```

### 6.3 更自由的官方 config

官方 5 关可以允许更细，因为我们会人工 QA：

```ts
roomProps: [
  {
    id: "left_occluder_a",
    modelKey: "room_wall_occluder_maintenance_half_panel",
    position: [-6.6, 0, 1.2],
    yaw: Math.PI / 2,
    collision: true
  },
  {
    id: "right_cyan_strip_a",
    modelKey: "light_wall_medical_strip_cyan_1m",
    position: [7.8, 1.4, 2.5],
    yaw: -Math.PI / 2,
    emissiveGroup: "cyan_medical_strips"
  }
]
```

但这个自由度不要开放给 generated/player config。玩家生成关卡只应该选：

```text
visualDirector.key
room.skinKey
lightRig.key
decalSet.key
heroSetPieceKey from curated list
```

### 6.4 Generated Config 的安全边界

为了长期本地 LLM 生成关卡，建议这样限制：

| Config 作者 | 允许 |
| --- | --- |
| official/internal | 可以手动摆 `heroSetPieces / backdrops / roomProps / lightFixtures` |
| generated/player | 只能选 curated `visualDirectorKey / skinKey / lightRigKey / decalSetKey` |

原因：

- 官方可以为了第一关镜头精修摆物件。
- 玩家/LLM 如果随便摆，会挡路、太亮、风格乱、性能爆。
- 生成关卡应该自由在“玩法、房间、门、谜题、故事”上，不应该自由到每个灯的色值。

Validator 要检查：

```text
unknown visualDirectorKey -> error
unknown lightRigKey -> error
unknown modelKey -> error
generated profile cannot use raw roomProps positions unless allowed
hero set piece must fit inside room bounds
collision props cannot block required path
targetDoorId must exist
decalSetKey must be curated
mobileCost total under room budget
```

### 6.5 Asset Registry

资产机器人交付后，需要进入统一 registry：

```ts
export const environmentModelAssets = {
  hero_maintenance_repair_bay: {
    modelKey: "hero_maintenance_repair_bay",
    url: heroMaintenanceRepairBayUrl,
    category: "hero_set_piece",
    sizeMeters: [3.2, 1.25, 1.4],
  },
  hero_maintenance_repair_arm_cluster: {
    modelKey: "hero_maintenance_repair_arm_cluster",
    url: heroMaintenanceRepairArmClusterUrl,
    category: "hero_set_piece",
    sizeMeters: [2.2, 2.6, 1.4],
  },
  backdrop_robot_storage_window_dark: {
    modelKey: "backdrop_robot_storage_window_dark",
    url: backdropRobotStorageWindowDarkUrl,
    category: "backdrop",
    sizeMeters: [7.5, 3.2, 0.35],
  }
}
```

灯光/贴花也做 registry：

```ts
export const roomVisualDirectorProfiles = {
  maintenance_bay_lockdown: {
    roomSkinKey: "maintenance_bay_hero",
    lightRigKey: "light_rig_maintenance_bay_lockdown",
    decalSetKey: "hp_level01_shadow_grime_decal_atlas",
    defaultHeroSetPieces: ["hero_maintenance_repair_bay", "hero_maintenance_repair_arm_cluster"],
    defaultBackdrops: ["backdrop_robot_storage_window_dark"]
  }
}
```

### 6.6 最终效果

这样一个 config 就能自由定义：

```text
房间是什么主题
有哪个 hero set piece
光效是什么导演预设
出口目标被什么光强调
哪些地方有背景玻璃/机器人仓
有多少阴影脏污
哪些道具是碰撞/哪些只是气氛
```

但不会允许：

```text
随机 RGB 光污染
每个物品换风格
摆件挡住通路
一个房间放 40 个高模 GLB
玩家生成关卡破坏游戏美术统一性
```

### 6.7 第一关推荐 config 最终形态

```ts
{
  id: "maintenance_bay_floor",
  label: "维修主舱",
  bounds: { center: [0, 0, -3.2], size: [18, 4, 25] },
  mood: "combat",
  skinKey: "maintenance_bay_hero",
  visualDirector: {
    key: "maintenance_bay_lockdown",
    intensity: "high",
    darkness: "dark",
    targetDoorId: "service_elevator_door",
    heroMoment: "wake_up"
  },
  lightRig: { key: "light_rig_maintenance_bay_lockdown" },
  decalSet: { key: "hp_level01_shadow_grime_decal_atlas", density: "high" },
  backdrops: [{ id: "robot_storage", modelKey: "backdrop_robot_storage_window_dark", wall: "west" }],
  heroSetPieces: [
    { id: "wake_table", modelKey: "hero_maintenance_repair_bay", position: [-2.8, 0, 6.8], yaw: 0.25 },
    { id: "repair_arms", modelKey: "hero_maintenance_repair_arm_cluster", position: [-4.1, 0, 5.8], yaw: 0.4 }
  ],
  roomProps: [
    { id: "left_half_panel", modelKey: "room_wall_occluder_maintenance_half_panel", position: [-6.6, 0, 1.2], yaw: 1.57, collision: true },
    { id: "right_half_panel", modelKey: "room_wall_occluder_maintenance_half_panel", position: [6.8, 0, -2.6], yaw: -1.57, collision: true },
    { id: "elevator_red_light", modelKey: "door_service_elevator_red_lockdown_light_kit", attachToDoorId: "service_elevator_door" }
  ]
}
```

如果先不扩 schema，短期也能用：

```ts
skinKey: "maintenance_bay_hero"
aesthetic: { style: "maintenance", detail: "high" }
```

然后 renderer 内部自动套 `maintenance_bay_lockdown`。这是最快能提升画面的做法。

### 6.8 最小实现步骤

1. 扩 `LevelRoomDefinition`：加 `visualDirector / lightRig / decalSet / backdrops / heroSetPieces / roomProps`。
2. 加 `RoomVisualDirectorProfiles.ts`：存 curated preset。
3. 加 validator：检查 key、bounds、door ref、generated 权限和 mobile cost。
4. renderer 加 `RoomDirectorLayer`：负责光、贴花、hero set piece、backdrop、occluder。
5. 第一关 config 改用 `maintenance_bay_lockdown`。
6. 跑 `smoke:campaign` 和真实 1-5 QA。

## 7. Asset Robot Prompt

可以直接把下面这段给 asset 机器人：

```ts
room.skinKey === "maintenance_bay_hero"
```

挂上这套 asset。

推荐 light rig key：

```json
{
  "lightRigKey": "light_rig_maintenance_bay_lockdown",
  "ambient": 0.15,
  "fogColor": "#03070a",
  "fogNear": 12,
  "fogFar": 42,
  "lights": [
    { "type": "point", "color": "#ff4438", "position": [0, 2.6, -13.8], "intensity": 2.2, "distance": 8 },
    { "type": "point", "color": "#64d7ff", "position": [-5.6, 2.4, 0.5], "intensity": 0.9, "distance": 10 },
    { "type": "point", "color": "#7ff2ff", "position": [3.8, 1.4, 5.2], "intensity": 0.55, "distance": 5 }
  ],
  "emissiveGroups": ["cyan_medical_strips", "red_elevator_lockdown"],
  "decalSetKey": "hp_level01_shadow_grime_decal_atlas",
  "volumetricCardSetKey": "hp_level01_volumetric_light_cards"
}
```

## 7. Asset Robot Prompt

可以直接把下面这段给 asset 机器人：

```text
Create the first-level lighting and hero-set-piece asset pack for Human Protocol, a first-person sci-fi horror escape game.

The level is called Maintenance Bay 01. The player wakes up thinking they are human. The room should feel like a dark robot maintenance/medical bay under emergency lockdown, not a bright test hall.

Build these commercial-safe original assets:
1. hero_maintenance_repair_bay: dark industrial repair bed / maintenance table with cyan medical strips, restraint rails, cable sockets, and dirty gunmetal panels.
2. hero_maintenance_repair_arm_cluster: ceiling/side mounted industrial repair arms, one clamp tool and one scanner tool, amber fault light, slow-horror maintenance feeling.
3. backdrop_robot_storage_window_dark: glass wall with robot storage silhouettes behind it, cold cyan vertical lights, a few tiny red warning dots, mostly dark.
4. room_wall_occluder_maintenance_half_panel: side occluder panels to break up the open room and cast shadows.
5. door_service_elevator_red_lockdown_light_kit: red lockdown light strips and floor reflection cards for the elevator exit.
6. A reusable light fixture set: cyan ceiling flicker strip, cyan wall medical strip, red fault light, broken cyan floor guide, red floor reflection card.
7. hp_level01_shadow_grime_decal_atlas.webp: contact shadows, oil smears, wet floor patches, scratches, cable shadows, worn warning stripes, glass dirt.
8. hp_level01_volumetric_light_cards.webp: soft cyan side haze, red elevator haze, sparse dust motes, screen glow, ceiling bloom streak.

Art direction: cold dark sci-fi maintenance facility, high contrast, black-blue shadows, limited cyan medical light, limited red lockdown light, wet metal floor, glass, worn industrial panels. No gore, no readable copyrighted logos, no military mech style, no cute service robot style. The horror comes from repair logic and emergency lockdown.

Export GLB models with meter scale, clean pivots, no cameras/lights, no hidden source geometry. Deliver a JSON manifest with modelKey, file path, sizeMeters, pivot, category, collision hint, parts, material slots, atlas path, mobileCost, and tags.
```

## 8. Acceptance QA

Asset robot 交付前必须给：

1. 第一关暗光 mood screenshot：无 UI，玩家视角，能看到维修床/机械臂/红电梯。
2. Asset 单体截图：维修台、机械臂、机器人仓、电梯红灯、灯具、贴花 atlas。
3. 移动端横屏截图：`844x390`，确保不是一团黑，也不是一片蓝。
4. GLB 检查：无 camera/light/隐藏源 mesh，pivot 正确，尺寸以米为单位。
5. 贴花检查：contact shadow 能让现有 GLB 接地。
6. 光效检查：红色只服务电梯目标，青色只服务维修身份，大面积仍然保持黑暗。
