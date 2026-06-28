# Human Protocol Config-Generated Escape Room Architecture

本文档定义 `Human Protocol` 后期如何从固定 5 关 demo，升级为“玩家一句话生成一段人生密室”的 config-based 游戏。目标不是马上接大模型，也不是重写引擎；目标是先把关卡、怪物、剧情、掉落、地图和资源都整理成可验证配置，让人工写的后 4 关和未来本地机器人生成的关卡使用同一套格式。

密室机关、文章阅读、阅读问答和门开关的细化能力见：`human-protocol-config-room-puzzle-systems.md`。

核心目标更新：

> 5 关 demo 不是最终内容量，而是未来本地机器人生成系统的官方参考包、训练样本和验收标准。从现在开始，config 自由度不是后期附加功能，而是当前架构的第一优先级。

## 0. 结论

当前最适合的节奏：

1. 先做一个最小 `Config Runtime v1`，再开始正式实现 Level 02。
2. Level 02 作为第一张 config 化试点关卡。
3. Level 03-05 不要继续按旧的硬编码模式写进 `levelManifest.ts`，否则后面生成系统会多一次迁移。
4. 本阶段只让 config 控制关卡内容，不让 config 执行任意 JS。
5. Web 版先用 `localStorage` 存轻量资料和配置索引，用 `IndexedDB` 或 OPFS 存玩家导入资源和大 config pack。后期桌面版再用 Tauri/Electron 打开本地文件夹和本地模型。
6. 每个官方 demo 关卡都要同时产出“人类设计意图 + config + QA 报告”，让后期本地机器人能学会我们想要的节奏、恐怖感和可玩性边界。

一句话判断：

> 先 refactor 到“关卡包驱动”，再写后 4 关。不要等 AI 生成系统全部完成，但也不要继续把后 4 关写成更大的硬编码。

## 0.1 5 关 Demo 的真正作用

这 5 关的定位不是“内容做满”，而是做出一套本地机器人未来可以模仿、扩展、变形的黄金样本。

每一关都应该保存四层东西：

```text
human-authored-intent.md       人类导演为什么这样设计
level.config.json/ts           机器可运行的关卡配置
validation-report.json         机器可读的预算和 QA 结果
repair-notes.md                如果不好玩，改了什么以及为什么
```

这样后期训练本地机器人时，它学到的不是散乱剧情，而是：

- 什么样的玩家一句话会变成什么样的密室。
- 什么样的房间目标适合 2-4 分钟移动端体验。
- 什么时候给怪，什么时候给沉默，什么时候给广播。
- 多少怪会卡，多少掉落会廉价，多少对白会烦。
- 如何把“人生愿望”拆成目标、敌人、掉落、门锁和结局。

官方 5 关要成为：

- `reference campaign`：玩家第一次看到这个世界的标准版本。
- `schema proving ground`：证明 config 能表达真实关卡。
- `generator training set`：给本地机器人提供高质量样本。
- `desktop app seed content`：桌面版安装后自带的基础关卡包。

## 1. 最终玩家体验

玩家输入一句话：

```text
我想体验一个以为自己是成功医生，最后发现自己只是医疗机器人训练样本的人生。
```

本地机器人生成一个可玩的 config pack：

- campaign：整段人生主题、结局路线、5-10 个房间。
- level：每个密室的目标、门锁、触发剧情、波次节奏。
- actors：敌人、NPC、广播、Boss。
- map：房间布局、门、障碍、互动物。
- loot：芯片、急救包、关键道具、可选奖励。
- dialogue：屏幕中间闪现的短句、机器人广播、假记忆片段。
- asset manifest：玩家导入的图片、贴图、音频、模型如何被使用。

玩家生成后可以：

- 直接游玩。
- 调参：怪物数量、恐怖程度、奖励密度、结局风格。
- 替换资源：加自己的图片、贴图、BGM、模型。
- 导出 config pack 分享给别人。
- 后期桌面版可以读取本地文件夹作为 mod。

## 2. 设计原则

### 2.1 核心引擎固定，内容用 config

固定在代码里的内容：

- 第一人称移动、镜头、手机/桌面输入。
- 武器手感、攻击判定、受击反馈、死亡复活。
- 基础 AI 行为类型。
- 渲染优化策略、对象池、InstancedMesh、贴花系统。
- 安全验证、资源预算、存档系统。

放进 config 的内容：

