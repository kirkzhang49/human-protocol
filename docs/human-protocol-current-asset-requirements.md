# Human Protocol Current Asset Requirements

这份文档给建模 / 美术 agent 使用，记录当前 config 系统已经需要的资产。它补充 `human-protocol-modeling-kit-breakdown.md`，重点是：哪些资产现在最值得做，做成什么 key，怎么接进 config。

## 1. 当前最高优先级

按投入产出排序：

1. 第一人称手臂、铁棒、手枪
2. 第一关维修舱光效、维修台、机械臂、红色电梯封锁和阴影贴花
3. 门、门禁、门组开关
4. 关键交互物：档案书、问答面板、钥匙、急救包、应急电池
5. 5 关房间 kit 和 hero set piece
6. 敌人机器人外形和 texture atlas

原因：

- 玩家一直看着自己的手和武器。
- 第一关是 demo 门面。现在最缺的是暗光密室导演，而不是更多随机 GLB。
- 密室游戏里门和开关决定可读性。
- 交互物如果不像实体，玩家会觉得系统是假的。
- 房间 kit 决定 Steam 质感。
- 机器人重要，但可以先用低模 + 贴图 + 灯条撑住。

第一关光效和 asset 细则见：

```text
docs/human-protocol-level01-lighting-asset-handoff.md
```

## 2. 第一人称 Hero Kit

这是当前最值得做好的资产，因为玩家全程都在看自己的手、铁棒和手枪。它们即使面数不高，也必须有材质层次、合理比例和动画空间。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `fp_arm_left_sleeve_glove` | 左手臂 | 白色实验服袖口、黑色战术手套、低血可加轻微污渍变体 |
| `fp_arm_right_sleeve_glove` | 右手臂 | 同上，手枪握持和铁棒扶持都要自然 |
| `weapon_iron_pipe_hero` | 主近战武器 | 旧实验室铁棒 / 管钳感，粗、重、有磨损和缠布 |
| `weapon_iron_pipe_swing_blur` | 挥击残影网格 | 半透明短命 mesh，不用真实运动模糊也能有爽感 |
| `weapon_pistol_service_hero` | 手枪 | 工业维修区捡到的短枪，白灰黑机能外壳，避免玩具感 |
| `weapon_pistol_magazine` | 弹匣 | 换弹动画可分离，20 发弹匣设定要看得懂 |
| `weapon_muzzle_flash_card` | 枪口火光 | 低成本 billboard，2-3 张 atlas frame |
| `fp_empty_hands_pose` | 开局空手 | 一开始未捡武器时用，支持剧情“先捡铁棒和手枪” |

建议动画 clip：

```text
empty_idle
pickup_pipe
pickup_pistol
pipe_idle
pipe_swing_left
pipe_swing_right
pipe_heavy_recover
pistol_idle
pistol_fire_recoil
pistol_reload_long
low_health_breath
damage_flinch
dash_sway
```

预算：

- 两只手臂合计 `<350KB` GLB，贴图用 `fp_arm_weapon_atlas.webp`。
- 铁棒 `<120KB`，手枪 `<180KB`，弹匣 `<40KB`。
- 武器 atlas 先用 `1024` WebP，移动端可降到 `512`。
- 动画优先保留挥棒、开枪、换弹、受击；复杂手指可以后面补。

## 3. 拾取物和可读交互物 Kit

这些物品必须“像真的掉在地上”，不能只像 UI 图标。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `pickup_large_yellow_key` | 大钥匙 / 门禁模块 | 和急救包接近体量，黄色灯条，一眼能看到 |
| `pickup_medkit_white_red` | 急救包 | 白色硬盒，红色急救符号，低血掉落要很明显 |
| `pickup_energy_cell_amber` | 应急电池 / 能量罐 | 透明或半透明黄光芯，适合 Boss 战前诱导玩家 |
| `pickup_memory_chip_cluster` | 记忆芯片 | 少量发光芯片，不要满地碎片 |
| `pickup_ammo_magazine` | 手枪弹匣 | 可作为后续关卡资源掉落 |
| `prop_small_floor_shadow_disc` | 统一落地阴影 | 低成本帮助所有拾取物贴地 |

