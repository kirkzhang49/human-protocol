# Human Protocol Level 4 3D 资产 RAG 记忆复用计划

Status: planning only, June 2026.

这次 Level 4 记忆诊所资产生产效果较好，原因不是单个 prompt 碰巧好，而是流程比较完整：先定审美和空间功能，再做 math-first 尺寸和轮廓，保留 Image2 prompt/provenance，最后接 builder pack、catalog、footprint、Raw WebGPU 和 QA。这个做法应该沉淀成 repo-local RAG 记忆，以后生产别的关卡家具、机关、医疗设备、机器人设施时复用。

## 目标

建立一套可检索的资产生产记忆，让未来 agent 能回答：

- 这类资产的审美基准是什么？
- 哪些 prompt 生成过好结果？
- 哪些尺寸、轮廓、材质槽最适合第一人称移动端？
- GLB / Image2 / builder / Raw WebGPU 接线顺序是什么？
- 哪些错误已经踩过，后续不要重复？
- 哪些 QA 证据证明资产真的可用？

RAG 记忆不是替代源文件。源文件仍然是 prompts、PNG、blend、GLB、manifest、registry、QA report。RAG 只是把这些证据变成可检索的生产知识卡。

## 建议存放

第一版先用 markdown + JSONL，不急着上数据库：

- `docs/rag/human-protocol-asset-memory-index.md`
- `src/assets/manifests/reports/asset-rag-memory/*.jsonl`
- `src/assets/manifests/reports/asset-rag-memory/level04-memory-clinic-furniture-v1.md`

如果以后有正式 RAG ingest 脚本，再把这些 JSONL 作为输入。

## 每条 RAG 记忆卡字段

建议一条 asset family 或一个小批次一条：

```json
{
  "id": "hp_asset_memory_level04_clinic_furniture_v1",
  "date": "2026-06",
  "levelScope": ["level_04_memory_clinic"],
  "reuseScope": ["sterile_clinic", "robot_facility", "escape_horror", "wall_switch"],
  "assetFamily": "memory_clinic_furniture",
  "modelKeys": [
    "room_l4_img2_treatment_chair_v1",
    "room_l4_img2_memory_console_v1"
  ],
  "aestheticSummary": "高级科幻电影里的医疗诊所；干净但不普通医院；冷白、烟黑钛、医疗青，红色只用于危险或揭示。",
  "gameplayRoles": ["cover", "navigation_landmark", "puzzle_host", "story_prop"],
  "prompts": [
    {
      "id": "prompt_l4_treatment_chair_hero",
      "text": "...",
      "tool": "Image2",
      "callId": "not-exposed-by-tool",
      "sourceImagePaths": [],
      "outputPaths": []
    }
  ],
  "sourceFiles": {
    "blueprints": [],
    "image2Sources": [],
    "textures": [],
    "blend": [],
    "glb": [],
    "builderPack": [],
    "registry": [],
    "rawWebgpu": [],
    "qaReports": []
  },
  "dimensionsMeters": {
    "recommendedPlayerReadDistance": 6,
    "collisionNotes": "Use simple box/capsule proxies; do not block critical doors."
  },
  "materialSlots": ["body_metal", "soft_pad", "glass", "screen", "emissive_cyan", "warning_red"],
  "qualityNotes": [
    "Avoid plain rectangular hospital furniture.",
    "Silhouette must read before color.",
    "Image2 texture needs visible panel seams, vents, screws, worn edges."
  ],
  "knownFailures": [
    "Gap between cushion modules reads as unfinished if not intentionally shadowed.",
    "Raw/global look can wash furniture color; per-level lighting/tuning is required."
  ],
  "qaEvidence": {
    "builderCatalogPresent": true,
    "rawWebgpuPresent": true,
    "thumbnailPresent": true,
    "browserReviewed": false
  }
}
```

## L4 资产生产中值得复用的做法

### 先确定关卡审美，不先堆物体

Level 4 不是普通医院。它是：

- memory clinic
- robot facility
- last human trace
- escape horror

所以家具不能只像商品页里的普通诊疗椅。它要更像高级科幻电影里的医疗设施：

- 干净、贵、克制。
- 医疗白和冷灰做主体。
- 烟黑钛、暗玻璃、细金属边提高高级感。
- 医疗青用于可交互 / 通电 / 安全。
- 小面积红用于危险、锁定、真相揭示。
- 避免一眼看成普通医院候诊室。

### 每件资产先写 gameplay role

每件家具都要说明玩家视角用途：

- 路标：远看知道房间功能。
- 遮挡：提供走位和恐怖节奏。
- 叙事：说明这里不是普通医院。
- puzzle host：以后能接谜题、屏幕、按钮、钥匙。
- 出口引导：不能挡住门和电梯路线。

没有 gameplay role 的家具，不进第一批。

### Math-first 尺寸先行

进入 Blender 前先定：

