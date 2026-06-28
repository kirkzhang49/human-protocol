# scripts/ai — 本地 AI 密室 Config Planner（作者侧工具）

> 让一个小本地模型（默认 Qwen3-4B-Instruct-2507）**分类密室 config、提议受限 patch、生成中英文玩家故事**，
> 但**永不破坏可玩性**：模型只吐受限 JSON，落地全靠确定性 `compile → validate` 兜底。
> 这是**作者侧/开发期工具**，跑在本机 Ollama，**不进 `vite build` 产物**——游戏体积零影响。

完整设计 / IR / 标签 / 风险分类 / 模型选型 / 微调数据准备：
👉 **`../../docs/human-protocol-local-ai-config-planner.md`**（单一事实源）

## 跑法（重要：资产桩 loader）

关卡树里有 `.glb`/`.webp` 静态导入，Node/tsx 直接 import 会炸 `ERR_UNKNOWN_FILE_EXTENSION`。
统一用 `lib/asset-register.mjs` 把资产桩成字符串 URL：

```bash
# From the standalone repo root
NODE_OPTIONS="--import ./scripts/ai/lib/asset-register.mjs" \
tsx --tsconfig tsconfig.app.json \
scripts/ai/<script>.ts [args]
```

## 现状（Phase 0–1 零模型确定性核心：全部实现、自检全绿）

