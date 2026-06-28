# Human Protocol — 本地 AI 密室 Config Planner（调研 + 架构 + 可执行计划）

> **🧭 其他 agent 入口（先读这里）**
> - 工具实现 + 跑法：**`games/human-protocol/scripts/ai/README.md`**（含资产桩 loader 的运行坑）。
> - 本设计文档 = 单一事实源（IR/标签/风险/patch/模型/微调全在此）。
> - 已实现且跑通（Phase 0–1 确定性核心）：`scripts/ai/{extractConfigCard,copyScan,demoEscapeRoom}.ts`、`lib/asset-stub-loader.mjs`。
> - 模型：**Qwen3-4B-Instruct-2507**（一个模型干 JSON 规划 + 中英文故事，作者侧 Ollama，**不进游戏包**，总盘 ~2.5GB）。
> - 微调数据格式从 Phase 0 起就按 **§12** 落，避免回填。根 `AGENTS.md` 有指针。

> 状态：**规划文档（draft）**。设计 + Phase 0–1 已实现（纯增量脚本），不改 runtime。
> 目标读者：关卡作者 / config 工程 / 落地小模型研究。
> 约束复述：模型**永不**直接生成 `LevelDefinition` TS；它只输出**受限 JSON**，由 deterministic
> validator/compiler/solver 应用与拒绝；任何建议默认是**预览**，编译 + 校验通过后才能一键 apply；
> 永远不破坏可玩性。

本文所有"代码事实"均来自对仓库的真实只读检查（rg + 抽样精读 + 一次 7-reader 并行深读工作流），
关键处带 `file:line` 锚点。下面先给一句话结论，再展开。

**一句话**：HP 的 config 体系**已经具备了做本地 AI planner 的几乎全部地基**——纯函数化的
compiler（`compileBuilderProjectToLevel`）、纯函数化的 validator（`validateLevelConfig` → `{ok,errors,warnings,budget,graph}`）、
已有的语义图（`buildSemanticGraph` / `computeTopology`）、20 个 Node 可导入的关卡语料、以及一本规则化的
故事圣经。缺的不是模型能力，而是：① 一个把这些纯函数串起来、抽出 **ConfigCard IR** 的 Node 层；
② 一套**对齐 Builder 枚举**的 typed patch 操作；③ 一个 schema 版本/迁移注册表的显式化。模型只做"分类 +
检索 + 提议 typed patch + 描述迁移"，**落地全靠确定性管线**。

---

## 0. 现状盘点（代码事实）

### 0.1 两套 schema、三个版本号、一个根缺版本

| 层 | 类型 | 版本号 | 位置 |
| --- | --- | --- | --- |
| Config Pack | `ConfigPackDefinition` | `schemaVersion: "hp.config.v1"` | `src/game/config/ConfigPackStore.ts:60` |
| Builder 工程 | `BuilderProject` | `schemaVersion: "hp.builder.v1"`（root 必填字面量） | `src/build/BuilderTypes.ts:222` |
| Level 地图 | `LevelMapConfig` | `schemaVersion: "hp.map.v1"` | `src/game/config/schema/levelConfig.ts:1013` |
| **Level 根** | `LevelDefinition` | **无 schemaVersion**，只有 `authoringProfile?: "internal"\|"generated"` | `levelConfig.ts:1314-1317` |

> 现实是"分层版本"：pack/builder/map 各有版本号，但 `LevelDefinition` 根没有；`BuilderProject` 用
> 大量 `字段? // absent in legacy → default` 做隐式迁移（pickups/puzzles/routeSwitches/story/lighting
> 都是 pre-v9 可缺省）。**没有任何 migration registry**（rg 全仓无 `migrat*`/`fromVersion` 注册表）。
> 这是第 6 章迁移计划的起点。

### 0.2 关键纯函数清单（Node 可直接 import，无需抽包）

仓库已用 `tsx` 跑 TS（见 `package.json` 的 `smoke:age-adapter`）。下列模块**纯、无 React/DOM 依赖**，
Node 脚本可经 `tsx --tsconfig tsconfig.app.json` 直接 import：

- 校验入口：`validateLevelConfig(level, options?) → ConfigValidationReport` `ConfigValidator.ts:42`；
  `assertValidLevelConfig` `:85`。返回 `{ ok, errors[], warnings[], budget{estimatedActiveEnemies,
  estimatedAssetMb, criticalPathRooms}, graph:PuzzleGraphExplanation }`。
- 解谜可达图：`explainPuzzle(level) → PuzzleGraphExplanation` `puzzleGraphValidator.ts:74`（含
  `reachability{rooms,doors,keyItems,interactions,puzzles,objectives,waves,exitUnlocked,exitInteractionReady}`）。
- Builder→Level 编译：`compileBuilderProjectToLevel(project) → { level: LevelDefinition\|null, issues }`
  `compileBuilderProjectToLevel.ts:105`；`builderLevelId` `:64`；`sharedEdge` `:1082`；
  `sanitizeGeneratedLevelMaterialFamilies` `:493`。
- Builder 语义图/拓扑：`buildSemanticGraph(project)` `builderDependencyGraph.ts:53`（markers:
  exit/puzzle/lock/story/enemy + links: key/puzzle/wave）；`computeTopology(project) → {pathRoomIds,
  lockChain, pressure, exitReady}` `BuilderTopology.ts:29`。
- Builder 谜题：`validateBuilderPuzzles(project)` `BuilderPuzzleCatalog.ts:288`、`hasPlayablePuzzleChain` `:392`、
  `normalizeBuilderPuzzles` `:229`（legacy→instance 迁移）。
- 反向导入（round-trip）：`builderProjectFromLevel(level) → BuilderProject\|null` `BuilderLevelImport.ts:20`；
  `builderProjectFromBuiltInLevel(levelId)` `:14`。
- Pack：`getLevelConfig` `:115`、`listPlayableLevels` `:149`、`exportLevelConfigPackJson` `:307`、`parseConfigPackText` `:211`。
- Builder 工程纯校验：`validateBuilderProject(project)` `BuilderStorage.ts:129`（**纯**）；`summarizeBuilderSaveProject` `:108`（纯）。

**浏览器耦合（Node 不能直接读，但能 import 签名）**：`BuilderStorage.ts` 的 load/save 走 `window.localStorage`
（key：`human-protocol-builder-draft-v1`、`human-protocol-builder-save-slots-v1`、`ConfigPackStore` 的
`human-protocol-custom-config-packs-v1`）。saved drafts/草稿要进语料，**必须先在浏览器侧导出 JSON**，Node 不能直接掏。
**React 耦合**（禁止 Node import）：`BuilderPage.tsx` / `BuilderCanvas2D.tsx` / `BuilderInspectorPanel.tsx` 等 UI 层。

### 0.3 语料就绪：20 个 Node 可导入关卡

`humanProtocolBasePack.levels`（`ConfigPackStore.ts:78-99`）= **10 官方关 + 10 smoke 关**：

