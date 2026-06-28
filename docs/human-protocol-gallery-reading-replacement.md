# 展画审读机替代方案：门路校准盘

目标：替换 `gallery_reading` 的阅读问答节奏。新玩法要像密室机关，而不是考试；能和门、路由台、机器人房间、钥匙形成多房间控制。

## 推荐玩法

名称：`门路校准盘`

玩家打开一台墙面校准盘，看到 3 层同心环：

- 外环：门路符号，代表 1-4 个输出目标。
- 中环：管线断点，旋转后把外环目标接到核心。
- 内环：权限齿，必须和钥匙/谜题颜色/房间标记对齐。

玩家每次点击旋转一个环。全部对齐后，当前输出被释放：可以开门、显露/接通一个谜题台，或唤醒/停用一个房间机器人。失败不会扣血，只会让盘面回退一步并发出拒绝声。难度由环数量、可旋转步数、输出数量决定。

## 为什么比审读机更适合

- 更少文字，节奏快，视觉上像真实设施机关。
- 能服务 builder 的核心卖点：门、谜题台、机器人、钥匙之间的路由。
- 可随机但可验证：config 给出目标组合，validator 可以检查最后一定能开出口。
- 和强制切镜头/门动画天然适配：解出后镜头转到目标门或目标房间，看见门慢慢打开或谜题台升起。

## Config 方向

新 puzzle kind 建议：`route_dial`

字段建议：

- `interactionId`: 校准盘实体。
- `linkedDoorId`: 主解锁门，可选。
- `outputs`: 1-4 个输出，复用 route switch 输出概念。
- `rings`: 2-4 个环，每个环有 `symbols`, `startIndex`, `targetIndex`。
- `stepLimit?`: 可选步数限制。
- `cameraReveal?`: 成功后切镜头目标，默认用第一个输出。
- `audio`: open / rotate / align / denied / release。

输出类型复用：

- `door`: 打开一扇锁门。
- `puzzle`: 接通/显露一个谜题台。
- `robot_room`: 唤醒或释放一个房间机器人。

## Image2 目标

建议新增脚本：

- `scripts/asset-build/generate-route-dial-ui-image2.py`

输出：

- `src/assets/gui/hp-gui-route-dial-frame-image2.png`
- `src/assets/gui/hp-gui-route-dial-ring-image2.png`
- `src/assets/gui/hp-gui-route-dial-symbols-image2.png`
- `src/assets/gui/hp-gui-route-dial-release-chip-image2.png`

画面要求：

- 无文字底图，所有文字继续由 React/CSS 渲染。
- 三层环必须一眼看出“可以旋转”。
- 每个输出目标用小图标表示：门 / 谜题 / 机器人房间 / 钥匙权限。
- 配色跟 Human Protocol 一致：黑青玻璃、少量铜金、成功时冷白到琥珀的扫描光。

## 3D 道具

模型 key 建议：

- `puzzle_console_route_dial`

形体：

- 1.2m 高墙面盘或立式控制台。
- 中心同心环有 emissive slot。
- 侧边有 1-4 个输出灯位，对应 config outputs。
- 成功后灯位按输出顺序亮，方便玩家知道它刚控制了什么。

## Builder UI

在 `/build` 中替代 `展画审读机` chip：

- chip 名：`门路校准盘`
- 描述：`旋转环路，把输出接到门或谜题台`
- 选中后右侧设置：
  - 输出 1-4 个。
  - 每个输出选择：锁门 / 谜题台 / 机器人房间。
  - 难度：轻 / 标准 / 严格，对应环数和起始偏移。
  - 成功镜头：自动 / 指定门 / 指定房间。

## Validation

必须检查：

- 输出至少 1 个，最多 4 个。
- 输出目标存在。
- 如果输出开出口链路上的门，不能把校准盘自身锁在门后。
- 如果输出接通谜题台，该谜题台在接通前不能成为唯一开路条件。
- 成功后主出口仍可达。

这套东西可以直接取代 `gallery_reading` 的 public chip；旧 `gallery_reading` 保持 legacy 兼容。