- 关卡标题、任务目标、剧情触发。
- 房间节点、门锁、互动物、出口。
- 敌人种类、数量、出生点、增援规则。
- 掉落表、修复箱概率、芯片奖励。
- Boss 阶段、对白、特殊事件。
- 使用哪些 texture atlas、贴花、音效、BGM。

### 2.2 AI 生成的是“可验证数据”，不是代码

禁止生成：

- 可执行 JavaScript。
- 任意 HTML 注入。
- 任意远程脚本 URL。
- 超出预算的大量敌人或巨大资源。
- 无法手机游玩的复杂操作。

允许生成：

- JSON config。
- 短文本剧情。
- 资源引用和资源标签。
- 地图网格/房间节点。
- 敌人参数，但必须通过预算裁剪和安全 clamp。

### 2.3 玩家一句话必须变成“人生密室”

这个游戏的生成方向不是普通随机地牢，而是：

> 玩家说出一种人生欲望，本地机器人把它解释成一座密室。每个房间都是这段人生的一层幻觉，机器人和机关不断暴露矛盾，最后让玩家发现自己到底是什么。

好玩的点来自：

- 玩家觉得“这是我生成的人生”。
- 每个房间都在拆穿这段人生。
- 机器人台词像系统维护日志，又像恐怖广播。
- 最后有路线选择：继续相信、逃离、修复、反向控制系统。

### 2.4 自由度来自“可组合能力”，不是无限硬写

玩家和本地机器人需要很大的自由度，但底层不能变成无法验证的随意脚本。正确方式是给足够多的组合积木：

- room：病房、家庭、办公室、学校、审判厅、博物馆、工厂、街道幻觉。
- lock：钥匙、记忆选择、生存波次、修复面板、Boss 死亡、资源消耗。
- actor：维修单位、家政单位、监管单位、伪装人声、Boss 平台。
- event：广播、灯光断电、门锁重置、远景机器人排队、假记忆闪回。
- loot：急救、芯片、弹药、核心电池、剧情证物。
- route：相信人类层、接受维修、反向控制、重建人类。

长期自由度来自这些积木的排列组合，而不是让本地机器人生成新代码。

### 2.5 桌面 App 是长期主形态

Web 版先验证玩法、关卡配置和平台流量。长期桌面版要承载更自由的本地机器人能力：

- 本地模型读写 config pack。
- 玩家本地资源库。
- mod 文件夹。
- 大资源压缩和预览。
- 无网络也能生成和游玩。
- 可把生成好的轻量 pack 导出给 Web 版或朋友。

因此现在的 config 设计必须避免只适配浏览器临时存储，要从一开始保留 `pack folder / asset manifest / import-export` 的概念。

## 3. Web 到 Desktop 的技术路线

### 3.1 Web v1

使用：

- `localStorage`：用户设置、已安装 pack 索引、轻量存档、最近生成 prompt。
- `IndexedDB`：完整 custom config pack、玩家导入图片/音频/GLB、生成历史。
- OPFS：可选，用于更大资源缓存和未来离线包。

注意：

- `localStorage` 不适合塞大资源，容易同步卡顿。
- 图片、音频、GLB 要进 `IndexedDB` 或 OPFS。
- custom pack 可以先支持导入/导出 `.json`，后期再支持 `.zip`。

### 3.2 Desktop v2

优先考虑 Tauri：

- 包体更小。
- 文件系统权限更克制。
- 适合小体量 WebGL 游戏。

Electron 适合：

- 需要更容易接 Node 生态。
- 本地模型、资源处理、开发工具更复杂。

桌面版增强：

- `mods/pack-id/` 文件夹。
- 本地模型运行时。
- 本地资源压缩工具。
- 批量导入贴图、音频、GLB。
- 关卡编辑器和一键预览。

## 4. Config Pack 结构

建议 pack 目录：

```text
human-protocol-pack/
  campaign.json
  levels/
    level_01_maintenance_bay.json
    level_02_residential_simulation.json
  actors/
    enemies.json
    npcs.json
  loot/
    loot_tables.json
    upgrade_pools.json
  dialogue/
    dialogue_bank.json
  assets/
    asset_manifest.json
  meta/
    author.json
    validation_report.json
```

内置官方 demo 也使用同样结构，只是可以先写成 TypeScript 对象，后期再导出 JSON。

## 5. Core Schema v1

### 5.1 Campaign

```ts
export interface GeneratedCampaignConfig {
  schemaVersion: "hp.config.v1";
  packId: string;
  title: string;
  language: "zh-CN" | "en-US";
  playerFantasy: string;
  hiddenTruth: string;
  emotionalArc: readonly string[];
  levels: readonly string[];
  globalAssetBudgetMb: number;
}
```

