# Human Protocol One-Time Runtime Systems

这份文档定义哪些能力要写成一次性的通用系统，哪些内容以后只通过 config 生成。目标是让官方 5 关、玩家生成关卡、本地机器人生成关卡都走同一套 runtime，而不是每关写一堆专属逻辑。

## 0. 总原则

代码负责“动词”，config 负责“名词和顺序”。

代码里只应该写一次：

- 玩家怎样移动、攻击、交互、开门、拾取、死亡、复活。
- 门怎样判断能不能开，怎样播放动画，怎样处理碰撞。
- 房间怎样检测进入/离开，怎样触发灯光、对白、刷怪和性能降级。
- 目标怎样开始、完成、切到下一个目标。
- config 怎样验证、修复默认值、限制预算。

config 里每关都可以改：

- 有几个房间。
- 门连到哪里。
- 钥匙放在哪里。
- 哪个终端打开哪扇门。
- 哪个房间刷什么怪。
- 哪句对白什么时候出现。
- 终点在哪里。

一句话：

```text
新玩法类型需要写系统；新关卡内容只写 config。
```

## 1. Runtime 边界

| 一次性系统 | 读取 config | 写入状态 | 以后可通过 config 改什么 |
| --- | --- | --- | --- |
| `ConfigPackStore` | pack、level、asset manifest | 当前激活关卡 | 切换官方关卡、玩家关卡、生成关卡 |
| `ConfigValidator` | 所有 config | validation report | 检查死路、缺钥匙、预算超标 |
| `MapProgressState` | map/objective 初始状态 | 门、钥匙、房间、目标进度 | 复活/重开/存档恢复 |
| `ObjectiveTrackerSystem` | `objectiveChain` | 当前目标、完成目标 | 每关目标顺序和完成条件 |
| `InteractionSystem` | `interactions/keyItems` | 完成互动、获得钥匙 | 终端、检查、门禁、记忆回声、出口 |
| `DoorSystem` | `doors/locks` | 门开关状态、碰撞状态 | 门位置、锁类型、门禁提示 |
| `RoomDirectorSystem` | `rooms/room triggers` | 当前房间、访问记录 | 进房间对白、灯光、刷怪、恐怖节奏 |
| `MapGeometryRenderer` | `rooms/doors/props/material keys` | 渲染对象池 | 简单房间、墙、门框、面板、碰撞块 |
| `WaveTriggerBridge` | `waves` + trigger 条件 | 波次启动记录 | 进房间刷、开门刷、目标完成刷 |
| `AssetResolver` | `visualKey/assetRefs` | 资源缓存 | 同一关换贴图、模型、音效 |
| `SaveProfileStore` | level id、pack id | 通关、升级、生成历史 | 记录每个 pack 的玩家资料 |

## 2. ConfigPackStore

职责：

- 读取内置官方 pack。
- 未来读取玩家导入 pack。
- 未来读取本地机器人生成 pack。
- 暴露统一入口 `activeLevelConfig` 或 `getLevelConfig(packId, levelId)`。

不能写进这里：

- 某关专属开门逻辑。
- 某关专属剧情触发。
- 某个敌人的临时生成规则。

MVP：

- 内置 pack 可运行。
- Level 01 继续从 config 读取。
- 为 Level 02 预留 `getBuiltInLevelConfig("level_02...")`。

## 3. ConfigValidator

职责：

- 检查 config 能不能运行。
- 给本地机器人返回可修复错误。
- 防止玩家导入坏 pack 导致白屏。

必须检查：

- 每个 `roomId` 存在。
- 每个 `door.fromRoomId/toRoomId` 存在。
- 从出生房间能走到出口房间。
- 钥匙不能放在自己锁住的唯一通路后面。
- 每个 `objectiveId/keyItemId/interactionId/waveId` 引用都存在。
- 每个互动物位置在房间 bounds 内。
- 同屏敌人数量不超过 mobile 预算。
- 资源总大小不超过目标平台预算。
- 每个锁门都有 `lockedMessage`。

输出：

