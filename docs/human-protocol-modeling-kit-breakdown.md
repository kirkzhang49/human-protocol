# Human Protocol Modeling Kit Breakdown

这份文档给建模 agent 使用。目标不是为 5 个关卡分别做 5 个巨大的整块场景，而是把大型建筑、房间、门、道具全部拆成可以被 config 复用的模块。这样当前 5 关能快速变高级，后期本地 LLM 生成关卡时也能继续用同一套资产。

当前最急的交付清单见 `docs/human-protocol-current-asset-requirements.md`。本文档负责“怎么拆”，那份文档负责“现在先做哪些 key”。

核心原则：

- 大建筑不能整块导出成一个巨大 GLB。
- 可游玩碰撞、远景背景、灯光气氛、交互道具必须分开。
- 每个资产都要能被 `skinKey`、`visualKey` 或未来 `modelKey` 引用。
- 同一套 layout 换不同 skin，就能变成维修舱、居住模拟间、博物馆、诊所或回收核心。

## 1. 大建筑拆分规则

大型建筑要拆成 6 层，不要合成一体：

| 层级 | 用途 | 是否碰撞 | 是否高细节 | 示例 |
| --- | --- | --- | --- | --- |
| Building Backdrop | 远景和窗外大空间 | 否 | 中 | 玻璃后机械臂、远处机器人仓、核心深井 |
| Room Shell | 玩家所在房间壳体 | 是 | 高 | 墙、地、天花、角柱 |
| Door Bay | 门洞和门体 | 是 | 高 | 门框、滑门、门禁面板、状态灯 |
| Hero Set Piece | 每关记忆点大件 | 通常否或简化 | 高 | 维修台、家庭门禁、中央档案、治疗剧场、回收内台 |
| Gameplay Props | 玩家会靠近/绕行/拾取 | 是或简化 | 中高 | 终端、钥匙、展柜、治疗椅、急救包 |
| Decal/Light Layer | 低成本质感层 | 否 | 低面高质感 | 警示线、地面顺序、编号、污渍、灯带 |

判断标准：

- 玩家会撞到的东西，必须有简单 collision proxy。
- 玩家只是看到的东西，优先做 backdrop 或 decal。
- 会开关、掉落、拾取、被打的东西，必须独立模型。
- 一眼决定关卡质感的东西，做 hero set piece。

## 2. 通用网格和尺寸

当前 config 房间高度基本是 `4m`，门高约 `3.1m-3.5m`。建模按这个尺度做：

```text
1 unit = 1 meter
standard wall height = 4m
standard door height = 3.2m
standard small room = 7m x 7m
standard large room = 16m-19m wide
standard corridor / connector depth = 4m-8m
```

模块最好按 1m 或 2m 网格吸附：

- Floor tile: `2x2`, `4x4`, `8x4`
- Wall panel: `2x4`, `4x4`, `6x4`
- Door bay: `4x4`, `5x4`, boss door `6x4`
- Ceiling panel: `4x4`, `8x4`
- Corner pillar: `0.4x4x0.4`

Pivot 规则：

- 房间 shell 模块 pivot 在地面中心。
- 门模块 pivot 在门洞中心，门板可拆成 left/right 或 up/down 动画分件。
- 小道具 pivot 在底部中心，方便放到地面。
- 墙面道具 pivot 在背面中心，方便贴墙。

## 3. 必做的通用建筑 Kit

### 3.1 Room Shell Kit

这套是所有关卡共用的骨架。

| Asset Key | 内容 | 用途 |
| --- | --- | --- |
| `room_floor_panel_2x2` | 金属地板小块 | 小房间拼接 |
| `room_floor_panel_4x4` | 金属地板大块 | 大厅拼接 |
| `room_floor_drain_strip` | 排水槽/线缆槽 | 维修舱、核心 |
| `room_floor_guide_line` | 导向线条 | 指引玩家去门 |
| `room_wall_plain_2m` | 普通墙板 | 所有关卡 |
| `room_wall_glass_4m` | 玻璃观察窗墙 | 维修舱、博物馆、核心 |
| `room_wall_light_strip_2m` | 带竖灯墙板 | 高级科幻感 |
| `room_wall_pipe_2m` | 带管线墙板 | 维修/回收主题 |
| `room_corner_pillar` | 角柱/结构柱 | 打破方盒子 |
| `room_ceiling_light_panel` | 顶部灯格 | 所有关卡 |
| `room_ceiling_rail` | 天花机械轨道 | 维修舱/诊所/核心 |