| 文件 | 作用 | 状态 |
| --- | --- | --- |
| `selfCheck.ts` | **一键自检整套**（禁词 + schema + 负样本 + 体检全绿才退 0）= CI 守门 | ✅ 全绿 |
| `healthCheck.ts` | **🩺 旗舰：一键体检任意密室**——裁决/分级问题(BLOCKER/WARNING/INFO)/画像/趣味分(0-100)。支持 `<id>` / `all` / `--project <json>` / `--json` | ✅ 20 关可玩、avg 76 |
| `repairPlan.ts` | **🔧 /build「修复」大脑（headless，零模型）**：体检问题→精确 typed 修复 ops→试应用(重编译+重体检，分不降才留)。`--project <json>` [`--apply`] | ✅ demo 85→89、问题2→1 |
| `generateRoom.ts` | **🎲 随机密室生成器 API**：种子驱动、构造即合法的 BuilderProject（线性脊柱+不同谜题+主题+自愈）。`[seed] [puzzleCount] [arc]` / `--batch N` / `--emit` | ✅ 批量 40/40 可玩、avg 87 |
| `buildCampaign.ts` | **🏗️ 用编译器重做 L1-5**（难度递增 2→5 谜题，主题资产，L1 维护 hero+3 decal 编译后合并、L3 三展厅 4 谜题更好玩）。`--emit`→`data/ai/campaign/rb_l{1-5}.{builder,level}.json` | ✅ 全 5 关编译0错+可玩 |
| `serveAi.ts` + `studio.html` | **🎛️ 好看的按钮 UI + 本地 API**（生成/修复/导出）。`http://localhost:4178`，不进游戏包 | ✅ |
| `storyCorpus.ts` | 从 10 关抽**双语故事 gold**（few-shot 范例 + SFT 数据，§12）→ `data/ai/train/story.{exemplars.json,jsonl}` | ✅ 10关全干净、5真双语 |
| `generateStory.ts` | **🪶 双语玩家故事生成（双路）**：model-free 兜底 + 连模型(Qwen3-4B)。`<arc>` [`--model`] | ✅ 两路通 |
| `modelClient.ts` | OpenAI 兼容本地端点(Ollama)适配 + 探测/超时/JSON-schema 校验/重试/**确定性 fallback** | ✅ |
| `trainPrep.ts` | **🧰 汇编四族 SFT 训练集**（classify/risk/story/plan，去重+train/val 切分+manifest）→ `data/ai/train/*.jsonl` | ✅ 33 条(story 待本地化) |
| `prompts/story.v1.md` · `schemas/storyBackground.schema.json` | 故事生成口吻模板 + 输出契约 | ✅ |

> studio UI 现含 **🪶 生成双语故事** 按钮（接 `/api/story`→generateStory）。
> ⚠️ 故事链路依赖 `src/game/config/LevelLocalization`；若并发 agent 正在改 `src/game/config/localization/`（TDZ bug），
> story 工具(storyCorpus/generateStory/trainPrep-story/UI 故事按钮)会**优雅降级**（核心生成/体检/修复不受影响）。修好即恢复。
| `extractConfigCard.ts` | `LevelDefinition → ConfigCard` IR（复用 `explainPuzzle`+`validateLevelConfig`，含 combat 房间、出口房间可达） | ✅ |
| `classifyRules.ts` | 规则分类器（arc/房间角色/难度4轴/节奏/解密结构/风险/母题），零模型基线 | ✅ arc 全对 |
| `copyScan.ts` | 玩家可见文案禁词扫描（**只扫** label/对白/objective，**不扫** id/modelKey；中英禁词） | ✅ 全 20 关干净 |
| `negatives.ts` | guardrail 负样本自测：注入破坏→断言被逮到（也产 §12 训练负样本） | ✅ 11/11 |
| `exportCorpus.ts` | 20 关 → `data/ai/corpus.jsonl`（card+分类+体检） | ✅ |
| `validateSchemas.ts` + `schemas/*.json` + `lib/miniSchema.ts` | IR 契约 + 零依赖校验器（无 ajv） | ✅ |
| `demoEscapeRoom.ts` | 手写 4-谜题密室「夜班档案室」全管线；`--emit` 导出可导入 /build 的 JSON | ✅ 可玩已验证 |
| `lib/asset-stub-loader.mjs` `lib/asset-register.mjs` | tsx 资产桩 loader（运行前提） | ✅ |

待建（接模型阶段，见设计文档 §5/§6/§10/§12）：`embedIndex.ts`、`modelClient.ts`、`planPatch.ts`、`applyPatch.ts`、`generateStory.ts`、`prompts/*.vN.md`。

## 例子

```bash
scripts/ai/run.sh selfCheck.ts                                   # 一键自检整套
scripts/ai/run.sh healthCheck.ts all                             # 全 20 关体检汇总
scripts/ai/run.sh healthCheck.ts level_05_reclamation_core       # 单关详情
scripts/ai/run.sh demoEscapeRoom.ts --emit                       # 先生成 demo 草稿 JSON
scripts/ai/run.sh healthCheck.ts --project data/ai/demo-night-archive.builder.json   # 体检你的草稿
scripts/ai/run.sh repairPlan.ts --project data/ai/demo-night-archive.builder.json --apply   # 自动修复草稿
scripts/ai/run.sh generateRoom.ts 7 4 museum --emit              # 随机生成一间(种子7,4谜题,博物馆)
scripts/ai/run.sh generateRoom.ts --batch 40                     # 批量验证全可玩
# 好看的按钮 UI（生成/修复/导出）：直接 tsx（勿经 run.sh，server 长驻）
NODE_OPTIONS="--import ./scripts/ai/lib/asset-register.mjs" tsx --tsconfig tsconfig.app.json scripts/ai/serveAi.ts
#   → 浏览器开 http://localhost:4178
scripts/ai/run.sh classifyRules.ts                               # 全 20 关分类一览
scripts/ai/run.sh extractConfigCard.ts level_03_human_museum     # 看某关 ConfigCard
scripts/ai/run.sh exportCorpus.ts                                # 导语料 JSONL
scripts/ai/run.sh negatives.ts                                   # guardrail 自测
```

## 红线（别破坏）

- 模型**绝不**直接产 `LevelDefinition` TS；只产受限 JSON，由 `compileBuilderProjectToLevel` + `validateLevelConfig` 应用与拒绝。
- patch 工作在 **BuilderProject 层**（官方关用了 builder 没有的锁型，不可 round-trip；对官方关只读/只建议）。
- AI 逻辑全在本目录；**不往 runtime / React builder 加 AI 分支**。
- 玩家可见文本（含生成的故事）显示前必须过 `copyScan`（中英双语）。
- 关键运行坑见上："builder 编译关卡 `reachability.exitUnlocked` 恒 false"（出口靠 room_entered 事件，静态模拟不跑 events）——
  判可玩用"出口**房间**可达"，不是 `exitUnlocked`。
