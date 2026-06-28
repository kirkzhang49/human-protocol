# Human Protocol 官方关卡生产线调整计划

日期：2026-06-20

## 结论

未来官方关卡生产主线改为增强 `/build`，让 `/build` 逐步覆盖官方关卡需求。除 Level 3 人类博物馆外，不再把旧的官方 `LevelDefinition`、raw JSON plan、多套 official baked plan、trial JSON 同步链路作为长期主线维护。

核心原则：

- `LevelDefinition` 仍是运行时关卡格式。
- `/build` 的 `BuilderProject` 是未来生产入口；Level 1/2 的 official 主源就是 official builder JSON + 轻量 source shell。
- Raw WebGPU render plan 和 baked resource pack 是输出与验收结果，不是手工源稿。
- 非 Level 3 的 `rb_l*.builder.json`、`rb_l*.level.json` 只作为历史快照、示例或 QA fixture。
- Level 1/2 的 `level.official.builder.json` 不是 legacy：它们是当前 official builder-native 源稿；旧 `level.ts/map.ts/waves.ts` 只应瘦成 copy/campaign shell 或兼容导入口。
- Level 3 例外保留官方链路，因为它已有 museum、boss、GUI、lighting、hero exhibit 资产和历史调试价值。

2026-06-20 复读 `/build` 后的修正：当前 `/build` 已经不是只会房间、门和简单 puzzle 的半成品。它已经具备官方关卡导入、形状房间、主题材质、门族、key/puzzle/wave lock、route switch、puzzle-granted key、story prop/article、fast/deep playtest pack、Raw WebGPU 资源桥、官方 source metadata round-trip 等能力。本计划后续重点从“补基础能力”改为“承认现有能力，补少数官方化缺口，并把 QA/文档从旧 official JSON 主线转向 `/build` 主线”。

## 旧链路处理

### 冻结或废弃

- `data/ai/campaign/rb_l1.builder.json`
- `data/ai/campaign/rb_l1.level.json`
- `data/ai/campaign/rb_l2.builder.json`
- `data/ai/campaign/rb_l2.level.json`
- `data/ai/campaign/rb_l4.builder.json`
- `data/ai/campaign/rb_l4.level.json`
- `data/ai/campaign/rb_l5.builder.json`
- `data/ai/campaign/rb_l5.level.json`
- Level 4+ 的旧 official builder source JSON
- 非 Level 3 的 builder-to-official source parity 要求
- 手工编辑 generated Raw WebGPU JSON 的工作方式
- 以 `scripts/ai/buildCampaign.ts` 为官方生产主线的流程

这些内容可以保留在仓库中，但状态应改成 legacy/reference。不再要求每次官方关卡改动都同步它们。

### 必须暂留

- 当前内置 Level 1/2 `LevelDefinition` 兼容入口，但其 playable 内容必须由 official builder JSON 编译/运行时 pack 覆盖。
- Level 1/2 的轻量 source shell：只保留不覆盖 build 的 copy/campaign 字段，例如 dialogues、articles、cinematicBeats、bossPhases、enemyDeathBeats、economy、revive。
- Level 3 当前内置 `LevelDefinition` 和 official builder document，因为它是 museum 特例。
- `ConfigValidator`、`smoke:campaign`、`qa:playthrough`。
- `/build` runtime pack、WGPU resource map、builder deep bake。
- Raw WebGPU 编译器和 visual bake contract，但验收重点从多源 parity 改成资源完整、无代理、可玩、可烘焙。
- Level 3 official builder document、museum lighting、boss visual contract、route switch GUI、hero exhibits。
- 少量通用 lighting/light 脚本，以及仍被 Level 3 或 `/build` 资源链路使用的脚本。

## `/build` 现有能力与真实缺口

### 已经具备的能力

