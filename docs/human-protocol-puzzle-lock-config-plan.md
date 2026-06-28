# Human Protocol Puzzle Lock Config Plan

这份计划回答：钥匙门、颜色球顺序、房间数字线索、东西南北密码锁，能不能做成简单关卡 config 控制。

结论：可以做，而且必须做成可复用通用系统。代码只写“谜题规则动词”，每个关卡只写房间、线索、目标球、密码、门锁和反馈。

这里不做任何“只服务这一关”的一次性逻辑。`PuzzleSystem`、`PuzzleTargetSystem`、`CodeInputSystem` 都是长期复用能力，官方关卡、玩家关卡、本地机器人生成关卡都走同一套系统。

## 1. 目标玩法

目标是让密室逃生关卡有三层理解：

1. 拿钥匙开第一道门。
2. 观察大厅图案，按顺序攻击对应颜色球，打开机关门。
3. 去不同方位房间读数字，带钥匙输入东西南北顺序密码，打开最终出口。

玩家体验应该是：

```text
看见锁 -> 找钥匙 -> 进门 -> 读图案 -> 打球 -> 门开
看见最终锁 -> 去四个方向找数字 -> 回来输入密码 -> 用钥匙出门
```

不要让玩家觉得是在解数学题。每一步都要有短反馈：球亮、音效、门震、错误重置、广播提示。

## 2. 可复用通用系统

需要新增或扩展这些 runtime 能力：

| 系统 | 可复用职责 | config 控制什么 |
| --- | --- | --- |
| `PuzzleProgressState` | 记录谜题状态、输入序列、完成状态、失败次数 | 每个谜题是否完成、当前输入到第几步 |
| `PuzzleSystem` | 判断命中目标、检查顺序、检查密码、发事件 | 颜色顺序、目标数量、密码来源、成功/失败反馈 |
| `PuzzleTargetSystem` | 把可攻击球/按钮/晶体注册成非敌人目标 | 目标位置、颜色、半径、可见条件 |
| `CodeInputSystem` | 管理密码锁 UI 或 3D 面板输入 | 数字长度、方向顺序、需要钥匙、错误处理 |
| `DoorSystem` 扩展 | 支持 `puzzle_complete` 锁类型 | 哪个谜题完成后开哪扇门 |
| `ConfigValidator` 扩展 | 检查 puzzle/target/clue/door 引用 | 防止坏 config 白屏或死路 |

这些系统不是用完即丢的关卡脚本，而是复用 runtime。后续不同谜题只新增 config 数据；只有出现全新的规则动词时才扩展系统。

可复用边界：

- 同一种规则换颜色、数量、房间、顺序、密码、门和奖励，只改 config。
- 同一种规则换 UI 文案、失败反馈、音效、镜头反馈，只改 config。
- 同一种规则从 3 球变 5 球、从东西南北变上下左右，只改 config。
- 新增“接线小游戏”“旋转管道”这种完全新规则，才写新 reusable puzzle type。

## 3. Config Schema 草案

### 3.1 Puzzle State

```ts
interface PuzzleProgressState {
  completedPuzzleIds: string[];
  activeSequences: Record<string, string[]>;
  failedCounts: Record<string, number>;
  revealedClueIds: string[];
}
```

`MapProgressState` 可以包含这个字段，复活和重开都能恢复。

### 3.2 颜色球顺序谜题

```ts
{
  id: "hall_color_orb_lock",
  type: "hit_sequence",
  label: "大厅颜色序列",
  roomId: "orb_chamber",
  clue: {
    type: "pattern_panel",
    roomId: "main_hall",
    visualKey: "three_color_order_panel",
    sequence: ["red_orb", "blue_orb", "green_orb"]
  },
  targets: [
    {
      id: "red_orb",
      label: "红色球",
      roomId: "orb_chamber",
      position: [-2.5, 1.2, -6],
      radius: 0.75,
      colorKey: "red",
      visualKey: "puzzle_orb_red"
    },
    {
      id: "blue_orb",
      label: "蓝色球",
      roomId: "orb_chamber",
      position: [0, 1.2, -6],
      radius: 0.75,
      colorKey: "blue",
      visualKey: "puzzle_orb_blue"
    },
    {
      id: "green_orb",
      label: "绿色球",
      roomId: "orb_chamber",
      position: [2.5, 1.2, -6],
      radius: 0.75,
      colorKey: "green",
      visualKey: "puzzle_orb_green"
    }
  ],
  input: {
    method: "weapon_hit",
    allowedWeapons: ["pulseRifle", "railLance"],
    resetOnMistake: true,
    showProgressPulse: true
  },
  success: {
    completesObjectiveId: "solve_hall_color_orbs",
    opensDoorId: "orb_reward_door",
    rewardPulse: { label: "顺序正确", detail: "机关门打开", rarity: "rare" }
  },
  fail: {
    message: "顺序错了，图案熄灭。",
    resetDelay: 0.45,
    cameraImpact: { shake: 0.18, fovKick: 0.8 }
  }
}
```

