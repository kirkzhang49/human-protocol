# Human Protocol Config Room Puzzle Systems

本文档定义 `Human Protocol` 后续密室系统的可复用 config 能力。目标是让官方 5 关、后续 3 条路线、玩家自定义人生、本地 LLM 生成关卡都使用同一套安全数据结构，而不是为每一关继续写一次性逻辑。

当前阶段已经完成第一批可复用系统：颜色顺序、密码锁、公式密码、大屏/电视线索、文章阅读、阅读问答、错答刷怪、成功后通用 actions，以及门开关最小系统。前 5 关 demo 暂时不强行加入门开关迷宫，但第六关以后可以直接用同一套 `switches[]` config 组合路线门。

## 1. 这一步已经完成的底座

### 1.1 Puzzle success 支持通用 actions

`LevelPuzzleSuccessDefinition` 现在除了旧字段外，新增：

```ts
success: {
  actions?: LevelRuntimeEventAction[];
}
```

旧字段继续可用：

```ts
opensDoorId
unlocksDoorId
completesObjectiveId
unlockExit
dialogueTrigger
rewardPulse
cameraImpact
effects
audio
```

新增 `actions` 的意义是：后续无论是颜色球、密码锁、文章问答、门开关，成功后都能复用同一套动作。

示例：

```ts
success: {
  rewardPulse: { label: "答案成立", detail: "门禁接受记录", rarity: "epic" },
  actions: [
    { type: "queue_dialogue", trigger: "truth_answered" },
    { type: "open_door", doorId: "boss_gate" },
    { type: "start_wave", waveId: "truth_guard_wave", delay: 0.4 }
  ]
}
```

### 1.2 通用 action 新增门状态控制

`LevelRuntimeEventAction` 现在支持：

```ts
{ type: "close_door"; doorId: string }
{ type: "lock_door"; doorId: string }
```

用途：

- 第六关以后做门开关迷宫。
- 一个开关打开 A 门、关闭 B 门。
- 一个错误选择锁回某条路线。
- 一个阅读问答正确后关闭安全门并开始 Boss 战。

当前前 5 关主线不使用这两个动作；`smoke_door_switch_lab` 已经用它们验证“一次开关改变两扇门状态”的最小闭环。

### 1.3 Validator 和 graph 已经理解 success.actions

`ConfigValidator` 现在会检查：

- `success.actions[].doorId` 是否存在。
- `success.actions[].waveId` 是否存在。
- `success.actions[].choiceId` 是否存在。
- `success.actions[].objectiveId` 是否存在。
- `success.actions[].keyItemId` 是否存在。

Puzzle graph 也会把这些动作纳入可达性模拟：

- `open_door / unlock_door` 让门可达。
- `close_door / lock_door` 会从图中移除已开门。
- `grant_key_item` 增加关键物。
- `start_wave` 视为可触发并可战斗完成。
- `complete_objective` 增加目标完成。
- `unlock_exit` 解锁出口。

这不是完整的状态机求解器，但足够发现大部分坏 config：引用不存在、关键路径打不开、出口不可达。

### 1.4 第五关已接入文章 + 问答样板

`level_05_reclamation_core` 现在包含一个可复用样板：

- `articles[0] = level_05_last_human_file`
- `quizzes[0] = level_05_last_human_check`
- 错答 action：`start_wave level_05_archive_wrong_answer_wave repeat: true`
- 正答触发：`quiz_completed level_05_last_human_check`
- Boss 波次触发：`level_05_reclamation_mother.trigger = quiz_completed`

这条链证明系统不是纸面 schema：

```text
打开回收内台 -> 进入实验档案室 -> 阅读档案 -> 回答校验
  -> 错答：刷 4 个校正单位，打完可重试
  -> 正答：唤醒回收主机，进入 Boss 战
```

### 1.5 第四关已接入大屏 + 公式密码样板

`level_04_memory_clinic` 现在有一个官方样板：

- `bigScreens[0] = level_04_body_formula_screen`
- 读取身体椅后 runtime event 执行 `{ type: "set_big_screen_state", screenId, stateId }`
- 大屏显示 `3 + 8 - 5 = 6`
- `level_04_theater_code` 使用 `code.source = "formula"`，最终输入 `386`

这条链证明屏幕不是纯视觉摆件：