- 房间与布局：普通房间、shaped rooms、building preset、2D/3D 编辑、网格吸附、房间修复、director 模板。
- 环境与视觉：maintenance、sterile、hazard、residential、exit、museum、core 等风格；floor/wall/ceiling surface preset 和 per-room override；全局 lighting mood；door family；官方 service elevator exit policy。
- 机制语法：门锁支持 none、key item、survive wave、puzzle complete；key 可地面拾取，也可由 puzzle grant；pickups 支持 key、repair kit、core cell。
- 谜题语法：`color_sequence` 编译为 `hit_sequence`；`circuit_grid` 编译为 runtime `tool_calibration`；`valve_matrix`、`archive_merge` 可新建；`surveillance_match`、`gallery_reading`、`code_lock` 可作为导入/legacy/runtime registry 语义存在。
- 路由与战斗：route switch 支持一把 key 控制 1-4 个输出，输出可 open door、reveal puzzle、start robots；robot group 支持 archetype、count、tier、combat tuning，并能保留官方 wave trigger、spawn group、reinforcement、reward 等 source metadata。
- Story/official bridge：story prop 会编译为 article + interaction。Level 1/2 的 official builder-native 入口只允许 source shell 保留不覆盖 build 的 copy/campaign 字段；`mapPresentation`、`mapInteractions`、`puzzles`、`objectiveChain`、`events`、`environmentStates`、`pickups`、`combatLimits`、`presentation` 等旧 runtime 字段必须被剥离，避免旧官卡反向覆盖 build。Level 3 可继续保留较完整 source metadata。
- 生产与试玩：本地 save slots、export config pack、fast proxy pack、deep cooked-GLB pack、pack hash/pointer、Raw WebGPU 启动参数、headless builder QA 已经存在。
- 战斗波次参考：普通守门战、连续刷怪、清场开门、最后无限压力的 authoring 规则见 `docs/human-protocol-build-wave-chain-authoring.md`。

### 真正还要补齐的缺口

- `code_lock`：schema、导入和 registry 已存在，但新建通用 `code_lock` 的 compile preset、线索输入、bigScreen hint authoring 还不完整。
- `tool_calibration`：不要再列为基础缺口；它当前通过 `circuit_grid` authoring 进入 runtime `tool_calibration`。后续只需要补 UI 命名、文档口径和官方验收样例。
- `quizzes` / article gate：story prop 已能生成 article interaction，但 quiz gate 与 article-gated objective 还不是一等 authoring。
- `choices` / story branch：官方 choice/story branch 还不是一等 authoring。
- `bigScreens`：导入可保留，但新建 clue screen、绑定 code lock 或 objective 的 UI/compile 仍需要补。
- generic switches 和 runtimeEvents：route switch 已很强，但非 route 的通用 switch、事件 action 链、objectiveChain 可视化仍需要官方化。
- wave chain editor：普通战斗波次链还需要一等 authoring；有限核心波次负责开门/启动下一波，最后可选无限压力永远不能作为开门条件。详见 `docs/human-protocol-build-wave-chain-authoring.md`。
- `bossPhases`：导入可保留，elite robot/wave 可编辑，但完整 boss phase editor、boss visual profile、phase routing 仍需要补。
- official promotion：从 `/build` 草稿升级为 official v2 的 report、diff、manifest 更新、rollback 标记还需要明确工具与 QA 口径。

### 资源链路与 QA 口径

- `/build` 可选资产必须进入 WGPU resource map。
- `builder_runtime_resources` 只做缺失资源补充包，不冒充官方关卡。
- 新资产必须通过 manifest、registry、catalog、footprint、Raw resource pack、QA 的完整链路。
- 禁止 runtime 正常路径临时 cook GLB。
- `/build project -> LevelDefinition -> validateLevelConfig -> playtest/playthrough -> WGPU runtime pack -> visual contract` 成为主验收链。
- Level 1/2 验收必须证明旧 source shell 不能覆盖 build 的房间表面、谜题视觉、门锁、波次或家具。
- 非 Level 3 不再要求 trial JSON 与 official source 完全 parity。
- Level 3 继续保留 focused official contract。
- 浏览器 QA 继续覆盖 desktop 和 mobile landscape。
- pack cache 继续用 engine version 和 explicit packId 防止旧 deep pack 误判。

## Level 3 例外策略

Level 3 保留 heritage official chain：