- 宽高深。
- 站立玩家视角下能不能读懂。
- 手机屏幕远看是不是只剩方块。
- 是否挡门。
- 碰撞代理是否简单。
- 可交互点高度是否符合玩家视线。

尤其对治疗椅、控制台、墙面按钮、床、候诊家具，要先定尺寸，不要靠模型生成后猜。

### Image2 不是贴一张大图

好的做法是把 Image2 作为 atlas source：

- 面板。
- 缝线。
- 螺丝。
- 通风口。
- 软垫纹理。
- 暗玻璃。
- 小标签。
- 状态灯。

动态文字、密码、数字、颜色状态不烘进图，留给 runtime。

### Prompt 必须可追踪

每个 Image2 / texture prompt 都要保存：

- 原 prompt。
- negative prompt / avoid list。
- 参考图路径。
- 生成日期。
- 工具和 call id，拿不到就写 `not-exposed-by-tool`。
- 输出 PNG。
- 裁切/打包脚本。
- 派生 atlas/regions。

不要只保存最终 PNG。

### Builder 和 Raw 是验收路径

资产“好看”不能停在 Blender viewer。必须能走完整链路：

1. GLB source。
2. Image2 provenance。
3. builder asset pack。
4. generated builder catalog。
5. generated footprints。
6. Raw WebGPU builder resource pack。
7. thumbnail。
8. builder WGPU QA。
9. browser first-person review。

generated Raw JSON 是输出，不手 patch。

## RAG 检索标签

建议每条记忆卡打这些 tag：

- `human-protocol`
- `asset-pipeline`
- `image2`
- `math-first`
- `builder-pack`
- `raw-webgpu`
- `level04`
- `memory-clinic`
- `medical-scifi`
- `escape-horror`
- `furniture`
- `puzzle-host`
- `wall-mounted`
- `mobile-readable`

未来做新资产时，检索示例：

- “memory clinic treatment chair mobile-readable image2 atlas”
- “wall mounted sci-fi medical switch hand press builder pack”
- “Human Protocol furniture gap texture raw webgpu QA”
- “sterile clinic puzzle host GLB material slots”

## Prompt 记忆格式

每个好 prompt 单独保存为 prompt memory：

```md
## prompt_l4_wall_switch_button_v1

Purpose: 通用墙面门控按钮，适合 Human Protocol 机器人设施 / 记忆诊所。

Prompt:
...

Avoid:
- ordinary hospital plastic
- toy-like sci-fi
- giant text labels
- red-black chaos
- flat square box

Why it worked:
- 明确了医疗科幻和逃生恐怖的混合审美。
- 要求 wall-mounted backplate 和 status light，方便建模。
- 要求 no baked text，适合 runtime localization。

Used by:
- hp_wall_door_switch_button_v1

Source outputs:
- ...
```

## QA 记忆格式

RAG 里也要保存 QA 结论，不只保存美术描述：

```md
## qa_l4_furniture_batch01_raw_webgpu

Checked:
- GLB has named materials.
- Image2 baseColorTexture visible.
- Builder catalog resolves modelKeys.
- Footprints are stable.
- Raw WebGPU resource pack contains modelKeys.
- Browser first-person review pending / passed.

Known risks:
- Some furniture gaps looked empty until atlas and cushion shadow were fixed.
- Raw global look can change perceived color; use per-level lighting policy.
```

## 第一批要写入 RAG 的内容

1. L4 记忆诊所总体审美卡。
2. L4 家具生产 pipeline 卡。
3. 每个已完成家具 family 的 prompt 卡。
4. Image2 atlas/provenance 卡。
5. GLB/material/footprint QA 卡。
6. Raw WebGPU color/visibility QA 卡。
7. 失败案例卡：空 gap、颜色没上、texture 太弱、Raw 里被洗色。
8. 新通用墙面手把/按钮的 asset blueprint 卡。

## 使用规则

未来 agent 开始生产资产前，必须先检索：

- 同关卡或同审美 tag。
- 同 asset role。
- 同交互类型。
- 同 renderer path。

如果找到可复用记忆：

- 复用审美和尺寸原则。
- 复用 prompt structure，但不能盲复制最终 prompt。
- 复用 material slot naming。
- 复用 QA checklist。
- 新资产仍然要有自己的 provenance 和 QA evidence。

如果找不到：

- 先写新的 blueprint。
- 生产后把 prompt、source、QA、失败点补成新记忆卡。

## 不要做的事

- 不要把 RAG 当成授权证明；授权仍看 provenance ledger。
- 不要把“看起来像 L4”当成通用结论；必须按 tag 检索。
- 不要只存最终图，不存 prompt 和派生路径。
- 不要把动态谜题文字烘进 Image2。
- 不要让 RAG 输出直接改 generated Raw JSON。
- 不要把 Level 4 专属 modelKey 当成通用资产名。