### 5.2 Level

```ts
export interface GeneratedLevelConfig {
  id: string;
  title: string;
  chapterIndex: number;
  targetDurationSec: [number, number];
  spawnPoint: Vec3Tuple;
  objectiveChain: readonly ObjectiveConfig[];
  rooms: readonly RoomNodeConfig[];
  doors: readonly DoorLockConfig[];
  interactables: readonly InteractionConfig[];
  enemySpawns: readonly EnemySpawnConfig[];
  lootTables: readonly LootTableConfig[];
  dialogue: readonly DialogueLineConfig[];
  exit: LevelExitConfig;
  assetRefs: readonly string[];
}
```

### 5.3 Room Node

```ts
export interface RoomNodeConfig {
  id: string;
  label: string;
  bounds: {
    center: Vec3Tuple;
    size: Vec3Tuple;
  };
  mood: "quiet" | "uneasy" | "combat" | "boss" | "reveal";
  props: readonly PropPlacementConfig[];
  spawnGroups: readonly SpawnGroupConfig[];
}
```

### 5.4 Door Lock

```ts
export interface DoorLockConfig {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  lockType: "key_item" | "survive_wave" | "repair_panel" | "memory_choice" | "boss_dead";
  requiredId?: string;
  closedDialogueTrigger?: string;
  openedDialogueTrigger?: string;
}
```

### 5.5 Interaction

```ts
export interface InteractionConfig {
  id: string;
  type: "pickup" | "inspect" | "repair" | "memory_echo" | "terminal" | "door_panel";
  roomId: string;
  position: Vec3Tuple;
  radius: number;
  grants?: readonly RewardConfig[];
  startsObjectiveId?: string;
  completesObjectiveId?: string;
  dialogueTrigger?: string;
  visualKey: string;
}
```

### 5.6 Enemy Spawn

```ts
export interface EnemySpawnConfig {
  id: string;
  trigger:
    | { type: "time"; afterSec: number }
    | { type: "objective_started"; objectiveId: string }
    | { type: "objective_completed"; objectiveId: string }
    | { type: "player_enter_room"; roomId: string };
  archetypeId: string;
  count: number;
  spawnGroupId: string;
  maxAlive?: number;
  reinforcement?: {
    everySec: number;
    maxGroups: number;
    requiresActorAlive?: string;
  };
}
```

### 5.7 Dialogue

```ts
export interface DialogueLineConfig {
  id: string;
  trigger: string;
  speaker: "earpiece" | "robot" | "facility" | "memory" | "unknown";
  text: string;
  durationSec: number;
  priority: "low" | "normal" | "urgent";
  presentation: "center_flash" | "radio_subtitle" | "objective_hint";
}
```

### 5.8 Enemy Archetype

```ts
export interface ConfigEnemyArchetype {
  id: string;
  displayName: string;
  role: "swarm" | "flanker" | "guard" | "turret" | "boss";
  health: number;
  damage: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldown: number;
  behaviorKey: "chase" | "flank" | "hold_position" | "boss_repair_platform";
  visualKey: string;
  hitReactionKey: string;
  deathKey: string;
  lootTableId: string;
}
```

### 5.9 Asset Manifest

```ts
export interface AssetManifestConfig {
  assets: readonly {
    id: string;
    type: "texture_atlas" | "image" | "audio" | "glb" | "decal" | "material_preset";
    source: "builtin" | "local_import" | "generated";
    uri: string;
    maxBytes: number;
    tags: readonly string[];
    fallbackAssetId?: string;
  }[];
}
```

## 6. Runtime 架构

```text
ConfigPackStore
  -> loads builtin packs
  -> loads local custom packs
  -> exports/imports packs

ConfigValidator
  -> schema check
  -> budget check
  -> safety check
  -> compatibility check

ConfigNormalizer
  -> fills defaults
  -> clamps enemy counts
  -> resolves asset fallbacks
  -> converts generated ids to runtime ids

RuntimeLevel
  -> used by GameWorld
  -> feeds WaveDirectorSystem
  -> feeds DialogueSystem
  -> feeds InteractionSystem
  -> feeds LootSystem

Save/Profile Store
  -> remembers completed packs
  -> remembers player upgrades
  -> stores generated pack history
```

核心规则：

