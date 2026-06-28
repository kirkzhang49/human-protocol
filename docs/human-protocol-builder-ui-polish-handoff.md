# /build UI 打磨交接（v3 cockpit pass）

日期：2026-06-10。本轮在已有 2D/3D 编辑器基础上做「驾驶舱化」打磨 + 导演层。

## 本轮改了什么

**新文件**
- `src/build/BuilderDirector.ts` — 导演层：
  - `builderTemplates`：4 个一键模板（分支密室=新版启动项目、线性三室、环形四室、Boss 终局），全部经 headless 校验 0 错误。
  - `repairProject()`：一键修复（出口/出生重合、近贴边房间自动吸合、断路补门、清剿门补机器人）。
  - `applyTension()` 低压/标准/致命（改全体机器人数量与精英层级）。
  - `applyThemeKit()` 维修/居住/博物馆/警戒（重刷非出口房间风格）。
  - `computeStatusChips()`：可玩/路径/门锁/机器人/出口 五枚实时状态 chip（轻量检查，完整校验仍在保存/校验按钮）。

**改动文件**
- `BuildPage.tsx`：顶栏（logo 灯点 + BUILDER v1 徽章 + 房/门/敌统计 + ⚒ 一键修复 + 保存中态 + ▶ 试玩）；目录新增「模板」区；底部状态条变成控制台（chips + 状态文本 + 保存成功面板：level id / 试玩 / 复制链接 / 导出包）；ProjectInspector 增加「导演工具」（张力段选 + 主题套件网格）；导出文件名 slug 化（`exportFileSlug`，CJK 安全）。
- `BuilderTypes.ts`：`createStarterProject()` 升级为 5 房分支布局（出生→监控走廊→{档案室[钥匙+展柜], 清剿机房[战斗]}→撤离电梯），14 件主题家具，1-2 分钟可通关。
- `BuilderPreview3D.tsx`：相机预设（顶视/斜视/出生/出口，经 CameraRig+OrbitControls target）；影院模式（autoRotate）；选中脉冲环、出口扩散波信标、关键路径发光段（带呼吸透明度）、锁图标浮动旋转（钥匙=八面体黄/清剿=锥红/谜题=二十面体紫）、机器人改为身体+头+发光眼环+底盘、悬停同步白环（2D hover → 3D）。frameloop 默认（动画需要连续帧）。
- `BuilderCanvas2D.tsx`：拖房磁性吸边（`snapRoomToNeighbors`，间隙 ≤1.05m 自动贴合）+ 金色吸附引导线；hover 回调（`onHover`）同步到 3D；门徽章按锁类型描边；家具足迹分组配色（维修青/居住暖/博物馆蓝紫）+ 内嵌台面线。
- `builder.css`：追加「v3 cockpit polish」层（顶栏徽章/呼吸灯、目录分区线与触感按钮、chips、保存面板、3D 工具栏悬浮药丸、检查器分区线、危险按钮 hover、无效门呼吸动画、snap guide 发光、滚动条、≤1500px 响应）。

## 验证（全部通过）
- `npm run build` ✓；`npm run smoke:campaign` ✓（官方 1-5 关全 PASS）。
- headless（vite ssrLoadModule）：4 模板 compile+validate 0 错误且 chips=可玩；故意破坏（出口房脱离 + 删机器人）→ repairProject 修复 2 项 → 重新可玩且通过完整校验；lethal 张力+博物馆主题后仍 0 错误；BuildPage SSR 渲染含全部新 UI。
- dev server `/build` 200（已关闭，无残留进程）。

## 自评（1-10）
视觉 8 / 编辑清晰度 8 / 信息层级 8 / 2D 手感 8 / 3D 观感 8 / 检查器 7.5。

## 还欠的打磨（下次优先）
1. 检查器数字控件仍是原生 input —— 加 ±步进按钮或拖拽滑杆（宽/深/数量/缩放）。
2. 3D 墙体没有真门洞（彩门叠在墙上）；按 `sharedEdge` 把墙切段即可。
3. 目录无搜索/缩略图；家具按钮可加迷你足迹图标。
4. 复制房间不带家具/机器人；无框选多选。
5. 保存面板与 ResultSummary 同时出现时底栏较挤（已 flex-wrap，1366 宽可接受但不优雅）。
6. 影院模式可加自动相机高度缓动；目前只有 autoRotate。

## 已知风险
- 2D hover 在拖动中仍会触发 onHover（无碍但多余渲染）；如卡顿可在 drag 时跳过。
- `applyTension` 会覆盖手动调过的机器人数量（设计如此，但没有提示）。
- repairProject 吸合只处理间隙 ≤2.2m 且已有 ≥3.4m 投影重叠的房间对。

## 跑过的命令
`npm run build` / `npm run smoke:campaign` / node 临时 ssr 校验脚本（已删）/ 短启 dev server 验证 200 后即 pkill。
