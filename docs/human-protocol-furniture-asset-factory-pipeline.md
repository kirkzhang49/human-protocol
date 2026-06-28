# Human Protocol Furniture / Props Asset Factory Pipeline

This pipeline turns the PDF research direction into a repo-local production system for Human Protocol furniture, museum props, utility cabinets, display cases, and later Electron/WebGPU runtime packs.

The important principle is simple: AI is not the final modeler. GPT/Image2 are used for concept, specifications, script scaffolding, metadata, and QA pressure. Blender and deterministic scripts own geometry. The Human Protocol config and registries own game integration. Raw WebGPU cook/build output is generated from source data, never patched by hand as the root fix.

## Ownership Boundary

Code owns reusable verbs:

- Blender generation helpers.
- Image2 layer cutting and atlas packing.
- GLB optimization/cooking.
- registry/catalog integration scripts.
- manifest validation and QA reports.
- Raw WebGPU rebuild and visual-bake checks.

Config and manifests own nouns:

- `modelKey`
- asset family
- role in a level
- scale in meters
- material slots
- texture evidence
- collision proxy
- LOD policy
- allowed states
- intended room kit or official level placement

Renderer code should not decide that "Level 3 body exhibit uses a special mesh." Official levels should reference a semantic `modelKey`, and the asset resolver/runtime pack should resolve it.

## Source Of Truth

The first catalog is:

- `src/assets/manifests/runtime/human_protocol_furniture_asset_factory_v1.json`

The first QA entrypoint is:

- `npm run assets:furniture:pipeline`

The QA report is written to:

- `src/assets/manifests/reports/furniture_asset_factory_qa_report.json`
- `src/assets/manifests/reports/furniture_asset_factory_qa_report.md`

## Directory Map

Use this map for future furniture and prop work:

| Purpose | Path |
| --- | --- |
| Image2 source boards | `src/assets/textures/environment/<level-or-family>/image2-sources/` |
| Runtime textures | `src/assets/textures/environment/<level-or-family>/` |
| Blender scripts | `scripts/asset-build/` |
| Source blend files | `src/assets/source_blend/<level-or-family>/` |
| Raw GLB exports | `src/assets/models/environment/props/` |
| Cooked GLBs | `src/assets/models-cooked/environment/props/` |
| Builder thumbnails | `src/assets/thumbnails/builder/core/` |
| Runtime manifests | `src/assets/manifests/runtime/` |
| QA reports | `src/assets/manifests/reports/` |
| Raw WebGPU generated output | `src/assets/manifests/generated/raw-webgpu/` and `.raw-webgpu/` sidecars |

## Pipeline Stages

### 0. Request Intake

Input:

- User intent: furniture, museum prop, tool cabinet, shelf, table, chair, light fixture, sculpture support, etc.
- Target level or generic catalog role.
- Expected player distance.
- Whether it blocks navigation.
- Whether it is interactable.

Output:

- One asset family name.
- One or more stable `modelKey`s.
- Acceptance notes in plain language.

Gate:

- The asset has a clear role and is not a random decoration dump.

### 1. Blueprint

Add or update an entry in `human_protocol_furniture_asset_factory_v1.json`.

Required fields:

- `assetFamily`
- `modelKey`
- `assetClass`
- `readiness`
- `role`
- `scaleMeters`
- `silhouette`
- `materialSlots`
- `textureSources`
- `states`
- `collisionProxy`
- `runtimeContent`
- `lodPolicy`
- `pathPlan`
- `integration`
- `qaEvidence`

Readiness levels:

- `blueprint-ready`: specification is complete, no GLB required yet.
- `source-ready`: Image2/source art or Blender script/source file exists.
- `raw-ready`: source GLB exists but is not cooked/registered.
- `build-ready`: cooked GLB, registry, builder catalog, footprint, and thumbnail are present for build-page placement.
- `runtime-ready`: `build-ready` plus Raw WebGPU sidecar/resource-pack evidence for official or deep-bake runtime use.

Gate:

