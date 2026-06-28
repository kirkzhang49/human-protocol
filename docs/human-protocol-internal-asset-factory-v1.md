# Human Protocol 内部资产工厂 v1（Internal Asset Factory & Art Bible）

状态：v1（2026-06-11）。本文件是 Human Protocol 内部高质量资产生产线的**美术圣经 + 生产手册**。
生产工具：auto-rig-3d（确定性家具生成器，本地路径见文末）。
摄取边界：`hp.builder.assetPack.v1` manifest + GLB → `scripts/asset-build/generate-builder-asset-pack-registry.mjs`。

## 0. 创作守则（先想象，后数学）

1. **想象先行**：每件资产先回答"它在这个房间里讲什么故事"，再谈预算。
2. **数学是质检门，不是创意源**：评分只负责拒绝坏资产（比例失真、不可读、超预算），不负责发明房间的灵魂。
3. **轮廓即语言**：玩家在 6–10 米外、0.5 秒内必须读懂"这是什么、能不能搜、挡不挡路"。
4. **不对称、分层、可信比例**：拒绝"倒角盒子"。每件家具至少有一个打破对称的细节（偏置抽屉、单侧支架、歪斜的标签）。
5. **红色只属于危险**：青色/蓝是设施身份色，暖黄是"人类记忆"色，红色保留给锁定/错误/危险。
6. **恐怖来自"差一点正常"**：住宅资产做得越像样板间越好——恐怖感来自完美的假，不来自血迹贴图。

---

## 1. 五个官方主题的资产语言

### 1.1 维修舱 Maintenance Bay（repair horror）

- **情绪幻想**：你是被送进来"维修"的。工具墙为比你大的东西准备；一切都湿、重、黄。
- **房间轮廓语言**：低顶压迫感；垂直配电塔与水平工具台交替；地面留出拖拽痕迹的空走廊。
- **家具族**：drawer_chest（工具抽屉）、control_console（断路器/配电）、storage_crate、cabinet（备件）、chair（检修凳）、bed_or_exam_table（检修架——给"人"用的）。
- **墙/地/顶材质语言**：警示黄漆 + 深钢 + 湿水泥地（builder 风格 `maintenance`）；锈水痕从管线接缝下垂。
- **英雄道具**：**机体检修台**——临床检查床的工业版本，束带位清晰可见。房间中央，灯打在上面。
- **小型填充**：金属包角箱、标签可读的备件柜、矮凳。
- **互动道具**：断路器塔（电力谜题）、工具抽屉墙（搜索）、暗格备件柜。
- **灯光重点**：单点顶光打英雄检修台；配电塔上一颗呼吸的青色指示灯；其余压暗。
- **不要做**：干净的高科技实验台；血迹喷溅；普通"科幻货箱"堆。

### 1.2 虚假客厅 Residential Simulation（fake home）

- **情绪幻想**：一个为你布置的"家"，每件家具都摆得太正。电视永远在播放。
- **房间轮廓语言**：水平低矮线条（沙发/矮架/矮桌），视线无遮挡——它希望你被看见。
- **家具族**：sofa_bench、chair、bookshelf（隔断）、desk、bed_or_exam_table（窄床）、wall_panel（全家福）。
- **墙/地/顶材质语言**：胡桃木 + 暖织物 + 米色墙（builder 风格 `residential`）；过分均匀的暖光。
- **英雄道具**：**永播电视柜**——其实是一台监控终端，屏幕对着沙发，沙发对着屏幕。
- **小型填充**：餐边椅、写字桌、窄床、隔断书架。
- **互动道具**：全家福相框（背后暗格）、写字桌抽屉（线索）、电视柜（剧情屏幕）。
- **灯光重点**：均匀暖白主光 + 电视蓝光闪烁打在沙发上；没有影子死角——这本身就是恐怖。
- **不要做**：破败/脏污的家具（假家是崭新的）；哥特装饰；任何明显"科幻"的外壳。

### 1.3 人类档案室 Human Museum（archive & exhibit）

- **情绪幻想**：人类是展品。黄铜、深木、玻璃；每个柜子有一张写给"它们"看的展签。
- **房间轮廓语言**：垂直高柜与玻璃罩交替的节奏；中轴对称大厅 + 不对称的"未完成翼"。
- **家具族**：display_case（主展柜/壁挂柜）、bookshelf（珍本）、desk（誊写台）、sofa_bench（展厅长椅）、drawer_chest（标本抽屉墙）、wall_panel（展签板）。
- **墙/地/顶材质语言**：深木墙裙 + 黄铜线脚 + 哑光石材地；玻璃只用于罩与门。
- **英雄道具**：**人类标本主展柜**——博物馆玻璃罩，灯从底座向上打，里面"应该"有东西。
- **小型填充**：展厅长椅、标本抽屉墙、展签线索板。
- **互动道具**：锁定珍本架（钥匙谜题）、标本抽屉（搜索）、誊写台（线索文本）。
- **灯光重点**：每个展柜独立的暖黄底座灯；环境光压到最低；黄铜反光做导路。
- **不要做**：现代白盒美术馆；电子屏幕墙（档案室是模拟人类纸质时代的）；霓虹。