```ts
interface ConfigValidationReport {
  ok: boolean;
  errors: { code: string; path: string; message: string }[];
  warnings: { code: string; path: string; message: string }[];
  budget: {
    estimatedActiveEnemies: number;
    estimatedAssetMb: number;
    criticalPathRooms: number;
  };
  graph: {
    startRoomId: string | null;
    exitRoomId: string | null;
    criticalPathRoomIds: string[];
    objectivePath: {
      objectiveId: string;
      title: string;
      startsWhen: string;
      completesWhen: string;
      requiredIds: string[];
    }[];
    locks: {
      doorId: string;
      lockType: string;
      requires: string[];
      blocksCriticalPath: boolean;
    }[];
    puzzles: {
      puzzleId: string;
      type: "hit_sequence" | "code_lock";
      expectedInput: string;
      opensDoorId?: string;
      unlocksExit: boolean;
    }[];
    reachability: {
      rooms: string[];
      doors: string[];
      keyItems: string[];
      interactions: string[];
      puzzles: string[];
      objectives: string[];
      exitUnlocked: boolean;
      exitInteractionReady: boolean;
    };
  };
}
```

## 4. MapProgressState

职责：

- 保存玩家在当前关卡地图里的进度。
- 让复活、重开、暂停、存档都能恢复门/钥匙/目标状态。

建议结构：

```ts
interface MapProgressState {
  currentRoomId: string;
  visitedRoomIds: string[];
  openedDoorIds: string[];
  unlockedDoorIds: string[];
  collectedKeyItemIds: string[];
  completedInteractionIds: string[];
  activeObjectiveId: string | null;
  completedObjectiveIds: string[];
  triggeredWaveIds: string[];
}
```

config 可以改变房间、门、钥匙、目标；代码只维护这些 id 的状态。

## 5. ObjectiveTrackerSystem

职责：

- 根据 `objectiveChain` 决定当前目标。
- 接收事件：`level_start`、`room_entered`、`interaction_completed`、`key_collected`、`door_opened`、`wave_completed`、`boss_dead`、`exit_unlocked`。
- 完成目标后切到 `nextObjectiveId`。
- 给 HUD 输出当前目标标题、细节、进度。

以后只改 config 就能做：

- 找钥匙。
- 检查 3 个物品。
- 打开门。
- 撑过一波。
- 读终端后逃跑。
- Boss 死亡后开出口。

## 6. InteractionSystem

职责：

- 检测玩家是否靠近或准星对准可互动对象。
- 在 mobile 显示一个交互按钮。
- 在 desktop 显示 `E` 交互提示。
- 执行标准互动动作。

第一版互动类型：

- `pickup_key`：获得钥匙/门禁片/记忆片。
- `pickup_story`：获得铁棒、手枪等剧情道具。
- `inspect`：检查物体，触发对白或目标完成。
- `terminal`：打开终端，触发剧情、目标或门锁。
- `door_panel`：尝试开门。
- `repair_panel`：按住修复。
- `memory_echo`：中屏闪现记忆。
- `exit`：进入终点。

不要在 InteractionSystem 里写“Level 02 厨房相框专属逻辑”。相框只是：

```ts
{ type: "inspect", dialogueTrigger: "faceless_photo", completesObjectiveId: "inspect_family_photo" }
```

## 7. DoorSystem

职责：

- 根据 `DoorLockDefinition` 判断门能不能开。
- 门关着时提供碰撞。
- 门开时播放动画并更新碰撞。
- 门打不开时显示原因。
- 门打开时发事件 `door_opened`。

锁类型：

- `none`
- `key_item`
- `objective_complete`
- `survive_wave`
- `repair_panel`
- `memory_choice`
- `boss_dead`
- `inventory_count`

config 能改：

- 门的位置、大小、朝向。
- 默认开/关/锁。
- 要哪把钥匙。
- 要哪个目标完成。
- 缺条件时提示什么。
- 开门音效和镜头轻震。

## 8. RoomDirectorSystem

职责：

- 判断玩家当前在哪个房间。
- 进入房间时触发一次性事件。
- 离开房间时关闭不需要的远房间细节。
- 管理当前房间/相邻房间的渲染质量。

config 能改：

- 房间气氛：`quiet / uneasy / combat / boss / reveal`。
- 进入对白。
- 环境压力值。
- 灯光颜色和强度。
- 房间触发的波次。
- 远景机器人剪影。

性能规则：

- 当前房间高质量。
- 相邻可见房间中质量。
- 不可见远房间只保留碰撞和门状态，必要时完全不渲染。

## 9. MapGeometryRenderer

职责：

- 从 config 生成低成本地图几何。
- 支持地板、墙、门框、门、终端、简单道具、碰撞块。
- 使用共享材质、texture atlas、visualKey，不给每个房间创建独立大资源。

第一版不做复杂建模：

- 房间用 box/plane 组合。
- 门用一个实体门板加门框。
- 终端/钥匙用简单 mesh + 贴花。
- 背景高级感靠灯、湿地面、玻璃、标识、遮挡和音效。

config 能改：

- 房间尺寸。
- 门位置。
- 材质 key。
- prop visualKey。
- 碰撞盒。

