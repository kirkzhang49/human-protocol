# Human Protocol /build Wave Chain Authoring Reference

日期：2026-06-20

## 结论

`/build` 后续战斗 authoring 的第一优先级不是做官方 boss 模板，而是做一个通用的 **Wave Chain Editor**：有限核心波次负责解锁门、推进目标和启动下一波；可选无限压力只负责战斗压力，永远不能作为开门条件。

这份文档是后续实现、QA、agent handoff 的 reference。凡是涉及 `/build` 里的怪物出现顺序、战斗门锁、波次清场开门、最后压力循环，都先按这里的语义判断。

## 不可破坏的规则

- 无限压力永远不能作为开门条件。
- 被门锁、objective、golden path 依赖的波次必须是有限核心波次。
- UI 只能允许最后一个波次勾选无限压力。
- 即使 UI 表现为“最后波次无限”，编译器也应把它拆成：有限核心最后波次完成后开门，再启动一个不参与门锁的压力循环。
- 波次链不能有循环依赖。
- 波次 2 只能在波次 1 已存在后选择；语义是“波次 1 清完后启动波次 2”。
- 压力循环不能被 `survive_wave` door lock、objective `requiredIds`、exit unlock 必需条件引用。
- 所有 spawn point 必须可达，不能在墙体、门体、出口、出生点危险半径里。
- mobile enemy budget 必须优先于设计自由度；同时存活小怪数量要受 `combatLimits` 和 `maxAlive` 控制。

## 当前 runtime 事实

现有 runtime 已有不少底层能力，后续重点是把它们以安全的 authoring 方式暴露给 `/build`。

- `WaveDefinition` 已支持 `enemies[]`、`reinforcements[]`、`interruptsActiveWave`、`reward`、`completionDialogueTrigger`。
- `WaveReinforcementDefinition` 已支持 `startsAfter`、`every`、`maxGroups`、`endless`、`maxAlive`、`requiresEliteAlive`。
- `LevelRuntimeEventAction` 已支持 `start_wave`、`open_door`、`unlock_door`、`complete_objective`、`grant_key_item`、`unlock_exit`、`queue_dialogue`、`set_environment_state`、`set_big_screen_state`。
- `GameWorld.markWaveCompleted()` 会派发 `wave_completed`，并自动打开绑定同一 `waveId` 的 `survive_wave` 门。
- `queueWaveStart(..., repeat: true)` 会清掉该 wave 的 triggered/completed 记录，所以不能直接把 repeat wave 作为门锁条件。
- `WaveDirectorSystem` 里 endless reinforcement 不会阻止 wave complete；这适合做压力，但仍要避免把 endless wave 本身当成 progression gate。

## Authoring 模型

### 核心概念

一个战斗链由两类节点组成：

- **Core Wave**：有限波次，负责开门、解锁门、完成 objective、给 key、启动下一波。
- **Pressure Loop**：无限或近似无限的压力循环，负责持续刷怪，不参与门锁和主线完成条件。

最常见结构：

```text
Core Wave 1 -> Core Wave 2 -> Core Wave 3 -> open/unlock door
                                      \
                                       -> start Pressure Loop R
```

玩家在 UI 里可以理解为“最后一波有无限压力”，但数据语义必须是“核心最后波清完先完成 progression，再启动压力循环”。

### MVP UI

`/build` 里建议新增一个战斗链面板，挂在 room / door / robot inspector 附近。

当前 `/build` 视觉是暗色工坊面板：左侧目录负责资产部署，中间 2D/3D 场景负责空间操作，右侧 inspector 负责当前实例参数。Wave Chain 不应新开一块重型独立编辑器，而应在这个结构里渐进接入：

- 左侧 `敌对单位` 目录继续只负责“放置一组怪”。
- 右侧 robot inspector 负责“这组怪属于哪一波、清完后做什么、是否是最后压力循环”。
- 中间场景继续负责拖动部署点；后续可在 2D/3D 里显示波次编号和 spawn point 徽标。
- 底部工具栏不新增复杂入口，避免和现有 `房间/门锁/家具/拾取/谜题/机关/机器人` 模式抢空间。
- 如果需要全局查看链路，在右侧 `波次` 卡内显示小型流程条，而不是打开 modal。

每个 Core Wave 必须能编辑：

- 波次名称。
- 所属房间。
- 触发方式：进入房间、互动完成、谜题完成、route switch 输出、手动由上一波启动。
- 怪物组：archetype、count、tier。
- 刷新位置：一个或多个 spawn point，可在 2D/3D 里拖动。
- 清场后动作：启动下一波、开门、解锁门、完成 objective、给 key。

最后一个 Core Wave 可以额外显示：

- `无限压力` checkbox。
- 压力怪物类型。
- 每次刷新数量。
- 首次延迟 `startsAfter`。
- 间隔 `every`。
- 同时存活上限 `maxAlive`。