- 官方 10 关（`campaignLevelIds`，6-10 是"赛博 mini-campaign"）：
  L01 维修舱、L02 居住模拟间、L03 人类博物馆、L04 记忆诊所、L05 回收核心、
  L06 霓虹前厅、L07 监控档案区、L08 配电管廊、L09 伪宅黑市、L10 黑诊所核心
  （`levels/level01..05/`、`levels/cyber/level06..10*.ts`）。
- smoke 10 关：keyDoor / puzzleOrb / directionCode / keyOrbCode / doorSwitch / bigScreenFormula /
  circuitGrid / surveillanceMatch / valveMatrix / galleryReading（`src/game/config/smoke/*`）。
  **smoke 关自带** `export const xxxSmokeValidationReport = validateLevelConfig(...)`——天然 gold 正样本。

故事圣经 `docs/human-protocol-story-bible.md` 给出 10 层情绪弧线表、母题清单、**词汇白名单 + 禁词黑名单**、
objective/命名格式规则——这是分类标签与"玩家可见文案"扫描的 ground truth。

### 0.4 ⚠️ 四个会咬人的真相（架构必须围着它们设计）

1. **门锁词表不对称**：Builder `BuilderLockType` 只有 **4** 个
   （`none|key_item|survive_wave|puzzle_complete`，`BuilderTypes.ts:6`）；runtime `DoorLockType` 有 **11** 个
   （多出 `objective_complete|repair_panel|memory_choice|choice_selected|environment_state|boss_dead|inventory_count`，`levelConfig.ts:174`）。
   **官方关卡用了 `objective_complete`/`inventory_count`**（见 0.5 的 L03/L04/L05），所以**官方关不可经
   Builder 无损 round-trip**。⇒ **patch planner 必须工作在 BuilderProject 这一层**（可被 compiler+validator
   兜底的层），而不是裸 `LevelDefinition`；对官方关只做"读 ConfigCard / 分类 / 描述性迁移建议"，不做自动改写。
2. **puzzle enum ≠ union**：`LevelPuzzleType` enum 只有 3 个（hit_sequence|code_lock|tool_calibration，`:384`），
   但 `LevelPuzzleDefinition` discriminated union 有 8 个 subtype。提取器**必须按 union 的 `type` 判别**，否则漏 5 类。
3. **issue 形状不一致**：`validation/*` 的 `ConfigValidationIssue` **有稳定 `code` 字符串**（`room.duplicate`、
   `graph.exit.unreachable.locked`…）；但 compiler 的 `BuilderCompileIssue`（`:43`）和 `validateBuilderPuzzles`
   只有 `{path, message}`（**无 code，message 是中文**）。⇒ patch planner 只能稳定地 key 在 `validation/*` 的 code 上；
   builder 侧 guardrail 当前只能正则中文 message。（第 8 章把"给 builder issue 补 code"列为**值得做的微小安全改动**，但不在本轮。）
4. **enemy 词表不对称**：Builder 作者集 `BuilderRobotArchetype` 4 个；runtime `EnemyArchetypeId` 5 个
   （多 `signal_turret`）；`EnemyTierId` = normal|elite|leader|boss（4 档）。patch 只能产出 Builder 的 4 archetype。

### 0.5 官方 L01–L05 ground-truth（深读抽样，用于分类基线）

| 关 | 弧线 | 房间数/形态 | 锁链（真实 lockType） | 谜题 | lightingPreset |
| --- | --- | --- | --- | --- | --- |
| L01 维修舱 | 待修对象 | 3，线性 | tool pickup → circuit puzzle → `objective_complete` → 到达解锁电梯 | 1× circuit_grid | `hp:cyan_lockdown_arena_v5_age_director` |
| L02 居住模拟间 | 住户 | 5，hub+2侧 | care(open) → light(`key_item` family_key 来自 custodian_elite) → exit(`puzzle_complete` light_sequence) | 1× surveillance_match | `hp:residential_simulation_false_home_story_v1` |
| L03 人类博物馆 | 展品 | 7，主厅+3卫星 | tool→voice(`key_item`)→body(`key_item`)→archive(`inventory_count` 3 chips) | tool_calibration + hit_sequence + surveillance_match | `hp:human_museum_gallery_lighting_v1` |
| L04 记忆诊所 | 病人 | 6，hub+3侧 | childhood→rescue(`objective_complete`)→body(`objective_complete`)→theater(`puzzle_complete` code)→exit(`survive_wave` therapist_host) | code_lock + valve_matrix | `hp:memory_clinic_sterile_v1` |
| L05 回收核心 | 库存 | 8，三路锁分叉+boss | north→east(`key_item`)→west(`key_item`)→platform(`inventory_count` 3keys)→archive→exit(`survive_wave` reclamation_mother) | hit_sequence + circuit_grid + valve_matrix | `hp:reclamation_core_v1` |

> 观察到的"房间角色"原型：entry/foyer（quiet, pressure 0.22–0.55）、main combat arena（combat, 0.56–0.92）、
> lock hub（路径决策交叉点）、puzzle room（通用门/墙/道具边界隔离，单一机制）、boss room（boss mood, 0.82–1.0）、
> exit/reveal（museum_gallery 皮 + 电梯面板）。L06–L10 标签**尚未盘点**（第 9 章列为已知缺口）。

---

## 1. Config IR / ConfigCard schema

**ConfigCard** = 从 `BuilderProject` **或** `LevelDefinition` 抽出的统一规范摘要（模型的唯一输入，从不喂裸 TS）。
提取器是纯 Node 函数，**复用 0.2 的纯函数**（`explainPuzzle`/`computeTopology`/`buildSemanticGraph`/`validateLevelConfig`），
不重写图算法。字段分组与代码来源：