### 1.4 镇静诊疗间 Memory Clinic（medical sedation）

- **情绪幻想**：温柔的恶意。淡蓝织物与苍白金属说"放松"，束带和抽屉里的剂量表说别的。
- **房间轮廓语言**：圆角、低噪声轮廓；床是房间唯一的重心，其它一切朝向它。
- **家具族**：bed_or_exam_table（镇静床）、cabinet（药剂柜）、drawer_chest（剂量抽屉）、control_console（体征终端）、chair（值守椅）、storage_crate（耗材箱）、wall_panel（脑图板）。
- **墙/地/顶材质语言**：苍白金属 + 淡蓝织物 + 可冲洗地面（builder 风格 `sterile`）；绿玻璃点缀。
- **英雄道具**：**记忆镇静床**——临床检查床的"舒适"版本，枕位下凹，旁边永远有一把值守椅。
- **小型填充**：标签耗材箱、值守软椅。
- **互动道具**：体征终端（数值谜题）、剂量抽屉柜（搜索/钥匙）、药剂柜（锁）。
- **灯光重点**：无影手术光（冷白、低对比）+ 体征终端的绿色波形微光；唯一暖光来自走廊门缝。
- **不要做**：恐怖医院的锈与血；停尸房抽屉墙（留给博物馆的标本语言）；过强红光。

### 1.5 回收核心前室 Reclamation Core（final industrial core）

- **情绪幻想**：终点站的等候室。黑钢、青色发光带、一排等候长椅——排队，然后被回收。
- **房间轮廓语言**：大体量黑钢块 + 细发光缝；视线被引向唯一的封存库门。
- **家具族**：control_console（总控）、safe（封存库/锁箱）、storage_crate（回收料）、cabinet（暗门机柜）、sofa_bench（等候长椅）、wall_panel（警示屏）。
- **墙/地/顶材质语言**：黑钢板 + 青色 emissive 缝隙 + 防滑格栅地（builder 风格 `hazard` 收边）。
- **英雄道具**：**核心封存库**——地面保险库体量放大，正面只有一个转盘和一条发光缝。
- **小型填充**：金属包角回收箱、等候长椅（最便宜也最恐怖的道具）。
- **互动道具**：核心监控台（终局谜题）、密码锁箱（钥匙链）、暗门机柜（隐藏通路）。
- **灯光重点**：青色发光缝做唯一持续光源；警示屏间歇红闪（这里允许红——它就是危险）。
- **不要做**：熔岩/火花粒子堆砌；通用"反应堆圆环"；把青色换成红色的全房间警报。

---

## 2. 未来 20 房间的可复用资产车道（Reuse Lanes）

每条车道 = 主题家族 + 材质主题 + 轮廓规则。新房间先选车道，再挑资产，最后才补做新模型。

| 车道 | 复用自 | auto-rig 材质主题 | 轮廓规则 | 典型房间 |
|---|---|---|---|---|
| maintenance/industrial | 维修舱 | maintenance_yellow_paint_dark_steel, basement_rusty… | 垂直塔 + 水平台交替 | 泵房、电梯机房、零件库 |
| residential/domestic | 虚假客厅 | office_walnut_black_metal, library_old_wood_leather_gold | 低水平线、无遮挡 | 卧室模拟、厨房模拟、走廊公寓 |
| museum/archive | 人类档案室 | museum_dark_wood_brass_glass, library_old_wood_leather_gold | 高柜+玻璃罩节奏 | 画廊、储藏翼、修复室 |
| clinic/medical | 镇静诊疗间 | clinic_pale_metal_blue_fabric, lab_white_plastic_steel_green_glass | 圆角、床为重心 | 候诊区、记录室、康复舱 |
| security/checkpoint | 回收核心（轻量） | security_black_metal_cyan_emissive | 屏幕墙 + 闸口 | 安检口、监控室、岗亭 |
| core/machine | 回收核心 | security_black_metal_cyan_emissive, maintenance… | 大黑体量 + 发光缝 | 核心室、能源井、冷却廊 |
| ritual/finale | 博物馆 + 核心混合 | museum… + security…（对撞） | 对称中轴 + 单一焦点 | 终幕厅、审判室 |
| transition/corridor/elevator | 全车道收边件 | 按相邻房间继承 | 窄、重复模数、单互动点 | 电梯、风闸、楼梯井 |