非最后波不显示或禁用 `无限压力` checkbox。

### 右侧 Inspector 推荐结构

当前截图里右侧已经有 `类型`、`波次`、`部署` 三张卡。后续不要推翻这个结构，建议直接扩展：

```text
类型
  基础单位：维修无人机 / 夹钳机器人 / 护盾技师 / 管理者精英
  首领预设：策展主管 Boss

波次
  数量 / 强度 / 威胁
  所属波次：1 / 2 / 3
  下一波：无 / 波次 2 / 波次 3
  清完后：开门 / 解锁门 / 给 key / 完成目标
  [ ] 最后一波压力循环

部署
  所在房间
  刷新点列表
  + 添加刷新点
```

波次流程条建议使用现有红色危险色和金色确认色：

```text
[1 核心] -> [2 核心] -> [3 开门] -> [压力循环]
```

- 核心波次：用现有红/橙敌对色。
- 当前选中波次：沿用蓝色描边或青色高亮。
- 开门动作：用金色或绿色 check 状态。
- 压力循环：用粉红/红色虚线、脉冲或 `∞` 标记，并明确写“不阻塞门”。

不要把 wave chain 做成原始 JSON 或 node graph。这个 UI 的目标是让设计者快速做“1 打完出 2，最后开门并持续施压”，不是暴露所有 runtime event。

### 右侧少一个怪类型的已知问题

当前左侧 `敌对单位` 目录显示 5 个条目，但右侧 robot inspector 的 `类型` 只显示 4 个。这不是截图挤压，而是 inspector 逻辑过滤了 preset：

- `src/build/BuilderAssetCatalog.ts` 里 `builderRobotCatalog` 有 5 项，其中 `策展主管 Boss` 是 `presetId: "museum_curator_boss"`。
- `src/build/BuilderAssetBrowser.tsx` 左侧目录显示完整 `builderRobotCatalog`，所以能看到 5 项。
- `src/build/BuilderInspectorPanel.tsx` 右侧 `RobotInspector` 使用 `builderRobotCatalog.filter((entry) => !entry.presetId)`，所以主动隐藏了 Boss preset。

修复方向：

- 右侧不要把 Boss preset 混进 4 个基础 archetype 的 2x2 组里。
- 保留 4 个基础单位为 `基础单位`。
- 在下面加一张全宽或半宽 `首领预设` 卡，显示 `策展主管 Boss / Level 3 博物馆首领预设`。
- 选中 Boss preset 时，标题和卡片应显示 `策展主管 Boss`，不能只显示它底层的 `护盾技师` archetype。
- 切换回基础单位时，应清理 Boss preset 的特殊 combat tuning，避免保留 `tierLabel: 策展主管`、boss visual 或过高血量倍率。
- 如果后续新增更多 boss preset，右侧只扩展 `首领预设` 区，不改变基础 2x2。

### 推荐 UI 文案

- `核心波次`：清完后推进关卡。
- `压力循环`：清完核心波后持续刷怪，不阻塞门。
- `清完开门`：绑定有限核心波。
- `下一波`：当前波清完后出现。
- `刷新点`：拖动机器人部署位置。
- `同时最多`：限制压力循环存活数量。

避免使用玩家看不懂的 raw 文案，例如 `repeat wave`、`completedWaveIds`、`survive_wave source`。

## 编译策略

### 有限核心链

BuilderProject 里可以引入类似 `combatChains[]` 或强化现有 `robots[].wave` metadata。无论内部 schema 怎么设计，编译结果应遵守以下规则：

```text
Core Wave A:
  waves[A].enemies = authored groups
  waves[A].trigger = selected trigger
  runtimeEvents / objective event:
    on wave_completed A -> start_wave B

Core Wave B:
  waves[B].enemies = authored groups
  trigger omitted or manual
  on wave_completed B -> open_door targetDoor
```

若门使用 `survive_wave` lock，门只能绑定有限核心波：

```text
door.lock = { type: "survive_wave", waveId: "core_wave_b" }
```

不要把 endless pressure wave 写入门锁。

### 最后无限压力

当 UI 勾选“最后一波无限压力”时，编译器应拆成两个 wave：

```text
core_wave_last:
  finite enemies
  on complete:
    - unlock/open door
    - complete objective if needed
    - start_wave pressure_loop

pressure_loop:
  enemies may be empty or very small opener group
  reinforcements:
    - endless: true
    - maxAlive: authored limit
    - startsAfter/every from UI
  no door lock
  no required objective dependency
```

如果现有 runtime 对 empty `enemies[]` 不稳定，就给 `pressure_loop` 一个很小的 opener group，或把 pressure loop 编译为一个有限 wave 的 endless reinforcement；但无论采用哪种底层结构，都不能让 pressure loop 成为门锁完成条件。

### 顺序出现