```jsonc
ConfigCard {
  meta: {
    sourceLayer: "builder" | "level" | "pack",
    id, title,
    schemaVersions: { pack?: "hp.config.v1", builder?: "hp.builder.v1", map?: "hp.map.v1", levelRoot: null },
    authoringProfile: "internal" | "generated"
  },

  // ── rooms graph ──  (BuilderTopology.pathRoomIds / map.navigation / buildSemanticGraph)
  roomsGraph: {
    rooms: [{ id, label, role?, style|aesthetic, mood?, bounds:{center,size}, ambientPressure? }],
    spawnRoomId,            // ⚠️ 隐式：Builder=rooms[0]；Level=roomContaining(spawnPoint) (mapValidator.ts:472)
    exitRoomId,
    adjacency: [[a,b]],     // sharedEdge 邻接（共享 ≥3.4m 边）
    criticalPathRoomIds, optionalRoomIds, maxBacktrackSeconds, mobileReadableDoorCount
  },

  // ── door / lock chain ──  (BuilderDoor / LevelDoorDefinition + DoorLockDefinition)
  doorLockChain: [{ doorId, from, to, lockType, doorFamily?,
    gate: { kind:"key"|"puzzle"|"wave"|"objective"|"choice"|"environment"|"boss"|"count"|"none", ref? } }],

  // ── puzzle chain ──  (puzzleInstances / explainPuzzle.puzzles)
  puzzleChain: [{ puzzleId, kind, roomId, linkedDoorId, solvable:boolean,
    params: { /* per-kind 摘要：orbs/grid/target/timeLimit… */ }, reachableFromSpawn:boolean }],

  // ── route switch graph ──  (BuilderRouteSwitch / collectRoutePuzzleRequirements)
  routeSwitchGraph: {
    switches: [{ id, keyRoomId, outputs:[{ kind:"open_door"|"reveal_puzzle"|"start_robots", target }] }],
    hiddenRequiredPuzzles: [puzzleId]   // ⚠️ reveal_puzzle 把必经谜题藏在 route 后 → 风险信号
  },

  // ── pickups ──  (BuilderPickup / keyItems[] + map.pickups[] + storyPickups[])
  pickups: [{ id, kind, roomId, linkedDoorId?, requiredForDoorIds? }],

  // ── robots / combat pressure ──  (waves / spawnGroups / computeTopology.pressure)
  robotsCombat: {
    groups: [{ roomId, archetype, count, tier }],
    waveCount, threatPressure,           // BuilderTopology.ts:78 加权公式
    estimatedActiveEnemies,              // estimateActiveEnemyBudget (combatValidator.ts:26)
    rewards: ["none"|"upgrade"|"open_exit"]
  },

  // ── material / lighting / story tags ──
  visualStory: {
    lightingPreset?, lightingRig?: { ambient, keyColor, keyIntensity, fog, bloom, shadow },
    roomMaterials: [{ roomId, floorMaterialKey?, wallMaterialKey?, style }],
    storyTemplateId?, motifsHit: [string], victoryLine?, hasArticles:boolean, propStoryCount
  },

  // ── asset coverage ──  (propEntry / generatedBuilderAssetCatalog / raw-webgpu manifest)
  assetCoverage: {
    propCount, modelKeys: [string],
    resolvedTriple: { ok:number, missing:[modelKey] },     // modelKey→(material,geometry) 解析
    assetRoles: { story, puzzle, combat, light, exit, hero, image2 },  // deriveAssetRoles 分布
    decals: [kind], webgpuMapped: { ok:number, missing:[modelKey] }
  },

  // ── solvability & visual risk metrics ──  (validateLevelConfig 派生)
  riskMetrics: {
    validatorOk:boolean, errorCodes:[code], warningCodes:[code],
    exitReachable:boolean, unreachablePuzzles:[id], keyBehindOwnLock:[doorId],
    visualIdentityScore: 0..1,       // 见 §2 计算式
    storyPresent:boolean, copyScanViolations:[{text, word}],
    difficulty: { exploration:0..3, puzzle:0..3, combat:0..3, routeComplexity:0..3 }
  }
}
```

> 设计要点：ConfigCard 是**有损但稳定**的摘要——刻意丢掉坐标级细节，保留"图结构 + 标签 + 风险"。
> 它对 builder 与 level 两层都能提取，但 `meta.sourceLayer` 让下游知道哪些字段是近似（如官方关的
> 11-锁词表落到 `gate.kind` 时会出现 builder 层产生不了的 kind）。

---

## 2. Label taxonomy（全部 code-grounded）

### 2.1 官方弧线（arc，10 层，来自故事圣经 §4 + 抽样）

`maintenance(维修)` · `fake_home(假家/居住模拟)` · `museum(博物馆)` · `clinic(记忆诊所)` · `reclamation(回收)` ·
`cyber(霓虹/赛博)` · `surveillance(监控)` · `power(配电/供能)` · `counterfeit_home(伪宅黑市)` · `black_clinic(黑诊所)`。
弧线规则：1-5 设施内部（被维护），6-10 设施外侧（外面同构）。每个 arc 关联：被当作的身份、情绪、结尾档案句、母题。

### 2.2 房间角色（room role）

`spawn` · `lock_hub` · `puzzle_room` · `robot_room` · `key_room` · `exit` · `reveal_room`。
判定信号：`RoomMood`（quiet|uneasy|combat|boss|reveal）+ `ambientPressure` + door 度数 + 是否含 puzzle/robot/keyItem +
是否依赖通用房间/门/道具边界。映射到 runtime `LevelMapRoomArchetype`
（large_combat_arena|small_escape_room|corridor_connector|boss_chamber|story_lab）。

### 2.3 难度（4 轴，各 0–3）

`exploration`（房间数 / 回溯 / optionalRooms）· `puzzle`（谜题数 × kind 复杂度 × 链深）·
`combat`（threatPressure / waveCount / elite&boss tier）· `routeComplexity`（routeSwitch outputs / 锁链分叉度，如 L05 三路）。

### 2.4 风险标签（risk tags，**每条都映射到确定性检查或可计算指标**）

| 风险标签 | 确定性来源 |
| --- | --- |
| `no_exit` / 出口不可达 | `map.exit.unreachable` / `graph.exit.unreachable.locked` |
| `self_lock` / 钥匙锁在自己门后 | `key.behind.own.lock`；`PUZZLE_CONSOLE_LOCKED_BEHIND_DOOR`（floodFill） |
| `key_unreachable` / 谜题不可达 | `graph.puzzle.unreachable` / `graph.critical_door.blocked` |
| `route_hides_required_puzzle` | ConfigCard `routeSwitchGraph.hiddenRequiredPuzzles` 非空（reveal_puzzle 锁住必经谜题） |
| `lock_cycle` / 死锁环 | ⚠️ **当前无专门检查**（仅 forward-fixpoint 报 unreachable）→ 新增 IR 级环检测（第 8 章） |
| `too_much_combat` | `budget.enemy.high` / `estimateActiveEnemyBudget` 超 mobile 舒适阈 |
| `too_little_visual_identity` | `visualIdentityScore` 低（见下）/ `asset.*.unknown` 多 |
| `missing_story` | `storyPresent=false`（无 articles & 无 storyTemplate & 无 victoryLine） |
| `bad_lighting` | 无 lightingPreset 或 rig 越界（ambient/fog/bloom 极值）/ 黑场风险 |
| `asset_missing_webgpu` | `assetCoverage.webgpuMapped.missing` 非空 / `resolvedTriple.missing` 非空 |
| `combat_unfair` | ⚠️ 无集成检查（waves×economy×revive×combatLimits 未交叉校验）→ 评测 rubric + 新检查 |
| `player_facing_debug_words` | **copy-scan 命中禁词**（故事圣经 §6 黑名单，纯正则） |

**`visualIdentityScore`（0–1）建议式**（纯确定性，模型不参与）：
`0.30·(hasLightingPreset) + 0.25·(propRoles 覆盖 story/puzzle/combat/light 的种类数/4) +
0.20·(每房间平均 prop 数 ≥ 阈) + 0.15·(asset.*.unknown == 0) + 0.10·(motifsHit ≥ 2)`。

### 2.5 完整枚举速查（patch op 与分类共用，全部抓自源码）