- `npm run assets:furniture:pipeline` must pass. Missing future files are allowed only for non-runtime assets and are reported as pending.

### 2. Image2 Concept And Texture Evidence

Use Image2 for visible art:

- concept board
- orthographic sketch
- material atlas
- trim sheet
- panel/screw/glass/wear details
- front/side/top guide when an asset will be cut or projected

Rules:

- Keep source images in repo under `image2-sources`.
- Do not paste an entire UI poster or concept painting onto the object.
- Cut or project only the useful material regions.
- Keep prompt/model/provenance notes in the manifest or license ledger.

Gate:

- The manifest references real image paths or explicitly marks the asset as procedural-material-only.
- For hero furniture, there must be a visible texture plan, not just procedural noise.

### 3. Math Search

Use math search when hand tuning affects readability or collision:

- width/depth/height for navigation
- display case glass opacity and bevel thickness
- cabinet shelf spacing
- bench height and cover safety
- plinth height and sculpture scale
- emissive intensity and color restraint
- LOD simplification target

Small deterministic searches can be Node. Large candidate sweeps should use C++ and write reports under `src/assets/manifests/reports`.

Gate:

- The report records current score, best score, penalties, top candidates, and the chosen parameters.

### 4. Blender Generation

Blender should be deterministic and repeatable:

- named root object
- named visible parts
- grounded pivot
- meter scale
- bevels on hard-surface edges
- weighted normals
- material slots matching the blueprint
- simple collision-friendly proportions
- optional LOD objects or export notes

For furniture, prefer script-generated geometry over prompt-to-3D geometry. Prompt-to-3D or CC0 assets can be used as candidates, but they must be normalized in Blender and pass the same manifest/QA gates.

Gate:

- `.blend` source saved when the asset will be polished again.
- raw or cooked GLB generated from source, not hand-patched runtime JSON.

### 5. GLB Export

Export GLB with:

- `+Y`/`Z` transform convention verified by existing project loader.
- no anonymous cube piles.
- no proxy cubes left visible.
- no hidden enormous mesh.
- no texture path pointing outside the repo.
- no baked dynamic clue text, puzzle answers, room numbers, or localized story text.

Gate:

- `npm run qa:gltf` or a focused GLB inspection command can read it.

### 6. Runtime Cooking

Cook environment furniture through the existing policy:

- `npm run cook:runtime-glb -- --only=environment/props/<file>.glb`

The current runtime cooker uses glTF Transform with meshopt and WebP compression for static environment assets.

For the future WebGPU engine, the cooked GLB remains the interchange layer. A later cooker can split it into:

- mesh buffers
- material descriptors
- texture KTX2/WebP outputs
- bounding boxes
- collision proxies
- LOD descriptors
- thumbnail and preview metadata

Gate:

- output exists under `src/assets/models-cooked/environment/props/`.
- cooking report includes the asset.

### 7. Config / Registry Integration

Register only via reusable places:

- `src/assets/registry/environment/props.ts`
- `src/build/BuilderAssetCatalog.ts`
- `src/build/BuilderAssetFootprints.tsx`
- official level config or room kit if used by a campaign level

Do not hardcode new furniture paths in renderer code.

Gate:

- Asset can appear in the build page through catalog/registry.
- Official levels reference it by `modelKey` only.

### 8. Raw WebGPU / Build Page Acceptance

When an asset affects an official level or build-page playtest, rebuild from source:

- `npm run raw-webgpu:level03:rebuild` for Level 3-specific acceptance.
- `npm run qa:visual-bake-contract`.
- `npm run qa:builder:wgpu-assets`.

Do not edit generated Raw WebGPU JSON to fix a missing model. Fix the source config, resolver, builder import, material generation, or resource pack index, then rebuild.

Gate:

- Raw render plan and runtime pack see the same `modelKey`.
- cooked sidecar exists when required.
- visual-bake contract has no missing geometry for the asset.

### 9. Browser Review

Use browser review only after the data path passes:

- build page thumbnail/card check
- desktop first-person view
- mobile landscape framing if it affects gameplay
- Raw WebGPU playtest path if official content changed