### 3.2 Door Kit

门必须明显、可读、可换皮。

| Asset Key | 视觉 | 当前对应 |
| --- | --- | --- |
| `door_service_elevator` | 厚重维修电梯门，冷青状态灯 | `service_elevator_hero` |
| `door_residential_clean` | 干净模拟家庭门，暖白+冷青 | `residential_access_clean` |
| `door_yellow_access` | 黄黑权限门，工业锁 | `yellow_access_service` |
| `door_red_lockdown` | 红色封锁门，危险状态 | `red_locked_blast` |
| `door_archive_gate` | 博物馆/档案门，大中缝 | `museum_archive_gate` |
| `door_clinic_soft_lock` | 诊所门，白色医疗灯 | `clinic_soft_lock` |
| `door_identity_archive` | 终局白光档案舱门 | `identity_archive_door` |

每个门至少拆成：

- `frame`
- `left_panel`
- `right_panel`
- `status_light`
- `access_panel`
- `collision_proxy`

门禁面板单独建模，未来可以通过 config 改位置：

```ts
panelPosition: [x, 0, z]
```

### 3.3 Interaction Props Kit

这些是 5 关都要复用的交互物。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `pickup_large_yellow_key` | 大钥匙/门禁模块 | 必须像急救包一样大，远处能看到 |
| `pickup_archive_chip` | 档案芯片 | 可换色：工具/声纹/身体 |
| `pickup_repair_kit` | 急救包 | 明确红/白医疗读法，不叫维修包 |
| `pickup_core_cell` | 应急电池 | 黄色发光柱/电池 |
| `terminal_wall_cyan` | 普通终端 | 门禁/读取 |
| `terminal_wall_red` | 危险终端 | 出口/封锁 |
| `exit_panel` | 终点交互面板 | 必须和普通终端区分 |
| `puzzle_orb_set` | 红/蓝/绿/黄/白球 | 可被枪和铁棒命中 |
| `floor_sequence_marker` | 地面颜色顺序 | 用 decal 或很薄实体条 |
| `wall_digit_marker` | 墙面数字/方向提示 | 密码锁线索 |

### 3.4 Hero Set Piece Kit

每个关卡至少一个 hero set piece，让玩家记住这个房间。

| Asset Key | 关卡 | 内容 |
| --- | --- | --- |
| `hero_maintenance_repair_bay` | Level 01 | 维修台、机械臂、玻璃后机器人仓 |
| `hero_residential_false_home` | Level 02 | 假客厅、无脸相框、家庭门禁 |
| `hero_museum_body_case` | Level 03 | 白色身体展柜、灯球、档案芯片台 |
| `hero_clinic_memory_chair` | Level 04 | 治疗椅、投影环、诊疗机械臂 |
| `hero_reclamation_core_platform` | Level 05 | 回收内台、三锁臂、核心机械臂 |

Hero set piece 可以更高细节，但仍然要分件，不能烘成一整坨：

- base/platform
- vertical frame
- screen/glass
- lights
- moving arm/tool
- decal plates
- collision proxy

## 4. Room Skin 列表

当前代码已有部分 `room.skinKey / door.skinKey`。建模 agent 可以按下面的目标补齐模型皮肤。

| Skin Key | 视觉方向 | 适用关卡 |
| --- | --- | --- |
| `maintenance_bay_hero` | 冷青维修舱、湿金属地面、玻璃后机械臂 | Level 01 主舱 |
| `maintenance_service` | 普通维修通道、管线、线缆、诊断台 | Level 02/03/05 复用 |
| `service_exit_red` | 红色出口/封锁门区域 | Level 01 电梯、后续出口 |
| `residential_sim_dark` | 假居住空间包在实验室里 | Level 02 |
| `museum_gallery` | 展柜、冷白灯、标签、玻璃 | Level 03 |
| `sterile_blue_lab` | 无菌蓝白实验室/诊所墙面 | Level 03/04/05 |
| `memory_clinic` | 医疗候诊厅、治疗灯、投影屏 | Level 04 |
| `hazard_yellow_service` | 黄黑危险维修间 | Level 02 Boss 房、Level 05 |
| `red_reclamation_core` | 红色核心回收区、重工业内台 | Level 05 |
| `identity_archive_white` | 白光档案舱、极简冷白空间 | Level 05 结尾 |

## 5. 当前 5 关拆分表

### Level 01 - 维修舱

当前 config 房间：

- `maintenance_bay_floor`：维修主舱
- `service_elevator_room`：维修电梯

需要模型：