支持任意数量球：

```text
sequence.length = 3 / 4 / 5 / N
targets.length >= sequence 去重数量
```

如果要更复杂，可以允许 sequence 重复：

```ts
sequence: ["red_orb", "blue_orb", "red_orb", "green_orb"]
```

## 4. 密码锁谜题

最终门用一个 `code_lock`。密码不是直接写死给玩家，而是从房间线索生成。

### 4.1 方位数字线索

```ts
clues: [
  {
    id: "north_digit",
    type: "number_decal",
    roomId: "north_room",
    direction: "north",
    value: "7",
    visualKey: "wall_digit_warning",
    position: [0, 1.8, -9.5]
  },
  {
    id: "east_digit",
    type: "number_decal",
    roomId: "east_room",
    direction: "east",
    value: "2",
    visualKey: "wall_digit_warning",
    position: [8.8, 1.8, 0]
  },
  {
    id: "south_digit",
    type: "number_decal",
    roomId: "south_room",
    direction: "south",
    value: "9",
    visualKey: "wall_digit_warning",
    position: [0, 1.8, 8.8]
  },
  {
    id: "west_digit",
    type: "number_decal",
    roomId: "west_room",
    direction: "west",
    value: "4",
    visualKey: "wall_digit_warning",
    position: [-8.8, 1.8, 0]
  }
]
```

### 4.2 东西南北顺序密码

```ts
{
  id: "final_direction_code",
  type: "code_lock",
  label: "方位密码锁",
  interactionId: "final_keypad",
  requiredKeyItemId: "exit_key",
  code: {
    source: "direction_room_digits",
    directionOrder: ["east", "west", "south", "north"]
  },
  input: {
    length: 4,
    mode: "digit_buttons",
    allowBackspace: true,
    clearOnMistake: false
  },
  success: {
    opensDoorId: "final_exit_door",
    completesObjectiveId: "unlock_final_exit",
    rewardPulse: { label: "密码正确", detail: "最终门解锁", rarity: "epic" }
  },
  fail: {
    message: "密码不对。广播短暂沉默。",
    cameraImpact: { shake: 0.22, fovKick: 1.1 }
  }
}
```

如果按上面线索，密码就是：

```text
east west south north = 2 4 9 7
```

但 config 不需要手写 `2497`，可以由系统根据 directionOrder 和 clue value 算出来。这样本地机器人生成关卡时更不容易自相矛盾。

## 5. Door Lock 扩展

新增门锁类型：

```ts
type DoorLockType =
  | "none"
  | "key_item"
  | "objective_complete"
  | "survive_wave"
  | "boss_dead"
  | "puzzle_complete";
```

示例：

```ts
{
  id: "orb_reward_door",
  label: "颜色机关门",
  fromRoomId: "orb_chamber",
  toRoomId: "number_wing",
  defaultState: "locked",
  lock: {
    type: "puzzle_complete",
    puzzleId: "hall_color_orb_lock",
    lockedMessage: "大厅图案还没有回应。"
  }
}
```

最终门可以双条件：

```ts
lock: {
  type: "puzzle_complete",
  puzzleId: "final_direction_code",
  keyItemId: "exit_key",
  lockedMessage: "需要钥匙和方位密码。"
}
```

实现时可以先做 `puzzle_complete + keyItemId`，不用立刻做复杂 AND/OR 表达式。

## 6. 目标链示例