- 保留 `src/game/config/levels/level03-human-museum/level.official.builder.json`。
- 保留 `OfficialDraftPolicy` 中 Level 3 cached draft preserve 策略。
- 保留 canonical official builder document。
- 保留 `rb_l3.builder.json` 和 `rb_l3.level.json` 作为 Level 3 官方链路 fixture。
- 保留 museum lighting QA、Level 3 Raw rebuild、ThreeJS lossless bridge。
- 保留 Level 3 boss visual contract 和 visual bake focused wrapper。

同时要避免 Level 3 特例继续扩散。可泛化的部分应逐步进入 `/build`：

- hero exhibit placement。
- forced supplemental resources。
- route switch console。
- boss profile。
- lighting profile。
- official exit fixture policy。

## 分阶段路线

### Phase 0：冻结政策

目标：让团队不再继续往非 Level 3 official JSON 链路追加维护成本。

任务：

- 写明 Level 4+ 不新增旧式 official builder JSON；Level 1/2 只维护当前 builder-native official JSON。
- 写明 generated Raw JSON 只可重建，不可手修。
- 将非 Level 3 `rb_l*.json` 标记为 legacy fixture。
- 更新 docs 和 agent instructions。

验收：

- 新文档合入。
- 后续任务说明引用此政策。

### Phase 1：QA 重定向

目标：把 QA 从多源 parity 改成 `/build` 生产验收。

任务：

- 拆分 `qa:builder-to-official`：Level 3 保留 strict parity，非 Level 3 改 capability/resource checks。
- 调整 `qa:build-official` 默认只覆盖 Level 3 canonical official document。
- 保留 `qa:visual-bake-contract`，但把非 Level 3 trial-json drift 降级为 warning 或移出默认阻断。
- 新增 `/build` capability coverage report。

验收：

- `npm run qa:builder`
- `npm run qa:visual-bake-contract`
- `npm run smoke:campaign`
- `npm run build`

### Phase 2：补 `/build` 官方化缺口

目标：让 L1-L5、L9、L10 剩余官方机制能由 `/build` 一等 author，而不是依赖 sourceLevel round-trip 或旧 JSON。

优先级：

1. 新建 `code_lock` 完整链路：UI、compile preset、validator、bigScreen clue 绑定、smoke。
2. wave chain editor：有限核心波次、清场开门、下一波选择、最后非门锁无限压力。
3. article gate + `quizzes`。
4. `choices` / story branch。
5. `bossPhases` / boss visual profile / phase routing，复用 wave chain。
6. generic switches + runtimeEvents action 链。
7. objectiveChain 可视化编辑和校验。
8. official promotion report：从 BuilderProject 到 official v2 的差异、资源、QA 状态一屏展示。

每个能力都要覆盖：

- Builder schema。
- Editor UI。
- Compile to `LevelDefinition`。
- Runtime support。
- Validator checks。
- Smoke config。
- zh/en 文案。
- Browser QA。

注意：`tool_calibration` 不再作为第一批“待补基础机制”。当前应把 `circuit_grid -> tool_calibration` 当成已有能力，后续只补命名、示例、官方验收和资源覆盖报告。

### Phase 3：垂直切片

目标：先证明 `/build` 可以真正承接官方关卡生产。

推荐顺序：

- L6：机制简单，适合作为第一个 `/build` official v2。
- L7：surveillance_match 专项，验证观察匹配类导入/保留/重编译。
- L8：circuit + valve 双谜题，验证 `circuit_grid -> tool_calibration` 与 valve_matrix 组合。
- L1/L2：已转为 builder-native official；后续只维护 official builder JSON + source shell，不再回到旧手写官卡主线。
- L4/L9：等新建 `code_lock` + bigScreen clue 链路稳定后迁移。
- L5：等 quiz/article gate 稳定后迁移。
- L10：等 boss phase authoring 稳定后迁移。

验收：

- 新关卡先用 `-v2` 或新 id 并行。
- 不直接覆盖旧 campaign slot。
- 每关都有 real playthrough route。

### Phase 4：逐关替换

目标：将通过验收的 `/build` 产物切入 official campaign。