Gate:

- Screenshot or explicit pending browser review note.

## Web / Electron / Own WebGPU Engine Policy

Use GLB as interchange, not as the final engine abstraction.

Recommended future runtime pack:

```json
{
  "modelKey": "room_museum_glass_vitrine_specimen",
  "category": "furniture",
  "boundsMeters": [1.25, 1.88, 1.07],
  "pivot": "floor-center",
  "lods": ["lod0", "lod1", "lod2"],
  "meshBuffers": "packed-webgpu-buffer-reference",
  "textures": {
    "baseColor": "ktx2-or-webp",
    "normal": "ktx2-or-webp",
    "orm": "ktx2-or-webp",
    "emission": "ktx2-or-webp"
  },
  "collider": "simple-box",
  "license": "project-owned-or-cc0-verified",
  "source": {
    "blend": "src/assets/source_blend/...",
    "image2Refs": ["src/assets/textures/.../image2-sources/...png"]
  }
}
```

Web:

- stream manifests and cooked assets.
- lazy-load non-critical props.
- keep texture budget tight.
- use shared materials and instancing for repeated pieces.

Electron:

- bundle the cooked runtime pack.
- cache decompressed GPU resources in app data if needed.
- keep the same manifest format as web.

Own WebGPU engine:

- compile GLB/cooked GLB into engine-native buffers at build time.
- renderer receives buffers/material descriptors, not level-specific hardcoded paths.
- config still references `modelKey`.

## Budget Defaults

Use conservative defaults unless a blueprint overrides them:

| Asset class | LOD | Materials | Web texture max | Triangle intent |
| --- | --- | --- | --- | --- |
| hero display case | 0/1/2 | 1-3 | 1024-2048 | readable within 4m |
| standard cabinet | 0/1/2 | 1-2 | 512-1024 | usable as room furniture |
| bench/table/chair | 0/1 | 1-2 | 512-1024 | repeated safe prop |
| small scatter prop | 0/1 | 1 | 256-512 | grouped or instanced |
| sculpture/plinth | 0/1/2 | 1-3 | 1024 | visible silhouette first |

Transparent glass is expensive and visually fragile. Prefer:

- low opacity but not white.
- faint cyan edge highlights.
- separate visible frame/base.
- restrained bloom.
- no full-screen overdraw walls if the player stands close.

## External / CC0 / AI 3D Ingest

Third-party or prompt-to-3D assets are not runtime-ready by default.

Required steps:

1. Record license and source URL in `docs/asset-license-ledger.md` or a family manifest.
2. Import into Blender.
3. Normalize scale, pivot, materials, and origin.
4. Remove extra cameras/lights/hidden meshes.
5. Retopo/decimate if needed.
6. Re-export GLB.
7. Cook and register through the same pipeline.
8. Run `npm run assets:furniture:pipeline`.

## External Research Plan: Official Furniture Beauty Pass

The next external-research question should focus on making our official campaign
furniture look better, not on reducing API cost. Cost optimization remains useful,
but the current quality bottleneck is art direction: source boards can be clean
enough to cut while still producing assets that feel plain, samey, too
procedural, or insufficiently tied to each official room's story.

Research target:

- improve the visual quality of official Human Protocol furniture and props.
- keep the Image2 atlas plus deterministic Blender pipeline.
- add stronger art-direction gates before source images enter math cut.
- keep `modelKey`, manifest, provenance, builder catalog, Raw WebGPU resource
  map, and 2D/3D viewer requirements unchanged.
- avoid a pipeline that depends on fragile prompt-to-3D output.

Questions for the external tool:

1. How should the pipeline change so each official level has a sharper furniture
   identity before Image2 generation starts?
2. What should be added before source-image generation: room mood board, style
   bible, silhouette sheet, material trim sheet, hero/filler ratio, or placement
   plan?
3. How should prompts differ for Level 1 maintenance, Level 2 residential
   simulation, Level 3 museum, Level 4 clinic, and Level 5 reclamation core?
