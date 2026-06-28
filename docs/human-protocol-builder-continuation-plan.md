# Human Protocol /build 编辑器 — 续作交接计划

最后更新：2026-06-11（v11：可触感表面涂装）

> ## 必读：/build 资产必须进入 WGPU Resource Map
>
> 以后任何资源进入 `/build`，不能只接到 GLB registry / catalog 就结束。它必须按 `modelKey` 进入 Raw WebGPU source map：优先复用官方 Raw level imports，官方包没有的唯一 key 才进入 `builder_runtime_resources` 补充包。禁止把全量资源塞进 `level_01`，也禁止把 runtime GLB 临时烘焙当成正常试玩路径。
>
> 完整规则见 `docs/human-protocol-builder-wgpu-resource-map.md`。合入前必须看到 `npm run qa:builder` 打印 `PASS builder WGPU resource map: ... unique modelKeys linked ...`，再跑 `npm run build && npm run smoke:campaign`。

> ## v11 增量（Sims 式材质刷体验）
> - **笔刷 HUD**（`builder-brush-hud`，取代笔刷态的普通横幅）：刷种 + 材质名 + 小 swatch + 「连续」开关 + 提示 + ✕。目录中已选 swatch 呼吸发光（`builder-brush-armed`）。
> - **悬停预览**：2D（`BuilderCanvas2D` 内部 `brushHover`）——地板刷直接把悬停房间的地板 fill 换成 `#bfp-brush-preview` 预览 pattern（`BrushPreviewPatternDef`，仅地板刷激活时挂载），墙刷换墙板描边为目标 accent，天花板刷显示 ⬒/⬓ 虚线覆盖（蓝=将开启/红=将关闭），所有目标房间带 marching 外框；空白处无预览。3D（RoomMesh `brushPreview` prop）——悬停房间直接以**目标材质纹理**渲染地板/墙体 + 轻微 emissive；墙刷只点亮墙段与墙顶光条（压制地板 wash 与白色 hover 环），天花板刷显示半透明预览面。**悬停预览纯渲染层，不碰 project 状态**。
> - **确认反馈**：纯函数 `applyBrushToRooms`（BuilderEnvironment.ts，QA 直接单测：只替换目标房间对象、输入不变、preset 应用同时清除颜色覆盖）返回 status + flashColor；BuildPage 设置 `paintFlash {roomId, token, color}`（750ms 自清）；2D `builder-paint-flash` 矩形动画 + 3D `PaintPulse3D` 扩散环（key=token 重启）；状态栏输出「已应用地板：监控走廊 → 警戒斜纹」等。
> - **连续涂刷**：HUD「连续」开关（默认关）持久连刷；Shift 临时连刷保留；天花板刷恒连刷；Esc 退出。
> - **3D 程序化材质**（`BuilderSurfaceTextures.ts`）：每 (pattern, 底色) 画一张 128px canvas（tile 网格缝/metal 面板缝+铆钉+拉丝/wood 板带+木纹/hazard 45° 警示条/stone 错缝石板/rubber 确定性噪点+棱纹，noise 用固定种子 mulberry32），`CanvasTexture` 按 (preset, color, repeat¼量化, rotation) 缓存复用；地板贴图尊重纹理缩放/旋转，墙段按长度/墙高平铺。SSR 安全：无 DOM 时返回 null 回退纯色。注意 r3f 材质 map 在运行时恒非空（null↔texture 切换会踩 USE_MAP 重编译坑）。
>
> v11 验证：`qa:builder` 全过（新增 5c2：纯涂装应用/状态文案/纹理键确定性+量化/SSR 安全）、`build` ✓、`smoke:campaign` ✓、浏览器 QA `.tmp/qa-v11.mjs` 20/20 ✓（HUD/2D 悬停预览与空白无预览/确认动画+状态/3D 墙刷/检查器徽章同步/Shift 与连续开关/Esc/1366 无溢出/0 console error）。
>
> v11 已知限制：3D 悬停预览用 preset 默认色（不带房间现有颜色覆盖）；纹理为低成本 canvas 平铺（无法线/凹凸）；hazard 条纹对比较强（有意为之的警示语义）。