- RoomStyle(7)：maintenance|sterile|hazard|residential|exit|museum|core（`BuilderTypes.ts:4`）
- RoomMood(5)：quiet|uneasy|combat|boss|reveal · RoomAesthetic(7)/Detail(3)/Archetype(5)
- LockType：Builder(4) vs Level(11)（见 0.4） · DoorFamily(6)：auto|residential|clinic|reclamation|industrial|elevator
- PuzzleKind Builder(6)：color_sequence|circuit_grid|surveillance_match|valve_matrix|archive_merge|gallery_reading
- PuzzleComponentRole(11) · ColorKey(7) · RouteSwitchOutputKind(3)
- PickupKind Builder(3)：key_item|repairKit|coreCell · RobotArchetype Builder(4) · EnemyTier(4)
- StoryTemplate(8)：maintenance_incident|false_family|museum_archive|memory_clinic|black_clinic|surveillance_trial|power_altar|reclamation_core
- AssetRole(7)：story|puzzle|combat|light|exit|hero|image2 · SurfacePattern(14) · PropFamily(12) · PropGroup(9)
- ObjectiveType(9)/Trigger(21)/Guidance(target7,urgency4) · RuntimeEventAction(25)

---

## 3. 风险/可玩性 Guardrail 分类法（deterministic gatekeeper）

这是 patch planner 的"否决墙"。模型产出 patch 后，**只有这一层说了算**。来源是 `validation/*` 的真实 code（稳定）+
compiler/builder 的 path/message（需正则）。按严重度分组：

- **结构/重复 ID（error）**：`room.duplicate`、`door.duplicate`、`puzzle.duplicate`、…（每类实体都有 `.duplicate`/`.empty`）。
- **悬挂引用（error）**：`door.from/to.missing`、`key.room/door/objective.missing`、`interaction.*.missing`、
  `pickup.room.missing`、`prop.room/model.missing`、`spawn.actor.missing`、`event.*.missing`、`choice.route.unknown`…
- **锁链缺字段（error，union 强约束）**：`door.lock.key/objective/wave/puzzle/choice/environment.missing`、`door.lock.count.invalid`、
  compiler：`SURVIVE_WAVE_REQUIRES_ROBOTS`、`PUZZLE_MISSING_INSTANCE`。
- **几何/放置（error/warn）**：`DOOR_SHARED_EDGE`/`PUZZLE_ROOMS_NOT_ADJACENT`（须共享 ≥3.4m 边）、`*.position.outside`、
  `PUZZLE_CONSOLE_PLACEMENT`、`PUZZLE_COMPONENT_PLACEMENT`、`EXIT_NOT_SPAWN`、`EXIT_ROOM_REQUIRED`、`ROBOT_ROOM_REFERENCE`。
- **可解性（error，图模拟——核心 guardrail）**：`CRITICAL_PATH_EXISTS`/`map.exit.unreachable`/`graph.exit.unreachable.locked`、
  `graph.exit.interaction.blocked`、`graph.critical_door.blocked`、`graph.puzzle.unreachable`、`graph.interaction.self_blocked`、
  `key.behind.own.lock`、`PUZZLE_CONSOLE_LOCKED_BEHIND_DOOR`、`graph.objective.not_on_main_path`。
- **谜题逻辑可解（error，逐 kind）**：`puzzle.valveMatrix.unsolvable`、`puzzle.toolCalibration.*`、`puzzle.circuitGrid.*`、
  `puzzle.code.*`/`formula.*`、`puzzle.archiveMerge.*`（target 必须 2 的幂 64–2048）、`puzzle.surveillance.*`、
  `puzzle.galleryReading.*`、`PUZZLE_COLOR_SEQUENCE_MINIMUM_ORBS`（≥2 且不重色）、`PUZZLE_SINGLE_COLOR_SEQUENCE`、`quiz.correct.count`。
- **route 开关（compiler）**：`ROUTE_SWITCH_OUTPUTS_COUNT`(1–4)、`ROUTE_OUTPUT_DOOR/PUZZLE/ROBOT_VALID`、`KEY_PICKUP_*`。
- **战斗/资源预算（warn）**：`budget.enemy.high`、`WAVE_SPAWN_GROUP_REFS`、`spawn.count/tier.invalid`、`bossPhase.*`。
- **视觉/资产覆盖（warn，generated profile 下升级为 error）**：`asset.visual/material/roomSkin/doorSkin.unknown`、
  `roomKit.*`、`key.visual.low_salience`、`navigation.mobile.complex`。
- **作者边界（generated profile，error）**：`authoring.generated.*`（room_skin/door_skin/visual/material/puzzle_orb/enemy 系列）。
- **静默迁移（无 warning）**：`sanitizeGeneratedLevelMaterialFamilies` 把陈旧材质族重映射但**不报警**——评测要专门盯。

---

## 4. Patch 操作设计（受限 JSON，对齐 BuilderProject 枚举）

模型产出 **`BuilderPatchPlan`**，操作工作在 **builder 层**（可被 compiler+validator 兜底）。每个 op：
① 只引用已存在 id；② 枚举值必须落在 §2.5 词表内；③ 由 `applyPatch`（纯函数）应用，非法即拒。

```jsonc
BuilderPatchPlan {
  baseProjectId, basedOnCardHash,           // 防漂移：patch 绑定到某个 ConfigCard 快照
  ops: [
    // 叙事
    { op:"set_story_template", templateId:"museum_archive" },
    { op:"set_prop_story", propId, title?, clue?, hint? },
    // 布局
    { op:"set_room_style", roomId, style:"museum" },
    { op:"set_room_env", roomId, env:{ floorPresetId?, wallPresetId?, wallHeight? } },
    { op:"add_prop", roomId, modelKey, position:[x,z], rotationY?, scale? },
    { op:"move_prop", propId, position:[x,z] },
    // 机关链路
    { op:"set_door_lock", doorId, lockType:"puzzle_complete", keyRoomId?, puzzleKind? },
    { op:"add_puzzle", kind, linkedDoorId, roomId, position:[x,z], components? },
    { op:"bind_puzzle", puzzleId, linkedDoorId },
    { op:"add_route_switch", roomId, keyRoomId, position:[x,z] },
    { op:"add_route_output", switchId, kind:"open_door"|"reveal_puzzle"|"start_robots", target },
    { op:"set_robot_group", roomId, archetype, count, tier? },
    // 资产/灯光材质
    { op:"set_lighting_rig", rig:{ ambient?, keyColor?, keyIntensity?, fog?, bloom?, shadow? } },
    // 可玩性修复
    { op:"add_pickup", kind:"key_item", roomId, position:[x,z], linkedDoorId },
    { op:"move_pickup", pickupId, position:[x,z] }
  ],
  groups: { 叙事:[opIdx], 布局:[...], 机关链路:[...], 灯光材质:[...], 资产缺口:[...], 可玩性修复:[...] },
  rationale: [ { opIdx, why } ]
}
```

其余模型输出（全是受限 JSON，schema 校验 + 失败重试）：

- **`ClassificationResult`**：`{ arc, arcConfidence, roomRoles:{roomId:role}, difficulty:{4 轴}, pacing:[tag],
  visualCompleteness:0..1, puzzleStructure:{chainDepth,kinds,gatingPattern}, riskTags:[enum], motifsHit:[] }`。
- **`RoomMatchPlan`**：每房间 `{ roleSuggestion, styleSuggestion, kitSuggestion, lightingPresetSuggestion,
  propSetSuggestion, storyTemplateSuggestion, motifsToAdd }`——**纯推荐**，转成 patch 才落地。