```ts
objectiveChain: [
  {
    id: "find_first_key",
    type: "collect_key",
    title: "找门禁钥匙",
    detail: "第一扇门锁着。",
    completesWhen: { type: "key_collected", id: "maintenance_key" },
    nextObjectiveId: "open_key_door"
  },
  {
    id: "open_key_door",
    type: "open_door",
    title: "打开维修门",
    detail: "门后有机关。",
    completesWhen: { type: "door_opened", id: "maintenance_key_door" },
    nextObjectiveId: "read_color_pattern"
  },
  {
    id: "read_color_pattern",
    type: "inspect_all",
    title: "观察大厅图案",
    detail: "颜色不是装饰。",
    completesWhen: { type: "interaction_completed", id: "hall_pattern_panel" },
    nextObjectiveId: "solve_color_orbs"
  },
  {
    id: "solve_color_orbs",
    type: "custom",
    title: "按顺序击中颜色球",
    detail: "打错会重置。",
    completesWhen: { type: "puzzle_completed", id: "hall_color_orb_lock" },
    nextObjectiveId: "find_direction_digits"
  },
  {
    id: "find_direction_digits",
    type: "inspect_all",
    title: "寻找四个数字",
    detail: "东西南北各有一个。",
    requiredIds: ["north_digit", "east_digit", "south_digit", "west_digit"],
    completesWhen: { type: "clues_collected", id: "direction_digits" },
    nextObjectiveId: "unlock_final_exit"
  },
  {
    id: "unlock_final_exit",
    type: "custom",
    title: "输入方位密码",
    detail: "还需要最后的钥匙。",
    completesWhen: { type: "puzzle_completed", id: "final_direction_code" },
    nextObjectiveId: "reach_exit"
  }
]
```

需要新增 objective trigger：

```text
puzzle_completed
clue_revealed
clues_collected
```

## 7. Mobile 和 Desktop 操作

桌面：

- 左键攻击球。
- 准星对准球时球边缘发光。
- 密码锁出现时释放鼠标锁，显示干净的数字面板。
- 关闭面板或成功后重新进入鼠标锁。

手机：

- 准星辅助扩大球的命中半径。
- 当前可打球在右手滑动视角时有轻微吸附，不强转镜头。
- 密码锁用大按钮数字面板，横屏右侧或中间弹出。
- 图案提示不要用小字，使用大色块/方向图标。

## 8. 失败和爽感

颜色球失败不应该惩罚太重：

- 打错：当前球红闪，序列板熄灭 0.45 秒，然后重置。
- 连续错 2 次：中屏短提示“颜色不是位置，是顺序”。
- 连续错 3 次：让正确的第一个球轻微闪一下，避免卡死。

成功要有仪式：

- 每打对一个球，图案板对应格亮起。
- 最后一击触发低频音、门锁震动、门缝透光。
- 门打开后刷一只小怪或广播一句话，形成“解谜 -> 压力变化”的节奏。

这会比纯解谜更适合当前第一人称机器人恐怖生存游戏。

## 9. Validator 要检查

必须检查：

- puzzle id 唯一。
- `targets[].id` 唯一。
- sequence 里的 target id 都存在。
- target roomId 存在。
- pattern panel interaction 存在。
- success opensDoorId 存在。
- code lock 的 interactionId 存在。
- requiredKeyItemId 存在。
- directionOrder 的每个方向都有数字 clue。
- 最终门从出生点可达，钥匙不在自己锁死的路径后面。

本地机器人生成关卡时，validator 要返回可修复错误，比如：

```text
final_direction_code 缺少 west direction clue。
hall_color_orb_lock sequence 引用了不存在的 purple_orb。
exit_key 在 final_exit_door 后面，玩家拿不到。
```

## 10. 推荐实现顺序

实现原则：每个 Phase 都必须产出一个可复用系统能力和一个 smoke config。不要为了 smoke 关写专属逻辑。

### Phase A：最小颜色球顺序

状态（2026-05-31）：已完成第一版 reusable runtime 和 smoke config。

已落地：

- `levelConfig.ts` 支持 `puzzles`、`hit_sequence`、`puzzle_completed` 事件和 `puzzle_complete` 门锁。
- `MapProgressState` 记录 `completedPuzzleIds`、当前输入序列、失败次数和目标反馈 pulse。
- `GameWorld` 提供通用 puzzle hit API，铁棒扇形和子弹都能命中 puzzle target。
- 铁棒命中谜题时一挥只取最近目标，避免手机/桌面一刀扫到多个球导致误重置。
- `PuzzleSystem` 负责更新 puzzle feedback timer。
- `MapGeometryRenderer` 可以从 config 渲染颜色球目标。
- `ConfigValidator` 检查 puzzle、target、sequence、door、objective、visual/material 引用。
- 新增内置 smoke 关 `smoke_color_orb_lock`：拿钥匙开门，读红蓝绿图案，按顺序击中 3 个颜色球，打开后门并解锁出口。