```text
读取童年椅 -> 得到 3
读取救援椅 -> 得到 8
读取身体椅 -> 身体屏点亮，显示第三位公式结果 6
输入 386 -> 治疗剧场门打开
```

新增自由测试关 `smoke_big_screen_formula_combo` 用来验证组合能力：

```text
开观察屏 -> 看到 黄/红/蓝
按顺序打颜色球 -> 反应门打开 + 公式屏亮起
公式屏显示 12 x 3 + 4 = 40
输入 040 -> 公式门禁打开 + 出口解锁
```

## 2. 多房间颜色顺序系统

现有 `hit_sequence` 已经能支持“提示和目标分散在多个房间”，不需要新增 puzzle type。

### 2.1 目标体验

玩家不是看见 `红 > 蓝 > 黄` 文字，而是读空间里的颜色路径：

- 提示房间 A 的地面有两个色块。
- 提示房间 B 的墙上有一个色块。
- 真正可攻击的三个球可能在另一个房间。
- 玩家按看到的顺序攻击球，门打开或 Boss 出现。

### 2.2 推荐 config

```ts
{
  id: "core_three_color_path",
  type: "hit_sequence",
  label: "核心色块路径",
  roomId: "core_lock_room",
  clue: {
    type: "environment_marking",
    sequence: ["blue_orb", "yellow_orb", "red_orb"],
    revealOnRoomEnter: true,
    roomEnterLabel: "地面色块",
    roomEnterDetail: "色块从入口排向后方门禁。",
    surfaces: [
      {
        id: "north_floor_two_steps",
        roomId: "north_hint_room",
        surface: "floor",
        position: [0, 0, -4],
        size: [4.8, 0.8],
        yaw: Math.PI / 2,
        sequence: ["blue_orb", "yellow_orb"]
      },
      {
        id: "east_wall_last_step",
        roomId: "east_hint_room",
        surface: "wall",
        position: [8, 1.4, 2],
        size: [1.2, 0.8],
        sequence: ["red_orb"]
      }
    ]
  },
  targets: [
    { id: "blue_orb", roomId: "core_lock_room", colorKey: "blue" },
    { id: "yellow_orb", roomId: "core_lock_room", colorKey: "yellow" },
    { id: "red_orb", roomId: "side_lock_room", colorKey: "red" }
  ],
  success: {
    actions: [
      { type: "open_door", doorId: "core_gate" },
      { type: "complete_objective", objectiveId: "solve_core_color_path" }
    ]
  }
}
```

### 2.3 设计规则

- 不要在地面直接写答案文字。
- 顺序来自空间方向：入口到出口、左到右、低到高、近到远。
- 同一个 sequence 可以分散在多个 `clue.surfaces`。
- 目标球可以跨房间，但不要让玩家隔墙误打。
- 错误后可以 `resetOnMistake`，也可以未来扩展成错误刷怪。

## 3. 大屏/电视线索系统

`bigScreens[]` 是通用屏幕状态系统，不只服务第四关。它可以显示黑屏、数字、颜色顺序、公式或短文本，也可以被玩家互动、puzzle success、quiz answer、switch action、runtime event 点亮。

```ts
bigScreens: [
  {
    id: "screen_combo_formula_screen",
    roomId: "formula_room",
    interactionId: "formula_screen_panel",
    initialStateId: "off",
    activationStateId: "formula_hint",
    modelKey: "terminal_puzzle_big_screen",
    visualKey: "terminal_puzzle_big_screen",
    position: [-2.35, 1.48, -9.35],
    yaw: 0,
    size: [2.55, 1.34],
    states: [
      { id: "off", mode: "off", powered: false },
      {
        id: "formula_hint",
        mode: "formula",
        powered: true,
        title: "门禁公式",
        formula: {
          expression: "12*3+4",
          answer: "040",
          display: "12 x 3 + 4 = 40",
          hint: "补成三位：040",
          padLength: 3
        }
      }
    ]
  }
]
```

可以直接互动点亮：

```ts
{ id: "formula_screen_panel", type: "big_screen", roomId: "formula_room", visualKey: "terminal_puzzle_big_screen" }
```

也可以由别的系统点亮：

```ts
success: {
  actions: [
    { type: "set_big_screen_state", screenId: "screen_combo_formula_screen", stateId: "formula_hint" }
  ]
}
```