- `GameWorld` 不应该知道某关是人写的还是 AI 生成的。
- `WaveDirectorSystem` 只读 `RuntimeLevel.enemySpawns`。
- `DialogueSystem` 只读 `RuntimeLevel.dialogue`。
- `InteractionSystem` 处理门锁、拾取、终端、记忆回声。
- 渲染层只认 `visualKey`、`assetId` 和少量材质参数。

## 7. 本地机器人生成流程

玩家一句话输入后：

1. Intent Parser：提取人生身份、欲望、恐惧、结局风格。
2. Campaign Planner：生成 3-8 个房间/关卡的情绪曲线。
3. Level Generator：逐关生成 JSON config。
4. Budget Simulator：检查时长、敌人密度、资源大小、手机性能。
5. Schema Validator：校验字段完整性。
6. Repair Loop：如果无效，让本地机器人只修 JSON，不改设计方向。
7. Preview Builder：生成可预览的标题、房间图、敌人列表、奖励列表。
8. Save Pack：写入 `IndexedDB`，在 `localStorage` 写 pack 索引。

### 7.1 训练本地机器人的目标

本地机器人不只是“写剧情”。它要学会三件事：

1. 把玩家一句话翻译成我们的内部高质量关卡 prompt。
2. 把关卡 prompt 翻译成合法 config pack。
3. 根据 validator 和 QA 结果修复 config，而不是随意改世界观。

训练样本应该长这样：

```text
input/
  player_sentence.txt
  director_prompt.md
output/
  campaign.config.json
  levels/level_02.config.json
  actors/enemies.config.json
  dialogue/dialogue.config.json
qa/
  validation-report.json
  gameplay-notes.md
  repair-prompt.md
```

`director_prompt.md` 是最重要的中间层。未来玩家只说一句话，但本地机器人先把它扩写成我们的导演 prompt，再生成 config。这样生成质量会比“一句话直接吐 JSON”稳定很多。

当前 Web demo 已提供开发者 graph export：

- 打开关卡时加 `?graph=1` 或 `?debug=graph`。
- UI 会显示 active level 的 config graph report。
- 本地机器人可以从页面执行 `window.__HUMAN_PROTOCOL_EXPORT_GRAPH__()`，得到 active report + built-in reports 的 JSON。
- 默认 `?debug=0` 不显示 graph 面板，也不暴露 export hook，避免污染普通玩家体验。

### 7.2 Prompt 到 Config 的分层

不要让一个模型调用承担全部工作。长期应该分成 4 个角色：

1. `Life Interpreter`：理解玩家想体验什么人生。
2. `Escape Room Director`：把人生拆成房间、门锁、异常细节和结局。
3. `Config Writer`：只负责输出合法 JSON config。
4. `Config Repairer`：根据错误报告只修无效字段、预算超标和节奏问题。

这四个角色可以是同一个本地模型的不同 prompt，也可以后期训练成一个专用小模型。关键是输出边界清晰。

### 7.3 官方 5 关如何喂给本地机器人

每个官方关卡要保留：

- `player_sentence`：这一关如果是玩家一句话生成，会怎么说。
- `director_prompt`：人类策划给 AI 的完整关卡方向。
- `config`：最终可运行配置。
- `bad_version_notes`：哪些做法不好玩，例如怪太多、对白太直白、门锁无意义。
- `qa_result`：通关时间、最大同屏敌人、掉落数量、死亡点、性能风险。

例子：

```text
player_sentence:
我想回到一个完美家庭，但所有人都不记得我的脸。

director_prompt:
做一个 2-4 分钟的住宅模拟间密室。玩家以为自己找到人类生活区，
但相框没有脸，厨房只给机器人营养液，睡眠舱记录显示玩家从未睡眠。
不要揭示玩家是机器人，只让机器人用“住户样本”称呼玩家。

config:
level_02_residential_simulation.config.json
```

这样本地机器人未来会学到“人生愿望 -> 恐怖矛盾 -> 密室目标 -> 可玩 config”的转换方式。

生成 prompt 需要非常明确：

```text
你是 Human Protocol 的关卡导演和系统策划。
根据玩家的人生愿望，生成一个 mobile-first 第一人称机器人密室逃生 config pack。
只能输出 JSON，不能输出代码。
每关 2-4 分钟，每 45-90 秒必须有一个目标、掉落、门锁或剧情变化。
敌人同屏普通手机最多 4 个，Boss 同屏最多 1 个。
剧情必须用短句，单句不超过 22 个中文字。
玩家第一关不直接知道自己是机器人，只能通过矛盾细节猜到。
```