> ## v10 增量（Asset Factory 导入桥）
>
> Human Protocol 现在有一条正式的**资产摄取边界**：外部工具（Math-First Asset Factory 等）导出 `manifest.json + GLB`，一条命令进入 registry → 目录 → 2D 足迹 → 编译 → 试玩。已注册的 12 件 auto-rig 试点家具是这条管线的"手工参考实现"，其元数据完整收录在试点 manifest 里供 QA 对账。
>
> ### Manifest 契约（`hp.builder.assetPack.v1`，类型见 `src/build/BuilderAssetPackTypes.ts`）
> 外部工具导出一个包目录：`asset-pack/{manifest.json, models/*.glb, previews/*.png?, reports/*.json?}`。manifest 字段：`packId/label/sourceTool/assets[]`；每个 asset 至少要有 `modelKey`（全局唯一、`^[a-z][a-z0-9_]{2,63}$`）、`label`（中文短名）、`assetKind`（furniture/roomKit/robot/clue/material）、`family`（furniture 必须落在 BuilderPropFamily 联合里）、`source/sourceAssetId`、`glbFile`（**相对 manifest 的路径**）、`sizeMeters [w,h,d]`（>0.05）、furniture 必须给 `footprintFamily`（13 个非 generic 剪影族之一）。可选：`group`（默认 自动家具）、`mount/wallPreferred/canHoldSmallProps/clueCapacity/presetId/themeId/colliders/sockets/score/tags`。**元数据与网格同级重要：manifest 是两个工具间唯一交接物。**
>
> ### 导入流程
> 1. 把包目录拷到 `src/assets/asset-packs/<packId>/`（GLB 必须在 src 内，Vite 才能静态打包；运行时不能动态 import 任意文件，所以桥会把 JSON 变成静态 TS）。
> 2. 预检（未摄取时加 `--pending` 跳过集成检查）：
>    `node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest src/assets/asset-packs/<packId>/manifest.json --check --pending`
> 3. 摄取：`node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit --manifest <同上路径>` —— 把 manifest 登记进 `src/assets/manifests/builder/ingested-packs.json`（ingest:"generated"）并**确定性重生成**三个 fragment：
>    - `src/assets/registry/environment/generatedBuilderAssetPacks.ts`（GLB `?url` 静态导入 → environmentModelAssets 合并）
>    - `src/build/generatedBuilderAssetCatalog.ts`（→ builderPropCatalog 追加，目录分组自动出现）
>    - `src/build/generatedBuilderAssetFootprints.ts`(→ 2D 剪影映射合并)
> 4. 复检（无 --pending）：registry/目录/足迹/尺寸全部比对。`--emit --manifest X --out-dir <dir>` 是无副作用的预览模式（QA 用它做冒烟）。
> 5. 刷新 WGPU resource map：`node tools/raw-webgpu-compiler/compile-builder-runtime-resource-pack.mjs`（如果同时重烘官卡 Raw，`rebuild-raw-webgpu-levels.mjs` 默认会做这步）。
> 6. `npm run qa:builder && npm run build && npm run smoke:campaign`。
>
> 试点包在 ingested-packs.json 里标记 `ingest:"manual"`：只用于**保留 modelKey 防撞**与 QA 对账，不参与生成（它的 12 件已手工注册在 autoRigFurniture.ts / BuilderAssetCatalog.ts / BuilderAssetFootprints.tsx，保持不动）。
>
> ### QA 覆盖（builder-headless-check 直接 import 桥脚本复用同一套校验）
> - 试点 manifest 结构校验 0 错；12 个 modelKey 都在 environmentModelAssets / builderPropCatalog；footprint 非 generic 且与 manifest 一致；registry/目录尺寸与 manifest 容差 0.005 内；GLB 在盘上；编译/校验含 manifest 家具的项目；SSR 含 manifest 标签（转角工作台）。
> - **emit 冒烟**：把试点 manifest 真实 emit 到 `.tmp/qa-pack-emit/` 并经 vite ssrLoadModule 加载，断言 12 个模型 url、目录条目、足迹族 —— 证明 --emit 产物是可编译的。
> - 已摄取 fragment 一致性：generated registry/catalog 的 key 必须出现在合并后的总表里。
>
> ### 未来扩展（room kits 等）
> `assetKind:"roomKit"` 已在 schema/校验里保留：v10 的 emit 只把 furniture 写进目录/足迹，**roomKit/robot/clue/material 会进 registry（有 GLB 即可渲染）但还没有目录页签与编译路径**。扩展路径：给 BuilderAssetBrowser 加新页签 + 给 compileBuilderProjectToLevel 加对应产物（如 roomKit → 预置房间模板），目录分组已是动态的，BuilderPropGroup 联合按需扩。修改 BuilderPropFamily/FootprintFamily 时必须同步 `generate-builder-asset-pack-registry.mjs` 顶部的镜像常量（QA 会抓漂移）。
>
> v10 验证：`qa:builder` 15/15 ✓（含 3 项新桥检查）、`build` ✓、`smoke:campaign` ✓；合成包全程实测：--check --pending → --emit 摄取 → tsc 通过 → --check 集成通过 → 回退后 fragment 复原。