目标链可以监听：

```ts
completesWhen: { type: "big_screen_state", id: "screen_combo_color_screen", optionId: "color_hint" }
requiredIds: ["screen_combo_color_screen:color_hint"]
```

### 3.1 显示模式

| mode | 用途 |
| --- | --- |
| `off` | 黑屏/未供电 |
| `digits` | 直接显示 1-8 位数字 |
| `color_sequence` | 显示颜色顺序，适合打球谜题 |
| `formula` | 显示算式/换算线索 |
| `text` | 显示短文本，不建议写长文章 |

### 3.2 公式密码

`code_lock` 现在支持：

```ts
code: {
  source: "formula",
  formula: {
    expression: "12*3+4",
    answer: "040",
    padLength: 3
  },
  hint: {
    source: "screen",
    label: "公式屏线索",
    detail: "把公式结果补成三位数。"
  }
}
```

规则：

- `expression` 只允许数字、空格、`+ - * / ( )`。
- `answer` 可选；写了就作为最终答案，适合避免小数/除法争议。
- `padLength` 用于 `40 -> 040`。
- `resultMode: "last_digits"` 可以用于“只取后几位”的后期谜题。
- hint 可以来自 `keypad / screen / article`，UI 会在密码面板上显示短提示。

## 4. 文章阅读系统

文章阅读已经是独立系统，不塞进普通 `dialogue`。原因是文章有标题、页数、已读状态、阅读 UI、题库绑定和中英文文本。

Schema：

```ts
articles?: LevelArticleDefinition[];
```

草案：

```ts
interface LevelArticleDefinition {
  id: string;
  roomId: string;
  interactionId: string;
  systemLabel?: string;
  title: string;
  subtitle?: string;
  pages: readonly {
    id: string;
    body: string;
  }[];
  readReward?: RewardPulseConfig;
  readRewardDuration?: number;
  readDialogueTrigger?: string;
}
```

### 3.1 第五关适合的官方样板

第五关可加一个小房间：`最后人类实验档案室`。

玩家看到一本书或实验档案：

```text
最后人类实验

他们没有保存人类。
他们保存的是“对象相信自己是人类时产生的反应”。

当对象保护痛觉、恐惧和名字，协议就继续运行。
```

这篇文章的功能不是解释全部真相，而是把 Boss 战前的理解门槛立起来：玩家必须意识到“最后人类”不是一个肉体，而是一层被维护的反应。

## 5. 阅读问答系统

问答已经独立成：

```ts
quizzes?: LevelQuizDefinition[];
```

不要直接复用 `choices`，因为 `choices` 是路线选择；问答是可错、可惩罚、可重试、可刷怪的谜题。

草案：

```ts
interface LevelQuizDefinition {
  id: string;
  articleId?: string;
  roomId: string;
  interactionId: string;
  systemLabel?: string;
  title: string;
  question: string;
  detail?: string;
  options: readonly LevelQuizOptionDefinition[];
  resetPolicy?: {
    type: "never" | "after_wrong_count" | "on_room_exit";
    wrongCount?: number;
  };
  wrongAnswer?: {
    message?: string;
    actions?: LevelRuntimeEventAction[];
    rewardPulse?: RewardPulseConfig;
    cameraImpact?: CameraImpactConfig;
    audio?: AudioCueConfig;
  };
  correctAnswer: {
    message?: string;
    actions?: LevelRuntimeEventAction[];
    rewardPulse?: RewardPulseConfig;
    cameraImpact?: CameraImpactConfig;
    audio?: AudioCueConfig;
  };
}

interface LevelQuizOptionDefinition {
  id: string;
  label: string;
  detail?: string;
  correct?: boolean;
  tone?: "system" | "threat" | "reveal" | "player";
}
```

### 4.1 第五关最小样板

第五关先只放一本书、一个问题、三个答案：