| 类型 | Asset Key | 说明 |
| --- | --- | --- |
| Room Shell | `skin_maintenance_bay_hero_shell` | 第一关最高优先级，地面/墙/天花都要高级 |
| Backdrop | `backdrop_robot_storage_window` | 玻璃后机器人仓，不碰撞 |
| Hero Prop | `hero_maintenance_repair_bay` | 维修台+机械臂，提供压迫感 |
| Door | `door_service_elevator` | 第一关出口门 |
| Pickup | `pickup_iron_rod_world` | 开局铁棒地面拾取物 |
| Pickup | `pickup_pistol_world` | 开局手枪地面拾取物 |
| Props | `prop_diagnostic_console`, `prop_cable_spine`, `prop_supply_crate` | 可做少量碰撞 |

第一关是 demo 门面。这里允许最高质量：

- 房间 skin 走 `maintenance_bay_hero`
- 门 skin 走 `service_elevator_hero`
- 玻璃后远景可用低面 backdrop 加 emissive 灯条
- 维修台/机械臂不要挡玩家主通道

### Level 02 - 居住模拟间

当前 config 房间：

- `level_02_recovery_foyer`：恢复前厅
- `level_02_living_room`：生活模拟大厅
- `level_02_care_room`：家政维修间
- `level_02_light_room`：家庭灯控室

需要模型：

| 类型 | Asset Key | 说明 |
| --- | --- | --- |
| Room Skin | `skin_residential_sim_dark_shell` | 生活模拟大厅，假家被实验室包住 |
| Room Skin | `skin_hazard_yellow_service_shell` | 家政维修间/Boss 小房间 |
| Room Skin | `skin_sterile_blue_lab_shell` | 灯控室 |
| Hero Prop | `hero_residential_false_home` | 沙发、无脸相框、假窗、家庭门禁 |
| Door | `door_residential_clean` | 生活区门、小房间门 |
| Door | `door_red_lockdown` | 家庭门禁/出口 |
| Puzzle | `puzzle_lamp_warm_white_blue` | 暖/白/蓝三个灯球 |
| Clue | `floor_sequence_marker_rgb` | 地面顺序提示，必须明显 |
| Pickup | `pickup_large_yellow_key` | Boss 掉落大钥匙 |

注意：

- 大厅是战斗空间，家具只能贴边或做低碰撞。
- 小房间门要足够宽，Boss 不能被门框卡住。
- 家庭门禁要像“出口”，不要像普通房门。

### Level 03 - 人类博物馆

当前 config 房间：

- `level_03_entry_hall`：博物馆入口
- `level_03_gallery_lobby`：主展厅
- `level_03_tool_exhibit`：工具展厅
- `level_03_voice_exhibit`：声纹展厅
- `level_03_body_exhibit`：身体展厅
- `level_03_central_archive`：中央档案室
- `level_03_exit_room`：后展厅门

需要模型：

| 类型 | Asset Key | 说明 |
| --- | --- | --- |
| Room Skin | `skin_museum_gallery_shell` | 展厅墙、灯箱、玻璃展柜语言 |
| Exhibit | `exhibit_tool_case` | 铁棒/工具展柜 |
| Exhibit | `exhibit_voice_case` | 声纹/录音展柜，可用波形灯 |
| Exhibit | `hero_museum_body_case` | 白色身体展柜，Level03 记忆点 |
| Door | `door_archive_gate` | 中央档案门 |
| Door | `door_yellow_access` | 左右展厅门 |
| Pickup | `pickup_archive_chip_tool` | 工具档案 |
| Pickup | `pickup_archive_chip_voice` | 声纹档案 |
| Pickup | `pickup_archive_chip_body` | 身体档案 |
| Puzzle | `puzzle_orb_white_blue_red` | 身体展柜灯球 |
| Boss Room | `hero_central_archive_core` | 档案室中台/红色封锁 |

注意：

- 博物馆不要像普通实验室，要有“展品被管理”的感觉。
- 展柜玻璃可以用简单透明材质，但 mobile 上要控制透明层数量。
- 文字不要多，优先用符号、编号块、灯光顺序。

### Level 04 - 记忆诊所

当前 config 房间：

- `level_04_waiting_room`：诊所候诊厅
- `level_04_childhood_chair`：童年治疗椅
- `level_04_rescue_chair`：救援治疗椅
- `level_04_body_chair`：身体治疗椅
- `level_04_therapy_theater`：治疗剧场
- `level_04_exit_room`：诊所后门

需要模型：