QA：

- `npm run build` passed。
- Chrome headless `844x390` 验证：错误击中蓝球会重置并记录失败；红 -> 蓝 -> 绿完成后 `completedPuzzleIds=[hall_color_orb_lock]`、`openedDoorIds=[orb_key_door, orb_reward_door]`、`exitUnlocked=true`、console error/warn `0`。
- 铁棒 arc QA 验证：红、蓝、绿三次挥击分别只命中一个最近目标，顺序不会被同一挥击误伤重置。

1. 扩展 schema：`puzzles`, `puzzleTargets`, `clues`。
2. 加 `PuzzleProgressState`。
3. 加 `PuzzleSystem`，只支持 `hit_sequence`。
4. 让武器命中可以命中 puzzle target。
5. DoorSystem 支持 `puzzle_complete`。
6. 做一个 smoke 关：3 个颜色球，打对开门。

验收：

- 3 球顺序正确会开门。
- 打错会重置。
- 目标球位置、颜色、顺序全由 config 控制。

### Phase B：方位数字密码锁

状态（2026-05-31）：已完成第一版 reusable runtime、横屏 UI 和 smoke config。

已落地：

- `levelConfig.ts` 支持 `code_lock` puzzle、`number_decal` 方位数字线索、`requiredKeyItemId`、`directionOrder` 和固定/方位线索两种密码来源。
- `GameWorld` 提供通用 code lock API：打开/关闭密码面板、输入数字、退格、清除、提交、计算期望密码、失败计数和完成 puzzle。
- `InteractionSystem` 可以把 config interaction 连接到 code lock；缺钥匙时给玩家短提示，拿到钥匙后才允许输入密码。
- `MapGeometryRenderer` 可以从 config 渲染墙面数字贴花；`CodeLockOverlay` 提供横屏友好的中文门禁面板。
- `ConfigValidator` 会检查 code lock interaction、key item、direction clue、success door/objective、visual/material 引用。
- 新增内置 smoke 关 `smoke_direction_code_lock`：东西南北 4 个房间藏数字，西房间拿 `exit_key`，按 `东 -> 西 -> 南 -> 北` 得到密码 `2497`，打开最终门并解锁出口。

QA：

- `npm run build` passed。
- `git diff --check` passed。
- Playwright/system Chrome `844x390` mobile landscape 验证：密码面板完整显示，确认按钮在视口内；错误输入 `1111` 后 `failedPuzzleCounts.final_direction_code=1`；正确输入 `2497` 后 `completedPuzzleIds=[final_direction_code]`、`openedDoorIds` 包含 `final_direction_door`、`exitUnlocked=true`、console error/warn `0`。
- Playwright/system Chrome `1280x720` desktop click QA：真实点击面板按钮 `2/4/9/7` 后提交，密码面板关闭，`completedInteractionIds=[final_direction_keypad]`，最终门打开，console error/warn `0`。

1. 增加 `number_decal` clue。
2. 增加 `code_lock` puzzle。
3. 做横屏密码面板 UI。
4. 密码从 `directionOrder + room clue value` 计算。
5. 支持 `requiredKeyItemId`。

验收：

- 4 个方向房间各有数字。
- 输入顺序由 config 控制。
- 需要钥匙 + 正确密码才开最终门。

### Phase C：生成关卡友好

状态（2026-05-31）：已新增第一版组合密室 smoke，用来验证本地机器人以后生成复杂关卡时的系统拼接能力。

组合 smoke：`smoke_key_orb_code_lock`

- 起点实验室：玩家可以拾起铁棒、手枪和 `combo_lab_key`。
- 读取三色图案：`黄 -> 红 -> 蓝`。
- 钥匙门：`combo_lab_key` 打开第一道门 `combo_key_gate`。
- 颜色球锁室：按 `黄 -> 红 -> 蓝` 攻击 3 个球，完成 `combo_color_orb_lock`，打开 `combo_orb_gate`。
- 方位密码大厅：南、东、西、北四个方向给数字 `3 / 8 / 5 / 1`。
- 最终密码锁：`directionOrder: ["south", "east", "west", "north"]`，因此密码为 `3851`。
- 最终门：`combo_final_direction_code` 完成后打开 `combo_final_code_door`，并 `unlockExit=true`。

QA：