拾取物默认尺寸：

```text
key module: 0.75m x 0.28m x 0.45m
med kit: 0.62m x 0.34m x 0.42m
energy cell: 0.42m x 0.42m x 0.9m
chip cluster: 0.45m x 0.08m x 0.34m
```

## 4. 敌人与房间 Kit

敌人不建议每个 tier 都重新建模。当前 config 已经有 `normal / elite / leader / boss` 分级，建模上用同一基础 mesh 加装甲片、灯色、贴花和 scale 变化即可。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `enemy_repair_drone_base` | 维修无人机 | 小、快、脆，蓝扫描眼，细维修臂 |
| `enemy_clamp_repair_base` | 夹具维修机器人 | 宽、低、重，双夹臂，黄黑警示条 |
| `enemy_custodian_platform_base` | 维修主管 / Boss | 叉车 + 手术机械臂 + 工业维修台轮廓 |
| `enemy_tier_armor_elite` | 精英装甲件 | 可套在小怪上，红/黄状态灯 |
| `enemy_tier_armor_leader` | 头领装甲件 | 更高肩甲或背部维护核心 |
| `enemy_boss_mechanical_arm_set` | Boss 机械臂组 | 只给 Boss 近距离显示，远处可关 |

Texture atlas：

```text
enemy_repair_atlas_512.webp
enemy_clamp_atlas_512.webp
enemy_boss_atlas_1024.webp
enemy_decal_warning_atlas_512.webp
```

5 关 room kit 当前优先级：

| Kit Key | 对应关卡 | 视觉重点 |
| --- | --- | --- |
| `kit_maintenance_bay_hero` | Level01 | 湿金属地面、维修舱、红色电梯门、机械臂远景 |
| `kit_residential_sim_dark` | Level02 | 假生活区、温暖家具被冷金属包围 |
| `kit_human_museum_archive` | Level03 | 展柜、编号、人类物件被收藏的压迫感 |
| `kit_memory_clinic_sterile` | Level04 | 治疗椅、白蓝无菌灯、记忆投影墙 |
| `kit_reclamation_core_red` | Level05 | 回收核心、身份档案、红色危险光、深井空间 |

## 5. 新增系统需要的资产

### 5.1 Door Switch Kit

用于 `switches[]` config。一个开关可以开门、关门、锁门、解锁出口。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `switch_panel_wall_cyan` | 普通门组开关 | 墙面或立柱面板，青色待机灯 |
| `switch_panel_wall_red` | 危险开关 | 红色封锁灯，适合回收核心 |
| `switch_panel_floor_lever` | 地面大开关 | 比普通终端更像“真的切换了门组” |
| `switch_state_light_cyan` | 状态灯 | 可贴在门旁或开关旁 |
| `switch_state_light_amber` | 状态灯 | 用于路线 B / 警告 |
| `switch_state_light_red` | 状态灯 | 用于锁死/危险 |

尺寸建议：

```text
wall switch panel: 0.7m x 1.1m x 0.18m
floor lever base: 0.9m x 0.35m x 0.7m
state light strip: 0.12m x 0.75m x 0.04m
```

Pivot：

- 墙面面板：背面中心，方便贴墙。
- 地面开关：底部中心。
- 灯条：背面中心。

材质：

- 一个共享 atlas：`switch_panel_atlas.webp`
- emissive 灯条颜色由材质参数或小贴图控制。
- 不要做文字按钮，优先做图形符号和状态灯。

### 5.2 Archive Reading Kit

用于 `articles[]` config。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `prop_archive_book_open` | 地上/桌上的打开档案 | 比普通终端更像实体书或实验夹板 |
| `prop_archive_folder_stack` | 档案堆 | 可做环境叙事，不一定交互 |
| `terminal_archive_reader` | 档案读取台 | 博物馆、诊所、回收核心通用 |
| `decal_archive_label_plate` | 档案编号牌 | 少文字，用 H-0 / A-13 这类符号 |