## 10. WaveTriggerBridge

职责：

- 把战斗波次从“固定时间开始”扩展成“事件触发”。
- 让波次可以挂在房间、门、目标、终端、Boss 阶段上。

触发例子：

```ts
{ type: "room_entered", id: "sleep_pod_room" }
{ type: "door_opened", id: "exit_door" }
{ type: "interaction_completed", id: "read_sleep_record" }
{ type: "objective_completed", id: "restore_power" }
```

config 能改：

- 哪个房间刷怪。
- 开哪扇门刷怪。
- 完成哪个终端后刷怪。
- 增援间隔。
- 最大同屏敌人。

## 11. AssetResolver

职责：

- 把 `visualKey` 转成真实材质、贴图、模型、音效。
- 处理资源 fallback。
- 控制 mobile 资源预算。
- 后续支持玩家导入资源。

config 只写：

```ts
visualKey: "yellow_access_door"
```

不要让每个关卡直接引用到处散落的文件路径。资源统一经过 asset manifest。

## 12. SaveProfileStore

职责：

- 存官方关卡进度。
- 存玩家生成 pack 的游玩记录。
- 存当前关卡的门/钥匙/目标状态。
- 存长期升级、Memory、build 偏好。

必须记录：

- `packId`
- `levelId`
- `completedLevelIds`
- `bestTime`
- `bestMemory`
- `mapProgress`
- `playerProgress`

以后桌面版要能把这些资料迁移到本地文件。

## 13. Debug And QA Tools

一次性 QA 工具也很重要，否则 config 生成会越来越难查。

需要：

- `validateConfig(pack)`：检查 config。
- `simulateCriticalPath(level)`：确认出生点到出口路径。
- `printDoorGraph(level)`：打印房间门图。
- `listBrokenRefs(level)`：列出坏引用。
- `budgetReport(level)`：估算敌人数和资源大小。
- `debugOverlay`：开发时显示当前房间、目标、门状态。

这些工具只在开发/调试出现，玩家正式 UI 不显示。

## 14. 什么以后不用写代码

这些只改 config：

- 加一个房间。
- 加一扇普通门。
- 加一扇需要钥匙的门。
- 加一张门禁卡。
- 加一个终端。
- 加一段中屏剧情。
- 加一个检查物。
- 加一个出口。
- 加一波敌人。
- 改敌人数量。
- 改掉落概率。
- 改目标顺序。
- 改通关文案。

## 15. 什么仍然需要写代码

这些属于新系统能力，才需要写代码：

- 新交互类型，例如接线小游戏。
- 新门锁类型，例如转盘密码。
- 新敌人 AI 行为。
- 新武器机制。
- 新渲染能力，例如真实镜面或复杂粒子。
- 新平台能力，例如广告 SDK、云存档。
- 新资源导入压缩流程。

判断标准：

```text
如果只是换内容，用 config。
如果创造了新的规则动词，写系统。
```

## 16. 推荐实现顺序

### Phase 1：让 config 真的能驱动地图

1. `MapProgressState`
2. `ObjectiveTrackerSystem`
3. `InteractionSystem v1`
4. `DoorSystem v1`

完成标准：

- 第一关仍然能跑。
- 第一关的铁棒、手枪、电梯能通过 interaction config 表达。
- 一扇锁门能用 key item 打开。
- HUD 能显示当前目标。

### Phase 2：让多房间可玩

1. `MapGeometryRenderer v1`
2. `RoomDirectorSystem v1`
3. `WaveTriggerBridge`
4. `ConfigValidator v1`

完成标准：

- 一个 3 房间测试关能跑。
- 门有实体碰撞。
- 进房间能触发对白和刷怪。
- validator 能发现出口不可达、钥匙放错、坏引用。

### Phase 3：让生成关卡可靠

1. `AssetResolver`
2. custom pack import/export
3. generated pack validation report
4. debug room graph preview

完成标准：

- 本地机器人或人类可以只写 JSON/TS config 生成一关。
- 坏 config 不会白屏。
- 生成关卡能被保存、重开、分享。

## 17. 当前落地状态

已落地到 runtime：