| 类型 | Asset Key | 说明 |
| --- | --- | --- |
| Room Skin | `skin_memory_clinic_waiting_shell` | 候诊厅，冷白医疗感 |
| Room Skin | `skin_memory_clinic_chair_room` | 三个治疗椅房间共用 |
| Hero Prop | `hero_clinic_memory_chair` | 治疗椅主体，换灯色复用三次 |
| Prop | `prop_projection_ring` | 记忆投影环 |
| Prop | `prop_medical_screen_wall` | 墙面治疗屏 |
| Door | `door_clinic_soft_lock` | 诊所门 |
| Door | `door_red_lockdown` | 治疗剧场/后门 |
| Boss Room | `hero_therapy_theater_core` | 圆形诊疗场、机械臂、红光 |

注意：

- 三个治疗椅房间不要分别做三套模型。用同一个 chair room，换灯色和少量 props。
- 候诊厅要安静，治疗剧场要压迫，形成节奏差。
- 治疗椅是这一关的核心资产，优先级高。

### Level 05 - 回收核心

当前 config 房间：

- `level_05_core_entry`：核心入口
- `level_05_lock_hub`：回收中庭
- `level_05_north_lock`：北侧制动间
- `level_05_east_lock`：东侧供能间
- `level_05_west_lock`：西侧回收间
- `level_05_platform`：回收内台
- `level_05_identity_file`：身份档案舱

需要模型：

| 类型 | Asset Key | 说明 |
| --- | --- | --- |
| Room Skin | `skin_red_reclamation_core_shell` | 红色回收核心主视觉 |
| Hub | `hero_three_lock_hub` | 北/东/西三方向锁臂可视化 |
| Lock Room | `lock_room_core_variant` | 三个锁房共用，换颜色/终端 |
| Door | `door_red_lockdown` | 回收中庭/锁房门 |
| Door | `door_core_platform_gate` | 回收内台大门 |
| Door | `door_identity_archive` | 身份档案舱门 |
| Hero Prop | `hero_reclamation_core_platform` | 最终 Boss 平台 |
| Backdrop | `backdrop_reclamation_core_depth` | 核心深井/巨大机械臂 |
| Puzzle | `puzzle_orb_blue_yellow` | 北侧制动序列 |
| Pickup | `pickup_lock_key_north/east/west` | 三个解除钥 |
| Exit | `hero_identity_archive_file` | 白光档案读取台 |

注意：

- Level05 可以最像大建筑，但仍要拆。中庭、三锁房、内台、档案舱分别是 room shell。
- 核心深井和巨大机械臂做 backdrop，不碰撞。
- 回收内台是 Boss arena，地面必须干净，不能堆太多 props 卡移动。

## 6. Config 映射方式

现在能直接映射：

```ts
room.skinKey = "maintenance_bay_hero";
door.skinKey = "service_elevator_hero";
interaction.visualKey = "exit_panel";
keyItem.visualKey = "large_yellow_key";
puzzle.targets[].visualKey = "puzzle_orb_blue";
```

未来建议加：

```ts
room.modelKitKey = "kit_maintenance_bay";
room.heroSetPieceKey = "hero_maintenance_repair_bay";
door.modelKey = "door_service_elevator";
prop.modelKey = "prop_diagnostic_console";
```

资产 manifest 可以这样组织：

```ts
{
  modelKey: "door_service_elevator",
  file: "/assets/models/doors/door_service_elevator.glb",
  collider: "box",
  lod: ["high", "low"],
  textureAtlasKey: "facility_doors_atlas",
  tags: ["door", "service", "hero"]
}
```

## 7. Texture / Material 拆分

不要每个模型一张 2K 图。推荐 5 张 atlas：

| Atlas | 尺寸建议 | 覆盖 |
| --- | --- | --- |
| `facility_trim_atlas` | 1024 | 墙边、灯条、警示线、金属边 |
| `floor_wall_surface_atlas` | 1024 | 地面磨损、墙面板线、污渍 |
| `door_terminal_atlas` | 1024 | 门、门禁、终端屏幕 |
| `props_pickups_atlas` | 1024 | 钥匙、急救包、电池、芯片 |
| `hero_setpiece_atlas` | 1024-2048 | 维修台/治疗椅/核心平台等 hero 大件 |

Mobile-first 预算：

- 普通 modular piece 单个 GLB：`10KB-80KB`
- 门：`40KB-180KB`
- 小交互物：`20KB-120KB`
- Hero set piece：`150KB-600KB`
- Level01 hero 房间总新增模型+贴图目标：先控制在 `2MB-4MB`
- 5 关全套第一版目标：先控制在 `8MB-14MB`