```ts
{
  id: "last_human_experiment_quiz",
  articleId: "last_human_experiment_file",
  question: "最后人类实验真正保存的是什么？",
  options: [
    { id: "human_body", label: "一具完整的人类身体" },
    { id: "human_response", label: "相信自己是人类的反应", correct: true },
    { id: "machine_law", label: "机器人社会的法律" }
  ],
  resetPolicy: { type: "never" },
  wrongAnswer: {
    message: "档案拒绝这个解释。",
    actions: [
      { type: "start_wave", waveId: "last_human_wrong_answer_wave", repeat: true }
    ]
  },
  correctAnswer: {
    actions: [
      { type: "start_wave", waveId: "last_human_truth_guard_wave", delay: 0.3 },
      { type: "start_wave", waveId: "reclamation_mother_boss", delay: 1.1 }
    ]
  }
}
```

### 4.2 Validator 规则

Validator 现在会检查：

- `article.roomId / interactionId` 必须存在。
- `quiz.roomId / interactionId / articleId` 必须存在。
- 每个 quiz 必须只有一个正确答案。
- quiz 建议 3-5 个选项，超过会 warning。
- `wrongAnswer.actions` 和 `correctAnswer.actions` 会按通用 runtime action 检查。
- graph 会模拟 `article_read` 和 `quiz_completed`，并把正答 actions 纳入开门/开波次/解锁出口模拟。

### 4.3 触发器

现在可用于 objective、wave、event 的触发器：

```ts
{ type: "article_read"; id: string }
{ type: "quiz_completed"; id: string }
{ type: "quiz_failed"; id: string; optionId?: string }
```

推荐用法：

- 读文章完成当前目标：`completesWhen: { type: "article_read", id: "file_id" }`
- 答对后开始 Boss 波次：`wave.trigger = { type: "quiz_completed", id: "quiz_id" }`
- 答错后用 `wrongAnswer.actions` 刷怪，不建议直接把错答写进主目标链。

第五关具体节奏：

1. 玩家进入档案室。
2. 读书。
3. 回答问题。
4. 选错：刷 4 个小怪，打完可以继续答，题目不重置。
5. 选对：刷 2 个小怪，然后 Boss 出现。
6. 击败 Boss 后读取身份档案结算。

### 4.2 题库策略

题库不应该只是一堆 trivia。它应该服务剧情理解：

- 简单题：确认玩家读过文章。
- 中等题：让玩家理解世界观矛盾。
- 高级题：影响路线选择或隐藏结局。

题库可以按 level 和 route 分组：

```ts
quizBanks: [
  {
    id: "last_human_core_bank",
    levelId: "level_05_reclamation_core",
    questions: [...]
  }
]
```

官方 demo 先每个阅读点 1 道固定题，后期再做随机题库。

## 6. 门开关系统

门开关已经完成最小可复用版本，并用 `smoke_door_switch_lab` 验证。它适合第六关以后做迷宫，不建议硬塞进前 5 关 demo 主线。

Schema：

```ts
switches?: LevelSwitchDefinition[];
```

```ts
interface LevelSwitchDefinition {
  id: string;
  roomId: string;
  interactionId: string;
  label?: string;
  initialStateId?: string;
  oneShot?: boolean;
  states: readonly LevelSwitchStateDefinition[];
}

interface LevelSwitchStateDefinition {
  id: string;
  label?: string;
  detail?: string;
  message?: string;
  actions: readonly LevelRuntimeEventAction[];
  rewardPulse?: RewardPulseConfig;
  rewardPulseDuration?: number;
  dialogueTrigger?: string;
  cameraImpact?: CameraImpactConfig;
  audio?: AudioCueConfig;
}
```

示例：

```ts
{
  id: "maze_route_switch_a",
  roomId: "switch_room",
  interactionId: "maze_switch_panel",
  initialStateId: "route_a",
  states: [
    {
      id: "route_a",
      label: "A 路线",
      actions: [
        { type: "open_door", doorId: "door_a" },
        { type: "close_door", doorId: "door_b" }
      ]
    },
    {
      id: "route_b",
      label: "B 路线",
      actions: [
        { type: "close_door", doorId: "door_a" },
        { type: "open_door", doorId: "door_b" }
      ]
    }
  ]
}
```

### 5.1 已验证的最小样板

`smoke_door_switch_lab` 验证了最小门组切换：

```text
玩家按下门组改道开关
-> switch_activated: reroute_switch:rerouted
-> close_door + lock_door: switch_entry_door
-> unlock_door + open_door: switch_exit_door
-> unlock_exit
```

QA 断言：