- `MapProgressState`：已进入 `GameSessionState`，记录当前房间、门、钥匙、互动、目标、波次和已击败 actor。
- `ObjectiveTrackerSystem v1`：已进入 game loop，负责从 `objectiveChain` 启动和推进当前目标。
- `InteractionSystem v1`：已进入 game loop，能检测 `keyItems/interactions/doors`，桌面用 `E`，手机出现交互按钮。
- `DoorSystem v1`：已进入 game loop，能按 config 同步门碰撞；出口解锁后会打开对应门。
- `ConfigValidator v1`：已能检查 room/door/key/interaction/objective 引用、出口连通性、钥匙是否放在自己锁住的门后、移动端路径复杂度和敌人预算预警。
- `RoomDirectorSystem v1`：已进入 game loop，负责判断玩家所在房间、记录访问状态，并在跨房间时给中屏提示和轻镜头反馈。
- `MapGeometryRenderer v1`：已能从 room config 生成地板、墙体、门框、钥匙标记和交互终端标记；房间墙碰撞由 `DoorSystem` 同步为 obstacle。
- `WaveTriggerBridge v1`：已进入 game loop，能消费 `level_start / room_entered / door_opened / interaction_completed / objective_completed / wave_completed` 等 runtime events，并按 `wave.trigger` 排队启动波次。
- `RuntimeEvent v1`：`LevelDefinition.events` 已支持 `trigger + actions`，关卡可以用纯 config 在事件发生时播放对白、提示、震镜头、给记忆经验、打开三选一升级、打开剧情选择、设置/清除定时环境状态、调整长期路线档案、开门/开出口、发钥匙、启动波次和给短暂 tempo surge。
- `ChoiceEvent v1`：`LevelDefinition.choices` 已支持三选一路线/剧情选择；玩家选择会写入 `mapProgress.selectedChoiceIds`，可作为 `memory_choice / choice_selected` 门锁条件，也可以用 `routeDeltas` 写入长期 `campaignRouteProfile`。
- `CampaignRouteProfile v1`：`UserProfile` 已持久化 `campaignRouteProfile`，记录路线分数、最近 80 次剧情选择和当前 dominant route。关卡可配置 `campaignRoutes` 元数据，选择项可写 `routeDeltas`，事件可用 `adjust_campaign_route`；后续 Level 05 结尾可直接读取玩家偏向。
- `EnvironmentState v1`：`LevelDefinition.environmentStates` 已支持房间或全图状态；runtime 可用 action 设置/清除状态，`duration` 可写在状态或 `set_environment_state` action 上，`EnvironmentStateSystem` 会自动过期；渲染层会给对应房间低成本 tint、glow 和 point light，适合做“墙纸剥落 / 警报 / 核心启动”。
- `BossPhase v1`：`LevelDefinition.bossPhases` 已支持按敌人 archetype 和血量阈值触发 action；第一关和第二关的主管半血台词/压迫反馈已从 `EnemyAISystem` 特例迁到 config。
- `ConfigValidator refactor`：validator 已统一使用 `createLevelReferenceSets` 生成 room/door/key/objective/wave/puzzle/choice/environment/boss phase 引用集合，避免后面每加一种 config 能力都复制校验逻辑。旧的 `enemy_health_below` 假触发和敌人 `hasTriggeredHalfHealth` 状态已删除，血量阶段统一走 `bossPhases`。`inventory_count` 门锁已补齐 runtime 和 graph 逻辑，可用于后续“收集 3 个展项档案开中央门”。
- `EnemyTier v1`：同一个 enemy archetype 现在可以在 wave config 里设为 `normal / elite / leader / boss`。等级会自动影响血量、伤害、攻击频率、威胁权重、碰撞半径、体型、灯色和 texture atlas；小怪如果被标为 `elite / leader / boss` 会退出 InstancedMesh，改走详细渲染，避免“精英看起来还是普通小怪”。后续关卡优先用“骨架 + tier + 颜色/贴图/光线”制造 Boss 差异，不优先新增手画 Boss。
- `AssetResolver v1`：已提供 `visualKey/materialKey` 到轻量材质、fallback primitive、发光色、金属度和粗糙度的统一解析；`MapGeometryRenderer`、config door、部分场景障碍已开始通过 resolver 取材质。
- 第一关 config 接入：铁棒、手枪、电梯 interaction 已登记；电梯门已登记为 config door；目标链已接入 HUD。
- 第二关 config 事件接入：打倒家政主管后由 `level_02_host_reward_upgrade` 给 `+18` 记忆并打开 `core_plating / rail_overcharge / field_medicine` 三选一；灯控顺序完成后由 `level_02_light_sequence_memory` 给额外记忆奖励并设置 `level_02_family_mask_off` 环境状态；`level_02_memory_route_preview` 已作为后续路线选择样例，并写入 `human_layer / repair_logic / unknown_signal` 三条长期路线。
- 第三到第五关 config v1：`levels03To05.ts` 已提供 `人类博物馆 / 记忆诊所 / 回收核心` 三关，并接入 campaign pack；每关都有地图、门锁、目标链、波次、头领/Boss、对白、奖励和出口。当前只做可通关 v1，不做 Boss 行为变体和最终 ending 专属页。
- Campaign runtime pass-through QA：已固化为 `npm run smoke:campaign`，用真实 `GameWorld` 按 campaign 顺序自动跑通 `level_01_maintenance_bay -> level_02_residential_simulation -> level_03_human_museum -> level_04_memory_clinic -> level_05_reclamation_core`，每关都按 config 主线完成 objective、奖励、升级/选择和出口 transition，最终全部进入 `victory`。这证明当前 1-5 关不是只有静态 validator 通过，而是运行时链路也能完成。
- `Custom Config Pack v1`：`ConfigPackStore` 已支持内置 pack + localStorage custom pack 统一查询；外部 JSON 可以是完整 `hp.config.v1` pack，也可以是单个 `LevelDefinition`，导入时会 validate、阻止官方 level id 冲突、阻止已保存 custom level id 冲突，并保存为最多 12 个本地 pack。`GameWorld.loadLevel`、URL `?level=` 和下一关查询都已支持 custom level。
- `ConfigPackPanel v1`：title 页面已接入折叠的“本地关卡”工具，可选择官方/本地关卡、导出当前关卡 pack、导出基础 pack、导入 JSON、保存、删除本地 pack。导出官方关卡时会自动生成 `_custom` id，方便本地机器人拿去改完再导入。
- `Localized Config Copy v1`：官方 1-5 关的 config 剧情文本现在有运行时本地化入口，覆盖标题、flow、目标链、wave 提示、对白、选择、出口提示、门锁/钥匙/奖励/密码/打灯反馈、升级卡和 HUD。`GameWorld.setLanguage` 会持久化语言并刷新 UI；title 和 playing 都有系统设置入口，移动端可直接点右上角 `设置 / Settings` 切换中英文。当前 custom pack 仍默认使用 pack 自己的原文，后续要在 pack schema 里加 `i18n` 字段，让本地机器人导出的玩家关卡也能带多语言。
- UI 接入：`MissionOverlay` 会显示交互提示；`MobileControls` 会显示移动端交互按钮。
- 手机横屏入口：移动端首次触摸/点击会尝试 fullscreen + `screen.orientation.lock("landscape")`；竖屏时显示横屏提示并阻止操作。iOS Safari 不保证支持真实 lock，但 guard 和横屏布局会继续工作。
- Smoke level：`smoke_key_door_lab` 已作为最小三房间钥匙门样例进入内置 pack，可通过 `?level=smoke_key_door_lab` 直接运行；开第一扇门会触发 `smoke_hall_contact`，读终端会触发 `smoke_terminal_alarm`，默认入口仍是第一关。