> ## v9 增量（3D 自足建造环 + 环境系统）
> - **3D 房间移动/拉伸**：选中房间出现 gizmo（中心平移盘 + 红 X / 蓝 Z 轴箭头 + 四边拉伸把手，`BuilderRoomEditing.ts` 的 `pickRoomHandle` 平面命中 + `RoomGizmo3D` 渲染）。拖动吸附 1 米网格 + 磁性贴边（与 2D 共享 `snapRoomToNeighbors`/`resizeRoom`，已从 Canvas2D 抽到 `BuilderRoomEditing.ts`）。**拉伸若新增"门失效/房间重叠"则松手自动还原**（`roomEditIssues`+`introducedIssues` 基线对比，手势中 gizmo 变红）；移动允许但状态栏警告。房间手势用"还原起点(静默)→应用终点(记录)"提交成**单条撤销**。
> - **相机平移**：`CameraPanRig`（WASD/方向键沿相机平面轴平移，Shift ×3，输入框聚焦时忽略）+ 平移工具（OrbitControls LEFT=PAN，地面拾取关闭）。**重要**：相机预设/PanRig 不要再读 `useThree(state.controls)`（drei makeDefault 注册在 StrictMode 下会偶发拿不到），改用显式 `controlsRef` 传给两个 rig。
> - **环境系统**：`BuilderEnvironment.ts`（6 地板 + 6 墙面 preset、按房型默认映射、effective 解析器、`clampLighting`）；`BuilderRoom.env?`/`BuilderProject.lighting?` 全可选（旧草稿默认值加载）；`BuilderSurfaceArt.tsx` 程序化 SVG 材质（swatch `bsw-*` + 每房间地板 pattern `bfp-<roomId>`，含颜色覆盖/缩放/旋转）。2D 地板用每房间 pattern、墙体描边反映墙面涂装；3D 地板/墙体用 preset 颜色+粗糙度、墙高可调（0.8–3.2m）、半透明天花板（选中房间自动隐藏，无事件处理器所以不挡拾取）。
> - **涂刷工具**：环境页签 swatch → 地板刷/墙壁刷（点击房间应用并退出，Shift 连刷）、天花板工具（点击开关，常驻）、光源工具（清空选择显示「光线」面板）。底栏工具托盘扩到 10 个；1366 下隐藏锁链、收窄工具按钮。
> - **光线**：项目级 `lighting`（环境光/主光颜色+强度/雾/泛光/阴影，钳制范围），3D 渲染即时响应（雾距、blob 阴影、墙顶辉光近似 bloom——编辑器故意不上 postprocessing）。滑杆拖动用 `onStart`=history.mark + record:false，一次拖动=一条撤销。
> - **持久化**：`LevelDefinition.authoringMetadata?`（schema 新增可选字段，运行时忽略）；compile 写入 `builderEnvironment: { lighting, rooms }`，经 config pack JSON 导出/导入往返保留。试玩端暂不渲染环境设置（白名单材质限制）。
> - **QA 陷阱（headless）**：CDP 新建 target 可能被 occlusion 限流导致 **rAF 完全不跑**（r3f useFrame 全挂：预设/键盘平移失效但事件拾取照常）→ Chrome 必须加 `--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding` 并关掉 about:blank 初始页。3D 坐标测试用"顶视 + 两点拾取标定"（`window.__qa3d` pick trace 给世界坐标，顶视下屏幕↔世界是等比映射）。
>
> v9 验证：`npm run build` ✓ `smoke:campaign` ✓ `qa:builder` 10/10 ✓ 浏览器 QA（`.tmp/qa-v9.mjs`）26/26 ✓ 0 console error，1366 无横向溢出。
>
> v9 已知限制：纹理缩放/旋转仅 2D 蓝图可见（3D 为纯色材质）；泛光为辉光近似非真 bloom；天花板/墙高不影响试玩端；2D 拉伸把手未走 3D 的"破坏即还原"规则（保持原行为）；角落把手未做（边把手已覆盖宽/深调整）。