4. What makes a generated furniture source board beautiful while still remaining
   usable for deterministic cut and Blender reconstruction?
5. Which visual QA gates should be added beyond background cleanliness:
   silhouette score, material richness, story relevance, level fit, thumbnail
   readability, first-person scale, and in-room composition?
6. Should the pipeline generate fewer objects per atlas for hero assets, or keep
   five per atlas and repair weak slots individually?
7. How should we classify assets into hero furniture, repeated room filler,
   interactable props, wall props, ceiling props, and small tabletop props?
8. What would a practical scoring rubric look like for deciding whether a source
   image is worth cutting into GLB assets?
9. How should the local 2D/3D viewer change so it helps judge beauty, not only
   existence and path correctness?
10. What are the minimum changes that would make our next 15 official furniture
    assets feel like they belong in a premium game level?

Candidate pipeline changes to evaluate:

- Add a per-level art brief before prompt planning.
- Add a reusable Human Protocol material vocabulary: graphite metal, warm
  residential ceramic, museum brass/glass, clinic off-white polymer, reclamation
  black archive metal, cyan/amber accent rules, and damage/wear limits.
- Split assets into `hero`, `support`, and `filler` before generation; hero
  assets may use one object per source image or a smaller atlas.
- Add "beauty QA" after deterministic source QA and before Blender: silhouette,
  material contrast, story specificity, small-thumbnail readability, and
  first-person object interest.
- Add room-composition QA after GLB generation: does the object look good at the
  actual in-game player distance, lighting, wall/floor material, and placement?
- Store beauty scores and rejection reasons in the same artifact/cost/provenance
  ledger as source images.

Absorbed source note:

- `/Users/zhengkaizhang/Downloads/Human Protocol Furniture_Props Asset Factory Pipeline.pdf`
  is treated as a baseline pipeline-discipline reference, not as the final beauty
  pass answer.
- It reinforces the existing rule that code/scripts own verbs and manifests own
  nouns: Blender generation, atlas cutting, GLB export, optimization, registry
  emit, Raw WebGPU compile, and QA stay scripted; `modelKey`, role, scale,
  material slots, collision, LOD, source evidence, and level intent stay in
  manifest/config.
- It also reinforces that AI image or GPT output is intermediate evidence for
  concept/specification, not the final runtime asset. Final meshes should remain
  deterministic Blender/script outputs that can be rebuilt from source.
- The next research prompt should therefore ask how to improve art direction
  inside this asset-factory discipline, not how to replace it with manual mesh
  editing or prompt-to-3D.
- `/Users/zhengkaizhang/Downloads/执行摘要.pdf` is absorbed as the concrete
  vNext direction for manifest-driven beauty QA. It is stronger than the
  baseline pipeline note because it turns "make the furniture better" into
  fields, stages, budgets, and review outputs.

Directly absorbed vNext rules:

- New manifest-level art fields should be introduced in the next schema pass:
  `artBrief`, `silhouetteSheet`, `trimSheet`, `tier`, `beautyQA`,
  `roomCompositionQA`, `viewerAesthetic`, and `requiredEvidence`.
- Asset tier becomes a first-class production decision:
  - `hero`: centerpiece or interaction-critical asset; may use single-image or
    small-atlas generation, higher texture budget, stricter viewer review, and
    room-composition QA.
  - `support`: normal room furniture; can use five-per-atlas when the source
    image remains clear and interesting.
  - `filler`: repeated background prop; should stay low-poly, shared-material,
    cheap to render, and readable mostly by silhouette.
- Beauty QA becomes a real gate after source-image cleanliness checks and before
  Blender generation. It should score silhouette distinctiveness, material
  readability, storytelling cues, focal hierarchy, thumbnail readability, and
  whether the source image contains enough texture evidence to justify cutting.
- Room-composition QA becomes a second visual gate after GLB generation. It
  checks the asset under real level lighting, player-distance framing, floor/wall
  material context, and navigation clearance instead of judging an isolated GLB
  only.