- `switch_exit_door` 必须打开。
- `switch_entry_door` 必须不再打开。
- `activatedSwitchIds` 必须包含 `reroute_switch:rerouted`。

### 5.2 触发器

现在可以在目标、波次、事件里使用：

```ts
{ type: "switch_activated"; id: "reroute_switch"; optionId?: "rerouted" }
```

推荐：

- 目标完成用 `switch_activated + optionId`。
- 如果只是关卡事件，可以只监听 `switch_activated` 的 `id`。
- `requiredIds` 可以写 `switchId` 或 `switchId:stateId`。

### 5.3 设计规则

- 开关必须有明确的视觉反馈：灯变色、门响、路径灯改变。
- 不要让玩家不知道自己改变了什么。
- 如果开关会锁死路线，必须有回退开关或清晰提示。
- 迷宫难度来自“我理解了空间变化”，不是让玩家在相同走廊里乱转。

## 7. 这些系统加起来是否足够做密室

足够。

当前已具备：

- 房间图。
- 门锁。
- 钥匙。
- 交互物。
- 颜色顺序。
- 方位数字密码。
- 波次。
- Boss。
- 选择。
- 对话。
- 出口。

加上本文计划的：

- 文章阅读。
- 阅读问答。
- 错误惩罚刷怪。
- 门开关状态切换。
- 多房间分散线索。

就可以组合出大量密室结构。

更重要的是这些系统可以互相卡：

- 文章解锁问答。
- 问答正确开门。
- 问答错误刷怪。
- Boss 掉钥匙。
- 钥匙开提示房。
- 提示房给颜色顺序。
- 颜色顺序开开关房。
- 开关改变门路。
- 最后密码锁需要不同房间数字。

这已经能支撑官方路线和玩家自定义人生。后续真正缺的不是更多规则，而是：

- 更好的房间 kit。
- 更好的 UI。
- 更好的文章和题目文案。
- 更好的 QA 自动通关。
- 更强的 config validator。

## 7. 推荐实施顺序

### Step 1: 已完成

- `success.actions` 底座。
- `close_door / lock_door` 通用 action。
- Validator 检查 puzzle success actions。
- Puzzle graph 纳入 puzzle success actions。
- 本文档。

### Step 2: 第五关文章阅读

新增：

- `articles` schema。
- `ArticleOverlay`。
- `InteractionSystem` 打开文章。
- `MapProgressState.readArticleIds`。
- 中英文本地化。
- QA 脚本自动阅读文章。

### Step 3: 第五关阅读问答

新增：

- `quizzes` schema。
- `QuizOverlay`。
- `MapProgressState.completedQuizIds / failedQuizCounts`。
- 答错执行 `wrongAnswer.actions`。
- 答对执行 `correctAnswer.actions`。
- QA 脚本自动先错一次，再答对。

### Step 4: 第五关内容接入

把第五关改成：

- 新增档案室。
- 阅读最后人类实验。
- 回答问题。
- 错误刷 4 个小怪。
- 正确刷 2 个小怪 + Boss。
- Boss 后读取身份档案。

### Step 5: 已完成，门开关最小系统

新增：

- `switches` schema。
- 开关交互。
- `MapProgressState.activeSwitchStateIds / activatedSwitchIds / switchActivationCounts`。
- `close_door / lock_door` 实际用于 maze config。
- `smoke_door_switch_lab` 验证开关不会造成死局。
- QA 脚本支持 `switch_activated`。

## 8. Validator 需要继续增强的地方

当前 validator 已经检查：

- 文章 interaction 是否存在。
- quiz 是否有且只有一个 correct option。
- wrong/correct actions 引用是否存在。
- resetPolicy 参数是否合法。
- switch 至少有一个 state。
- switch room / interaction / initialState 是否存在。
- switch state actions 引用是否存在。
- graph 是否能在所有 required objectives 后到达 exit。

门开关会让图验证更难。下一步可以继续增强：

- 检查 switch actions 是否会关闭唯一出口且没有回退。
- 对循环开关做更完整的状态空间搜索，而不是当前保守静态模拟。

当前生产规则：

- 官方关卡必须有 QA playthrough。
- 自动生成关卡必须先通过 graph，再通过 runtime dry-run。
- 复杂 switch 关卡如果 graph 不确定，就要求 LLM 生成额外 hint 或降低难度。