- `npm run build` passed。
- Playwright/system Chrome `844x390` mobile landscape 功能链路通过：错打 `combo_blue_orb` 会记录 `failedPuzzleCounts.combo_color_orb_lock=1` 并清空序列；正确 `combo_yellow_orb -> combo_red_orb -> combo_blue_orb` 后 `combo_orb_gate` 打开。
- 同一链路继续验证 code lock：期望密码 `3851`；错误 `1111` 会记录 `failedPuzzleCounts.combo_final_direction_code=1`；正确 `3851` 后 `completedPuzzleIds=[combo_color_orb_lock, combo_final_direction_code]`、`openedDoorIds` 包含 `combo_key_gate / combo_orb_gate / combo_final_code_door`、`exitUnlocked=true`、console error/warn `0`。
- UI visual QA：组合密码面板在 `844x390` 横屏下完整显示，确认按钮在视口内。

状态（2026-05-31 追加）：`explainPuzzle(level)` 和 graph validator 已加入 `ConfigValidator`。

能力：

- `validateLevelConfig(level).graph` 会输出起点房间、出口房间、critical path、目标链、锁门列表、谜题列表、静态可达结果。
- `explainPuzzle(level)` 可单独调用，给本地机器人/调试面板提供“这关为什么能通”的机器可读报告。
- 静态图模拟会从出生房间开始，推导可达房间、可拿钥匙、可完成交互、可解谜题、可打开门、是否解锁出口、出口交互是否可用。
- 新增图检查会报出关键门永远打不开、进度谜题不可解、出口房间不可达、出口交互被 objective 自己锁住等问题。

QA：

- `npm run build` passed。
- Playwright/system Chrome 直接读取 `builtInValidationReports`：`level_01_maintenance_bay`、`smoke_key_door_lab`、`smoke_color_orb_lock`、`smoke_direction_code_lock`、`smoke_key_orb_code_lock` 全部 `ok=true/errors=0/warnings=0`。
- 组合 smoke graph 输出：critical path 为 `combo_start_lab -> combo_orb_chamber -> combo_code_hub -> combo_north_digit_room -> combo_exit_room`；locks 为 `combo_key_gate / combo_orb_gate / combo_final_code_door`；puzzles 为 `combo_color_orb_lock` 和 `combo_final_direction_code`；密码解释为 `3851`；`exitUnlocked=true` 且 `exitInteractionReady=true`。

状态（2026-05-31 追加 2）：开发者 graph overlay 已接入。

- 默认玩家界面不显示 graph，也不暴露 `window.__HUMAN_PROTOCOL_EXPORT_GRAPH__`。
- URL 加 `?graph=1` 或 `?debug=graph` 时显示 `ConfigGraphOverlay`。
- 面板显示 active level 的 `ok/error/warning`、start/exit room、critical path、locks、puzzles、objective path。
- 面板提供 `Download JSON` 和 `Copy JSON`，并暴露 `window.__HUMAN_PROTOCOL_EXPORT_GRAPH__()` 给本地机器人读取。
- Playwright/system Chrome `844x390` QA：`?debug=0` 下 panel count `0` 且 export hook `undefined`；`?graph=1` 下 panel count `1`、active level 为 `smoke_key_orb_code_lock`、puzzles 为 `combo_color_orb_lock / combo_final_direction_code`、expected inputs 为 `黄红蓝 / 3851`、`exitInteractionReady=true`、console error/warn `0`。

1. Validator 增加 puzzle graph 检查。
2. 增加 `explainPuzzle(level)` debug 输出。
3. 给本地机器人一份 puzzle prompt 模板。
4. 让 puzzle config 可导入/导出。

验收：

- 本地机器人只生成 config，就能得到一关钥匙 + 球序列 + 方位密码密室。

## 11. 一个完整关卡骨架

```text
Start Lab
  - pickup maintenance_key
  - door: maintenance_key_door locked by maintenance_key

Main Hall
  - pattern panel shows red -> blue -> green
  - door to Orb Chamber

Orb Chamber
  - red/blue/green attackable orbs
  - correct sequence opens number_wing_door

Direction Wing
  - north room: digit 7
  - east room: digit 2
  - south room: digit 9
  - west room: digit 4
  - pickup exit_key

Final Exit
  - keypad asks E W S N
  - code is 2497
  - requires exit_key
  - opens final_exit_door
```

这套结构正好适合作为 Level 02 或一个 `puzzle_smoke_lab` 内置测试关。