## 8. 生成内容的好玩标准

每个生成 pack 必须满足：

- 10 秒内有一个可互动目标。
- 30 秒内第一次恐怖广播或异常细节。
- 60 秒内第一次战斗或逃跑压力。
- 90 秒内出现一次奖励、门锁突破或剧情反转。
- 每关最多 1 个主目标，2-3 个子互动。
- 每个敌人都有功能差异，不只是换血量。
- 每个掉落都影响玩家决策，不只是闪光垃圾。
- 结尾给玩家一个想继续的选择，而不是单纯通关。

随机系统：

- 每关只给 1 次主要三选一。
- 关内掉落少量修复箱和芯片。
- 低血时修复箱权重上升。
- build 影响真实行为：挥棒精力、换弹、dash CD、急救恢复、芯片保留概率。
- 关卡结算给 Memory，用于长期升级和解锁生成主题。

## 9. 资产策略

### 9.1 低成本高质感

优先使用：

- 共享 texture atlas。
- 贴花板 `DecalPlate`。
- 发光小面片。
- 少量真实 GLB 或压缩后的低模。
- 同类敌人 InstancedMesh。
- 远距隐藏细贴花，近距恢复细节。

避免：

- 每个敌人独立大贴图。
- 太多透明材质。
- 运行中临时创建大量 mesh/material。
- 玩家导入未压缩大图直接用于首屏。

### 9.2 玩家导入资源

Web 版处理方式：

- 图片导入后生成缩略图和压缩版本。
- 大图保留原始文件引用或 IndexedDB blob。
- GLB 导入后读取节点数量、材质数量、贴图大小。
- 超出预算时给玩家提示：可用于桌面高质量模式，不能用于 mobile pack。

资源预算建议：

- Mobile first pack：总资源 8-20MB。
- 单张普通 atlas：512 或 768。
- Boss atlas：1024。
- BGM：mp3/ogg，尽量 1-3MB。
- 小怪模型：压缩后每个 100-500KB 比较舒服。

## 10. 现在仓库的最小 Refactor

不要大重构。先把现在的硬编码关卡包上一层 config runtime。

### Step 1：抽 schema

新增：

```text
src/game/config/schema/levelConfig.ts
src/game/config/schema/actorConfig.ts
src/game/config/schema/assetConfig.ts
src/game/config/runtimeConfig.ts
```

目标：

- 保留当前 `LevelDefinition` 能力。
- 扩展 room、door、interaction、objective。
- 让 Level 01 继续跑。

### Step 2：ConfigPackStore

新增：

```text
src/game/config/ConfigPackStore.ts
src/game/config/builtin/humanProtocolBasePack.ts
```

功能：

- 返回内置 pack。
- 读取 `localStorage` 的 pack index。
- 预留 `IndexedDB` loader。
- 暂时不用 UI 暴露。

### Step 3：Level 01 适配

把当前：

```text
src/game/config/levelManifest.ts
```

整理成：

```text
humanProtocolBasePack.levels[0]
```

不要改手感，不要改数值，只改数据来源。

### Step 4：InteractionSystem v1

新增：

```text
src/game/systems/InteractionSystem.ts
```

先支持：

- 拾取铁棒。
- 拾取手枪。
- 检查终端。
- 门锁开关。
- 进入出口。

Level 02 的厨房、相框、睡眠舱都用这个系统，不单独写逻辑。

### Step 5：Level 02 作为试点 pack

新增：

```text
src/game/config/builtin/levels/level02ResidentialSimulation.ts
```

Level 02 必须使用：

- `rooms`
- `doors`
- `interactables`
- `enemySpawns`
- `dialogue`
- `lootTables`

如果 Level 02 不能用 config 做出来，说明 schema 还不够，不要急着写 Level 03。

### Step 6：后 3 关迁移

Level 02 跑通后，再把 `docs/human-protocol-levels-02-05-script.md` 的 Level 03-05 转成 config。

## 11. 后 4 关按这个模式的节奏

### Level 02：Residential Simulation

目标：证明“密室目标 + 门锁 + 对白 + 战斗”能 config 化。

需要系统：

- 房间节点。
- 3 个互动锁。
- 家政机器人小怪。
- `Carekeeper Host` 小 Boss。
- 短剧情闪现。

不需要：

- 玩家自定义生成 UI。
- 完整资源导入。
- AI 自动生成。

### Level 03：Human Museum

目标：证明“展品、扫描、假记忆选择”能 config 化。

需要系统：