- **`MigrationPlan`**（描述性，**不改 runtime**）：`{ targetSchema, detectedVersion,
  mappings:[{from,to,rule,ambiguous,modelSuggestion?}], idsPreserved, graphUnchanged, counts }`。

**确定性落地管线（一键 apply 前强制全过）**：
```
模型 → BuilderPatchPlan(JSON, schema 校验+重试)
  → applyPatch(projectClone, ops)            // 悬挂引用/非法枚举 → 拒，记 invalidOps
  → compileBuilderProjectToLevel(project)    // issues 非空 → 拒
  → validateLevelConfig(level)               // !report.ok → 拒
  → 风险回归对比 baseline + copy-scan        // 新增 error / 新禁词 → 拒
  → 通过：展示 before/after diff + 精确 ops → 等用户一键 apply
```

---

## 5. Dataset / 导出 pipeline

新建目录 `games/human-protocol/scripts/ai/`（沿用现有 `scripts/{qa,asset-build,optimizer,tools,lib}` 约定，`.mjs`/`.ts` + `tsx`）。

```
scripts/ai/
  lib/            # 复用 scripts/lib/{cli,paths}.mjs；新增 tsxImport.mjs（包装 tsx 动态 import）
  schemas/        # *.schema.json：ConfigCard / ClassificationResult / RoomMatchPlan / BuilderPatchPlan / MigrationPlan
  prompts/        # 版本化提示模板：classify.v1.md / plan.v1.md / migrate.v1.md（带 system + few-shot）
  extractConfigCard.mjs     # LevelDefinition|BuilderProject → ConfigCard（复用 §0.2 纯函数）
  exportCorpus.mjs          # 遍历 basePack 20 关 + 已导出草稿 → JSONL
  classifyRules.mjs         # §2 规则基线分类器（无模型）
  embedIndex.mjs            # 卡片向量化 + 本地索引（sqlite-vec 或 JSON+cosine）
  retrieve.mjs              # 相似关卡检索
  modelClient.mjs           # OpenAI 兼容本地端点 adapter + 超时/缓存/重试/JSON 校验
  planPatch.mjs             # 调模型出 BuilderPatchPlan
  applyPatch.mjs            # 纯确定性应用 + compile + validate
  eval.mjs                  # §7 benchmark
  copyScan.mjs              # 禁词扫描（故事圣经 §6 黑名单）
```

npm scripts（沿用 `域:动作` 命名，对照现有 `qa:*`/`raw-webgpu:*`）：

```jsonc
"ai:corpus:export":  "tsx scripts/ai/exportCorpus.mjs",            // → data/ai/corpus.jsonl
"ai:card:extract":   "tsx scripts/ai/extractConfigCard.mjs --level <id>",
"ai:classify":       "tsx scripts/ai/classifyRules.mjs --in data/ai/corpus.jsonl",
"ai:retrieve:index": "tsx scripts/ai/embedIndex.mjs",
"ai:plan":           "tsx scripts/ai/planPatch.mjs --project <draft.json>",
"ai:eval":           "tsx scripts/ai/eval.mjs",
"ai:copyscan":       "tsx scripts/ai/copyScan.mjs --in data/ai/corpus.jsonl"
```

**JSONL 样本格式**（一行一条）：`{ input: ConfigCard, output: { classification | patchPlan | migrationPlan }, gold:boolean, source }`。

- **正样本**：20 关 ConfigCard + 规则分类器标签 + 故事圣经 ground truth；smoke 关的 `*ValidationReport` 直接作可解性 gold。
- **负样本**：从 validator 自动合成——对一张合法卡施加"会触发某 code 的破坏"（删 key、把谜题挪到自锁门后、抽掉 exit 邻接），
  记录 `{ brokenCard, expectedRiskCode }`。这给分类器/planner 提供"识别风险 + 反向修复"训练对。
- **后续 gold**：把"作者接受的修复"（apply 前后 diff）回灌为高质量样本（Phase 4 LoRA 用）。

**隐私**：默认只导出 basePack（官方 + smoke）。用户私有草稿（localStorage save slots）**不导出、不提交**，除非显式 `--include-drafts`
且作者手动在浏览器导出 JSON 放到 `data/ai/drafts/`（gitignore）。

---

## 6. 本地模型服务架构 + 选型

### 6.1 推荐模型栈（Mac 本地开发，**总盘 2–3GB 预算**）

> ⚠️ 模型是**作者侧开发工具**，跑在本机 Ollama，**不进 `vite build` 产物**——玩家下载的游戏不含权重，
> 模型大小只占作者本机磁盘，与游戏体积无关。下面在 2–3GB **总盘**预算内选型。
> 省空间的杠杆：**不用神经 embedding**——ConfigCard 是结构化 IR，检索用"特征向量+余弦"即可（0 字节）。

| 角色 | 首选（预算内） | 备选 | 盘(约) |
| --- | --- | --- | --- |
| JSON patch/分类 LLM | **Qwen3-4B-Instruct-2507 · Q4_K_M** | Qwen2.5-3B-Instruct·Q4(~1.9G) / Qwen3-1.7B·Q5(~1.3G) | ~2.5GB |
| 检索 | **结构化特征向量 + 余弦**（无模型） | bge-small-zh-v1.5（中文小，~0.1G）/ Qwen3-Embedding-0.6B | 0 ~0.1GB |
| 运行时 | **Ollama**（`localhost:11434/v1` OpenAI 兼容） | MLX / llama.cpp(GGUF) | — |
| JSON 强约束 | Ollama `format:<json-schema>` / llama.cpp GBNF grammar | — | — |

**三档总盘**（按磁盘紧张程度选）：
- A 质量优先 ~2.5–2.6GB：Qwen3-4B-Instruct-2507 Q4 + 结构化检索(0)。
- B 更快/更省 ~1.9GB：Qwen2.5-3B-Instruct Q4 + 结构化检索(0)。
- C 极小 ~1.3GB：Qwen3-1.7B Q5 + 结构化检索(0)（靠语法约束解码保 JSON）。

> 关键判断：**重点不是聊天能力，是中文 config 分类 + JSON 稳定 + 低盘**。3B/4B-Q4 + 语法约束解码足够；
> embedding 在结构化 IR 上可省成 0。检索库小到"JSON + 余弦"，不必上向量 DB。
>
> **若要让玩家在浏览器内用 AI（非作者侧）**：改走 WebLLM/transformers.js(WebGPU)，模型**懒加载**（不进首包，
> 点开 AI 功能才下），选 ≤1.5B 量化（Qwen2.5-1.5B-Instruct ~1GB 级）。这会增加玩家在用该功能时的下载，
> 与"游戏首包大小"是两回事。默认仍按作者侧 Ollama 方案。

### 6.2 服务架构（`modelClient.mjs`）

- **OpenAI 兼容 adapter**：`POST {OPENAI_BASE_URL}/chat/completions`，`OPENAI_BASE_URL` 默认 `http://localhost:11434/v1`，
  可切 MLX/vLLM。模型名走 env `HP_AI_MODEL`。
- **确定性 fallback**：探测不到端点 → 自动降级到 §2 规则分类器 + §3 validator 体检 + 模板化 RoomMatchPlan
  （无 LLM 也能给"风险报告 + 安全建议"）。AI 永远是增益，不是依赖。