任务：

- 更新 campaign manifest。
- Level 1/2 的 rollback 单位是上一份 official builder JSON/source shell；不要恢复旧多文件官卡主线。
- 更新 playthrough QA。
- 更新 menu 展示和 localization。
- 生成 Raw/WGPU 资源并跑 visual contract。

验收：

- `npm run qa:playthrough`
- `npm run smoke:campaign`
- `npm run qa:builder:wgpu-assets`
- `npm run qa:visual-bake-contract`
- `npm run build`

### Phase 5：清理 legacy

目标：等多个 `/build` official v2 稳定后，再集中清理旧链路。

任务：

- 删除或归档非 Level 3 `rb_l*.json`。
- 降级或删除 `scripts/ai/buildCampaign.ts` 的 official 语义。
- 清理非必要 lighting search 脚本。
- 清理过期 raw plan fixture。

约束：

- 必须单独 PR 或单独 commit。
- 删除清单先给用户确认。
- 不和功能迁移混在一起。

## 风险

- `/build` 能力补齐前，强行迁移 Level 4+ 会丢失官方机制；Level 1/2 已按 builder-native official 方向维护。
- 非 Level 3 QA 一次性放松太多，可能让资源缺失或白模回归。
- `builder_runtime_resources` 可能膨胀，需要继续审计重复资源。
- pack cache 如果 engine version 没有正确 bump，浏览器会显示旧 deep pack。
- Level 3 特例如果继续扩散，会重新制造多源维护成本。
- 当前仓库已有大量资产和生成物变更，清理必须谨慎分组。

## 当前脏工作区处理政策

已在 2026-06-20 做 checkpoint commit：

- commit：`e26474c`
- message：`Checkpoint human protocol build pipeline work`

后续原则：

- 不 revert 用户或其他 session 的改动。
- 不在迁移计划任务里顺手清理资产。
- 如果要清理当前 session 半成品，先列出删除/回滚清单，再等用户确认。
- 每个执行方只处理自己任务范围内的文件。

## 执行方拆分

下面任务包可以分别交给不同 Codex session 或工程执行方。每个执行方开工前都要读取 `human-protocol-config-game-dev` skill。

### 执行方 A：架构与政策落地

目标：把生产线政策写入 repo 的长期文档和 agent 说明。

输入：

- 本文档。
- `docs/LEVEL3_BUILD_OFFICIAL_CONTRACT.md`
- `docs/human-protocol-builder-wgpu-resource-map.md`
- `docs/human-protocol-official-room-design-pipeline.md`

任务：

- 更新官方生产线文档，明确非 Level 3 不维护 official builder JSON。
- 更新 agent/handoff 文案，避免后续 session 继续维护旧 official raw JSON 主线。
- 标记 `scripts/ai/buildCampaign.ts` 和非 Level 3 `rb_l*.json` 的 legacy 状态。

验收：

- 文档无互相矛盾。
- 不改运行时代码。
- `git diff --check`。

### 执行方 B：QA 链路重定向

目标：让 QA 反映新主线。

任务：

- 调整 `scripts/qa/build-official-source-qa.mjs` 默认只检查 Level 3 canonical official source。
- 调整 `scripts/qa/builder-to-official-pipeline-qa.mjs`，非 Level 3 不再默认阻断 trial JSON drift。
- 保留 Level 3 focused strict checks。
- 新增或更新 report 字段，写明 `legacyFixture` / `canonicalLevel3` / `buildCapability`。

验收：

- `npm run qa:build-official`
- `npm run qa:builder-to-official`
- `npm run qa:visual-bake-contract`
- `npm run smoke:campaign`

### 执行方 C：/build puzzle/story 官方化

目标：补 `/build` 已有体系里的 puzzle/story 缺口，不重复实现已经存在的 `circuit_grid -> tool_calibration`。

第一批任务：

- 完成新建 `code_lock`：UI 参数、compile preset、validator、runtime smoke、bigScreen clue 绑定。
- 完成 article gate + `quizzes` authoring。
- 完成 `choices` / story branch authoring。
- 给 `circuit_grid -> tool_calibration` 增加官方样例、文档命名和 capability report，避免被后续误判为缺口。