- `memory_choice` 门锁。
- 展柜互动。
- 机器人对白分支。
- 一次路线选择影响结算文案。

### Level 04：Memory Clinic

目标：证明“同一房间被不同记忆解释”能 config 化。

需要系统：

- room mood 切换。
- 终端文本。
- 低强度战斗和高压追击切换。
- 结算时记录玩家选择。

### Level 05：Reclamation Core

目标：证明“Boss 阶段和 demo 结尾真相”能 config 化。

需要系统：

- Boss phase config。
- 三锁臂互动。
- 结局 reveal。
- demo 完成后显示路线入口。

## 12. 为什么先 Refactor 再写后 4 关

如果现在直接写 Level 02-05：

- 每关都会把新互动逻辑硬塞进 `GameWorld` 或关卡系统。
- 敌人、门锁、剧情触发会越写越散。
- 后期 AI 生成时要把所有旧逻辑重新迁移。
- 玩家导入资源和生成 pack 没有落点。

如果先做最小 config runtime：

- Level 02 会慢一点，但 Level 03-05 会越来越快。
- AI 生成系统将来直接复用同一套 schema。
- 官方关卡、玩家关卡、本地机器人关卡都是同一种 pack。
- QA 可以对 config 做自动检查，而不是每关靠人工记忆。

最小 refactor 的边界：

- 不重写渲染器。
- 不改第一关手感。
- 不做完整编辑器。
- 不做复杂 navmesh。
- 不接真实本地模型。
- 只把“内容变化的东西”从代码中抽出来。

## 13. 第一批验收标准

Config Runtime v1 完成后必须满足：

- Level 01 从 config pack 加载后表现不变。
- Level 02 可以用 config 定义至少 3 个互动物、2 个门锁、3 段剧情、2 种小怪、1 个 Boss。
- 修改 Level 02 的敌人数量不需要改系统代码。
- 修改 Level 02 的对白不需要改系统代码。
- 修改一个门锁条件不需要改系统代码。
- 无效 config 会给出错误原因，不会白屏。
- build 通过。
- in-app Browser 能从 title 进入 Level 01，且 console 无 error/warn。

## 14. 未来生成编辑器

第一版编辑器不要做复杂 3D 编辑。先做轻量表单：

- Pack title。
- 一句话人生 prompt。
- 房间列表。
- 每房间目标。
- 敌人数量滑杆。
- 掉落密度滑杆。
- 恐怖程度滑杆。
- 资源导入。
- JSON 预览。
- 验证报告。
- 开始游玩。

高级版再做：

- 平面房间图。
- 资源拖拽。
- 关卡模拟器。
- 本地机器人一键修复。
- 分享码或导出 zip。

## 15. 下一步执行清单

已完成的第一轮 runtime/config 底座：

1. schema 文件已落地，并映射当前 `LevelDefinition`。
2. `ConfigPackStore` 已支持内置 pack 和 localStorage custom pack。
3. `GameWorld.loadLevel` 已通过统一 level registry 读取关卡。
4. `InteractionSystem / DoorSystem / RoomDirector / WaveTriggerBridge / RuntimeEvent` 已支持第一批密室系统。
5. Level 02-05 已作为 config-driven 官方样板关接入。
6. `npm run smoke:campaign` 已能跑内置 validation、custom pack import QA 和 1-5 关 runtime pass-through。
7. Title 页已提供“本地关卡”折叠工具：选择、导出、导入、保存、删除。
8. 官方 1-5 关已接 `Localized Config Copy v1`：中文 config 保持原样，运行时按语言覆盖英文标题、flow、目标、对白、选择、门锁/钥匙/奖励/密码/打灯反馈、波次提示和升级卡。下一步 custom pack schema 应补 `i18n`，让本地机器人生成的 pack 能直接带多语言 copy。

下一轮推荐：

1. 做 `generated level template library`，把钥匙门、颜色球、方位密码、三锁臂、Boss 房、剧情三选一拆成可组合模板。
2. 给本地机器人一份固定 prompt adapter：一句话人生 -> 模板选择 -> JSON pack -> validator repair loop。
3. 做“生成关卡档案页”，保存 prompt、pack JSON、validation report、graph summary 和 QA notes。
4. 把 `levels03To05.ts` 拆成一关一个文件，作为训练样本的干净输入。
5. 给 pack schema 增加 `i18n` 字段，并让导入面板校验缺失语言时给 warning。
6. 再做自定义资源引用，不急着做复杂 3D 编辑器。