- The 2D/3D viewer should grow from a path/loading viewer into an approval
  viewer: thumbnail, primary player-facing angle, 45-degree turntable, top/side
  views, small-size readability, beauty score, rejection reason, and repair
  decision should be visible together.
- The pipeline should store beauty score, rejection reason, repair decision,
  source image IDs, crop mapping, modelKey, and provenance/cost records in
  structured reports. Do not leave them as informal chat notes.

Not directly absorbed yet:

- The PDF mentions traditional high/low-poly, Substance-style, and heavy PBR
  workflows. Treat these as hero-asset reference only, not the default pipeline.
- The PDF mentions command names such as `assets:generate:artBrief` and
  `assets:pack:webgpu`; these are conceptual and must be mapped to the repo's
  real scripts before implementation.
- Do not switch the current cooker from the existing glTF Transform/meshopt/WebP
  path just because the PDF mentions `gltf-pipeline` or Draco.

Prompt to send to a research tool:

```text
请作为游戏美术总监、技术美术、WebGL/Raw WebGPU 管线顾问和 3D 资产生产线顾问，研究如何升级 Human Protocol 的官方关卡家具/道具生产线。目标不是单纯省钱，而是让我们自己官方关卡里的家具更好看、更有故事感、更像高级游戏资产，同时不破坏现有 Image2 atlas + deterministic Blender + builder/Raw WebGPU pipeline。

我们已经有一份 Asset Factory Pipeline 总纲，结论是：code/scripts own verbs，manifest/config own nouns。也就是说，Blender 生成、atlas 切图、GLB 导出、优化、registry emit、Raw WebGPU compile、QA 都要脚本化；modelKey、role、scale、materialSlots、collision、LOD、source evidence、level intent 都要进 manifest/config。AI 图像和 GPT 只作为概念/规格/视觉证据，不是最终 runtime 资产。请在这个前提下研究“如何更好看”，不要建议放弃这个管线。

项目背景：
我们在做 Web/3D 游戏 Human Protocol，类型是第一人称机器人设施逃脱/恐怖。官方关卡目前包括：
- Level 1 维修舱 / maintenance bay
- Level 2 住宅模拟 / residential simulation
- Level 3 人类博物馆 / human museum
- Level 4 记忆诊所 / memory clinic
- Level 5 回收核心 / reclamation core

当前资产生产线不是 prompt-to-3D，而是一个可重放的工程化内容编译系统：
1. 用 GPT Image 2 / Image2 生成 source board 或 atlas，常见方案是一张图 5 个家具/道具。
2. source image 是“视觉证据”，不是最终 runtime 合同；它必须适合切图：背景干净、物体分离、轮廓清楚、没有地面/墙/阴影/文字/logo。
3. source image 和 provenance 进入 repo，通常在：
   - src/assets/textures/environment/<level-or-family>/
   - src/assets/manifests/reports/*image2*source*provenance*.json/md
   - src/assets/manifests/reports/*image2*texture_report.json
4. 用 fixed rect crop / math cut 切出每个 slot 的 texture/crop。我们希望切图尽量数学化、可重放，而不是人工抠图。
5. 用本地 Blender deterministic scripts 生成 GLB，不依赖 prompt-to-3D。相关产物通常在：
   - scripts/asset-build/blender-generate-*.py
   - src/assets/source_blend/<level-or-family>/
   - src/assets/models-cooked/environment/<level-or-family>/
6. 生成 builder thumbnails：
   - scripts/asset-build/generate-builder-asset-thumbnails.mjs
   - src/assets/thumbnails/builder/<pack-id>/
7. 写入 builder asset-pack manifest，格式是 hp.builder.assetPack.v1，路径通常是：
   - src/assets/manifests/builder/<pack>.json
   每个 asset 至少需要 modelKey、中文 label、assetKind、family、source/sourceAssetId、glbFile、sizeMeters、footprintFamily、group/tags 等。
8. 用脚本摄取 manifest，生成 registry/catalog/footprints：
   - node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit --manifest <pack.json>
   会更新：
   - src/assets/manifests/builder/ingested-packs.json
   - src/assets/registry/environment/generatedBuilderAssetPacks.ts
   - src/build/generatedBuilderAssetCatalog.ts
   - src/build/generatedBuilderAssetFootprints.ts
9. 编译 builder Raw WebGPU runtime resource pack：
   - node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs
   要求 issues=0，新增 modelKey 进入：
   - src/assets/manifests/generated/raw-webgpu/render_plan_builder_runtime_resources.json
10. 生成统一 2D/3D asset viewer：
   - node scripts/asset-build/generate-image2-asset-viewer.mjs --out .tmp/<pack>-image2-asset-viewer.html --manifest <pack.json>
   viewer 现在能看 2D thumbnail 和 3D GLB，但主要用于检查资源存在/加载，不足以判断“美不美、是否像高级官卡家具”。
11. QA 目前包括：
   - node scripts/qa/builder-wgpu-resource-audit.mjs
   - npm run qa:builder
   - npm run build
   - 必要时 browser screenshot / 2D/3D viewer QA

现有例子：
- Level 1 已经有 Image2 家具/道具包，例如 workcell、power infra、safety storage 三组，各 5 个左右。
- Level 2 已有 hp_level02_furniture_image2_v1，例如看护沙发、观察餐桌、儿童看护床、观察书架、照护椅、摄像灯等。
- 这些资产能进入 build/viewer，但我们担心它们仍可能“可用但不够高级”：轮廓普通、材质层次不足、关卡故事性不足、在真实房间里不够好看，或者一张 5 物体 atlas 为了可切图牺牲了 hero asset 的美术表现。

已经确定的成本路线：
正式 source atlas 默认用 gpt-image-2 medium；DeepSeek/Qwen 只做便宜文本、命名、manifest、QA 总结；本地 deterministic 做切图、Blender、thumbnail、build、viewer、QA。不希望把 Qwen Image-Max 当最终 source atlas 模型。

硬约束：
- 不要建议把主流程改成 prompt-to-3D。
- 不要建议手改生成出来的 Raw WebGPU JSON。
- 不要建议把任意风格开放给用户或 config；官方资产要保持统一 Human Protocol 视觉语言。
- 不能把谜题答案、房间号、可变文本烘焙进 mesh；这些应由 runtime/config 渲染。
- 资产最终要通过 modelKey / manifest / registry / builder catalog / Raw WebGPU resource map 进入游戏。
- Web/mobile 性能要保守：低多边形、强材质、强轮廓、共享 atlas/材质优先，不追求重型高模。

现在的问题：
我们不是只想降低成本，而是想让官方关卡的家具更好看。现在的资产可能能用、能切、能进 build，但可能仍然显得普通、同质化、太程序化、缺少每个关卡的故事身份。我们要改 pipeline，让 Level 1-5 的官方家具真正提升视觉质量，同时仍能被 math cut、Blender script、builder pack、Raw WebGPU、viewer 和 QA 接住。

请研究并回答：
1. 在现有 11 个 pipeline 阶段里，应该新增哪些 art direction gate？请给“当前阶段 -> 新增美术产物 -> 负责人/模型 -> 是否本地 deterministic -> 验收标准”的表。
2. 是否应该在 Image2 前增加每关 art brief、mood board、silhouette sheet、material trim sheet、hero-vs-filler plan、room placement sketch？每个产物具体应该包含什么字段，如何进入 prompt？
3. 请为 Level 1-5 分别设计家具视觉语言矩阵：核心情绪、材料、颜色、发光规则、磨损程度、形状语言、hero 家具类型、support/filler 类型、禁用元素。
4. 什么样的 Image2 source board 同时满足“好看”和“可切图”？请给 source board prompt 模板、hero single prompt 模板、support atlas prompt 模板，以及失败反例。
5. 一张 5 物体 atlas 是否会限制美术质量？请明确哪些资产继续 5-per-atlas，哪些应改成 1-per-image 或 2/3-per-atlas，并给判断规则。
6. pipeline 应该如何区分 hero furniture、support furniture、filler props、interactable props、wall props、ceiling props、tabletop props？每类对应什么 source image 策略、Blender 几何策略、texture 策略、QA 策略？
7. 除了背景干净、无阴影、可切图，还应该加哪些 visual QA 指标：silhouette、material contrast、story specificity、thumbnail readability、first-person scale、room composition、lighting fit、texture evidence、shape originality？
8. 请设计一个 100 分制 beauty QA rubric，用于决定 source image 是否值得进入切图和 Blender。要求包含阈值：直接通过、单件 repair、整板重生、彻底换 prompt。
9. 请设计一个 GLB 生成后的 room-composition QA：如何在真实官方房间灯光、墙/地材质、玩家第一人称距离下判断家具是否好看？
10. 现有 2D/3D asset viewer 应该如何升级，才能帮助我们判断美感，而不只是判断 GLB 能否加载？例如小缩略图、真实房间预览、turntable、多距离截图、材质/轮廓评分面板、同关卡资产并排比较。
11. 如何把 beauty score、reject reason、repair decision、source image ID、crop mapping、modelKey、成本记录和 provenance ledger 结构化记录下来？
12. 如果只改最少的 pipeline，下一批 15 个官方家具要怎样做，才能明显比现在更高级？请给 2 周内可落地的最小改动清单。
13. 哪些改动不值得现在做？例如本地小 LLM、全自动艺术审美、复杂 prompt-to-3D、过重 PBR/high-poly。

要求：
- 输出中文。
- 给表格和可执行步骤，按优先级排序。
- 不要建议全改成 prompt-to-3D。
- 不要只说“找参考图”，要说明参考图如何变成 prompt、source board、cut、Blender、viewer QA 的约束。
- 不要只给审美建议，要落回我们的真实工程产物：source image、crop、Blender script、GLB、thumbnail、manifest、registry、Raw WebGPU resource pack、viewer、QA report。
- 给一个“下一批 15 个官方家具”的具体执行模板：分组、每组 prompt planning、Image2 生成策略、QA gate、repair 策略、viewer 检查、入库标准。
- 结论要明确告诉我们哪些改动最值得先做，哪些不值得。
```