> ## v8 增量（premium build-mode 壳层）
> - **布局重构**：分屏模式 = 3D 主舞台 + 左上浮动「平面蓝图」面板（可折叠，`.builder-blueprint`）；2D 平面 / 分屏 / 3D 编辑三模式保留（快捷键 1/2/3），视图切换器换成发光分段控件（`BuilderViewportControls` 瘦身为视图+缩放+吸附）。
> - **新组件**：`BuilderAssetBrowser.tsx`（四页签 房间/家具/机器人/门锁 + 搜索 + 最近使用行 + 缩略图密集网格；门锁页签按锁型直接放门）、`BuilderInspectorPanel.tsx`（对象属性卡片：房间风格 chips/出生·出口角色、门锁 2×2 分段+谜题色点行、家具缩略图卡+缩放滑杆+吸附开关、机器人原型网格+强度分段）、`BuilderBuildToolbar.tsx`（底部工具托盘 选择/房间/门锁/家具/机器人 + 撤销重做/旋转/复制/删除 + 锁链◉→钥→战→▣ + 敌压条 + 可玩/警告 chips）。
> - **3D 编辑增强**：3D 空闲悬停拾取（`useBuilder3DEditing` 的 `reportHover`，2D/3D hover 双向同步 + 指针光标反馈）、网格吸附开关（snapStep 0.5↔0.05 贯穿 2D/3D 拖动与放置）、放置模式顶部横幅（Esc 取消按钮）、保存/校验结果改为舞台右下 toast。
> - **关键 bug（r3f 容器尺寸）**：`BuilderPreview3D` 改为**常驻挂载**。卸载重挂会让 R3F canvas 卡在 300×150；`display:none` 更糟——react-use-measure 量到 0 之后 r3f **停止向场景树 flush React 更新**（渲染继续但 placement/相机预设/事件处理器全部冻结在旧 props，表现为"3D 点击失灵"）。正确做法：2D 平面模式用 `.builder-plan-layer`（absolute 覆盖层）盖住 3D，3D 容器保持非零尺寸 + `visibility:hidden`。
> - **回归脚本**：`npm run qa:builder`（`scripts/qa/builder-headless-check.mjs`：编译/校验 0 错、背包契约、放置规则界外拒绝+吸附、pickAt、18/18 缩略图、拓扑链、SSR v8 壳层）；浏览器端 `.tmp/qa-v8.mjs`（CDP 24 项：三模式切换、目录搜索/页签、3D 放置/拖动/旋转/撤销重做/Esc/机器人部署/选中、工具托盘、保存+试玩，0 console error）。
>
> v8 验证：`npm run build` ✓ `smoke:campaign` ✓ `qa:builder` 7/7 ✓ 浏览器 QA 24/24 ✓（1440×900）。
>
> v8 已知限制：3D 仍不能拖房间/门（房间几何在 2D 蓝图调整）；无连续放置；蓝图面板位置固定不可拖拽缩放；plan 模式下隐藏的 3D 仍在后台渲染（常驻挂载的代价）。