## 8. LOD 和性能规则

每个资产按距离分级：

| 距离 | 显示 |
| --- | --- |
| 0-8m | 完整模型、主要贴花、状态灯 |
| 8-18m | 隐藏小贴花、小螺丝、复杂线缆 |
| 18m+ | 保留大轮廓和发光点，细节关掉 |

规则：

- 透明材质只用于玻璃、灯罩，不能到处用。
- 小灯优先 emissive 材质，不要大量真实 point light。
- 同类墙板、地板、门框优先复用同一材质。
- 背景大建筑不要加复杂碰撞。
- 复杂机械臂只在 hero 房间或 backdrop 里出现。

## 9. 建模交付命名

建议目录：

```text
assets/models/environment/
  room_shell/
  doors/
  props/
  hero_setpieces/
  backdrops/
  colliders/

assets/textures/environment/
  facility_trim_atlas.webp
  floor_wall_surface_atlas.webp
  door_terminal_atlas.webp
  props_pickups_atlas.webp
  hero_setpiece_atlas.webp
```

命名格式：

```text
hp_[category]_[theme]_[name]_[size_or_variant].glb
```

示例：

```text
hp_door_service_elevator_5m.glb
hp_room_maintenance_wall_glass_4m.glb
hp_prop_pickup_large_yellow_key.glb
hp_hero_clinic_memory_chair_a.glb
hp_backdrop_reclamation_core_depth_a.glb
```

## 10. 交付优先级

### Phase 1 - 第一关立刻变高级

必须先做：

1. `door_service_elevator`
2. `skin_maintenance_bay_hero_shell` 的地/墙/天花基础模块
3. `hero_maintenance_repair_bay`
4. `backdrop_robot_storage_window`
5. `pickup_iron_rod_world`
6. `pickup_pistol_world`
7. `prop_diagnostic_console`
8. `prop_supply_crate`

验收：

- 第一眼能看出是高级维修舱，不是方盒 arena。
- 门是门，出口一眼看懂。
- 铁棒和手枪是实体道具。
- 玩家移动路线不被道具卡住。

### Phase 2 - 5 关共用门/交互物

做：

1. 7 种门 skin
2. 大黄色钥匙
3. 档案芯片
4. 急救包
5. 应急电池
6. 颜色球
7. 终端/出口面板

验收：

- Level02 钥匙远处可见。
- Level03 三种芯片可区分。
- Level04 读取终端和普通门禁不混淆。
- Level05 三个解除钥有同系列但不同颜色。

### Phase 3 - 后 4 关 hero set piece

做：

1. `hero_residential_false_home`
2. `hero_museum_body_case`
3. `hero_clinic_memory_chair`
4. `hero_reclamation_core_platform`
5. `hero_identity_archive_file`

验收：

- 每关至少有一个能截图传播的视觉记忆点。
- 同一套 room shell 换 set piece 后，玩家觉得进入了新区域。

### Phase 4 - 长期本地 LLM 生成关卡

做：

1. 更多 wall/floor/ceiling variants。
2. 可随机组合的 prop clusters。
3. 自动生成用的 asset tags。
4. 每个 modelKey 的预算、碰撞、适用 room mood。

示例 tags：

```text
theme: maintenance/residential/museum/clinic/core
roomMood: quiet/combat/boss/reveal/uneasy
placement: floor/wall/ceiling/backdrop/door
collision: none/simple/blocker
mobileCost: low/medium/high
```

## 11. 建模验收 Checklist

每个模型交付前检查：

- 尺寸是米制，和 4m 房高匹配。
- pivot 正确，能被 config 放到房间里。
- 命名稳定，不含中文路径和空格。
- 材质数量少，贴图可 atlas 化。
- 没有隐藏相机、灯光、未用 mesh。
- 提供 low-poly collision proxy，或说明不需要碰撞。
- 远处看有清晰轮廓，近处看有细节。
- 不包含真实品牌、真实游戏/电影 IP、真实 logo。
- 能压缩：`prune/dedup/weld/simplify/meshopt` 后不破坏外观。

## 12. 最重要的判断

如果建模 agent 时间有限，优先顺序是：

```text
第一关维修舱 hero 质量
> 门和钥匙的可读性
> 交互物实体感
> 后四关 hero set piece
> 其他墙面变化
```

因为玩家第一眼、第一扇门、第一把铁棒、第一次捡钥匙，会决定他是否相信这个游戏是高级的。