仍未完成：

- `ChoiceEvent / EnvironmentState / BossPhase` 目前还是 v1：能触发、能记录、能渲染基础状态，并且已有长期路线档案和定时环境状态；但还没有复杂条件表达式、Boss 行为参数覆盖、环境危险伤害、按路线动态改奖励池或结尾 UI。
- `EnemyTier v1` 目前是“等级模板 + config override”，不是新 AI 行为树。它能低成本改变读感和数值，但真正的 Boss 阶段行为变化还需要后续 `bossPhase.behaviorModifiers`。
- `RoomDirectorSystem` 还只做房间进入和提示，尚未按房间触发灯光/刷怪/性能降级。
- `MapGeometryRenderer` 还只覆盖基础房间几何，后续要接 `visualKey/materialKey/prop` 和共享材质缓存。
- 第一关主波次仍保留顺序启动，这是为了不破坏当前首关手感；后续多房间关卡建议优先使用 `wave.trigger`。
- `AssetResolver v1` 目前只解析轻量材质和 fallback primitive，尚未接 GLB、texture atlas、音效引用、资源预算估算和玩家导入资源。
- `npm run smoke:campaign` 目前验证的是 config 主线通关和 custom pack 导入解析，不模拟真实移动、瞄准、敌人 AI 消耗、帧率和镜头舒适度；后续每次改 UI/手感/性能后仍需要补一次手玩或浏览器视觉 QA。

下一步最适合做：

```text
Generated level template library + prompt adapter
```

原因：现在 JSON pack 已经能导入、校验、保存、选择运行；下一步要给本地机器人稳定样板，提供“4 房间钥匙/灯序/Boss/出口”“三锁臂”“治疗椅选择”等可组合模板，让生成关卡更少写错引用和路径。