每个任务必须覆盖：

- `src/build/BuilderTypes.ts`
- `src/build/compileBuilderProjectToLevel.ts`
- editor UI。
- `src/game/config/schema/levelConfig.ts` 如需扩展。
- `src/game/core/GameWorld.ts` 如需 runtime state。
- `ConfigValidator`。
- smoke config。
- i18n。

验收：

- `npm run qa:builder`
- `npm run smoke:campaign`
- `npm run qa:playthrough` 如影响 campaign progression。
- `npm run build`

### 执行方 D：Boss 与战斗 authoring

目标：让 `/build` 能产出 L3/L5/L10 级别 boss encounter。

任务：

- 设计 `BuilderBossEncounter` schema。
- 编译到 `bossPhases`、waves、spawnGroups、presentation。
- 接入 boss visual profiles。
- 增加 boss completion objective/exit routing。
- 增加 validator graph simulation。
- 做一个 smoke boss level。

验收：

- boss smoke 可通关。
- `qa:playthrough` 覆盖至少一个 boss path。
- mobile enemy budget 不被破坏。

### 执行方 E：Raw/WGPU 资源链路

目标：保证 `/build` 官方化后资源稳定。

任务：

- 检查 `BuilderRuntimeAssetIndex` 是否覆盖新机制资产。
- 为新 puzzle machine、boss asset、screen、quiz/article prop 增加 resource map。
- 确保 supplemental pack resource-only。
- 强化 missing WGPU resource 报告。
- 明确何时 bump `BUILDER_RUNTIME_PACK_ENGINE_VERSION`。

验收：

- `npm run qa:builder:wgpu-assets`
- `npm run qa:builder`
- `node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs`
- `npm run qa:visual-bake-contract`

### 执行方 F：Level 3 守护

目标：保住 Level 3 例外链路，同时减少特例扩散。

任务：

- 维护 `level.official.builder.json`。
- 维护 museum lighting QA。
- 维护 boss visual contract。
- 把可泛化的 route switch、hero props、forced resources 提炼成 `/build` 能力需求。
- 确保 `rb_l3.builder.json`、`rb_l3.level.json`、official source、Raw plan 不漂移。

验收：

- `npm run raw-webgpu:level03:rebuild`
- `npm run qa:level3:visual-contract`
- `npm run qa:visual-bake-contract`
- browser visual QA。

### 执行方 G：官方 v2 关卡生产

目标：用 `/build` 产出第一批 official v2。

推荐顺序：

- L6 v2。
- L7 v2。
- L8 v2。
- L1 v2。
- L4/L9 v2：等新建 `code_lock` + bigScreen clue 链路完成。
- L5 v2：等 quiz/article gate 完成。
- L10 v2：等 boss phase authoring 完成。

任务：

- 从 `/build` 生成 BuilderProject。
- 编译为 `LevelDefinition`。
- 以新 id 并行注册。
- 写 playthrough path。
- 做 browser QA。

验收：

- 新关卡 validator 0 errors。
- golden path 可通。
- WGPU resource map 完整。
- 不替换旧关卡，除非用户确认。

### 执行方 H：Legacy 清理

目标：在迁移稳定后清理旧链路。

前置条件：

- 至少两个 `/build` official v2 稳定通过 QA。
- 用户明确批准清理范围。

任务：

- 列出将删除或归档的文件。
- 分批清理非 Level 3 `rb_l*.json`。
- 分批清理过期 lighting/raw 实验脚本。
- 删除 docs 中过时指令。

验收：

- 删除清单已确认。
- `npm run smoke:campaign`
- `npm run build`
- `git diff --check`

## 推荐下一步

1. 先让执行方 A 落文档政策。
2. 然后执行方 B 改 QA 范围。
3. 同时执行方 C 和 E 从新建 `code_lock + bigScreens` 开始补 `/build` 官方化缺口和资源链。
4. Level 3 由执行方 F 独立守护，不阻塞非 Level 3 新主线。