- **超时 / 缓存**：请求超时（默认 20s）→ fallback；按 `hash(prompt+cardHash+promptVersion)` 缓存到 `data/ai/cache/`。
- **JSON schema 校验 + 重试**：用 §5 的 `schemas/*.schema.json`（ajv）校验；失败把校验错误回灌重试（≤2 次）再 fallback。
- **版本化 prompt**：`prompts/*.v1.md`，prompt 版本进缓存 key 与样本元数据。

### 6.3 玩家可见双语故事生成（中英文）

与内部 JSON 不同：这是**给玩家看的创意散文**，双语流畅度 + 设施口吻才是重点。但**不新增模型**——
同一个 Qwen3-4B-Instruct-2507 既做 JSON 规划也做中英文故事（Qwen 系是 ≤4B 里中文最强、英文够用的原生双语），
总盘仍 ~2.5GB。绝不把模型原始输出直接给玩家，必须过和 patch 同一道确定性墙。

- **一次调用产双语**（不要"先中文再机翻"——设施口吻"冷静、把坏事说成服务、短句无感叹号"要两种语言各自原生写，
  机翻丢调性还混进禁词）。受限 JSON schema：
  ```jsonc
  StoryBackgroundDraft {
    levelId, arc,
    title:        { zh, en },
    premise:      { zh, en },   // 1–2 句玩家背景（"你以为在逃，设施以为在走流程"式钩子）
    facilityLine: { zh, en },   // 设施播报口吻一行
    victoryLine:  { zh, en },   // 档案口吻结尾句，给下一关留钩
    motifsUsed:   [..]          // ≥2，取自 维护/假家/展柜/记忆/回收/监控/供电/全家福/黑诊所
  }
  ```
- **两种语言都跑 copy-scan**：`copyScan.ts` 的禁词表本就中英混合（中文 流程/官卡/大门 + 英文 wave/spawn/config/Boss/demo/builder/generated/HUD），
  生成文本同样喂进去；命中即重生成（≤2 次）。
- **格式/口吻校验**（故事圣经 §6）：victoryLine = 一句档案口吻、命中 ≥2 母题、objective 标题 4–9 汉字动词开头（EN 短祈使）。
- **烘进本地化层**：中文写进关卡 story；英文写进 `LevelLocalization.ts` 的 `englishTextByLevel`（仓库既有 ZH→EN 字典 + `GameLanguage` + `localized*()`）。
  **生成只在作者侧发生一次**，玩家看到的是已校验的静态双语文本，模型不进 `vite build` 产物 → 游戏体积零影响。
- 文件：`scripts/ai/generateStory.ts` + `prompts/story.v1.md` + `schemas/storyBackground.schema.json`；命令 `ai:story --level <id>`。
- 若要玩家在浏览器内**实时**生成（动态/个性化）：走 §6.1 末的 WebLLM 懒加载路线，且每条输出在显示前同样过 copy-scan。

---

## 7. /build 集成提案（「修复」大脑已实现，React 接线待办）

- **"自动搭配" = 预览，不立即改**。产出按组分类的建议：**叙事 / 布局 / 机关链路 / 灯光材质 / 资产缺口 / 可玩性修复**
  （对齐 §4 patch groups）。
- 每条建议给 **before/after**（在 BuilderProject 克隆上 apply+compile+validate+体检，对比分数与问题数）。
- **一键 apply 仅在 compile+validate 通过且分数不降时可点**；失败的建议灰显并显示被哪个 code/issue 拒。
- **"修复"按钮**调同一个修复规划器，**必须展示精确 ops**（不许黑箱改图）。修复**优先确定性方案**，模型只在多解时排序/补叙事。

### 7.1 「修复」契约（已实现的 headless 大脑，零模型）

`scripts/ai/repairPlan.ts` 就是 /build「修复」按钮背后的纯逻辑，**已实现并验证**：

```ts
planRepairs(project: BuilderProject, health: HealthReport): RepairSuggestion[]   // 体检问题 → 精确 typed 修复 ops（纯函数，不改输入）
applyRepairs(project, picked): RepairRun   // 逐条试应用：每条都重编译+重体检，只保留"仍合法且分数不降、问题减少"的；返回 before/after + applied/rejected
```

`RepairSuggestion = { id, finding, group:"叙事"|"布局"|"灯光材质"|"可玩性修复", rationale, ops:RepairOp[], apply(project) }`。
已落地的确定性修复（每条都带回归护栏）：

| finding | 修复 op | 效果（实测 demo「夜班档案室」） |
| --- | --- | --- |
| `missing_story` | `set_story_template` + `set_prop_story`（策划好的 copy-scan 干净线索） | 编译出 article，storyPresent 转真；**分 85→89、问题 2→1** |
| `too_little_visual_identity` | `add_prop`（按房间 style 补道具到稀疏房间） | 视觉完整度↑ |
| `player_facing_debug_words` | `rename_labels`（禁词→设施名词白名单同义词） | 玩家文案转干净 |

跑法：`scripts/ai/run.sh repairPlan.ts --project <x>.json [--apply]`（预览 / 试应用并写 `*.repaired.json`）。

### 7.2 React 接线（小而有界，**本轮不做**——`src/build/*` 正被其他 agent 大改，避冲突）

/build 的「修复 / 体检」按钮只需做**三件薄事**，**不在 React 里加任何 AI 逻辑分支**：
1. 拿当前 `BuilderProject` →（headless）`healthReport` + `planRepairs` 拿建议；
2. 在面板渲染 before/after 分数 + 分级问题 + 每条 ops 预览（纯展示）；
3. 用户勾选 → `applyRepairs` → 用返回的 `repaired` 工程覆盖编辑器状态。
> 调用方式：把 `scripts/ai/{healthCheck,repairPlan}.ts` 的纯函数抽到一个 app 可 import 的位置（或经一个本地 `modelClient` 端点），
> React 只传 props、收结果——**沿用 §6.2 fallback：没有模型也能用（修复全是确定性的）**。r3f Canvas 边界照旧（传 props，不在 `<Canvas>` 下 `useContext`）。

### 7.3 随机密室生成器 API + studio UI（已实现，零模型）

- **`scripts/ai/generateRoom.ts`**：`generateRoom({seed, puzzleCount?, arc?}) → {project, level, health}`。种子驱动 mulberry32，
  选主题（museum/clinic/maintenance/reclamation/surveillance）→ 沿"线性脊柱"几何布局（每段门由一座**不同**谜题解锁，
  console 在前一房、≥1.1m 离门、reachable-without-door——demo 已验证的合法模式参数化）→ 配道具/故事/灯光/轻战斗 →
  compile+validate+体检 → 有可修问题就跑 `repairPlan` 自愈。**构造即合法**：`--batch 40` 实测 40/40 可玩、avg 87。
- **`scripts/ai/serveAi.ts` + `studio.html`**：好看的按钮 UI（本地 API `http://localhost:4178`）：
  `🎲 随机生成密室` → 俯视平面图(SVG) + 体检卡(裁决/分数/难度条/分级问题) + `🔧 一键修复` + `📥 导出 JSON`。
  **纯作者侧、不进 `vite build` 产物**。React 接入照 §7.2（薄壳调同一批纯函数 / 本地端点）。