> ## v7 增量（3D 编辑模式）
> - **3D 可直接编辑**：`Builder3DEditing.tsx` + `BuilderPlacementRules.ts`。核心架构：**所有 3D 拾取都走"地面拾取"** —— 唯一的 raycast 目标是一块巨大的隐形地面盒（`EditingGround`），从命中点做**平面坐标命中测试**（`pickAt`：机器人 > 家具 > 门 > 房间），拖动/放置同理。不要改回给每个 mesh 挂 onPointerDown：StrictMode 的废弃渲染会把 identity-transform 幽灵对象塞进 r3f 交互注册表，导致拾取在真实位置全部失灵（排查记录见下）。
> - **放置模式**：目录点击资产 → `PlacementDraft` → 2D/3D 都显示青/红 ghost（合法=房间内），点击放下并选中，R 预旋转，Esc 取消。2D 端用 svg `onPointerDownCapture` 拦截放置点击。
> - **机器人自由位置**：`BuilderRobotGroup.position?`（可选，向后兼容）；compile 把已放置位置（夹回房间内）作为出怪点；2D/3D 都可拖。
> - **三个被 QA 揪出的真 bug**：① `<Canvas camera={{...}}>` 内联对象每次渲染都让 R3F 重设相机位置（每次编辑视角被弹回）→ `useMemo` 固定 initialCamera；② OrbitControls `enableDamping` 让相机在预设/点击后持续漂移（同一像素映射漂移）→ 关闭；③ `useBuilderHistory` 在 setState updater 里做历史副作用，StrictMode 双调用产生重复撤销条目 → 改为 `latestRef` + 直接值 setState。
> - **UI 重构**：目录三页签（结构/家具/单位）+ 放置态高亮；检查器对象头部卡（图标+名称+类型+旋转/复制/删除快捷钮）、家具 X/Z 步进器、分组小节；底栏保持锁链+chips+保存面板。
> - **回归脚本**：`.tmp/qa-3dedit.mjs`（CDP 受信输入：放置/拖动/旋转/撤销重做/3D 选择/机器人部署/保存/试玩 12 项全过）。注意 CDP `Input.dispatchMouseEvent` 才能驱动 OrbitControls+r3f；JS 合成事件不行。`window.__qa3d` 是内置 QA 追踪钩子（无害，QA 定义后才生效）。
>
> v7 验证：`npm run build` ✓ `smoke:campaign` ✓ headless（compile 0 错/背包契约 railLance+coreCells0/足迹 18/18/SSR）✓ 浏览器 QA 12/12 ✓ 截图 1440/1366 无溢出 ✓。
>
> v7 已知限制：3D 不能拖房间/门（房间几何仍在 2D 调整）；放置一次后退出放置模式（无连续放置）；3D 选中无 hover 预高亮（仅 2D→3D hover 同步）；影院模式与拖动并存时 autoRotate 暂不暂停。

> v3 增量：`BuilderDirector.ts`（模板/一键修复/张力/主题/状态 chips）、5 房启动项目、3D 相机预设+影院模式+路径发光+锁图标、2D 磁性吸边+hover 同步、底栏控制台+保存成功面板。
>
> v4 增量：`BuilderFields.tsx`（Stepper/AngleControl/ThreatMeter/InspectorHint）、检查器内联诊断（房间重叠/无门、清剿门缺机器人、家具出界）、目录搜索、缩放自适应拉伸手柄+marching-ants 选框、`capturePointer` 容错。真实浏览器 QA 方案：`/Applications/Google Chrome` headless + CDP over Node 全局 WebSocket（零依赖），断言要基于 DOM 而不是 localStorage 草稿（headless 后台标签页定时器节流会让 350ms 自动存草稿延迟到 ~1s+）；交互用分步 dispatch + rAF tick。
>
> v5 增量（Sims 式升级）：
> - `BuilderAssetFootprints.tsx`：18 个家具 modelKey → 14 个剪影族（沙发/床/柜/桌/灯/展柜/栏杆/壁挂…），2D 画布与目录缩略图共用；`FloorPatternDefs`（5 种地板材质 SVG pattern，页面级挂载供跨 svg 引用）；`RoomStyleThumb`/`RobotThumb`/`PropThumb`。
> - `BuilderTopology.ts`：computeTopology → 锁链读出（◉→钥→战→▣）+ 敌压 0-1，渲染在底栏 `builder-chain`。
> - `BuilderCanvas2D`：墙体厚度（stroke 0.36 墙板）+ 图案地板 + 踢脚线、门=墙上开口（门洞/门框/门槛/摆动弧/锁光条/小徽章）、家具剪影 + 朝向、机器人=底盘+面罩+数量 pips 威胁单位、房间标签缩小+出生/出口胶囊。
> - `BuilderPreview3D`：实心矮墙带真实门洞（`wallRunSegments` 按门切分、墙内缩半厚避免共边 z-fight）、墙顶发光边、门框+门扇+门槛+状态光条、地板嵌边、家具/机器人 blob 阴影、锁图标降到 1.95m。
> - 编译产物 playtest 背包契约：rod+pistol、`equipWeapon:"railLance"`、`coreCells:0`（headless 检查覆盖）。