尺寸建议：

```text
archive book open: 0.85m x 0.12m x 0.55m
archive reader terminal: 0.9m x 1.2m x 0.38m
folder stack: 0.75m x 0.22m x 0.5m
```

当前代码已经有低成本 fallback：`visualKey: "archive_book"`。未来接 GLB 时建议映射：

```ts
interaction.modelKey = "prop_archive_book_open"
```

### 5.3 Quiz / Code Panel Kit

用于 `quizzes[]` 和 `code_lock`。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `terminal_quiz_panel_cyan` | 普通问答/校验面板 | 3-5 选项 UI 打开前的实体入口 |
| `terminal_quiz_panel_red` | 危险校验面板 | 答错会刷怪的红色版本 |
| `terminal_code_keypad` | 密码锁面板 | 方位数字输入 |
| `terminal_direction_ring` | 东西南北提示环 | Level04/未来密码锁 |

注意：

- 这些模型只表示“这里可以打开 UI”，不要在模型上写完整题目。
- 面板要和普通门禁有区别：更多输入键、中心屏幕、状态灯。
- mobile 远处轮廓必须明显，不要太薄。

### 5.4 Puzzle Big Screen / TV Kit

用于 `bigScreens[]` config。第四关已经用 `level_04_body_formula_screen`，自由测试关 `smoke_big_screen_formula_combo` 也在验证“屏幕颜色顺序 -> 打球 -> 公式屏 -> 密码门禁”。

| Asset Key | 用途 | 要求 |
| --- | --- | --- |
| `terminal_puzzle_big_screen` | 通用大屏/电视线索 | 墙面或短支架大屏，黑金属边框，屏幕可暗/亮 |
| `terminal_puzzle_big_screen_low` | 远景低模 | 保留轮廓、屏幕面、状态灯 |
| `screen_socket_wall_mount` | 屏幕墙挂件 | 可复用在诊所、实验室、回收核心 |
| `screen_power_button_module` | 电源按钮/小状态灯 | 适合玩家靠近互动 |

推荐尺寸：

```text
big screen: 2.4m x 1.3m x 0.18m
wall mount: 0.55m x 0.35m x 0.14m
power button: 0.18m x 0.18m x 0.05m
```

Pivot：

- 大屏：背面中心，方便贴墙。
- 如果做带支架版本，另给 `terminal_puzzle_big_screen_stand`，pivot 在地面中心。

需要支持的显示状态：

```text
off
digits
color_sequence
formula
text
```

建模不需要把文字和数字烘进贴图。屏幕内容由 runtime `Text` / 低成本色块渲染，资产只需要提供：

```text
screen_off_panel
screen_on_panel
power_button
status_off_lens
status_on_lens
content_surface
optional_color_slot_01..05
optional_digit_slot_01..04
```

当前 config 链接样例：

```ts
bigScreens: [{
  modelKey: "terminal_puzzle_big_screen",
  visualKey: "terminal_puzzle_big_screen",
  interactionId: "level_04_body_screen_interaction",
  states: [{ id: "off", mode: "off" }, { id: "formula_hint", mode: "formula" }]
}]
```

## 6. Door Kit 增强要求

门现在不仅要打开，还要表达状态：

| 状态 | 视觉 |
| --- | --- |
| open | 门洞清晰，门板收起或分离 |
| closed | 中缝、门板厚度、门槛明显 |
| locked | 红/黄状态灯，锁体或横向封条 |
| rerouted | 路线灯改变，门旁灯从青变黄/红 |

每个门模型拆分：

```text
frame
left_panel
right_panel
status_light_left
status_light_right
access_panel_mount
collision_proxy
```

未来动画：

- sliding open
- lock bar snap
- status light pulse
- power reroute flicker

当前最需要做的门：

1. `door_service_elevator`
2. `door_yellow_access`
3. `door_red_lockdown`
4. `door_residential_clean`
5. `door_identity_archive`