- 玩家侧实时随机：把 `generateRoom` 编译产物经 ConfigPackStore 注入一个临时关卡即可——但属 runtime 改动，待 §7.2 一并接线。

### 7.4 规则在持续加（确定性，零模型）

体检/分类的风险规则与生成/修复规则是**可增量扩展**的。已上线（节选）：可解性(no_exit/key_unreachable)、
禁词(player_facing_debug_words)、`monotonous_puzzles`(≥3 座全同种类)、`dead_end_room`(度数1且无谜题/钥匙/机器人/故事/交互的空房——
精修到只报真薄房，实测准确逮到 L09 空厨房、不误伤诊所记忆椅)。修复侧：set_story_template / add_prop / rename_labels。
新增规则只需在 `classifyRules.riskTags()` + `healthCheck.RISK_SEVERITY/DETAIL`（+ 可选 `repairPlan`）各加一条，跑 `selfCheck.ts` 守门。

---

## 8. Config 迁移 / refactor 计划（描述优先，确定性优先）

1. **显式化 schema 版本**：给 `LevelDefinition` 根补 `schemaVersion?: "hp.level.v1"`（可选、默认即视为 v1，向后兼容），
   与已有 `hp.config.v1`/`hp.builder.v1`/`hp.map.v1` 对齐。**这是值得做的微小安全改动**，但单独 PR + 单独 review，不在本轮。
2. **确定性迁移注册表优先**：`scripts/ai/migrations/`（或 `src/game/config/migrations/`）存
   `{ from, to, migrate(level):level }`，**纯函数、可测试**。模型**只在旧数据语义歧义时**给映射建议（`MigrationPlan.ambiguous`）。
3. **codemod 而非字符串替换**：TS config 的结构性改写用 AST（ts-morph / jscodeshift），保 ID、保图不变（除非显式请求）。
4. **迁移报告**：before/after 计数、ID 是否全保留、`explainPuzzle` 图是否等价（reachability 同构）、validator 是否仍 `ok`。
5. **补 builder 侧 issue code**（见 0.4-③）：给 `BuilderCompileIssue`/`validateBuilderPuzzles` 加 `code?: string`——
   微小、纯增量、让 patch planner 能稳定 key。同样单独 PR。

### Refactor 建议（共享 config core）

- **暂不抽 `packages/hp-config-core`**。理由：validator/compiler/schema **已经纯且 Node 可 import**（§0.2 验证过），
  Node 脚本经 `tsx` 直接 import `src/game/config/*` 与 `src/build/compile*/Builder{Types,Topology,PuzzleCatalog,LevelImport}` 即可。
  过早抽包会引入构建/路径成本而无收益。
- **抽包的触发条件**（满足任一再做）：① 第二个 game 要复用同一 validator；② AI 脚本与 app 的 tsconfig/路径别名打架；
  ③ 想给 core 加独立 CI。届时把 `src/game/config/{schema,validation,ConfigValidator}` + `src/build/compile*`
  以**纯函数子集**挪进 `packages/hp-config-core`，app 反向依赖它。
- **避免耦合的红线**：AI 逻辑全在 `scripts/ai/`（或独立包），**绝不**往 runtime/React builder 里加 AI 分支；
  runtime 不感知 AI 存在；AI 只读 config + 调纯函数。

---

## 9. 评测 benchmark

| 指标 | 度量 | 目标 |
| --- | --- | --- |
| 分类准确率 | 官方 10 关 arc/room-role 对 ground truth（§2.1/§0.5 + 故事圣经） | arc ≥ 0.9，room-role ≥ 0.8 |
| 非法 patch 率 | `applyPatch` 拒绝的 op 占比 | < 5% |
| 编译成功率 | patch 后 `compile.issues == 0` | ≥ 0.95 |
| validator 通过率 | patch 后 `report.ok` | 1.0（硬门槛） |
| 图可解性 | `exitReachable && unreachablePuzzles==[]` | 1.0 |
| 资产覆盖 | `resolvedTriple.missing==[] && webgpuMapped.missing==[]` | 官方关 1.0 |
| 视觉/故事一致性 | `visualIdentityScore` + motifsHit≥2 + storyPresent | rubric ≥ 0.8 |
| **玩家可见禁词** | copy-scan 命中 demo/v1/Boss/流程/wave/spawn/config/builder/generated/HUD… | **0** |
| 速度/内存（4B-Q4） | 首 token / 完整 patch plan / 索引构建 | < ~1.5s / < ~8s / 秒级；RAM < ~6GB |

> 回归基线：每次 patch 与 apply 前的 ConfigCard 对比，**不允许新增 error code、不允许新增禁词、不允许 reachability 退化**。

---

## 10. Phase 计划（精确路径 + 命令）

- **Phase 0 — corpus exporter + ConfigCard**：`scripts/ai/extractConfigCard.mjs` + `exportCorpus.mjs` + `schemas/configCard.schema.json`；
  命令 `ai:corpus:export` 产 `data/ai/corpus.jsonl`（20 关）。**纯增量脚本，零 runtime 改动。** 这是一切的地基。
- **Phase 1 — 规则分类器基线**：`classifyRules.mjs`（§2 标签 + §3 风险，全确定性，无模型）+ `copyScan.mjs`；命令 `ai:classify` / `ai:copyscan`。
  先把"无 AI 也能用的体检 + 分类"做扎实——这本身就是给作者的价值，也是模型的对照与 fallback。
- **Phase 2 — 嵌入检索**：`embedIndex.mjs` + `retrieve.mjs`（Qwen3-Embedding-0.6B，JSON+cosine）；命令 `ai:retrieve:index`。
  支撑"相似关卡检索 / 自动搭配参考"。
- **Phase 3 — 本地 LLM JSON patch planner**：`modelClient.mjs`（OpenAI 兼容 + fallback + schema 校验 + 缓存）+ `planPatch.mjs` +
  `applyPatch.mjs` + `prompts/plan.v1.md`；命令 `ai:plan`。**落地仍由 compile+validate 把关。**
- **Phase 4 — 可选 LoRA 微调**：见 **§12 微调/pretrain 数据准备**（数据格式 + 采集回路 + mlx-lm LoRA + 触发条件已就绪）；
  攒够 accepted gold 才开训，之前用 few-shot。非近期目标，但数据格式从 Phase 0 起就按 §12 落，避免回填。

---

## 11. 前 5 个落地任务（建议起步顺序）

1. 建 `scripts/ai/`（lib/schemas/prompts 骨架）+ `lib/tsxImport.mjs`，验证 Node 经 tsx 能 import `validateLevelConfig` 与
   `compileBuilderProjectToLevel`（冒烟：跑一遍 basePack，打印 20 份 `report.ok`）。
2. 写 `extractConfigCard.mjs`：先做 **level 分支**（复用 `explainPuzzle` + `validateLevelConfig` + `buildSemanticGraph` 的
   level 等价物），对 20 关产出 ConfigCard；定 `configCard.schema.json` 并 ajv 自检。