规则：transition 车道**永远继承相邻房间的材质主题**，只用 wall_panel / crate / console 三族，保证廉价与连贯。

---

## 3. 首发高级批次 batch-01（35 件）

命名：`room_autorig_<lane>_<name>`；GLB `hp_<modelKey>.glb`；分组（BuilderPropGroup）：维修 / 居住 / 博物馆 / 诊疗 / 核心。
每主题 6 件家具 + 1 件英雄道具。完整 modelKey/尺寸/footprint 清单以
`src/assets/manifests/builder/auto_rig_internal_batch01_v1.json` 为准（生成后即合同）。

| 主题 | 英雄道具 | 家具 |
|---|---|---|
| 维修舱（维修） | 机体检修台 maint_repair_cradle | 工具抽屉墙、断路器配电塔、包角载具箱、检修转凳、备件双门柜、检修警示挂板 |
| 虚假客厅（居住） | 永播电视柜 home_tv_console | 样板沙发、餐边椅、客厅隔断架、家用写字桌、单人样板床、全家福相框 |
| 人类档案室（博物馆） | 人类标本主展柜 museum_hero_vitrine | 壁挂展示柜、锁定珍本架、档案誊写台、展厅长椅、标本抽屉墙、展签线索板 |
| 镇静诊疗间（诊疗） | 记忆镇静床 clinic_sedation_bed | 药剂档案柜、值守软椅、镇静剂抽屉柜、体征监护终端、耗材标签箱、脑图挂板 |
| 回收核心前室（核心） | 核心封存库 core_seal_vault | 核心监控台、密码锁箱、回收料箱、暗门机柜、回收等候长椅、核心警示屏 |

墙/地/顶模组：v1 批次以 **wall_panel 族（每主题 1 件挂墙模组）+ 既有 builderRoomStyles 地/墙材质键** 覆盖；
独立地板/天花 GLB 模组留给 batch-02（见 §6）。

---

## 4. 数学质检门（创意之后才运行）

资产先过 auto-rig 内置 hard gate（地面枢轴、导航碰撞体、必需插槽、三角预算、轮廓评分），
再过 Human Protocol 侧的批次门（`scripts/qa/builder-headless-check.mjs` 扩展项）：

1. 尺度理性：每族尺寸落在族区间内（manifest sizeMeters vs registry，容差 0.005 m）。
2. 碰撞足迹理性：footprintFamily 非 generic 且与族匹配。
3. 俯视可读性：2D 足迹轮廓族正确（builder 蓝图渲染用）。
4. 三角/文件预算：单件 GLB < 200 KB（参考批均值 ~40 KB）。
5. 材质槽数量：仅使用 12 个标准槽。
6. 轮廓区分度：同族不同件的 sizeMeters/preset 必须不同（驱动脚本断言）。
7. 主题契合：themeId 必须属于该车道的允许主题列表。
8. 建造器可用性：modelKey 全部能在 environmentModelAssets / builderPropCatalog / footprint 表解析。
9. 复用潜力：每件资产携带 lane 标签（tags）。

**原则**：质检门只能以"不可读 / 超预算 / 破坏一致性"为由拒绝资产，不得以"多余的想象细节"为由删减。

## 5. 生产管线（操作手册）

1. 生成 + 导出（在 auto-rig-3d 仓库内运行）：
   `node <human-protocol>/scripts/asset-build/export-hp-internal-batch01.mjs`
   产出 `exports/hp-internal-batch01/`：GLB ×35、`manifest.json`（hp.builder.assetPack.v1）、`gate-report.json`。
2. 拷入仓库：GLB → `src/assets/models-cooked/environment/auto-rig-batch01/`；manifest → `src/assets/manifests/builder/auto_rig_internal_batch01_v1.json`。
3. 预检：`node scripts/asset-build/generate-builder-asset-pack-registry.mjs --check --pending --manifest src/assets/manifests/builder/auto_rig_internal_batch01_v1.json`
4. 摄取：在 `ingested-packs.json` 注册（ingest: "generated"）后 `--emit`，自动重生成 registry/catalog/footprint 三个片段。
5. 质检：`npm run qa:builder && npm run build && npm run smoke:campaign`。

## 6. v1 已知边界与 batch-02 方向

- 独立地板/天花模组、房间外壳 GLB：未做，batch-02 以 transition 车道为试点。
- roomKit 仍是数据合同（`src/build/builderRoomKitCatalog.ts`），/build 目录页签与一键铺装待实现。
- 预览图：auto-rig 仅有族级 contact sheet，单件 previewFile 留空，batch-02 接 per-asset 渲染。

auto-rig-3d 本地路径：`/Users/zhengkaizhang/Documents/Codex/2026-06-07/files-mentioned-by-the-user-pasted/auto-rig-3d`