## 7. Level 05 新增资产需求

Level05 现在有 `实验档案室` 和 `H-0 记录校验`。

需要：

| Asset Key | 位置 | 说明 |
| --- | --- | --- |
| `kit_sterile_archive_room` | `level_05_archive_room` | 小型档案室，白蓝冷光，墙面有编号和档案槽 |
| `prop_archive_book_open` | `level_05_archive_book` | 玩家读《最后人类实验》 |
| `terminal_quiz_panel_red` | `level_05_archive_quiz_panel` | 答错刷怪，应该有危险感 |
| `door_identity_archive` | `level_05_identity_door` | Demo 终点门，要高级 |
| `hero_reclamation_core_platform` | `level_05_platform` | 回收主机前的压迫空间 |

视觉方向：

- 档案室不要像普通终端房，要有“研究记录被保存”的冷白感觉。
- 问答面板可以偏红，但不要像 Boss 门一样夸张。
- 档案书/夹板要足够大，玩家靠近前能看出是一本可读物。

## 8. Level 06 以后门开关迷宫资产

未来第六关如果做门开关迷宫，最少需要：

| Asset Key | 数量 | 说明 |
| --- | --- | --- |
| `switch_panel_wall_cyan` | 2-3 | 普通路线开关 |
| `switch_panel_wall_red` | 1 | 危险路线开关 |
| `door_route_a_cyan` | 2 | A 路线门 |
| `door_route_b_amber` | 2 | B 路线门 |
| `floor_route_line_cyan` | 若干 | 地面路线灯 |
| `floor_route_line_amber` | 若干 | 地面路线灯 |
| `decal_switch_symbol_set` | 1 atlas | 无文字符号：A/B、锁、回路、警告 |

设计原则：

- 玩家一眼能看出“这个开关改变的是路线”。
- 门旁状态灯要和地面路线灯同色。
- 不要用大量文字解释规则。
- 开关模型要有明显手感：拉杆、按压块、旋钮或实体护盖。

## 9. 交付 Manifest 要求

每个资产必须提供 manifest entry：

```json
{
  "modelKey": "switch_panel_wall_cyan",
  "file": "assets/models/environment/props/hp_switch_panel_wall_cyan.glb",
  "category": "interaction",
  "defaultVisualKey": "direction_keypad_panel",
  "sizeMeters": [0.7, 1.1, 0.18],
  "pivot": "back_center",
  "collision": { "type": "box", "sizeMeters": [0.7, 1.1, 0.18] },
  "materialAtlas": "switch_panel_atlas",
  "mobileCost": "low",
  "tags": ["switch", "door-route", "wall", "cyan", "config"]
}
```

质量要求：

- 单个普通交互物 GLB 目标 `<80KB`，最多 `<180KB`。
- 门模型目标 `<180KB`，hero 门最多 `<350KB`。
- 贴图优先 atlas 化，单张 WebP/JPG `512` 或 `1024`。
- 不包含真实品牌、真实 IP、真实 logo。
- 命名 ASCII、无空格。

## 10. 当前接入映射

当前代码已有 fallback，模型接入后建议这样映射：

```ts
visualKey: "direction_keypad_panel" -> modelKey: "switch_panel_wall_cyan" 或 "terminal_quiz_panel_red"
visualKey: "archive_book" -> modelKey: "prop_archive_book_open"
visualKey: "exit_panel" -> modelKey: "terminal_archive_reader" 或 "exit_panel_service"
visualKey: "large_yellow_key" -> modelKey: "pickup_large_yellow_key"
visualKey: "service_elevator_door" -> modelKey: "door_service_elevator"
enemy tier: "elite" -> base enemy model + "enemy_tier_armor_elite"
room.skinKey: "maintenance_bay_hero" -> modelKitKey: "kit_maintenance_bay_hero"
```

下一步接 GLB 前，需要在 asset manifest 里新增 `modelKey` 字段，并让 renderer 优先使用模型，缺模型时继续用当前 fallback primitive。