## First Seed Families

The first manifest includes runtime-ready examples already in the project:

- `room_museum_glass_vitrine_specimen`
- `room_museum_gallery_bench`
- `room_museum_archive_cabinet_drawers_brass`
- `room_museum_statue_pedestal`

It also includes build-ready batch-01 targets generated by `scripts/asset-build/blender-generate-furniture-factory-batch01.py`:

- glass display case
- horizontal tool/weapon case
- museum bench
- archive cabinet
- metal maintenance cart
- display plinth
- wall archive cabinet
- lab table
- cold ceiling light slot
- specimen/sculpture plinth combo

These are intentionally not forced into official level layout yet. They are build-page assets first; promote any one of them to `runtime-ready` after it is referenced by official config or a room kit and the Raw WebGPU resource pack has been rebuilt.

## Minimum Commands

For pipeline/spec validation:

```bash
npm run assets:furniture:pipeline
```

For a new GLB:

```bash
npm run cook:runtime-glb -- --only=environment/props/hp_<model-key>.glb
npm run qa:gltf
npm run assets:furniture:pipeline
```

For official Level 3 / build page / Raw WebGPU acceptance:

```bash
npm run qa:build-official
npm run raw-webgpu:level03:rebuild
npm run qa:visual-bake-contract
npm run qa:builder:wgpu-assets
npx tsc -p tsconfig.app.json --noEmit
```

## Definition Of Done

An asset family is done only when:

- blueprint is complete.
- source art/provenance is recorded.
- Blender/source generation is repeatable.
- GLB exists and is cooked if used at runtime.
- registry and builder catalog resolve the `modelKey`.
- official config or room kit references it semantically when used.
- Raw WebGPU pack sees it when official content uses it.
- QA report is clean.
- browser screenshot or explicit pending visual review is recorded.