## v5 验证结果
`npm run build` ✓ `npm run smoke:campaign` ✓；headless：starter 0 错误、背包契约 ✓、18/18 足迹映射 ✓、topology 链 ✓、SSR 渲染 ✓；CDP 截图（1440/1366，split/2D/3D）0 console 错误，无文字溢出。

## v5 后最值得做
1. 2D 地板图案对比度微调（hazard 斜纹略强）；房间标签与家具偶有重叠 → 标签碰撞回避或仅 hover 显示。
2. 3D 影院模式自动相机高度缓动；门扇开合动画（locked→open 状态切换）。
3. 目录缩略图换成真实 GLB 渲染快照缓存（dataURL）。
4. 复制房间连同家具/机器人；多选框选。

## 当前状态（已完成、已验证）

`/build` 是玩家自制密室工具（非开发者 debug 页），路由在 `src/App.tsx` 用 `pathname === "/build"` 判断（无 React Router），整个页面是懒加载 chunk。

核心数据流（不要破坏）：

```
BuilderProject (hp.builder.v1, localStorage 草稿)
  → compileBuilderProjectToLevel()  → LevelDefinition (authoringProfile: "generated")
  → validateLevelConfig(level, { authoringProfile: "generated" })
  → createSingleLevelConfigPack() → saveCustomConfigPackFromText()  (hp.config.v1 本地包)
  → 试玩 = window.open("/?level=<builder_level_id>")
```

文件一览（全部在 `src/build/`，样式在 `src/styles/builder.css`）：

| 文件 | 职责 |
| --- | --- |
| `BuilderTypes.ts` | BuilderProject schema + `createStarterProject()`（默认可玩示例） |
| `BuilderAssetCatalog.ts` | 房间风格（仅 generated 白名单材质）、18 个家具 modelKey（带尺寸/碰撞标记）、4 种机器人、锁标签、谜题颜色 |
| `compileBuilderProjectToLevel.ts` | 编译到 LevelDefinition；`sharedEdge()` 在房间贴合边上自动算门位置（mapValidator 的 door-opening 校验依赖这个）；机器人→每房间 spawnGroup(显式 positions)+room_entered 波次；出口=进出口房间事件 unlock_exit |
| `BuilderStorage.ts` | 草稿 localStorage（key `human-protocol-builder-draft-v1`）、校验、存包、导出 JSON |
| `BuildPage.tsx` | 页面壳：目录/检查器/底栏/快捷键/复制/关键路径 BFS |
| `BuilderCanvas2D.tsx` | SVG 平面图：滚轮缩放(光标为中心)、空白拖动平移、房间/家具拖动吸附、房间四边拉伸手柄、门/机器人徽章、无效门提示(title tooltip)、关键路径虚线 |
| `BuilderPreview3D.tsx` | R3F 静态预览（frameloop="demand"，无 GameWorld、无 Raw WebGPU）：房间地板+半透明矮墙、按锁类型着色的门、家具 GLB（`EnvironmentModelInstance` 自带懒加载+占位符）、机器人发光圆柱、出生/出口信标、选中光环 |
| `BuilderViewportControls.tsx` | 视图工具栏：2D/分屏/3D 切换、缩放±/重置、撤销重做、旋转/复制/删除 |
| `BuilderHistory.ts` | `useBuilderHistory`：past/future 快照栈（上限 50），`mark()` 让拖拽手势合并成一步撤销 |