3. 写 `exportCorpus.mjs` + `ai:corpus:export`：产 `data/ai/corpus.jsonl`（先只官方+smoke）。
4. 写 `classifyRules.mjs` + `copyScan.mjs`：规则分类（arc/room-role/difficulty/riskTags）+ 禁词扫描；对官方 10 关测准确率，
   作为 Phase 3 的对照基线与 fallback。
5. 写 §3 的负样本合成器（对合法卡注入"触发某 code"的破坏），产 `data/ai/negatives.jsonl`，为 planner 评测铺路。

---

## 12. 微调 / pretrain 数据准备（turnkey 训练就绪）

> **术语澄清**：4B 量级**不从零 pretrain**——做的是 **SFT / LoRA 指令微调**（在 Qwen3-4B-Instruct 上贴小适配器）。
> 本节把"数据格式 + 采集回路 + 训练工具 + 治理"全部定死，使得**一旦攒够接受样本就能一键开训**。
> 在那之前，线上一律用 **few-shot + 语法约束解码**（不微调也能跑）。微调只为"省 prompt token + 提稳定性 + 贴口吻"。
>
> **要不要训 / 要不要用 4080（结论）**：**现在基本不用训**。Qwen3-4B 原生中英双语，故事任务短、模板化，few-shot 就够好；
> 在只有 10 关 gold 时微调反而易过拟合/灾难性遗忘。**先 few-shot。** 将来真要 LoRA：4080(16GB CUDA)是比 Mac 更合适的训练机
> （LoRA 4B≈10–14GB、分钟级），理想分工 = **Mac 推理 / 4080 偶尔训练**；但触发条件是攒够~几百条 accepted gold，且可选（也能 Mac MLX 慢训/云上租）。
>
> **已实现（story 任务，model-free）**：`scripts/ai/storyCorpus.ts` 已从 10 关 + LevelLocalization 抽出双语 gold →
> `data/ai/train/story.{exemplars.json,jsonl}`（10 条 SFT messages，全 copy-scan 干净，5 条真双语）。
> 生成走 `generateStory.ts` **双路**：连模型(`modelClient.ts`→Ollama，schema+双语 copy-scan+重试) 或 **model-free 兜底**(按 arc 取官方范例)——
> **没有模型/没有 4080 也能产出合法双语故事**。同一份 gold 现在当 few-shot、将来当 SFT 数据。

### 12.1 四个训练任务族（共用一套 chat-SFT 格式）

| 任务 | input | output（受限） | 来源 |
| --- | --- | --- | --- |
| 分类 classify | ConfigCard | `ClassificationResult` | 规则分类器 silver + 人工改正 gold |
| patch 规划 plan | ConfigCard + 目标 | `BuilderPatchPlan`（compile+validate 已过） | **作者接受的修复** apply 前后 diff |
| 双语故事 story | levelId + arc + 母题 | `StoryBackgroundDraft{zh,en}`（copy-scan 干净） | 作者采用的生成稿 |
| 风险识别 risk | 被破坏的 ConfigCard | 命中的 `errorCode` 列表 | §3 负样本合成器（validator 自动产） |

### 12.2 SFT JSONL 格式（messages，OpenAI/MLX 通用）

```jsonc
// data/ai/train/{classify,plan,story,risk}.jsonl —— 一行一条
{
  "messages": [
    { "role": "system", "content": "<口吻+任务规则+目标 JSON schema，来自 prompts/<task>.vN.md>" },
    { "role": "user",    "content": "<ConfigCard / 指令 的 JSON 字符串>" },
    { "role": "assistant","content": "<校验通过的 JSON 或 {zh,en} 文本>" }
  ],
  "meta": { "task", "source": "gold|silver|synthetic", "promptVersion", "levelId?", "accepted": true }
}
```
> assistant 一侧**只收已过确定性墙的样本**：plan 必须 compile+validate 通过、story 必须 copy-scan(中英)干净 +
> 命中 ≥2 母题。**脏样本永不入训练集**（不在禁词/不可解配置上学习）。

### 12.3 gold 采集回路（让数据自己长出来）

- /build 里每次作者**点"采用"AI 建议** → 把 `{input, acceptedOutput}` 追加到对应 `train/*.jsonl`（标 `accepted:true, source:gold`）。
- 每次作者**手改后通过校验** → 记 `{input, humanOutput}` 为最高质量 gold。
- 规则分类器 + 负样本合成器持续产 silver/synthetic 兜底冷启动。
- 去重（按 input hash）、按 task 切 train/val（如 90/10，official 关固定进 val 做 §9 评测）。

### 12.4 训练工具与产物（本地、不破预算）

- **Apple Silicon 首选 `mlx-lm` LoRA**：`mlx_lm.lora --model Qwen/Qwen3-4B-Instruct --train --data data/ai/train`；
  备选 unsloth / axolotl（CUDA）。LoRA rank 8–16，几百~几千条即可，分钟级。
- 产物：LoRA 适配器 → 合并 → 量化 **GGUF** → `ollama create hp-config-4b -f Modelfile` 给同一 OpenAI 兼容端点。
- **仍是作者侧**：微调后的 GGUF 只占本机磁盘（仍 ~2.5GB 同档量化），**不进游戏包**。
- eval：复用 §9 benchmark（分类准确率 / 非法 patch 率 / compile&validate 通过率 / 双语 copy-scan=0 / 故事 rubric），
  微调前后同一套 val 对比，**不达标不上线**。

### 12.5 触发条件（什么时候才值得开训）

每族 ≥ ~200 条 accepted gold 再考虑微调；不足时 few-shot 足够。命令 `ai:train:prep`（聚合+去重+切分）→ `ai:train:lora`（可选、手动）。
数据目录 `data/ai/train/` 进 .gitignore（含潜在私有草稿派生），只提交 schema 与 prompt 模板。

---

## 13. 风险与非目标

**非目标（本轮明确不做）**：不改 runtime / React builder 行为；不下载/训练大模型；不跑重型长任务；
不动其他 agent 正在改的资产文件；不让模型直接吐 `LevelDefinition` TS；不自动改写官方关卡。

**风险与缓解**：
- 官方关不可经 Builder round-trip（0.4-①）→ patch 只在 builder 层、对官方关只读/只建议。
- builder issue 无稳定 code（0.4-③）→ 先靠 validation/* 的 code 把关；补 code 列为单独微小 PR。
- modelKey→(material,geometry) 解析依赖**自动生成的** `generatedBuilderAssetCatalog` + raw-webgpu manifest，陈旧 key 不被 lint
  → ConfigCard 的 `resolvedTriple.missing` 显式暴露，评测盯。
- 静默迁移/归一化（material 重映射、archiveTarget 越界归 64）会丢作者意图 → 评测专门检测"原值 vs 归一值"。
- 模型 JSON 不稳 → 语法约束解码 + schema 重试 + 确定性 fallback 三重兜底。
- 私有草稿隐私 → 默认不导出、不提交。

**本轮改了哪些文件**：仅**新增**本规划文档
`games/human-protocol/docs/human-protocol-local-ai-config-planner.md`。
**未改动任何 runtime / config / 脚本 / 资产文件。**（工作区里 level03 资产的删改属于其他并发 agent，未触碰。）