“打完 1 才出 2”优先编译成 `wave_completed -> start_wave`，不要依赖 `waves[]` 数组自然顺序。数组顺序只能作为 fallback，不应作为 authoring 主语义。

### Official import 的原生首波

从官方关卡导入 `/build` 时，有些房间已经带着真实 3D 运行时首波，例如 Level 2 进入生活模拟大厅后触发的 `level_02_living_swarm`。这种房间里，UI 上新建的 `波次 1` 不是玩家实际遇到的第一批怪，而是 **原生首波清完后的第二阶段**。

编译规则：

```text
imported room-entered source wave -> builder wave chain order 1 -> builder wave chain order 2 -> ...
```

- 如果同一房间存在 imported `room_entered` source wave，builder `order: 1` 的 wave 不再直接绑定 `room_entered` trigger。
- 编译器生成 `wave_completed(source_wave) -> start_wave(builder_order_1)` runtime event。
- 门锁只看作者在 `/build` 里选择的有限核心波次；清完 source wave 不会打开绑定 builder wave 的门。
- source wave 仍是真实 3D 战斗，玩家必须能正常清理；它只是 prelude，不是门锁目标。
- Level 3 继续按 heritage official chain 处理，避免破坏 museum/boss/lighting 特例。

这样可以保留官方导入已有的真实战斗手感，同时让 `/build` 的波次 UI 语义保持一致：`波次 1` 永远表示作者新建链路的第一个核心节点。

### 刷新位置

每个 authored spawn point 应编译为 stable spawn group：

```text
spawnGroups:
  id: chain_room_wave_01_spawn_a
  roomId: targetRoom
  positions: [[x, y, z], ...]
```

怪物组引用 `from: spawnGroupId`。不要把“房间中心附近随机刷”作为官方 authoring 的唯一方式。

## Validator 要求

新增或强化以下检查：

- `combat.wave_chain.cycle`：波次链有循环。
- `combat.wave_chain.missing_next`：下一波引用不存在。
- `combat.wave_chain.non_last_endless`：非最后波开启无限压力。
- `combat.wave_chain.endless_blocks_door`：无限压力被门锁引用。
- `combat.wave_chain.endless_blocks_objective`：无限压力被 objective requiredIds 引用。
- `combat.wave_chain.open_door_missing`：清场开门引用不存在的门。
- `combat.wave_chain.spawn_missing_room`：刷新点所属房间不存在。
- `combat.wave_chain.spawn_blocked`：刷新点落在墙、门、出口、出生保护半径或不可达区域。
- `combat.wave_chain.mobile_budget`：核心波 + 压力循环可能超过 mobile 同屏敌人数预算。
- `combat.wave_chain.no_completion_action`：有限核心链最后没有 progression action。

这些错误应能被生成器或后续 Codex session 直接理解和修复。

## QA 验收

实现时至少需要一个 smoke config，覆盖：

- 进入房间触发 Core Wave 1。
- Core Wave 1 清完启动 Core Wave 2。
- Core Wave 2 清完打开一扇 `survive_wave` 或 action-open door。
- Core Wave 2 完成后启动 Pressure Loop。
- Pressure Loop 持续增援，但门已经可通行。
- validator 确认 pressure loop 没有被门锁或 objective 引用。

推荐命令：

```bash
npm run qa:builder
npm run smoke:campaign
npm run qa:playthrough
npm run build
git diff --check
```

如果改了 `/build` UI 或 3D spawn point 可视化，还需要 desktop + mobile landscape 浏览器 QA。

## 与 Boss Phase 的关系

Boss phase 不应该先做成另一套特殊系统。先完成 Wave Chain Editor，再让 boss phase 复用它：

```text
Boss Phase 1 = Core Wave 1 + boss visual/state
Boss Phase 2 = Core Wave 2 + stronger pressure
Boss Final = finite boss/core wave clears -> unlock exit
Pressure Loop = boss 存活或最后阶段期间的非门锁压力
```

这样 boss、普通守门战、答错刷怪、route switch 召唤怪，都能复用同一套 wave chain、completion action、validator 和 QA。

## 推荐实施顺序

1. 先修 robot inspector 的目录一致性：右侧显示 4 个基础单位 + `策展主管 Boss` 首领预设，并正确清理/套用 preset combat tuning。
2. Builder schema：新增 combat chain 或 wave chain authoring 层。
3. Editor UI：波次列表、下一波选择、刷新点拖动、最后压力循环 checkbox。
4. Compiler：有限核心波、`wave_completed -> start_wave`、清场开门、压力循环拆分。
5. Validator：固化“无限永远不能开门”的规则。
6. Smoke config：证明链条、开门和压力循环可玩。
7. Browser QA：确认 spawn point、门锁提示、压力循环不堵路。
8. 再推进 boss phase，让 boss 复用 wave chain。