相关改动（builder 之外，均很小）：
- `src/render/GameCanvas.tsx`：`authoringProfile === "generated"` 的关卡跳过 Raw WebGPU，直接走 Three/R3F。
- `src/main.tsx`：导入 `builder.css`。

## 验证方法（每次改动后跑）

```bash
cd games/human-protocol
npm run build            # tsc + vite
npm run smoke:campaign   # 当前 maintained slice + smoke；Level 4+ 不再作为返工前的默认官方验收目标
```

无头校验技巧（仓库无 puppeteer/playwright）：参照 `scripts/qa/smoke-campaign.mjs`，用 vite `createServer({middlewareMode:true})` + `ssrLoadModule` 可以直接：
- `compileBuilderProjectToLevel(createStarterProject())` + `validateLevelConfig(..., {authoringProfile:"generated"})` 断言 0 错误；
- `renderToString(createElement(BuildPage))` 抓渲染崩溃（react 用 `createRequire` 引 CJS 版本）；
- 需要测存档/GameWorld.loadLevel 时，给 `globalThis.window` 塞 `localStorage/location(hostname!)/history/matchMedia` 垫片即可 `new GameWorld()` 并加载自定义关卡。

## 已知限制 / 下一步候选（按优先级）

1. **3D 预览没有门洞**：矮墙是整面半透明盒子，门只是叠加的彩色盒。若要真门洞，把每面墙按该边上的门切成 2-3 段（`sharedEdge` 已给出门心和朝向，门宽 3.2）。
2. **2D 没有框选/多选**，复制房间不带家具/机器人。多选要改 `BuilderSelection` 为数组——动所有 inspector 前先想清楚。
3. **谜题只支持一扇门一个颜色锁**（compile 里 `puzzleDoor` 单例 + `builder_color_lock` 固定 id）。扩展成多谜题需给 BuilderPuzzle 挂 doorId 并生成唯一 id。
4. **机器人徽章位置固定**在房间左上角排队（2D/3D 同一公式：`minX+1.1+index*1.4, maxZ-1.1`），不可拖。可加 BuilderRobotGroup.position 可选字段（schema 加可选字段是安全的，旧草稿照常读）。
5. **3D 选中高亮是平面光环**，没有 outline pass（故意不上 postprocessing，保持轻量）。
6. **撤销栈不含视口/选中状态**，只含 project——这是有意的。
7. 资产目录截图/缩略图：目录现在是纯文字按钮，可以用 3D 预览同款 R3F 小场景生成缩略图（注意性能，建议截图后缓存 dataURL）。
8. **continuation 测试**：旧草稿（无新字段）兼容性由 `loadBuilderDraft` 的 schemaVersion 检查兜底；改 BuilderProject 时保持向后兼容或 bump 到 hp.builder.v2 + 迁移函数。

## 红线（历次会话都要遵守）

- 玩家关卡**永远**是 `hp.config.v1` 里的 LevelDefinition，不发明并行运行时格式。
- 只用 `BuilderAssetCatalog` 里已存在的 modelKey / generated 白名单材质（`authoringValidator.ts` 是硬校验）。
- Level 1/2 的 official 主源是 official builder JSON + 轻量 source shell；旧 `map.ts/waves.ts/puzzles.ts` 不能反向覆盖 build 的房间、家具、材质、谜题、门锁或波次。
- Level 3 保留 museum/boss/lighting 特例链路；Level 4+ 返工前不作为默认 official QA gate。
- 不碰 raw-webgpu 资产生成；builder 关卡只通过 runtime pack/官方 promotion 链路进入 Raw/WGPU。
- 不引入大依赖；r3f/drei/three 已在依赖里。
