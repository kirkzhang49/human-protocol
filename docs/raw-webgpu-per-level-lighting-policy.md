# Raw WebGPU Per-Level Lighting Policy

Status: active decision, June 2026.

## `renderer=raw-webgpu` 做什么

`renderer=raw-webgpu` 只应该选择渲染后端。

它的职责是：

- 用 Raw WebGPU 运行官方关卡，而不是走 Three.js / R3F fallback。
- 读取当前关卡自己的 `render_plan_<level>.json`。
- 读取同关卡配套的 geometry、material、texture、sidecar、lightingProfiles、visibilityScenarios。
- 按 `modelKey` / material role / room visibility 去画已经 bake 好的资源。

它不应该做这些事：

- 不应该改玩法、门、谜题、刷怪或动线。
- 不应该替 official builder JSON 或 LevelDefinition 补内容。
- 不应该默认给所有关卡套同一套电影化曝光、调色、IBL、shadow、grounding、tone-map 审美。
- 不应该靠全局开关把不同关卡修成同一种颜色。

一句话：`renderer=raw-webgpu` 是后端选择，不是全局美术导演。

## 为什么取消全局默认

关掉全局默认后，各关的画面更像自己的关卡，而不是被同一套 Raw runtime look 统一洗过。

全局默认的问题：

- 它会把 Level 1 维修舱、Level 2 假家庭、Level 3 人类博物馆、Level 4 记忆诊所、Level 5 回收核心推向同一种光感。
- 它会掩盖真正该修的 source / compiler / tuning 问题。
- 它会让浏览器里看起来像是“Raw renderer 质量问题”，但实际是全局 artist fallback 在干预。
- 它让后续 review 很难判断一处画面改善来自哪个 level 的 plan，还是来自全局默认。

所以以后默认原则是：没有全局审美默认。每关自己决定光线和调色。

## 正式规则

1. Raw WebGPU runtime 可以有通用渲染能力，但不能默认开启通用审美。
2. 全局 URL 参数只能用于临时 A/B 和 debug，例如 `rawAgx`、`rawIbl`、`rawFull`、`rawEnv`。
3. 如果一个全局参数改变了所有关卡的默认观感，它不能作为生产默认。
4. 生产画面修正必须落到对应 level 自己的 source / render plan / tuning。
5. 生成的 Raw JSON 是产物，不是手工源稿；不要直接 patch generated render plan。

允许保留的全局逻辑：

- WebGPU device / bind group / buffer / texture loader。
- 性能保护和移动端降级。
- crash fallback 到 Three.js。
- debug-only URL flag。
- 完全中性的兜底值，例如缺少 `lightingProfiles` 时保证不黑屏。

不允许作为默认生产策略的全局逻辑：

- 所有关卡共用的曝光、对比、饱和、warmth 加成。
- 所有关卡共用的 AGX / tone-map 审美开关。
- 所有关卡共用的 IBL / bloom / grounding / shadow boost。
- 所有关卡共用的 visual director 自动调色。

## 以后怎么改某一关的光线

改 Level N 的光线时，按这个顺序走：

1. 改官方 source：`level.official.builder.json`、LevelDefinition presentation、room style、light fixture、surface preset。
2. 如果 source 表达不了，再改 Raw compiler：`tools/raw-webgpu-compiler/*`。
3. 如果这一关需要精修，新增或更新关卡级 tuning：
   - `raw_lighting_algorithm_tuning_<levelId>.json`
   - `raw_visual_color_tuning_<levelId>.json`
   - `raw_role_palette_tuning_<levelId>.json`
   - `raw_material_pipeline_<levelId>.json`
4. 重新生成该关 Raw output：
   - `render_plan_<levelId>.json`
   - `render_plan_<levelId>_geometry.bin`
   - `raw_material_pipeline_<levelId>.json`
   - `raw_threejs_resource_bridge_<levelId>.json`
   - public Raw texture / material output
5. 用 `renderer=raw-webgpu` 进游戏看该关，不用全局默认救场。
6. 跑 focused QA，再决定是否需要 broader QA。

## Level 4 记忆诊所的要求

Level 4 是记忆诊所 / robot facility / last human / escape horror，不是普通医院。

它的光线应该来自 L4 自己的 plan：

- 候诊区可以干净、偏白、可读。
- 治疗椅室可以有冷色医疗光和局部屏幕光。
- 身体椅室可以更红、更暴露、更像揭示真相。
- 治疗剧场可以压暗、危险、出口方向清楚。
- 服务电梯出口仍然走自己的 exit-room 规则。

不要用一个全局 Raw look 把 L4 拉成 Level 3 博物馆、Level 1 维修舱或 Level 5 核心的颜色。

## 已删除和仍可清理的旧全局默认

已删除：

- `rawGlobalDefaults` 这种一键恢复全局 look 的 URL 入口。
- 默认开启的全局 full effects 恢复路径。
- 默认开启的全局 AGX / IBL / postprocess / shadow-map 审美恢复路径。
- 默认 1.25 之类的全局 grounding boost。

仍可以逐步删除或降级：

- 非 debug 用途的全局 visual director。
- 会跨关卡改变观感的 runtime artist fallback。

删除前提：

- 每个 official level 都有完整 `lightingProfiles`。
- 需要特殊审美的关卡有自己的 tuning 文件。
- `renderer=raw-webgpu` 无 URL flag 时仍能正常显示所有维护中的官方关卡。
- QA 能证明没有黑屏、材质丢失、过暗、过曝、出口不可读。

## 验收口径

好的 Raw WebGPU 默认行为应该是：

- 无 URL flag 时，各关只吃自己的 source / plan。
- 加 `renderer=raw-webgpu` 只改变渲染后端，不改变关卡美术意图。
- 要比较具体渲染能力时，显式加具体 debug flag，不再使用一键全局 look。
- 如果某关不好看，修某关，不修全局。
