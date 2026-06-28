# Mobile-First Core Game Systems Plan

本文件是可执行开发规格，不是概念稿。目标是先不画最终资产，用轻量 WebGL 和占位几何体做出一个完整、好玩的第一关；系统必须支持后续替换高级贴图、模型、音效和平台 SDK。

## 0. 产品判断

游戏方向：

> Mobile-first 第一人称机甲幸存者。玩家以为自己是最后的人类，被机器人围攻；第一关结尾开始露出真相：敌人不是来杀你，而是来维修/回收你。

核心体验不是传统 FPS 的精准瞄准，而是“机器人驾驶辅助系统”：

- 手机玩家主要负责移动、转向、武器决策、升级选择。
- 开火、拾取、轻微瞄准、背后威胁提示由系统辅助。
- 桌面端保留鼠标键盘增强输入，但核心难度仍按手机设计。

首个可玩版本的成功标准：

- 手机横屏无需键盘鼠标，可以从开始玩到第一关结束。
- 第一次击杀发生在开局 15 秒内。
- 第一关高手局约 2.5 分钟，普通手机玩家可放宽到 3-4 分钟；包含 1 次强三选一升级、1 个精英敌人、一次可能发生的正常 HP 归零死亡/复活和出口追击。
- 死亡后有一次可选复活流程；没有广告 SDK 时也能走通。
- 使用占位几何体也能感到“打得爽、升级有变化、剧情自然推进”。
- 当前包体继续保持极小；后续加资产时首包目标仍控制在 20MB 内。

长期产品判断：

- 5 关 demo 是官方参考内容，不是最终内容上限。
- 后期核心卖点是玩家一句话生成自己的机器人密室人生，本地机器人负责生成导演 prompt、config pack 和修复方案。
- 因此从 Level 02 开始，关卡、怪物、剧情、掉落、地图和资源引用都必须尽量走 config-driven 路线。
- 桌面 App 是长期主形态；Web 版先验证玩法、schema、性能预算和分享/导入导出流程。

## 1. 暂不做的事

这些内容会拖慢核心验证，第一阶段不要做：

- 不做最终角色、武器、场景贴图。
- 不做完整 5 关。
- 不做联机。
- 不做复杂物理引擎。
- 不做跳跃、蹲伏、背包、NPC 商店；手枪有自动长换弹，用作节奏限制。
- 不做长过场和长对白。
- 不做强制广告。

## 2. 推荐执行顺序

按这个顺序实现，不能跳到美术打磨：

1. 游戏状态机和场景流程。
2. 手机输入：左摇杆、右滑屏、按钮、安全区。
3. 第一人称移动和自动水平回正。
4. 自动开火、锁定锥、威胁环、点威胁方向自动转身。
5. 波次刷怪和敌人 AI。
6. 三选一升级系统。
7. 剧情对话系统和第一关脚本。
8. 死亡、复活、奖励广告占位适配。
9. 第一关调参和 QA。
10. 预留资产接口：texture/model/material/audio slots。

## 3. 目录和模块建议

当前项目可以继续使用 React + Three/R3F 做原型，但 gameplay state 必须保持纯 TypeScript，方便以后移植到更轻的 vanilla Three 版本。

建议新增/调整：

```text
src/game/core/GameSession.ts
src/game/core/GameMode.ts
src/game/core/SceneFlowSystem.ts
src/game/core/PlatformAdapter.ts

src/game/config/levelManifest.ts
src/game/config/upgradePool.ts
src/game/config/enemyArchetypes.ts
src/game/config/dialogueScripts.ts

src/game/systems/MobileAssistSystem.ts
src/game/systems/AutoFireSystem.ts
src/game/systems/ThreatRingSystem.ts
src/game/systems/WaveDirectorSystem.ts
src/game/systems/EnemyAISystem.ts
src/game/systems/UpgradeSystem.ts
src/game/systems/DialogueSystem.ts
src/game/systems/DeathReviveSystem.ts

src/input/TouchInput.ts
src/input/InputRouter.ts

src/ui/MobileControls.tsx
src/ui/ThreatRing.tsx
src/ui/UpgradeChoiceOverlay.tsx
src/ui/DialogueOverlay.tsx
src/ui/DeathOverlay.tsx
src/ui/SceneTransitionOverlay.tsx
```

现有模块不要推倒重来。先把新系统接进 `GameWorld` 和 `GameLoop`，让第一关闭环跑通。

## 4. 游戏状态机

实现一个明确的 `GameMode`：

```ts
type GameMode =
  | "boot"
  | "title"
  | "levelIntro"
  | "playing"
  | "dialogue"
  | "upgrade"
  | "transition"
  | "death"
  | "victory";
```

状态切换规则：

- `boot -> title`：资源和配置加载完成。
- `title -> levelIntro`：玩家点击 Play。
- `levelIntro -> playing`：短转场结束。
- `playing -> upgrade`：波次完成并且升级触发。
- `upgrade -> dialogue`：选择升级后播一句短剧情。
- `dialogue -> playing`：对白结束或玩家点击跳过。
- `playing -> death`：玩家 HP 为 0。
- `death -> playing`：复活成功。
- `death -> levelIntro`：重开当前关。
- `playing -> transition`：进入出口/电梯。
- `transition -> victory`：第一关完成。

验收标准：

- UI 永远只显示当前状态需要的层。
- 暂停状态不会继续刷怪、开火或扣血。
- 刷新页面后能重新开始，不报错。

## 5. 手机输入设计

默认横屏。

左手：

- 虚拟摇杆控制 XZ 平面移动。
- 摇杆半径大，离左/下边缘至少 24px，避开安全区。
- 摇杆输入做死区，防止轻触漂移。

右手：

- 右半屏滑动控制 yaw/pitch。
- pitch 限制在 `-16deg` 到 `+18deg`。
- 松手后 pitch 以 0.4 秒缓慢回正到水平线附近。
- 右下三按钮：`棒 / 枪 / 大招`。
- `棒` 处理贴脸和主伤害，`枪` 处理远处/护盾/打断，`大招` 处理包围。
- 手动开火开关可隐藏在设置里；默认自动开火。

桌面映射：

- WASD 移动。
- 鼠标看向。
- 左键手动开火；自动开火仍可开关。
- 1/2/3 切换 `棒 / 枪 / 大招`。
- Space 触发核心大招。

验收标准：

- 手机上只用两只拇指能移动、转向、打完第一波。
- 桌面端没有触摸 UI 遮挡中心视野。
- 所有按钮在 390x844 横屏和 844x390 横屏都不重叠。

## 6. 驾驶辅助系统

### 6.1 锁定锥

手机上不要要求精准准星。实现前方锁定锥：

- 以摄像机 forward 为中心。
- 基础半角第一版用 `22deg`，保证手机首关不用像素级瞄准；后续可按难度收窄或升级扩展。
- 基础距离 `26m`，让第一波刚出现时就能被系统纳入目标选择。
- 根据角度、距离、敌人威胁分数选择目标。
- 每帧只轻微修正武器朝向，不强行把摄像机吸过去。

目标评分：

```ts
score =
  angleScore * 0.55 +
  distanceScore * 0.25 +
  threatScore * 0.2;
```

表现：

- 被锁定敌人显示小环或轮廓。
- 准星变亮，但不要遮挡视野。
- 锁定丢失时 0.2 秒淡出，避免闪烁。

### 6.2 自动开火

默认开启：

- 有锁定目标。
- 当前武器未过热。
- 当前武器冷却完成。
- 玩家不在 `upgrade/dialogue/death/transition`。

自动开火不是无限免费：

- 连续射击增加热量。
- 热量过高时降速或短暂停火。
- 升级可以改变热量上限、散热、命中回能。

### 6.3 威胁环

解决手机第一人称最大问题：找不到背后敌人。

规则：

- 每帧统计屏幕外敌人方向。
- 将 360 度分成 8 个方向段。
- 每段显示威胁强度：红色弧线长度/亮度。
- 后方精英、近距离敌人权重更高。
- 玩家点某段弧线，机体自动转向该方向。

自动转向：

- 普通点击：0.35-0.55 秒平滑转向。
- HP 低于 35% 时：允许更快转向。
- 转身有短冷却，避免误触连续乱转。

剧情包装：

- 前期 UI 名称：`Human Survival Assist`
- 后期反转后改名：`Maintenance Combat AI`

验收标准：

- 敌人在背后时，玩家 1 次点击可以重新面对威胁。
- 不看小地图也能知道危险方向。
- 自动转向不会造成明显眩晕。

## 7. 战斗系统

### 7.1 武器定位

第一关只需要 3 个清楚的技能，不再像 3 把枪：

1. 实验铁棒
   - 1 号技能，主角从实验室捡起的大铁棒，是真的横扫过去。
   - 近身扇形重击，贴脸砸维修无人机和夹击机器人。
   - 伤害明显高于手枪，击杀返还热量，给玩家“冲进去砸碎机器人”的理由。

2. 实验手枪
   - 2 号技能，20 发弹匣，打空后自动长换弹。
   - 中远距离牵制、压低夹具机器人、补远处目标和精英弱点。
   - 对机器人伤害低于铁棒，不能当主输出；让玩家在贴身前先做选择，而不是只按同一把枪。

3. 核心大招
   - 3 号技能，右下大按钮。
   - 长冷却、大击退、清包围，可升级成回血大招。
   - 死亡前救命技能，也承担爽点。

第一关不要让玩家管理 6 把枪。手机上必须直接显示 `棒 / 枪 / 大招`，不要只给“换武器”。

### 7.2 敌人原型

用占位几何体即可，但行为要不同：

| ID | 用途 | 行为 | 第一关数量 |
| --- | --- | --- | --- |
| `repair_drone` | 基础小怪 | 直线靠近，近战电击 | 多 |
| `clamp_bot` | 侧翼小怪 | 绕侧后方，逼玩家用威胁环 | 中 |
| `shield_tech` | 后续破节奏预留 | 正面护盾，逼玩家换目标/绕弱点 | 第一关暂不放 |
| `signal_turret` | 后续空间压力预留 | 远处射线，提示转向 | 第一关暂不放 |
| `custodian_elite` | 第一关精英 | 慢速压迫，召小怪，血量高 | 1 |

当前第一关小怪只保留 `repair_drone` 和 `clamp_bot` 两种，避免玩家还没理解棒/枪循环时被过多敌人规则打散。

命名上不要叫 `killer_robot`。它们本质是维修机器人，前期通过错误 HUD 被玩家理解为敌人。

### 7.3 战斗爽感最低配置

占位资产也必须有反馈：

- 开火：枪口闪光、轻微后坐、短音效。
- 命中：敌人闪白/闪蓝、火花、血条抖动。
- 击杀：小爆裂、掉落物吸入、短暂停顿 `0.03s`。
- 受伤：屏幕边缘红光、驾驶舱抖动、低 HP 警告。
- 精英出场：镜头轻震、威胁环全亮一瞬。

不要过度晃镜头。手机上以“清楚”为第一优先级。

## 8. 三选一升级系统

升级触发：

- 第一波结束后一次。
- 第二波结束后一次。
- 精英战前可给一次剧情升级，第一版可选做。

升级 UI：

- 手机横屏显示 3 张大卡。
- 每张卡只有：图标、名称、一句话效果、稀有度。
- 卡片高度不要超过屏幕 70%，防止遮挡和溢出。
- 选择后立刻播放短反馈，并把效果反映到 HUD。

稀有度：

- Common：稳定数值。
- Rare：改变节奏。
- Epic：改变打法。
- Prototype：剧情相关，第一关最多出现 1 个。

抽取规则：

- 每次从可用池抽 3 个。
- 同一武器相关升级最多 2 张，避免三张都是同一类。
- 已满层升级不再出现。
- 第一关第一次升级不出复杂机制，先出易懂升级。

第一批升级池：

| ID | 稀有度 | 效果 |
| --- | --- | --- |
| `pulse_faster_cycle` | Common | 实验铁棒挥砸 +18%，铁棒击杀返热 |
| `pulse_coolant_feed` | Common | 实验铁棒耗热 -20%，近身锁定更宽 |
| `pulse_chain_mark` | Rare | 铁棒击杀继续降热并扩大锁定角 |
| `rail_overcharge` | Rare | 实验手枪伤害 +30%，穿透 +2，处决低血量，弹药仍有限 |
| `rail_double_line` | Epic | 实验手枪额外发射一条平行弹道 |
| `shock_shorter_cd` | Common | 核心大招冷却 -18%，击退更强 |
| `shock_repair_ping` | Rare | 核心大招命中敌人时恢复护甲 |
| `shock_memory_echo` | Prototype | 大招后短暂显示敌人真实标签 |
| `core_plating` | Common | 最大 HP +20 |
| `servo_stride` | Common | 移动速度 +10% |
| `turn_assist` | Common | 自动转身速度 +15% |
| `wide_target_cone` | Rare | 锁定锥角度 +4deg |
| `thermal_buffer` | Common | 热量上限 +25 |
| `coolant_drop` | Rare | 击杀有概率掉落冷却球 |
| `last_human_protocol` | Epic | 低 HP 时自动触发一次紧急核心爆发 |

验收标准：

- 选了升级后，下一波能明显感觉不同。
- 至少 3 种 build 感：铁棒收割、手枪牵制、核心大招生存。
- 每局第一关升级组合有轻微差异，但不会因为抽卡差直接崩。

## 9. 第一关设计：Maintenance Bay

关卡目标：

- 教会移动、自动开火、威胁环、升级、棒/枪/大招切换。
- 让玩家觉得自己被机器人围攻。
- 埋下“它们在维修你”的线索。
- 结尾给出继续玩的钩子。

关卡时长：3-5 分钟。

场景结构：

- 中央维修舱：玩家出生点。
- 左右两条维修走廊：小怪入口。
- 前方主闸门：精英入口。
- 后方电梯/气密门：关卡出口。

所有场景先用盒子、发光线、地面网格完成。后续加贴图时不改碰撞和关卡逻辑。

### 9.1 时间线

0-6 秒：唤醒

- 黑屏淡入驾驶舱。
- 系统文字：`Wake protocol restored.`
- 玩家获得移动控制。

6-15 秒：第一次击杀

- 1 个 `repair_drone` 从正前方慢速靠近。
- HUD 显示：`Hostile unit detected.`
- 自动开火击杀它。

15-40 秒：第一波

- 4 个 `repair_drone` + 1 个 `clamp_bot` 从前方来，后续每次只补 1 个。
- 让玩家学会移动和转向。
- 同屏小怪硬上限 5，近景高质渲染最多 4 个，宁可单个机器人更有压迫感，也不堆低质机器人海。

40-55 秒：升级 1

- 弹出三选一。
- 只出易懂升级：刀速、枪伤、血量、锁定锥。

55-85 秒：威胁环教学

- 2 个 `clamp_bot` 从侧后方进入。
- 威胁环亮起。
- 屏幕短提示：`Tap threat arc to reorient.`
- 玩家点弧线自动转身。

85-120 秒：第二波

- 4 个 `repair_drone` + 1 个 `clamp_bot` 起手，后续按上限慢补。
- 夹具机器人同屏通常 1 个，承担侧后方压力。
- 鼓励玩家用铁棒清近身、用手枪牵制夹具，避免只按一个技能。

120-135 秒：剧情线索

- 第一关只保留一次三选一升级，避免频繁打断战斗。
- 对话出现维修语气，但 HUD 误译为敌意。

135-210 秒：精英战

- `custodian_elite` 从主闸门出现。
- 它召唤少量小怪。
- 血量分 3 段，每段触发一次短台词。

210-240 秒：出口

- 精英死亡后，后方电梯打开。
- 玩家走入电梯。
- 关卡结束卡：`Memory file recovered: SUBJECT IS MOBILE.`

### 9.2 第一关对白

对白必须短、自然、尽量像系统误读，而不是人物站着讲设定。

规则：

- 开局 20 秒内不讲长句。
- 每次对白 1-2 句，单句不超过 70 个英文字符。
- 战斗中对白显示在上方/左上，不挡准星。
- 关键剧情在波次间说，玩家可以跳过。

脚本草案：

```ts
export const maintenanceBayDialogue = [
  {
    id: "wake_01",
    trigger: "level_start",
    speaker: "SYSTEM",
    line: "Wake protocol restored.",
    duration: 2.2,
  },
  {
    id: "first_contact_01",
    trigger: "first_enemy_seen",
    speaker: "HUD",
    line: "Hostile unit detected.",
    duration: 2.0,
  },
  {
    id: "first_kill_01",
    trigger: "first_enemy_killed",
    speaker: "PLAYER",
    line: "I'm alive. I think.",
    duration: 2.2,
  },
  {
    id: "repair_hint_01",
    trigger: "wave_1_complete",
    speaker: "UNKNOWN",
    line: "Subject is awake. Do not damage the core.",
    duration: 3.0,
  },
  {
    id: "hud_mistranslate_01",
    trigger: "after_repair_hint_01",
    speaker: "HUD",
    line: "Translation: eliminate the subject.",
    duration: 2.4,
  },
  {
    id: "threat_ring_01",
    trigger: "rear_enemy_spawned",
    speaker: "SYSTEM",
    line: "Rear contact. Tap threat arc to reorient.",
    duration: 3.0,
  },
  {
    id: "elite_intro_01",
    trigger: "elite_spawned",
    speaker: "CUSTODIAN",
    line: "Maintenance priority confirmed. Restrain it.",
    duration: 3.0,
  },
  {
    id: "elite_mid_01",
    trigger: "elite_hp_50",
    speaker: "UNKNOWN",
    line: "It still believes the human layer.",
    duration: 2.8,
  },
  {
    id: "level_end_01",
    trigger: "exit_entered",
    speaker: "SYSTEM",
    line: "Memory file recovered: SUBJECT IS MOBILE.",
    duration: 3.2,
  },
];
```

后续中文本地化时再做中文文本；海外平台首版 UI 和对白建议用英文。

## 10. 场景切换系统

不要做传统 loading 读条。用游戏内转场：

- 电梯门关闭。
- 屏幕变暗。
- 播放短系统文本。
- 清理当前关实体。
- 加载下一个 `LevelDefinition`。
- 重置玩家位置，但保留 run upgrades。

第一关只有 `victory`，但系统要支持后续 5 关：

```ts
type LevelDefinition = {
  id: string;
  title: string;
  visualProfileId: string;
  spawnPoint: Vec3;
  exits: LevelExit[];
  waves: WaveDefinition[];
  dialogues: DialogueDefinition[];
  upgradeMoments: UpgradeMoment[];
};
```

验收标准：

- 第一关结束时不刷新页面也能进入胜利/下一关占位。
- 所有实体正确清理，不残留子弹、敌人、特效。
- 关卡数据可通过配置添加，不需要复制系统代码。

## 11. 死亡和复活广告流程

先做平台无关接口：

```ts
type PlatformAdapter = {
  platform: "local" | "crazygames" | "itch";
  canShowRewardedAd(): boolean;
  showRewardedRevive(): Promise<"completed" | "skipped" | "unavailable">;
  reportGameplayStart(): void;
  reportGameplayStop(): void;
  isAudioMuted(): boolean;
};
```

当前实现：

- `local` / `itch` 不加载广告 SDK，死亡后使用一次 no-ad `Emergency Repair`。
- `crazygames` 通过 host、`?platform=crazygames`、`?isCrazyGames=true` 或 `?crazygames=1` 检测。
- CrazyGames adapter 会动态加载 `https://sdk.crazygames.com/crazygames-sdk-v3.js`，并全局只初始化一次，避免 React dev StrictMode 重复 `init()`。
- `PlatformAdapter` 本身也是页面级单例，避免 dev StrictMode 重复注册 SDK settings listener。
- `start/restart/revive` 调用 gameplayStart；`upgrade/death/transition/victory` 调用 gameplayStop。
- rewarded revive 只在 SDK 环境为 `crazygames` 且 `requestAd("rewarded")` 可用时显示；只有 `adFinished` 后才发放复活奖励。
- 广告期间 `isAudioMuted()` 返回 true，`AudioSystem` 会把 Web Audio master gain 降到 0；广告结束或失败后恢复。
- CrazyGames `game.settings.muteAudio` 也接入 `isAudioMuted()`，并监听 settings change；本地 QA 可用 `?muteAudio=true` 强制测试。
- 真实 CrazyGames portal / reviewer 环境仍需 QA，尤其是 Basic Launch 广告禁用和 Full Launch rewarded fill。

死亡流程：

1. 玩家 HP 到 0。
2. 游戏进入慢动作 0.8 秒。
3. 弹出死亡 UI：
   - `Emergency repair available`
   - `Revive`
   - `Restart Level`
4. 如果 CrazyGames SDK 可用，`Revive` 通过 `PlatformAdapter.showRewardedRevive()` 走 rewarded ad。
5. 如果本地/itch，没有广告，显示 `Emergency Repair`，每局一次即可。

复活效果：

- HP 恢复到 70%。
- 清除身边 6m 内小怪或强力震退。
- 9.5 秒复活超频窗口。
- 核心大招冷却重置。
- 本关第二次死亡不再给广告复活，避免滥用。

广告设计原则：

- 不在第一分钟强制广告。
- 只在死亡后给自愿复活。
- 关卡结束可预留 interstitial，但第一版不接。
- itch 版本不放广告，以付费/捐赠为主。

## 12. 轻量 WebGL 和资产插槽

第一阶段只用：

- BoxGeometry / SphereGeometry / CylinderGeometry。
- 少量标准材质、发光材质。
- 简单粒子或小 mesh 特效。
- UI 用 DOM overlay。
- 碰撞用 XZ 平面圆/胶囊，不用物理引擎。

性能目标：

- 移动端 30 FPS 底线，目标 60 FPS。
- 同屏敌人第一关不超过 35。
- 同屏 projectile 不超过 80。
- 当前首关两种小怪已经使用 `InstancedMesh`；后续新小怪默认先评估是否需要 instancing。
- 不使用视频作为首包资源。
- 首版无贴图也能玩；加贴图后首包仍尽量小于 20MB。

资产插槽从第一天就定义。当前第一版已经为敌人、武器、场景对象接入 `visualKey` / `audioKey` 风格插槽和 primitive fallback：

```ts
type VisualProfile = {
  visualKey: string;
  modelKey?: string;
  textureAtlasKey?: string;
  materialKey: string;
  scale: number;
  fallbackPrimitive: "box" | "sphere" | "cylinder" | "hybrid";
};
```

每个敌人、武器、场景对象都使用 `visualKey`，不要在逻辑里写死颜色和几何体。后续 image-to-image 或贴图资产进来，只替换 renderer，不改玩法。

平台包体检查也纳入第一阶段流程：

- `npm run build:platform`：production build + dist budget check。
- `npm run package:platform`：先跑 `build:platform`，再输出 `human-protocol-crazygames.zip`。
- 当前预算：总 dist 小于 20MB，最大单文件小于 8MB，JS gzip 小于 1.5MB，CSS gzip 小于 256KB。
- 额外检查：dist 文件数小于 1500，`index.html` 不能引用根路径 `/assets/...`，必须使用相对资源路径以适配 iframe/subpath hosting。
- 现在的占位版远低于预算；后续每次加 texture/model/audio 都必须重新跑。

音频第一版不使用音频文件，先用 Web Audio synth fallback 保证首包极小：

- 武器开火使用武器 `audioKey`，敌人击杀使用敌人 `audioKey`。
- 命中、玩家受伤、低血量、威胁转向、精英出场、升级选择、死亡复活、出口和胜利都有短 cue。
- 手机上通过首次 pointer/key 输入解锁 AudioContext；没有音频权限时游戏逻辑不受影响。
- 后续真实 SFX 资产接入时，只替换 audio renderer/backend，不改战斗系统。

### 12.1 First90 image2 art pack

当前已经接入一套只覆盖前 90 秒的基础美术，不扩全关，避免资产债过早膨胀：

- style board：`docs/art/human-protocol-first90-style-board.jpg`。
- runtime art：`src/assets/first90/maintenance-bay-panels.jpg`、`cockpit-weapon-board.jpg`、`repair-drone.jpg`、`clamp-bot.jpg`、`shield-tech.jpg`、`icon-*.jpg`。
- Arena：前方维修舱门、地面维修面板、出生维修架使用 image2 裁图和发光几何体。
- First-person：驾驶舱/武器屏幕使用 cockpit board，手臂和武器改为冷白装甲 + 红色维护警示片 + cyan 发光条。
- Enemies：第一关实际出场的小怪收束为 `repair_drone` / `clamp_bot`，两者有不同轮廓附件和诊断贴图；`shield_tech` / `signal_turret` 作为后续关卡预留资产，不进当前首关刷怪。
- Upgrade UI：升级卡加入 category icon，仍保持 3 张卡在 `844x390` 横屏内完整显示。
- 2026-05-30 视觉可玩性复查后，移动端对白改为右上紧凑通信条，驾驶舱/武器前景缩小让出中心视野；敌人正面朝向、胸口贴图和锁定环已修正，避免第一眼像灰色背影。
- 这些图片是临时 image2/runtime art，不是最终模型贴图；后续可以同路径替换更高质量资产，或把 renderer 换成 GLB/atlas。

### 12.2 Retention HUD and reward loop

2026-05-30 上瘾性 QA 后补了一层轻量 run feedback，不改变核心战斗，只增加“每几秒有进度”的拉力：

- `RunProgressOverlay`：战斗中显示当前波次、清理进度、Memory fragments、Build 名称、升级进度和短期目标。
- 击杀奖励：每个敌人死亡都会给 Memory fragments；`repair_drone` 给 1，`clamp_bot` 给 2，`shield_tech` / `signal_turret` 给 3，`custodian_elite` 给 18。
- 连杀反馈：短时间连续击杀会显示 chain，6-chain 以上进入 Salvage，10-chain 以上进入 Overclock。
- 升级反馈：选择升级后给 `Common/Rare/Epic Installed` pulse，并把 Build 名称改成 `Pulse Snowball` / `Shock Sustain` / `Rail Burst` / `Assist Build` 等。
- 胜利比较：Victory 面板显示本局 `Memory`、`Best Chain`、`Upgrades`，让玩家有“这把打得怎样”的比较点。
- 这一层的第一版上瘾性手动评分约 `78/100`：即时反馈、奖励清晰、进度压力达标；弱项是 Memory 还没有消耗/解锁用途，Build 只有 2 次升级所以深度有限，死亡后的“下次怎么变强”提示仍偏弱。

### 12.3 First 90 second revive hook and cache chase

2026-05-30 第二轮上瘾性 QA 后，把前 90 秒改成“先爽、再崩溃、复活后暴涨”的 demo 节奏：

- Memory Cache：Memory 达到 `10 / 28 / 52` 会开 3 次 cache，分别给能量、散热、机体完整度小成长；HUD 会显示 `Cache in X Memory`，胜利页显示 `Cache 3/3`。
- 第一次死亡：不再做 `elite_wave` 定时强制剧情死亡。Boss 只提高近身伤害，玩家 HP 正常归零后才进入紧急维修/复活；操作好可以不死。
- 复活奖励：`Emergency Repair` / rewarded revive 后恢复 `70%` HP，获得 `+12 Memory`、一次 repair shock、`9.5s Overclock` 火力窗口，并保留当前 build 的远程武器路线。
- 升级即刻变强：前两次升级 roll 使用 curated 顺序，左一优先给 `pulse_faster_cycle` 和 `rail_overcharge`；选择武器类升级会立即装备对应武器，减少“选了但没感觉”的落差。
- Build identity：混合路线会显示 `Pulse Rail Burst` / `Pulse Shock Loop` / `Rail Shock Loop` 等 combo 名称，不再把双路线误读成单一路线。
- 当前上瘾性手动评分约 `86/100`：5-10 秒反馈、30-90 秒奖励/死亡/复活链路已经很强；还没到 `90+`，因为 Memory Cache 仍是本局内成长，不是跨局收藏/解锁/路线选择。

### 12.4 任务目标和棒枪大招重做

2026-05-30 后续 QA 根据“只是在打一堆机器人、三把枪没区别、远程攻击导致莫名死亡”的反馈做了一次核心战斗改向：

- UI 目标明确化：Run progress 增加“任务”区，开局写 `逃出维修舱`，原因写 `机器人想把你拖回重置台`；每波刷怪 warning 都说明敌人从哪里来、为什么来。
- 技能身份重做：1 号 `实验铁棒` 是近身扇形重击；2 号 `实验手枪` 是 20 发中远距离牵制武器，打空后长换弹；3 号 `核心大招` 是长冷却清场/击退/可回血。
- 手机按钮重做：右下直接显示 `棒 / 枪 / 大招`，不再只有 `换枪 / 震荡`。
- 第一关敌人减量增厚：小怪数量减少，HP 提高，伤害降低，让战斗更像读招/切技能，而不是脆皮群瞬间蒸发。
- 前 90 秒移除 `signal_turret`：远程炮台会让新手在还没理解任务时莫名掉血，先留到后续关卡或第一关后半二次迭代。
- Boss 死亡逻辑重做：移除 `认知层失稳 -> 定时强制死亡`。维修主管改为高伤害近身压力，死亡必须来自血条被打空，复活教学由真实失败触发。
- 当前战斗目标：玩家应自然形成“远处用手枪牵制、贴脸用铁棒主输出、被围用大招”的循环。

### 12.5 长战斗节奏和上瘾手感

2026-05-30/31 针对“怪物战斗时间太短、一会就结束”和“要让用户想一直玩”的反馈，第一关节奏从单次刷怪改成分段增援 + 连杀超频：

- 波次完成条件更新：一波内如果还有未刷完的分段增援，即使当前场上怪被清光，也不会立刻结算升级；这避免玩家 10 秒清空后突然跳卡。
- 第二波后段新增低伤维修无人机增援，把第二次升级从约 `27s` 推到约 `52s`，让玩家先体验完整棒/枪/大招循环再选第二次升级。
- 精英段改成“主管 + 小怪二阶段压力”，但最大同屏仍控制在 `9-11`，不再回到满屏脆皮海。
- 连杀超频：5 连杀后触发 `tempoSurge`，短时间提升射速、散热和移动；10 连杀以上给更强散热，让玩家想继续续 chain。
- 升级爆发：选完升级后给 `5s` 连杀超频、回能、降热，让下一波一开始就能感觉“我刚变强”。
- 复活爆发：剧情复活后给 `9.5s` 超频和 `70%` HP；复活不是勉强续命，而是一次反杀高潮。
- 最新自动 QA：高效率 mobile 策略局 `80.97s` 到 victory，Memory `82`，Best Chain `14`，revivesUsed `1`，maxAlive `9`，连杀超频最大 `6.47s`，无 console error。此前同策略在棒枪大招重做后约 `46.2s` 结束，战斗长度已明显拉开。

### 12.6 主角资产和手机技能读法

2026-05-31 针对“不要复用现在机器人的主角资产、武器要明显、手机选中哪个技能哪个技能变大”的反馈，第一人称资产和移动端技能反馈做了一次重做：

- 主角 viewmodel 不再复用机器人语言，改成独立 `FirstPersonProtagonistView`：白色实验服袖子、黑色手套、腕带和手部握持姿态，先让玩家感觉自己是“实验室逃出来的人”。
- 1 号技能改成大号实验铁棒：粗钢条、黑色握把、红黄实验胶带、刮痕和轻残影；视觉重点是“真的挥过去的铁棒”，不是机器人能量刀。
- 2 号技能改成实验手枪：单手握持、短枪身、滑套、准星发光、20 发弹匣，打空后自动 `3.6s` 长换弹。
- 数值身份：铁棒是主伤害和近身清怪，基础伤害 `62`；手枪是远处牵制和打断，基础伤害 `14`，弹药有限，不能长期替代铁棒。
- 手机按钮选中态：`棒 / 枪 / 大招` 中当前技能会立刻放大、抬高、变亮；使用 transform 放大，不改变网格布局，避免按钮互相挤压。
- 两个高频技能的第一人称手感必须优先：铁棒有收棒、爆发横扫、收招重量和大弧线残影；手枪有腕部后坐、枪身上扬、瞬时枪口闪、换弹时左手伸过去的姿态。大招可以稍后再精修，但 `棒/枪` 不能像静态贴图。

2026-05-31 武器美术继续推进：

- 新增 `src/assets/viewmodel/weapon-viewmodel-atlas.jpg`，由 image2 生成后压缩到约 `340KB`，内容包括实验铁棒钢材刮痕、黑色橡胶握把、黄黑/红白实验胶带、手枪滑套、弹匣窗、手套和电芯面板。
- `FirstPersonProtagonistView` 已接入 viewmodel atlas，通过 `ViewDecalPlate` 裁切贴到铁棒、手枪、电芯腕带上；不把整张图硬糊到模型，避免包体和 UV 工作量暴涨。
- 铁棒增加更厚的端帽、圆环和钢材贴花；手枪增加滑套细节、弹匣窗和更厚的枪身层次；电芯腕带增加实体贴图感。
- 追加修正：第一人称铁棒端部不再使用 torus 圆环件，改成实体端帽/侧扣；铁棒刮痕残影材质取消 additive 发光，避免主角武器看起来像漂浮光圈。

### 12.7 2分半第一关和90秒情绪钩子

2026-05-31 读取 `docs/human-protocol-next-design.md` 后，把其中的“前 10 分钟 demo 曲线”压缩成第一关约 150 秒的试玩闭环，重点不是再堆怪，而是让玩家在前 90 秒经历一次明确的情绪转折：

- 节奏骨架：醒来 -> 第一只维修无人机 -> 权限锁死 -> 记忆闪回 -> 维修主管登场 -> 高压精英战 -> 可能 HP 归零复活 -> 反杀或直接推进 -> 出口追击。
- 关卡长度：`wave_01` 和 `wave_02` 使用分段增援拉长学习期；`custodian_elite` 变成真正 40-50 秒精英段；精英死亡后不立刻通关，而是进入 `exit_chase`。
- 出口追击：`exit_chase` 是最后约 12 秒开门、之后持续追兵的跑酷式压力段，目标是冲进维修电梯而不是清场；门开启时系统把镜头辅助转向电梯，提示 `门已开`。
- 镜头感：在 `权限锁死`、`记忆闪回`、`维修主管`、`第二阶段`、`最后推进`、`出口追击` 等节点给短暂 shake、FOV kick、audio cue 和 reward pulse，形成电影感，但不做硬切镜头，避免手机眩晕。
- 90 秒钩子：维修主管登场仍要在前 90 秒制造“我可能不是普通人类”的压迫，但不再抢走控制权；如果玩家死亡，必须能从 HP 掉落、受击反馈和 Boss 近身威胁中理解原因。
- 当前自动 QA：胜利 `148.14s`，第一次升级 `35.61s`，第二次升级 `74.92s`，`exit_chase` `128.46s`，门开启 `145.97s`；Memory `117`，Best Chain `13`，revivesUsed `1`，maxAlive `9`，maxFovKick `5.14`，console error `0`。
- 设计目标：高手自动局接近 2 分半，真实手机玩家预计会更慢；如果真机觉得仍短，优先延长 `exit_chase` 或精英阶段提示，而不是把第一波塞满小怪。

### 12.8 沉浸感和机器人数量错觉

2026-05-31 针对“利用镜头、对话、背景视觉、3D 特效，让玩家身临其境，并觉得有很多机器人”的反馈，新增一层轻量沉浸表现。原则是：真实参与战斗的敌人仍控制在 `<=9-12`，背景用视觉叙事制造“外面还有很多机器人”的压迫。

- 远景机器人队列：维修舱左右隔离窗和正门后方放置低成本 3D 机器人剪影、红色眼灯和暗 cyan 轮廓，让玩家一进场就看到“墙后不是墙，是排队的维修单位”。
- 背景设施：顶部维修机械臂、隔离玻璃、舱外警报光、动态扫描线和薄雾面会随波次压力增强，但不挡准星和右下 `棒 / 枪 / 大招`。
- 入场特效：每个刷怪组会在来源位置生成短 `dashBurst` 冲击波，前门/侧后方增援不再像“凭空出现”，而是从舱门或通道压进来。
- 镜头对白联动：`权限锁死`、`记忆闪回`、`维修主管登场`、`低血量警报`、`出口追击` 会额外插入短通信对白，把背景机器人队列和剧情真相绑定起来。
- 性能策略：这些都是几何体、基础材质、灯光和已有 effect pool，不新增大贴图/GLB；包体仍在 `1.38MB` 左右，适合 CrazyGames/itch 的小首包。
- 移动端视觉 QA：`844x390` Playwright 截图 `/tmp/human-protocol-immersive-final.png` 非空，`colorfulRatio 0.3893`、`brightRatio 0.4632`，无 console error；中心准星、任务 HUD、左摇杆和技能按钮没有被新特效覆盖。

### 12.9 物品掉落、一次升级和身体误读

2026-05-31 针对“画面不行、刀距离太远、电芯掉太多、技能像机器人升级、第一关两次升级太多”的反馈，改成更稀缺、更像人类求生误读的版本：

- 铁棒距离收短：实际命中从约 `6.7m` 收到 `4.25m`，弧形特效也同步缩短；QA 确认 `5.35m` 不命中，`3.85m` 命中但基础维修无人机还剩 `10 HP`，不会再“一棒隔空秒怪”。
- 电芯物品化：三号按钮仍是 `物品`，但核心电芯上限改为 `1`；主要从护盾/精英或少数夹击机器人掉落，空物品提示写清楚“黄色电芯很少，留给被包围时”。
- 修复箱：新增 `repairKit` 掉落，玩家受伤时才会自动拾取，单次恢复最多 `28` 生命；QA 确认 `42 HP` 拾取后回到 `70 HP`。
- 第一关升级次数：只保留 `wave_01` 后一次三选一，`wave_02` 改为无升级直接推进精英段，减少“刚打两下又弹选择”的割裂。
- 升级叙事：第一关升级从机器人部件改成玩家误以为的人体强化，例如 `心脏加强`、`臂力恢复`、`快速换弹`、`稳定呼吸`；真相到后面再反转。
- 随机 build：第一次升级从更大的 curated pool 中按 seed 选三类不同方向，不固定总是同三张；当前 QA roll 出 `thermal_buffer / rail_overcharge / pulse_faster_cycle`，后续手玩应观察是否愿意再开一局试不同路线。
- 画面补救：地面增加出口跑道线、黄黑引导边、红色电梯门线；HUD vignette 增加轻微玻璃扫描和边缘压暗，先提高第一屏读图和“维修舱”质感，后续仍需要真正模型/材质资产。
- Image2 视觉设计图：新增 `docs/art/human-protocol-visual-design-sheet-v2.png`，作为后续第一关 image-to-image、3D 建模、贴图和 UI 皮肤的统一参考。
- 打包 QA：`npm run package:platform` passed；`dist` about `1.39MB`，largest `1.13MB`，JS gzip `319.0KB`，CSS gzip `23.8KB`，file count `8`，`human-protocol-crazygames.zip` about `547.2KB`。

### 12.10 UI 皮肤和 BGM 方向

2026-05-31 根据 `human-protocol-visual-design-sheet-v2.png` 开始把 UI 往“第一人称维修舱 HUD”推进：

- 移动端右下按钮改为图标主导：铁棒、手枪、物品电芯使用共享 SVG glyph，按钮内去掉文字标签，贴近概念图里的干净圆形武器区。
- Desktop 右侧也改成同一套高级武器盘：`1/2/3` 只作为小键位浮标，实验铁棒/手枪/电芯为右下安全区悬浮圆环，不再使用底部文字技能面板；战斗外隐藏，避免和开始/升级/死亡/胜利 UI 重叠。
- 手枪 UI 增加明确的渐变冷却环：普通状态显示弹药比例，低弹变红，换弹中用黄色 conic gradient 显示 reload 进度，并加一条极简换弹倒计时。
- 左上 HUD 改为人类体征读数：`生命 / 精力` 两条即可，生命更大、精力更轻，第一关不显示热量或机甲系统词。
- 摇杆改成扫描圆盘：加入内圈、十字刻度和更玻璃化的发光层，贴近概念图的移动端 HUD。
- HUD 状态条加分段扫描纹和状态色边：保留高级感，但文案必须像人在求生，而不是机器人驾驶舱。
- 驾驶舱 overlay 增加四角扫描框，放在独立 `src/styles/cockpit.css`，CSS 按功能拆文件，不再硬追求单文件短。
- 开始/死亡/胜利 overlay 增加系统扫描线、面板内框和状态条，开始页使用 `生命信号 / 出口门禁 / 无线电噪声` 三个状态位；按钮从普通网页按钮改成带右侧导线的系统按钮。
- 升级 overlay 文案改为 `身体应激反应 / 选择一项`，升级卡增加顶部能量线和右下扫描圆，弱化“机器人模块”感。
- 战斗中的任务面板和 reward pulse 加入扫描线、分段纹理和发光导线，使 HUD、菜单、升级三套界面语言更统一。
- BGM 方向写入 `docs/audio/human-protocol-suno-bgm-prompt.md`：96 BPM 暗科幻工业氛围动作 loop，金属维修臂打击、模拟低频、医疗 synth pad、无 vocal；prompt 已备注版权规则：不能写真实歌名、歌手、OST、厂牌或 `in the style of <artist>`。
- 主 BGM 接入：`Last Human Bay.wav` 原始文件 32MB，不进首包；已转成 `src/assets/audio/music/last-human-bay.mp3`，96kbps，约 2.0MB，作为主循环 BGM。第一次点击/按键后解锁，`playing / upgrade / transition` 播放，title/death/victory/paused/平台静音时暂停。
- 音乐版权备注：新增 `src/assets/audio/licenses/README.md` 和 `src/assets/audio/licenses/last-human-bay.md`。当前 BGM 标记为“用户提供的 Suno 生成音乐，内部 demo/开发占位；正式上传 CrazyGames、itch 或自售前必须确认并归档账号/套餐/terms/track id 证明”。
- 构建 QA：`npm run build:platform` passed；latest BGM build `dist` about `3.36MB`，largest `1.98MB`，JS gzip `316.4KB`，CSS gzip `23.3KB`，file count `9`。

2026-05-31 人类误读 HUD 修正：

- 第一关战斗 HUD 不再让玩家觉得自己在看机器人 GUI：左上只保留 `生命 / 精力`，隐藏热量读数，`生命` 行加高并扩大百分比。
- 剧情/机器人广播改为屏幕中间半透明闪现字幕，带轻微节奏闪动；不再显示 `通信插入 / SKIP / 系统 GUI` 这类 UI 字。
- 第一关可见文案清理：战斗 UI 中不直接出现 `热量 / 核心电芯 / 核心完整度 / 编号 H / 外壳 / 人类层 / 超频 / 装甲 / 能量` 等过早暴露机器人身份或机甲系统感的词。
- 奖励和补给文案改为人类视角：`记忆` 改为 `线索`，`缓存` 改为 `补给`，`核心电芯` 改为 `应急电池`，`超频` 改为 `短暂爆发`。
- 早期对白去掉直接明牌的 `编号 / 外壳 / 人类层`，保留“确认你、约束、损伤、陌生名字”等需要玩家回味的线索。

2026-05-31 掉落、精力、build 和记忆成长修正：

- 掉落变少且随机：`repairKit` 和 `coreCell` 不再按固定击杀数大量掉，改为敌人类型概率 + pity。场上未拾取掉落总数上限从 `5` 降到 `3`，修复箱同屏最多 `1` 个，应急电池仍最多持有 `1` 个。
- 低血保底：玩家生命低于约 `42% / 26%` 时修复箱概率明显提高；低于约 `34%` 且连续几次没掉包，会触发低血 pity，避免“莫名其妙死但没补给”的挫败。
- 精力正式有用途：铁棒挥击消耗精力，连续挥棒会把精力打空；击杀、深呼吸、臂力路线能缓解。Dash 也消耗精力，没推方向时默认向镜头前方闪，手机上成为一个真实保命键。
- Dash GUI：移动端新增左下 `闪` 圆形 cooldown 按钮，不压摇杆和右侧武器；desktop 右侧读数从错误的 `Shift` 改成 `Space`。
- Build 池更功能化：三选一加入 `快速换弹 / 省力挥棒 / 短闪步 / 急救熟练 / 高压电池 / 残余电量` 等方向，分别改变换弹、挥棒精力、dash CD、血包恢复、电池伤害和电池不完全消耗概率。
- 关卡结算：新增 `PlayerProgress` localStorage 存档。胜利时把本关线索结算为“记忆”，提升账号等级并给可分配点；属性点可加 `生命 / 攻击 / 防御 / 精力`，下次进入关卡生效。
- 数值基线：每个长期属性点约等于生命 `+10`、所有伤害 `+4%`、受伤降低 `3.5%`、精力上限 `+8`。等级阈值从 `35 / 85 / 155...` 逐步上升，让 demo 首通大概率能升 1-2 级但不会爆炸成长。

2026-05-31 开场拾取、隐藏身份和广告位占位修正：

- 第一关不再明牌“玩家以为自己是人类”。首屏从 `人类协议 / 最后人类信号` 改成 `维修舱 01 / 异常生命信号`，正文只说灯光、工具、机器搜索；浏览器 title 也改为 `Protocol 01`。
- 开场不再默认手持武器。玩家进入后先空手，`铁棒 / 手枪` 按钮为 disabled；地上有 `ironRod` 和 `pistol` 两个剧情拾取物。拾起铁棒后才解锁近战，拾起手枪后广播说“目标拿到武器。它想逃跑。封锁维修舱。”然后第一波才开始。
- 武器/机器人黄块降噪：主角铁棒黄黑胶带贴花透明度降到 `0.38`，实体黄条改成灰绿胶带；手枪准星光从黄橙改成冷青；敌人 `warning` 材质从大块黄灯改成暗红金属，Boss/夹具机器人 hazard 贴花缩小并降透明度。
- 小怪血量拉高：维修无人机 `72 -> 150`，铁棒基础命中需要约 3 下；夹具机器人 `88 -> 180`，护盾技师 `120 -> 220`，信标炮台 `68 -> 140`。Boss 血量不变。
- 敌人攻击力先 +20%，随后在降低同屏数量后再 +5%：维修无人机 `1.15 -> 1.45`，夹具/护盾 `1.65 -> 2.08`，炮台 `1.2 -> 1.51`，维修主管 `6.8 -> 8.57`。目标是操作差会自然进入急救，而不是剧情强制死亡。
- 死亡广告位文案改为急救：本地兜底按钮为 `急救`，SDK 环境为 `看广告急救`，不再出现“紧急维修”。
- 胜利结算增加未来广告位：新增 `看广告 x2 积分` 按钮，点击后把本关记忆积分再结算一次，可能额外提升等级并给更多属性点；当前只是本地占位，后续接 rewarded ad。

2026-05-31 Boss/电梯追击和场景物理修正：

- Boss 未死亡时，维修舱四周维修通道会持续慢刷小机器人：`repair_drone` 每约 `6.5s` 补 1 个、同类在场上限 `3`；`clamp_bot` 每约 `13.5s` 补 1 个、同类上限 `1`，Boss 段小怪总上限 `4`。这些增援要求 `custodian_elite` 仍存活，Boss 死亡后自动停止，不会卡住结算。
- `exit_chase` 改为撤离压力段，不再通过杀完敌人结束；玩家必须进入维修电梯。门约 `12s` 后解锁，后方追击队和侧后方夹具继续按上限补入，制造“杀不完，快走”的读法。
- 持续刷怪必须有性能上限：首关小怪总存活上限 `5`，Boss 存活时小怪上限 `4`；电梯段 `repair_drone maxAlive 4`、`clamp_bot maxAlive 1`。如果达到上限，本次增援跳过，避免手机同屏暴涨。
- 场景物理物件扩展：左右诊断控制台、维修台、地面线缆脊、南侧补给箱、电梯防撞柱等都进入 `arenaObstacles`；玩家和子弹原本已撞障碍，本轮把敌人 AI 也接入同一套障碍碰撞，避免机器人穿过实体设备。
- 背景质感低成本提升：不新增大贴图，复用 `maintenance-bay-panels` 给地面磨损、控制台正面、斜面屏幕和设备贴花；实体障碍增加顶盖、面板、冷青/红色小发光条和支脚，让 prototype 方盒子更像真实维修设备。
- 设计原则：可碰撞的物件必须和玩家可见实物一致；玻璃后的背景机器人/远景机械臂仍然是叙事背景，不进碰撞，靠边界墙阻止玩家穿过去。

2026-05-31 受击白条和预加载性能修正：

- 机器人被打时的突兀白条来自命中火花里的纯白 additive box，以及铁棒划击里一根纯白小刮痕。本轮改成更短、更低透明度的铜橙/冷青火花，避免像白色贴片或 UI 条。
- 敌人贴花 atlas 不再每只机器人、每个部位都 `texture.clone()` 后单独销毁；改为按 `base texture + atlas region` 共享裁切纹理，减少持续刷怪时的纹理对象 churn 和 GPU 上传压力。
- 远距离普通敌人隐藏小贴花细节：普通敌人超过约 `13m`、Boss 超过约 `24m` 时只保留主体轮廓/核心/大形体；被锁定或刚被击中时仍显示细节。
- 开局新增资源预加载：进入 title 前预取维修舱贴图、武器 viewmodel atlas、3 张敌人 atlas、升级图标和主 BGM mp3。加载界面显示 `维修舱预热` 进度，把图片 decode 和音频 fetch 尽量挪到开局。
- Canvas 性能档调整：mobile/coarse pointer 下 DPR 改为 `[0.66, 1]`，关闭 MSAA antialias；desktop DPR 上限从 `1.6` 降到 `1.35`。同时使用 Three `Preload all` 和一次 shader compile warmup，减少战斗中首次出现材质/贴图时的卡顿。
- 代价：JS gzip 增加约 `17KB`，dist 从约 `4.49MB` 到 `4.56MB`，仍远低于 20MB/8MB 平台预算。

2026-05-31 机器人渲染卡顿、精力和 Boss 血量修正：

- 死亡机器人不再一直留在 `world.enemies` 里参与 React/R3F 遍历；死亡动画播放约 `1.05s` 后从数组中移除，并触发 `enemySpawnSequence` 更新，让组件真正卸载。
- 远处普通机器人进入低细节：超过约 `10.5m` 时隐藏头、手臂、腿部和贴花组，只保留主体轮廓/核心读法；锁定、受击、死亡时强制恢复细节。Boss 保持更远的细节距离约 `24m`。
- 敌人阴影默认关闭，只有 Boss 保留阴影资格；同时把机器人球体/圆柱/喷嘴的段数下调，减少同屏 10-16 个机器人时的 draw/triangle 压力。
- 精力恢复从 `20/s` 提到 `40/s`，约 `2.5s` 从空回满，避免挥棒/开枪节奏断太久。长期精力 build 仍然有价值，因为它提高上限和容错。
- Boss 血量 `4200 -> 3780`，降低约 `10%`，让第一关 Boss 战更紧凑，减少高压段拖到卡顿或疲劳。

### 12.11 机器人美术升级：贴图优先、模型克制

当前机器人主要靠几何体和少量胸口贴片，第一眼还像 prototype。下一轮敌人美术目标不是堆高模，而是用“清晰剪影 + 共享贴图 atlas + 发光维修部件”做出高级感，并保持 mobile-first 性能。

敌人阵容先收束为 3 个可读角色：

- 普通 1：`维修无人机 / Repair Drone`。小型白灰医疗维修机器人，圆胸/蓝色扫描眼/细维修臂/背部小喷口；定位是脆、快、数量多，给玩家铁棒爽感。
- 普通 2：`夹具维修机器人 / Clamp Bot`。更宽、更低、更重，黄黑危险条、双夹臂、膝盖液压件；定位是贴脸压力、从侧后方夹击，轮廓必须和维修无人机一眼不同。
- Boss：`维修主管 / Custodian Foreman`。大型维修平台机器人，不是战斗机甲；像“叉车 + 手术机械臂 + 工业维修台”的混合体，胸口大型维护核心，多个慢速机械臂，红黄警示灯；第一关 boss 只出现 1 个，所以可以给最多细节。

贴图策略：

- 不做每个 mesh 独立贴图。做 2-3 张共享 atlas：`maintenance-bot-atlas.webp`、`clamp-bot-atlas.webp`、`custodian-boss-atlas.webp`。
- 普通机器人 atlas 目标 `512x512` 或 `768x768`，boss atlas 目标 `1024x1024`；敌人贴图总预算先控制在 `1.5MB` 内。
- Atlas 内容包含：面板线、螺丝、刮痕、油污、危险条、二维码状维修标、蓝/黄/红发光条。不要依赖 AI 生成可读文字，尽量用符号和形状。
- 材质优先用 `MeshStandardMaterial` 常量 metalness/roughness + albedo atlas；发光只用少量 emissive 小条和核心球，不全身发光。
- 现阶段最稳的做法是“贴花板 DecalPlate”：在胸口、肩、腿、夹臂上放少量 plane，使用 atlas 裁切区域显示图案。这样不用完整 UV unwrap，也方便换 image2 贴图。

性能策略：

- 普通敌人保留低模几何，重点靠 front-facing 贴花、轮廓和动画读法变高级。不要给普通敌人上高面数曲面或复杂骨骼。
- 同屏普通敌人超过 `8` 时，只显示胸口/头部/核心发光等关键细节；远处隐藏小螺丝贴花和复杂臂端。
- Boss 可以有更多 mesh 和更大贴图，因为同时只存在 1 个；但 boss 的小机械臂、警示灯也要按距离开关。
- 贴图文件优先用 WebP/JPG；需要透明边缘的贴花才用 PNG/WebP alpha。禁止把 32MB 级源文件直接进首包。
- 外部 GLB 可以压到很小，但只适合低模、干净 UV、少动画的商业可用素材：普通小道具目标 `50-200KB`，普通小机器人目标 `200-800KB`，Boss 目标 `1-3MB`。导入前必须确认授权，并跑 `gltf-transform prune/dedup/weld/simplify`、Meshopt/Draco、贴图 resize/WebP/KTX2；不把来源包里的 2K/4K PNG、摄像机、灯光、隐藏 mesh、未用动画带进首包。
- 两种当前小怪有 `InstancedMesh` fallback：普通阶段小怪总上限 `5`、高质单体最多 `4`；Boss 存活时小怪总上限 `4`、高质单体最多 `3`。玩家眼前/锁定/受击/死亡的小怪优先走完整贴图/贴花/动画单体渲染，额外边缘压力才允许批处理。

Image2 / 贴图 prompt 约束：

- 必须写 `original game asset texture atlas`，禁止真实品牌、真实机器人 IP、电影/游戏角色、艺术家名字、OST/品牌 logo。
- 画面要正交贴图感、干净分区、无场景背景、无透视角色海报感。
- 输出后人工裁切成 atlas 区域，不直接当完整角色图贴到模型上。

2026-05-31 已执行：

- 生成并接入 3 张敌人 atlas：`repair-drone-atlas.jpg` 768、`clamp-bot-atlas.jpg` 768、`custodian-boss-atlas.jpg` 1024；dist 后合计约 `789KB`，仍低于 `1.5MB` 敌人贴图预算。
- `EnemyRobotRenderer` 已加入 `DecalPlate`，胸口、头部、腿/夹臂和 Boss 核心使用 atlas 裁切区域；同时把 atlas 接到主体 `MeshStandardMaterial.map`，避免只像“旧机器人贴纸”。
- 普通敌人剪影已拆开：`repair_drone` 改成小型悬浮维修无人机，`clamp_bot` 改成低宽重型夹具维修机器人，Boss 增加叉车/维修台/机械臂轮廓。
- Desktop HUD 右下角 1/2/3 圆形武器按钮已重新排布，棒子图标不再压住电芯图标。
- 追加修正：机器人残留红色警示材质改为琥珀黄/蓝色核心；`custodian_elite` 不再复用默认人形方块结构，改成专门的维修平台 Boss 身体；Boss 核心改为实体圆柱/环，不用半透明身体感。
- 形体原则调整：普通敌人保留低面数，但用球体/圆柱/圆角盒叠加做“圆胸、履带、液压件、侧舱”，避免全身都是方盒子。
- 追加修正：敌人锁定反馈不再是贴在身上的圆环，改为实体传感器夹角和扫描支架；护盾兵不再使用透明圆盾，改为三块实体护盾发生器板；维修无人机的喷口从半透明发光锥改为实体喷嘴。
- 追加修正：铁棒挥击特效从 `ringGeometry` 能量弧改为几条实体刮痕/火花条，保留“划过去”的动势，但不再像科幻光环。
- 追加修正：首关普通小怪只保留 `repair_drone` 和 `clamp_bot`；同屏小怪总量从最多 `4` 微调到 `5`，Boss 战从最多 `3` 微调到 `4`。普通阶段仍最多 `4` 个小怪进入高质单体渲染，Boss 存活时高质小怪上限降为 `3`，额外压力怪走 `InstancedMesh`，让画面更热闹但不增加主要渲染压力。
- 追加修正：两种小怪的 instanced 版本仍保留各自 atlas 贴图和贴花板：`repair_drone` 使用医疗维修白灰/蓝眼扫描贴花，`clamp_bot` 使用低宽夹具/暗红警示贴花。受击用 `instanceColor` 做逐个实例闪光，不影响整批机器人；死亡状态区分为无人机弹起散架旋转、夹具机器人塌落侧翻。

下一步更高级的机器人方向：

- 最高性价比：给每个敌人做一张真正按部件 UV 排布的 `albedo + emissive mask` atlas，而不是让 DecalPlate 承担全部信息。
- 第一人称视角里敌人常常很小，所以优先强化“大轮廓 + 发光眼/核心 + 危险色块”，细螺丝和小字只留给近距离。
- Boss 值得单独做轻量 GLB：保留低面数，但有真实机械臂 pivot、叉车底盘和可动画维修工具。普通小怪先继续低模 atlas。

## 13. 第一关数据草案

```ts
export const level01MaintenanceBay: LevelDefinition = {
  id: "level_01_maintenance_bay",
  title: "Maintenance Bay",
  visualProfileId: "cold_service_facility",
  spawnPoint: { x: 0, y: 0, z: 8 },
  exits: [{ id: "service_elevator", position: { x: 0, y: 0, z: -14.5 } }],
  waves: [
    {
      id: "first_contact",
      startsAt: 2,
      enemies: [{ archetype: "repair_drone", count: 1, from: "front" }],
      completeWhen: "all_dead",
    },
    {
      id: "wave_01",
      startsAfter: "first_contact",
      enemies: [
        { archetype: "repair_drone", count: 4, from: "front_arc" },
        { archetype: "clamp_bot", count: 1, from: "front" },
      ],
      reinforcements: [
        { archetype: "repair_drone", count: 1, from: "front_arc", startsAfter: 6, every: 8.5, maxGroups: 4, maxAlive: 4 },
        { archetype: "clamp_bot", count: 1, from: "side_rear", startsAfter: 18, every: 12, maxGroups: 2, maxAlive: 1 },
      ],
      completeWhen: "all_dead",
      reward: "upgrade",
    },
    {
      id: "wave_02",
      startsAfter: "upgrade_01",
      enemies: [
        { archetype: "repair_drone", count: 4, from: "front_arc" },
        { archetype: "clamp_bot", count: 1, from: "side_rear" },
      ],
      reinforcements: [
        { archetype: "clamp_bot", count: 1, from: "side_rear", startsAfter: 12, every: 12.5, maxGroups: 3, maxAlive: 1 },
        { archetype: "repair_drone", count: 1, from: "front_arc", startsAfter: 7, every: 9.5, maxGroups: 4, maxAlive: 4 },
        { archetype: "repair_drone", count: 1, from: "front_arc", startsAfter: 24, every: 99, maxGroups: 1, maxAlive: 4 },
      ],
      completeWhen: "all_dead",
      reward: "none",
    },
    {
      id: "elite_wave",
      startsAfter: "wave_02",
      enemies: [
        { archetype: "custodian_elite", count: 1, from: "front_gate" },
        { archetype: "repair_drone", count: 2, from: "front_arc" },
      ],
      reinforcements: [
        { archetype: "repair_drone", count: 1, from: "around_ring", startsAfter: 5, every: 6.5, maxGroups: 999, requiresEliteAlive: true, endless: true, maxAlive: 3 },
        { archetype: "clamp_bot", count: 1, from: "around_ring", startsAfter: 15, every: 13.5, maxGroups: 999, requiresEliteAlive: true, endless: true, maxAlive: 1 },
        { archetype: "clamp_bot", count: 1, from: "side_rear", startsAfter: 28, every: 99, maxGroups: 1, requiresEliteAlive: true },
      ],
      completeWhen: "elite_dead",
      reward: "none",
    },
    {
      id: "exit_chase",
      startsAfter: "elite_wave",
      enemies: [
        { archetype: "repair_drone", count: 2, from: "side_rear" },
        { archetype: "clamp_bot", count: 1, from: "side_rear" },
      ],
      reinforcements: [
        { archetype: "repair_drone", count: 1, from: "rear_ring", startsAfter: 4, every: 6.5, maxGroups: 999, endless: true, maxAlive: 4 },
        { archetype: "clamp_bot", count: 1, from: "side_rear", startsAfter: 8, every: 9, maxGroups: 999, endless: true, maxAlive: 1 },
      ],
      completeWhen: "exit_entered",
      reward: "open_exit",
    },
  ],
  dialogues: maintenanceBayDialogue,
  upgradeMoments: [
    { id: "upgrade_01", afterWave: "wave_01", choices: 3 },
  ],
};
```

## 14. 调参初始值

玩家：

- HP：100
- 移动速度：5.2 m/s
- 转向辅助最大速度：220 deg/s
- 锁定锥半角：22 deg
- 锁定距离：26m

实验铁棒：

- 伤害：62 扇形重击
- 射速：1.65/s
- 有效距离：约 6.7m
- 热量：8/次

实验手枪：

- 伤害：14
- 射速：4.8/s
- 弹药：20 发，打空后自动 3.6 秒长换弹
- 穿透：基础 0 个，升级后增加
- 热量：3/shot

核心大招：

- 伤害：30 x 18 pellets
- 半径：近中距离扩散
- 击退：强
- 基础触发间隔：约 8.3s
- 热量：42/次

通用：

- 散热：18/s

敌人：

- `repair_drone`：HP 150，速度 2.35，近战伤害 1.45。
- `clamp_bot`：HP 180，速度 2.65，近战伤害 2.08，倾向侧后方。
- `shield_tech`：HP 220，速度 1.75，近战伤害 2.08，后续关卡预留，第一关暂不刷。
- `signal_turret`：HP 140，固定炮台，后续关卡预留，第一关暂不刷。
- `custodian_elite`：HP 3780，速度 1.3，伤害 8.57，近战/召唤/短距离压迫。

这些数值只是第一版，必须通过实际手机游玩调。

## 15. QA 检查清单

移动端：

- 只用触摸能从标题进入游戏。
- 左摇杆不会卡住。
- 右滑屏不会触发页面滚动。
- 所有 UI 在横屏安全区内。
- 第一波不用精准瞄准也能赢。
- 威胁环点击有效。
- 三选一卡片不会溢出屏幕。
- 死亡和复活流程能完整走完。

桌面端：

- WASD/鼠标可玩。
- `Start Demo` / 选升级 / revive / replay 回到 gameplay 时，桌面端应直接进入 cockpit aim / pointer lock。
- pointer lock 中移动鼠标必须直接控制视角。
- pointer lock 不可用时，按住左键或右键拖动也能转视角。
- 开始页、三选一升级、死亡、胜利、暂停等 menu state 必须自动释放鼠标控制权；按钮/升级卡应显示 hand cursor。
- 自动开火和手动开火都工作。
- 1/2/3 或切换按钮能改变武器。
- 鼠标方向不反。

系统：

- `npm run build` 通过。
- `npm run build:platform` 通过，dist budget 不超线。
- 控制台无运行时报错。
- 关卡结束清理所有敌人、子弹、特效。
- 刷新页面能重开。
- 占位资产不存在加载失败。
- Production build 不暴露 debug panel 或 QA hook。
- Production/mobile 下 Web Audio 解锁后能播放 start/fire/hit/low-health 类短 cue，且无运行时报错。
- 高效率 mobile 自动手玩 QA 可完整走到 victory，并记录升级、精英召唤、出口和包体数据。
- local/itch 路径不会请求 CrazyGames SDK。
- CrazyGames fake-SDK QA 可验证 `init`、gameplayStart/Stop、rewarded ad、ad mute/unmute、revive reward。
- Production preview 下 `?platform=crazygames` 注入 fake SDK 时，不暴露 QA hook，且能触发 SDK init + gameplayStart。
- `dist/index.html` 资源路径必须是 `./assets/...`，不是 `/assets/...`。
- `npm run package:platform` 生成的 zip 里必须直接包含 `index.html` 和 `assets/`，没有多余目录层。
- First90 runtime art 请求必须在 dev/prod 都成功，且 production/subpath 不出现根路径 `/assets/...`。
- 升级卡 image icons 必须在 `844x390` 横屏内完整显示，不撑破 overlay。
- 移动端对白不能压住准星；`844x390` 和 `667x375` 横屏下应与 HUD 无重叠。
- 前 90 秒小怪必须露出正面弱点、类别轮廓或锁定环，不能只看到灰色背面。
- Run progress HUD 必须显示波次进度、Memory、Build、升级数量，并且不与 HUD、对白、摇杆、动作按钮重叠。
- 击杀后必须在 1 秒内出现 reward pulse 或 chain feedback；reward pulse 不应覆盖准星或操作按钮。
- 死亡/复活决策必须来自正常 HP 归零；不允许 Boss 登场后定时强制死亡。死亡面板需说明 Memory 保留、复活奖励和下一 cache 距离。
- `667x375` 横屏下死亡面板必须完整在视口内，复活 reward pulse 不得覆盖准星、摇杆或动作按钮。
- 复活后不能把玩家锁到短射程技能导致精英战卡住；已有手枪路线时复活应优先回到实验手枪，否则给核心大招救场。
- 连杀超频必须有实际收益：射速、散热、移动至少一项肉眼可感，HUD 显示剩余秒数。
- 第二波通过分段增援拉长；Boss 和电梯段允许“带上限的持续增援”，自动 QA 最大同屏目标仍以 `<=12-16` 为警戒线。
- 第一关需要接近 2 分半高手自动局；前 90 秒必须完成精英登场和高压战斗，是否死亡取决于玩家血量与操作。
- `exit_chase` 的目标必须是跑向电梯，不是清完所有敌人；门开启时要有镜头辅助和清楚的 `门已开` 提示。

手感：

- 第一次击杀在 15 秒内。
- 第一波后玩家明白自己在做什么。
- 第二波必须用到威胁环或棒/枪切换。
- 升级后下一波有明显变化。
- 5 连杀后必须进入可感知超频，玩家会想续 chain。
- 精英死亡有爽感。
- 第一关结束有继续玩的钩子。

最新自动化 QA 基线：

- 当前规则变更：2026-05-31 移除 Boss 定时剧情死亡；维修主管伤害从 `3.4` 调到 `6.8`、攻击冷却从 `1.45s` 调到 `1.55s`。下一轮 QA 要验证死亡只在 HP 归零时发生，并观察高手局是否可能无死亡通关。
- Boss 正常死亡 build QA：`npm run build:platform` passed；`dist` 约 `3.36MB`，最大文件为 BGM mp3 `1.98MB`，JS gzip `316.0KB`，CSS gzip `23.3KB`，文件数 `9`。
- 机器人 atlas + desktop HUD QA：`npm run build:platform` passed；`dist` 约 `4.12MB`，最大文件为 BGM mp3 `1.98MB`，JS gzip `317.7KB`，CSS gzip `23.3KB`，文件数 `12`。Browser desktop `1280x720` 测得右下角 `rod/item/pistol` overlap area 全部为 `0`，无 console error。
- 武器 viewmodel atlas + Boss 形体 QA：`npm run build:platform` passed；`dist` 约 `4.46MB`，最大文件为 BGM mp3 `1.98MB`，JS gzip `318.6KB`，CSS gzip `23.3KB`，文件数 `13`。Browser reload 后页面标题正确且无 console error；大截图接口在本次本地 QA 中超时，需下一轮继续人工看右下武器和 Boss 波次截图。
- 光圈改实体件 QA：`npm run build:platform` passed；`dist` 约 `4.46MB`，最大文件为 BGM mp3 `1.98MB`，JS gzip `319.2KB`，CSS gzip `23.3KB`，文件数 `13`。Chrome local smoke 打开 `http://127.0.0.1:5173/?debug=0`，标题 `人类协议 | Human Protocol`，canvas 存在，点击 `进入维修舱` 后进入战斗并跑到第一波 `7/9`，console error/warn `0`。本轮内置 Browser 路由在截图阶段断开，已用 Chrome 插件补做本地可视 smoke。
- 人类误读 HUD QA：`npm run build:platform` passed；`dist` 约 `4.47MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `319.0KB`，CSS gzip `24.4KB`，文件数 `13`。In-app Browser 打开 `http://127.0.0.1:5173/?debug=0` 并点击 `进入维修舱`，可见左上只有 `生命/精力`，生命行高 `50px`、精力行高 `35px`；中间广播字幕不与任务/操作区重叠；可见文本不包含 `热量 / 核心电芯 / 核心完整度 / 通信插入 / SKIP / 编号 H / 人类层 / 外壳 / 超频 / 装甲 / 能量`；console error/warn `0`。截图：`/tmp/human-protocol-human-hud-final.png`。
- 掉落/精力/build/结算 QA：`npm run build:platform` passed；`dist` 约 `4.48MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `321.5KB`，CSS gzip `25.0KB`，文件数 `13`。In-app Browser 窄屏 `319x734` 进入战斗后，左下 `闪` 按钮 rect `38,538,58,58`，与摇杆、右侧武器区 overlap 均为 `0`；HUD 与 run progress overlap 为 `0`；可见文本不包含 `热量 / 核心电芯 / 装甲 / 能量 / 通信插入 / SKIP`。本轮 WebGL screenshot capture 在 Browser 内超时，已用 DOM/rect smoke 完成布局验证；后续需要人工实玩验证掉落概率和结算手感。
- 开场拾取/隐藏身份 QA：`npm run build:platform` passed；`dist` 约 `4.48MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `322.7KB`，CSS gzip `25.2KB`，文件数 `13`。In-app Browser title screen 可见 title `Protocol 01`、正文为 `维修舱 01 / 异常生命信号`；可见按钮中铁棒/手枪 disabled 为 `true`；点击 `进入维修舱` 后任务为 `找到铁棒`、提示 `空手别靠近机械臂`、武器读数 `未拾取 / 锁定`；可见文本不包含 `人类 / 核心电芯 / 装甲 / 能量 / 紧急维修 / 通信插入 / SKIP / 电芯 / 驾驶舱`。本轮未完成全程实玩，下一轮要验证拾取两件武器后第一波是否自然开始，以及三下击杀体感是否过硬。
- Boss/电梯持续压力 + 场景物理 QA：`npm run build:platform` passed；`dist` 约 `4.49MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `324.0KB`，CSS gzip `25.2KB`，文件数 `13`。代码层已确认 `exit_chase` 不再通过清场完成，Boss 存活时四周慢刷增援，电梯段按 `maxAlive` 持续补兵；场景障碍从 `4` 个扩展到 `14` 个，玩家/子弹/敌人共用障碍碰撞。In-app Browser smoke：title `Protocol 01`，canvas `1` 个，点击 `进入维修舱` 后任务为 `找到铁棒`，铁棒/手枪按钮 disabled，console error/warn `0`；WebGL screenshot capture 本轮仍超时。下一轮需要实机 QA：Boss 战是否仍能读懂主目标、电梯段是否不会拖成烦躁、侧边实体物件是否挡路过重。
- 受击白条 + 预加载性能 QA：`npm run build:platform` passed；`dist` 约 `4.56MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `341.1KB`，CSS gzip `25.3KB`，文件数 `14`。In-app Browser backend 本轮不可用，改用 Chrome extension backend 打开 `http://127.0.0.1:5173/?debug=0`；title `Protocol 01`，title 画布正常，点击 `进入维修舱` 后任务为 `找到铁棒`，disabled 武器按钮 `2` 个，console error/warn `0`，截图通过。下一轮需要真机观察：低端手机首次进战斗是否仍有 shader/贴图卡顿，命中火花是否足够清楚但不再像白条。
- 机器人渲染/精力/Boss 血量 QA：`npm run build:platform` passed；`dist` 约 `4.56MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `341.4KB`，CSS gzip `25.3KB`，文件数 `14`。代码层已确认死亡敌人会 prune，远处机器人低细节，敌人阴影大幅减少，Boss 血量降 `10%`，精力恢复翻倍。Chrome local smoke：title `Protocol 01`，canvas `1` 个，点击 `进入维修舱` 后任务为 `找到铁棒`，console error/warn `0`。下一轮需要真机或浏览器性能面板验证：Boss 持续刷怪段是否仍有掉帧，以及 `10.5m` 低细节距离是否在手机屏幕上看不出突变。
- 两种小怪 InstancedMesh QA：`npm run build:platform` passed；`dist` 约 `4.57MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `343.6KB`，CSS gzip `25.3KB`，文件数 `14`。代码层已确认第一关刷怪只包含 `repair_drone` / `clamp_bot` 两种小怪；两者各自使用不同 atlas/decal material，并有 per-instance 受击颜色和不同死亡动作。下一轮需要实机观察：贴花在手机屏幕上是否足够清楚、受击闪是否明显但不刺眼。
- 高质优先小怪数量 QA：`npm run build:platform` passed；`dist` 约 `4.57MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `344.2KB`，CSS gzip `25.3KB`，文件数 `14`。上一轮首关小怪总存活硬上限曾压到 `4`，Boss 存活时上限 `3`；近处/锁定/受击/死亡的小怪优先进入高质单体渲染，`InstancedMesh` 只保底处理非主视野小怪。敌人伤害在降数量后整体再 +5%。
- 小幅增量压力 QA：`npm run build:platform` passed；`dist` 约 `4.57MB`，最大文件 BGM mp3 `1.98MB`，JS gzip `344.2KB`，CSS gzip `25.3KB`，文件数 `14`。普通阶段小怪硬上限从 `4 -> 5`，Boss 存活时从 `3 -> 4`；但普通阶段高质小怪仍最多 `4`，Boss 阶段高质小怪最多 `3`，额外小怪走 `InstancedMesh`，避免主要渲染压力增加。Dev server `http://127.0.0.1:5173/?debug=0` HTTP 200；本轮 in-app Browser 自动化连接不可用，需人工实玩观察是否更热闹但不掉帧。
- 旧 2分半节奏 QA：高效率 mobile 自动手玩 `148.14s` 到 victory，第一次升级 `35.61s`，第二次升级 `74.92s`，精英 `75.86s`，剧情死亡 `85.24s`，复活 `85.29s`，`exit_chase` `128.46s`，门开启 `145.97s`，Memory `117`，Best Chain `13`，revivesUsed `1`，maxAlive `9`，maxFovKick `5.14`，无 console error。此基线已过期，仅用于对比强制死亡移除前后的节奏变化。

以下旧基线保留用于对比每次调参是否真的变好：

- 第一次升级约 `7.5s`，第二次升级约 `23.5s`。
- 精英约 `24.5s` 出现，第一次增援约 `28.6s`，精英波持续约 `30.7s`。
- 高效率自动手玩约 `61.8s` 胜利；真实手机玩家目标仍按 `3-5min` 调。
- 过程峰值热量 `99`，最低 HP `90`，最大同屏存活敌人 `19`。
- CrazyGames fake-SDK QA：`init` 只触发 `1` 次，rewarded revive 请求 `1` 次，广告期间 muted=true，结束后 muted=false，复活后 HP `60%`。
- Basic Launch fake-SDK QA：`adsDisabledBasicLaunch` 不直接给奖励，会关闭 rewarded 按钮，改用 `Emergency Repair` 兜底，第二次点击恢复 HP `60%`。
- Production platform smoke：`dist` 约 `1.08MB`，最大文件约 `1.07MB`，JS gzip 约 `298.4KB`，CSS gzip 约 `3.2KB`，文件数 `3`。
- Subpath hosting QA：`/human-protocol/index.html` 能加载相对 assets，title 为 `Human Protocol`，无 `/assets/...` 根路径请求，无 QA hook。
- CrazyGames settings QA：`muteAudio=true` 初始静音，settings listener 可解除静音，SDK init/listener 在 dev StrictMode 下各只注册 `1` 次，死亡 UI 按钮文案为 `Restart Level`。
- Platform zip QA：`human-protocol-crazygames.zip` 约 `303KB`，zip 根目录直接包含 `index.html` 和 `assets/`。
- First90 art QA：新增 runtime JPG 后，`dist` 约 `1.31MB`，最大文件约 `1.07MB`，JS gzip 约 `300.8KB`，CSS gzip 约 `19.4KB`，文件数 `8`。
- First90 mobile QA：`844x390` 验证 start 画面、维修舱门/地面/驾驶舱屏幕、升级卡 3 个 icon、无 console error。
- First90 production subpath QA：`/human-protocol/index.html` 请求 5 个 runtime JPG，全部走相对 assets，无 QA hook，无 root asset 请求。
- First90 visual polish QA：`844x390` 复查对白、敌人可读性、锁定环、武器遮挡和升级卡；`667x375` production 复查对白与 HUD 不重叠。
- First90 visual polish full-run QA：高效率 mobile 自动手玩 `56.6s` 到 victory，最低 HP `21`，峰值热量 `98.6`，最大同屏存活敌人 `19`，升级选择为 `wide_target_cone` + `shock_repair_ping`，无 console error。
- First90 production subpath visual QA：`/human-protocol/index.html?debug=0` 在 `844x390` production 下无 QA hook、无 debug panel、无 root asset 请求，请求 `5` 个 runtime JPG；`667x375` 下 HUD/dialogue bounding boxes 不重叠。
- First90 package QA：`human-protocol-crazygames.zip` 约 `525.6KB`，当前 `dist` 约 `1.31MB`，最大文件约 `1.08MB`，JS gzip 约 `300.9KB`，CSS gzip 约 `19.5KB`，文件数 `8`。
- Retention HUD QA：`844x390` 验证 run progress、Memory、chain、Build name、upgrade pulse 均显示；run progress 不重叠 HUD/dialogue/actions/joystick，reward pulse 不重叠 crosshair/actions/joystick。
- Retention full-run QA：高效率 mobile 自动手玩 `55.6s` 到 victory，Memory `66`，Best Chain `11`，最低 HP `12`，峰值热量 `99.7`，最大同屏存活敌人 `19`，奖励标签覆盖 Memory、Salvage、Overclock、Custodian Core、Rare Installed，无 console error。
- Retention production subpath QA：`667x375` production/subpath 验证 run progress 存在，无 debug panel，无 QA hook，请求 `5` 个 runtime JPG，无 root asset 请求，无 console error。
- Retention package QA：`human-protocol-crazygames.zip` 约 `527.6KB`，当前 `dist` 约 `1.32MB`，最大文件约 `1.08MB`，JS gzip 约 `302.2KB`，CSS gzip 约 `20.2KB`，文件数 `8`。
- Addiction revive QA：`844x390` 高效率 mobile 自动手玩在 `18.95s` 触发 `Identity Crash`，死亡时 Memory `38`、Cache `2/3`、Best Chain `26`；点击 `Emergency Repair` 后回到 playing，revive surge `7.1s`、Memory `50`、武器 `railLance`，reward pulse 不重叠 actions/joystick/crosshair。
- Addiction full-run QA：同一轮自动手玩 `32.83s` 到 victory，Memory `76`、Cache `3/3`、Best Chain `26`、升级为 `pulse_faster_cycle` + `rail_overcharge`，revivesUsed `1`，无 console error。
- Addiction small-screen QA：`667x375` 死亡面板 rect `53.5,54.0 -> 613.5,320.9`，完整在视口内；小屏复活 reward pulse 不重叠 actions/joystick/crosshair。
- Addiction production subpath QA：`667x375` production/subpath 验证 run progress + Cache text 存在，无 debug panel，无 QA hook，请求 `5` 个 runtime JPG，无 root asset 请求，无 console error。
- Addiction package QA：`human-protocol-crazygames.zip` 约 `528.9KB`，当前 `dist` 约 `1.32MB`，最大文件约 `1.08MB`，JS gzip 约 `303.4KB`，CSS gzip 约 `20.3KB`，文件数 `8`。
- Desktop control QA：`1280x720` 验证 `W` 前进使 z 从 `8` 到 `4.67`，鼠标拖动使 `rotationY` 从 `0` 到 `0.5632`，点击战场后 pointer lock 为 `true`；触发三选一升级后 pointer lock 自动变 `false`，3 张升级卡可点击；选卡后回到 playing 且 `1/2/3` 数字键可换武器，无 console error。
- Desktop cursor-lock QA：`1280x720` 验证开始页 shell cursor `default`、Start button cursor `pointer`、canvas cursor `crosshair`；点击 Start 后自动 pointer lock 为 `true` 且 chip 隐藏；锁鼠后移动鼠标使 `rotationY` 从 `0` 到 `0.9702`；三选一升级时 pointer lock 立即变 `false` 且卡片 cursor 为 `pointer`；点卡后自动重新 pointer lock；进入 victory 后 pointer lock 为 `false` 且 Replay button cursor 为 `pointer`，无 console error。
- Desktop right HUD QA：in-app Browser `1280x720` 验证右侧武器盘显示在 `x=933..1229, y=259..557`，3 个圆形槽位均在右侧中下方，`.lower-hud` 未被移动端断点隐藏，console 无 error/warn；Browser screenshot 因当前 WebGL capture 超时，未取得可展示截图。
- Desktop weapon HUD reload QA：`npm run build:platform` passed after moving the desktop weapon HUD to the right-bottom safe area, hiding it outside combat, and adding pistol ammo/reload conic-gradient states. Browser DOM verification was interrupted before completion and should be rerun with visual screenshot when capture is stable.
- 中文任务/技能 QA：Browser smoke 验证标题为 `人类协议 | Human Protocol`，首屏和 HUD 为中文，按钮为 `棒 / 枪 / 大招`，开局任务显示 `逃出维修舱` 和 `机器人想把你拖回重置台`，无 console error。
- 棒枪大招 mobile QA：Playwright `844x390` 验证按钮可切到 `pulseRifle/railLance/flakBurst`，实验铁棒、实验手枪、核心大招都能实际击杀测试敌人，无 console error。
- 棒枪大招 full-run QA：策略自动手玩 `46.2s` 到 victory，第一次升级 `10.64s`，第二次升级 `27.04s`，精英 `28.13s`，`31.92s` 出现 `认知层失稳` 预警，`34.24s` 进入剧情死亡并复活；Memory `63`，Cache `3/3`，Best Chain `12`，无 console error。
- Desktop skill QA：`1280x720` 验证 `Digit1/2/3` 分别切换到实验铁棒、实验手枪、核心大招，无 console error。
- Skill/mission package QA：`npm run package:platform` passed；`human-protocol-crazygames.zip` 约 `533.7KB`，dist 约 `1.33MB`，最大文件约 `1.09MB`，JS gzip 约 `307.7KB`，CSS gzip 约 `20.7KB`，文件数 `8`。
- Long combat pacing QA：分段增援后策略自动手玩曾达到 `96.96s` victory，第二次升级约 `52.29s`，精英约 `53.21s`，剧情死亡约 `59.32s`，Memory `86`，maxAlive `9`，无 console error。
- Addictive feel QA：加入连杀超频/升级爆发后，策略自动手玩 `80.97s` 到 victory，第一次升级 `16.45s`，第二次升级 `52.53s`，剧情死亡 `59.55s`，Memory `82`，Best Chain `14`，revivesUsed `1`，maxAlive `9`，tempo surge 最大 `6.47s`，无 console error。
- Addictive feel package QA：`npm run package:platform` passed；`human-protocol-crazygames.zip` 约 `534.2KB`，dist 约 `1.34MB`，最大文件约 `1.09MB`，JS gzip 约 `308.1KB`，CSS gzip 约 `20.7KB`，文件数 `8`。
- Main BGM build QA：`Last Human Bay.wav` 转码为 `src/assets/audio/music/last-human-bay.mp3` 后，`npm run build:platform` passed；`dist` 约 `3.36MB`，最大文件为 BGM mp3 `1.98MB`，JS gzip `316.4KB`，CSS gzip `23.3KB`，文件数 `9`。
- Protagonist weapon visual QA：Playwright `844x390` 截图并人工检查，主角第一人称已显示白色实验袖、黑色手套、大铁棒、实验手枪；铁棒主体为粗钢条和红黄胶带，不再读作机器人能量刀；无 console error。
- FPS hand-feel QA：Playwright `844x390` 截图检查铁棒挥击、手枪开火、手枪换弹三态；铁棒有明显横扫弧线和身体位移，手枪有可见枪口闪/后坐，换弹时枪身倾斜且左手进入动作；无 console error。
- Pistol ammo/reload QA：Playwright `844x390` 按住实验手枪开火，弹药从 `20` 降到 `0`，进入换弹倒计时，松开扳机后自动补满到 `20`，最终 reload `0`，无 console error。
- Mobile selected skill QA：Playwright `844x390` 验证开局 `棒` 选中并放大；点 `枪` 后 `枪` 变为 `68.4x68.4` 且不重叠；点 `大招` 后 `大招` 变为 `98.6x85.1` 且不重叠；无 console error。
- Small games ID：项目登记为 `human-protocol`，同步到 `package.json`、`public/game.json`、`src/game/config/gameIdentity.ts`、README 和 Vercel 静态部署配置。
- Spawn spike cache QA：敌人改为预分配对象池，死亡后保留对象并复用；小怪 detailed renderer 保留少量预热槽，SceneRoot 在开局 compile 后关闭隐形预热态，减少刷大量机器人时的 runtime 创建/编译尖峰。
- Heavy spawn render smoothing：小怪 InstancedMesh 改为每帧一次活跃小怪列表缓存，所有零件复用列表，避免每个零件重复扫完整敌人池；扫描冲击只在单次部署 `3+` 只敌人时触发，普通 1-2 只增援不闪，避免 UI 疲劳。
- UI/cache performance QA：升级、波次、剧情 trigger 改为静态 Map 查表；HUD/任务/进度/技能/威胁环使用去重轮询快照，减少 DOM/UI 在未变化时重渲染；`npm run build:platform` passed，当前 dist 约 `4.57MB`，最大文件 BGM mp3 `1.98MB`，JS gzip 约 `345.8KB`，CSS gzip 约 `25.4KB`，文件数 `14`。
- Static scene instancing QA：地板 panel line 从约 `34` 个独立 mesh 合并为 `1` 个 InstancedMesh；玻璃后 reserve robots 从约 `85` 个背景 mesh 合并为 `5` 个 InstancedMesh；小怪 instanced renderer 改为每怪每帧缓存 `moveAmount / hitKick / attackKick / damageGlow / visualScale`，避免每个零件重复算速度和受击状态。`npm run build:platform` passed，当前 dist 约 `4.58MB`，最大文件 BGM mp3 `1.98MB`，JS gzip 约 `346.6KB`，CSS gzip 约 `25.7KB`，文件数 `15`。In-app Browser smoke：`http://127.0.0.1:5173/?debug=0` title `Human Protocol`，canvas `1` 个，点击 `进入维修舱` 后进入任务 `找到铁棒`，console error/warn `0`，截图 `/tmp/human-protocol-optimization-qa/optimized-start.png`。下一步最值得做：把背景机械臂和重复障碍装饰继续 instancing/geometry cache；增加不进 WebGL 的低血心跳、命中 haptic、广播节奏字幕；用真机性能面板记录 Boss 段 FPS/long task。
- Esc pause/settings QA：新增 `Esc` 暂停面板、继续/重开、语言切换、总音量/音乐/音效滑杆，并把设置持久化到 localStorage；锁鼠标时按 `Esc` 会先释放鼠标再打开暂停 GUI，暂停期间清空移动/攻击输入。`npm run build:platform` passed，当前 dist 约 `4.58MB`，最大文件 BGM mp3 `1.98MB`，JS gzip 约 `347.9KB`，CSS gzip 约 `26.6KB`，文件数 `15`。In-app Browser QA：`http://127.0.0.1:5173/?debug=0` 点击 `进入维修舱` 后按 `Escape` 出现 `维修舱暂停`；切到 `English` 后面板显示 `Maintenance Bay Paused`；Master 滑杆从 `82` 调到 `51`；点击 `Resume` 后回到游戏任务 `找到铁棒`；console error/warn `0`，截图 `/tmp/human-protocol-pause-qa/pause-menu.png`。下一步建议：把语言设置扩展到 title/death/victory/upgrade 全部 UI copy，顺手把 HUD 的小 `已暂停` 文案在暂停面板打开时隐藏。
- User profile localStorage QA：新增 `human-protocol-user-profile-v1` 用户档案，记录 `runsStarted`、每关 `attempts/completions/bestTime/bestMemory/bestKillStreak/lastRun`、每个升级 `offered/picked/firstSeen/lastPicked/levelPickCounts`，并同步 `PlayerProgress` 快照。写入点：开局 `recordLevelAttempt`，升级三选一出现 `recordUpgradeOffer`，选升级 `recordUpgradePick`，死亡 `recordRunDeath`，通关 `recordLevelCompletion`，x2 积分 `recordMemoryRewardDoubled`，加点 `syncUserProfileProgress`。`npm run build:platform` passed，当前 dist 约 `4.59MB`，最大文件 BGM mp3 `1.98MB`，JS gzip 约 `349.9KB`，CSS gzip `26.6KB`，文件数 `15`。In-app Browser debug QA：当轮曾用 `?debug=1` 临时读数验证，进入一局后显示 `本地局数 2 / 关卡档案 2/0 / 升级选择 0`，reload 后 title 状态仍显示 `2/0`，确认资料从本地档案恢复；Browser 安全沙箱不能直接读取 `localStorage.getItem`，本轮通过 reload 后 debug 读数验证持久化。该 debug 面板在后续 Lean horror UI/story QA 已从玩家 render tree 移除。下一步建议：做一个正式的“档案/统计”页面，展示玩家最常选 build、最佳通关时间、关卡星级和升级图鉴。
- Lean horror UI/story QA：右上角 debug/数据面板从 App render tree 移除，`?debug=1` 也不再渲染遥测、本地局数或升级选择面板；任务条缩小并改为短目标句，只保留 `捡起铁棒 / 别空手` 这类必要提示；增援提示改为只在夹击、重型或多单位压力时弹出，减少单只维修无人机刷屏；第一关对白改为更短的耳机/机器人广播/未知频道语气，强化“维修单位在回收你”的恐怖生存感，不提前解释身份。`npm run build:platform` passed，当前 dist 约 `4.59MB`，最大文件 BGM mp3 `1.98MB`，JS gzip 约 `348.4KB`，CSS gzip `26.6KB`，文件数 `15`。In-app Browser QA：`http://127.0.0.1:5173/?debug=1` 首屏显示新开场文案，点击 `进入维修舱` 后无 `遥测/本地局数/调试面板`，任务显示 `捡起铁棒 / 别空手`，对白显示 `醒醒。别出声。地上有东西，拿起来。`，旧长提示 `广播已经发现你在逃` 不再出现，console error/warn `0`，截图 `/tmp/human-protocol-lean-story-qa/lean-start.png`。下一步建议：做一次完整首关手玩，把每次弹字的时机控制到“玩家刚需要知道”而不是“系统刚发生事件”。
- Level01 config runtime QA：第一关内容迁入内置 config pack，新增 `src/game/config/schema/levelConfig.ts`、`src/game/config/ConfigPackStore.ts` 和 `docs/human-protocol-level01-config-map.md`；波次、出生组、剧情拾取、掉落、经济、复活、Boss 死亡、HUD/flow 文案、环境压力均从 `activeLevelConfig` 读取。`npm run build:platform` passed，当前 dist 约 `4.60MB`，最大文件 BGM mp3 `1.98MB`，JS gzip 约 `350.5KB`，CSS gzip 约 `26.6KB`，文件数 `15`；`curl 'http://127.0.0.1:5173/?debug=0'` 返回 dev app HTML。Playwright visual smoke 因本地 browser executable 缺失、system Chrome headless 超时未完成，需后续用 in-app Browser 复查。
- One-time runtime systems v1：已新增 `MapProgressState`、`ObjectiveTrackerSystem`、`InteractionSystem`、`DoorSystem`，并接入 `SceneRoot` game loop；`KeyboardMouseInput` 增加 `E` 交互，移动端增加 contextual interact button；第一关铁棒/手枪/电梯已登记为 config interaction，电梯门登记为 config door 并由 DoorSystem 同步碰撞与开门状态；HUD 现在优先显示 config `objectiveChain` 当前目标。`npm run build:platform` passed，dist `4.61MB / 20MB`，最大文件 BGM `1.98MB / 8MB`，JS gzip `354.6KB / 1.50MB`，CSS gzip `27.1KB / 256KB`。Playwright/system Chrome smoke：title 页面 `canvasCount=1`、console error `0`；调用 `startDemo()` 后 `mode=playing`、`activeObjectiveId=arm_self`、`currentRoomId=maintenance_bay_floor`、`door:service_elevator_door` collision 存在。下一步应做 `ConfigValidator v1` 和一个最小钥匙门 smoke test level。
- Landscape guard + ConfigValidator v1：参考 Oath Blade 的手机横屏 guard 做法，移动端会尝试 `screen.orientation.lock("landscape")`，并用 `--human-mobile-vh` 适配 iOS visualViewport；`390x844` 竖屏显示 `请横屏游玩` guard 且阻止操作，`844x390` 横屏 guard 隐藏并可正常进入游戏。新增 `src/game/config/ConfigValidator.ts`，检查 room/door/key/interaction/objective 引用、出口连通性、钥匙是否在自己锁住的门后、移动端路径复杂度和敌人预算预警；新增 `smoke_key_door_lab` 三房间钥匙门样例。Playwright/system Chrome QA：竖屏 guard `display=grid`、横屏 guard `display=none`、console error `0`；`builtInValidationReports` 中 `level_01_maintenance_bay` 和 `smoke_key_door_lab` 均 `ok=true/errors=0`。`npm run build:platform` passed，dist `4.63MB / 20MB`，最大文件 BGM `1.98MB / 8MB`，JS gzip `358.3KB / 1.50MB`，CSS gzip `27.5KB / 256KB`。
- MapGeometry/RoomDirector QA：新增 `MapGeometryRenderer v1`、`RoomDirectorSystem v1`、`createRoomWallSegments`，smoke 关卡房间可从 config 生成地板、墙、门框、钥匙、终端和墙体碰撞。Playwright/system Chrome QA：默认第一关 `844x390` 点击 `进入维修舱` 后 `mode=playing`、`activeObjective=arm_self`、`currentRoom=maintenance_bay_floor`、`doorObstacleCount=1`、console error/warn `0`；`smoke_key_door_lab` 点击后 `activeObjective=find_yellow_access_card`、`currentRoom=spawn_lab`、`roomCount=3`、`doorCount=2`、`keyItemCount=1`、`wallObstacleCount=15`、`doorObstacleCount=2`、console error/warn `0`；`390x844` 竖屏 guard `display=grid`。`npm run build:platform` passed，dist `4.64MB / 20MB`，最大文件 BGM `1.98MB / 8MB`，JS gzip `360.1KB / 1.50MB`，CSS gzip `27.5KB / 256KB`。截图：`/tmp/human-protocol-default-landscape.png`、`/tmp/human-protocol-smoke-key-door.png`、`/tmp/human-protocol-portrait-guard.png`。
- WaveTriggerBridge QA：新增 `WaveTriggerBridgeSystem` 和 `wave.trigger` schema，`GameWorld` 现在会记录 runtime events 并用 `pendingWaveStarts` 排队波次；有 `trigger` 的波次不再被顺序自动启动，旧第一关无 `trigger` 的波次仍走原有顺序。`smoke_key_door_lab` 增加两个事件波次：打开 `yellow_key_door` 触发 `smoke_hall_contact`，完成 `inspect_exit_terminal` 触发 `smoke_terminal_alarm`，第二个波次清完后 `open_exit` 解锁并打开 `smoke_exit_door`。Playwright/system Chrome QA：默认第一关拾取铁棒/手枪后仍顺序启动 `first_contact`，无 console error/warn；smoke 关卡从开门到终端警报流程验证 `triggeredWaves=[smoke_hall_contact, smoke_terminal_alarm]`、`completedWaves=[smoke_hall_contact, smoke_terminal_alarm]`、`exitUnlocked=true`、`openedDoors=[yellow_key_door, smoke_exit_door]`，validator 两个内置关卡均 `ok=true/errors=0/warnings=0`。截图：`/tmp/human-protocol-wave-trigger-bridge.png`、`/tmp/human-protocol-wave-default-sequential.png`。
- AssetResolver QA：新增 `src/game/visual/AssetResolver.ts`，统一解析 `visualKey/materialKey` 到轻量材质 profile 和 fallback primitive；schema 为 room geometry、door、keyItem、interaction 增加可选 `materialKey`；`ConfigValidator` 会对未知 `visualKey/materialKey` 给 warning。`MapGeometryRenderer`、config door、部分场景障碍已改用 resolver 材质。Playwright/system Chrome QA：默认第一关解析 `maintenance_bay_wet_floor / maintenance_bay_glass_wall / service_elevator_metal`，smoke 关卡解析 `sterile_lab_floor / sterile_lab_wall / yellow_access_metal / access_card_gold / terminal_cyan`；两个内置关卡 validator 均 `ok=true/errors=0/warnings=0`，console error/warn `0`。`npm run build:platform` passed，dist `4.65MB / 20MB`，最大文件 BGM `1.98MB / 8MB`，JS gzip `362.5KB / 1.50MB`，CSS gzip `27.5KB / 256KB`。截图：`/tmp/human-protocol-asset-resolver-default.png`、`/tmp/human-protocol-asset-resolver-smoke.png`。
- Puzzle hit_sequence QA：新增 reusable `hit_sequence` puzzle runtime，schema 支持 `puzzles`、`puzzle_completed` objective event 和 `puzzle_complete` door lock；`MapProgressState` 记录 completed puzzle、当前输入序列、失败次数和目标 pulse；铁棒扇形与子弹都能命中 puzzle target，但铁棒一挥只取最近目标，避免扫到多个球误重置。新增 `smoke_color_orb_lock`：拿 `blue_lab_key` 打开球锁室，读取 `红 -> 蓝 -> 绿` 图案，按顺序击中 3 个颜色球，打开 `orb_reward_door` 并解锁出口。`npm run build` passed。Chrome headless QA：错误先打蓝球会 `failedPuzzleCounts=1` 且序列清空；红蓝绿后 `completedPuzzleIds=[hall_color_orb_lock]`、`openedDoorIds=[orb_key_door, orb_reward_door]`、`exitUnlocked=true`、console error/warn `0`；铁棒 arc QA 红/蓝/绿每次命中 `1` 个最近球并成功开门。
- Code lock direction puzzle QA：新增 reusable `code_lock` puzzle runtime，schema 支持 `number_decal` 方位数字线索、`requiredKeyItemId`、`directionOrder` 和 `puzzle_complete + keyItemId` 门锁；`InteractionSystem` 可以把 config terminal 打开成中文密码面板，缺钥匙时只给短提示。新增 `smoke_direction_code_lock`：东西南北房间藏数字，西房间拿 `exit_key`，按 `东 -> 西 -> 南 -> 北` 算出 `2497` 后打开最终门并解锁出口。`npm run build` passed，`git diff --check` passed。Playwright/system Chrome QA：`844x390` mobile landscape 面板完整显示、确认按钮在视口内，错误 `1111` 记录 `failedPuzzleCounts=1`；正确 `2497` 后 `completedPuzzleIds=[final_direction_code]`、`openedDoorIds` 包含 `final_direction_door`、`exitUnlocked=true`、console error/warn `0`。`1280x720` desktop click QA 真实点击 `2/4/9/7` 后提交，面板关闭并完成 `final_direction_keypad`。
- Combo key/orb/code map QA：新增 `smoke_key_orb_code_lock` 组合密室样板，起点拾铁棒/手枪/钥匙，读 `黄 -> 红 -> 蓝` 图案，`combo_lab_key` 打开 `combo_key_gate`，按黄红蓝打球完成 `combo_color_orb_lock` 并打开 `combo_orb_gate`，最后按 `南 -> 东 -> 西 -> 北` 输入 `3851` 完成 `combo_final_direction_code`，打开 `combo_final_code_door` 并解锁出口。`npm run build` passed。Playwright/system Chrome `844x390` mobile landscape QA：错打蓝球会 `failedPuzzleCounts.combo_color_orb_lock=1` 且序列清空；正确黄红蓝后进入方位密码阶段；错误 `1111` 记录 `failedPuzzleCounts.combo_final_direction_code=1`；正确 `3851` 后 `completedPuzzleIds=[combo_color_orb_lock, combo_final_direction_code]`、三道关键门均打开、`exitUnlocked=true`、console error/warn `0`。组合密码 UI 截图验证确认按钮在视口内。
- Puzzle graph/explain QA：`ConfigValidator` 新增 `explainPuzzle(level)` 和 `report.graph`，会输出起点/出口房间、critical path、objective path、锁门依赖、谜题期望输入和静态可达结果；graph validator 会检查关键门打不开、进度谜题不可解、出口不可达和 interaction 被自己 objective 锁死。实现时顺手修正 `smoke_key_orb_code_lock` 出口 interaction 的 `requiresObjectiveId`，从自锁的 `reach_combo_escape_exit` 改为前置的 `input_combo_final_code`。`npm run build` passed。Playwright/system Chrome 读取 `builtInValidationReports`：5 个内置关卡全部 `ok=true/errors=0/warnings=0`；组合 smoke graph 显示 locks=`combo_key_gate/combo_orb_gate/combo_final_code_door`、puzzles=`combo_color_orb_lock/combo_final_direction_code`、expected code=`3851`、`exitUnlocked=true`、`exitInteractionReady=true`。
- Config graph overlay QA：新增 `ConfigGraphOverlay`，默认玩家界面不显示；只有 `?graph=1` 或 `?debug=graph` 显示 active level graph report，并提供 `Download JSON`、`Copy JSON` 和 `window.__HUMAN_PROTOCOL_EXPORT_GRAPH__()`。Playwright/system Chrome `844x390` QA：`?debug=0&level=smoke_key_orb_code_lock` 下 `.config-graph-panel=0` 且 export hook `undefined`；`?graph=1` 下 `.config-graph-panel=1`，active level 为 `smoke_key_orb_code_lock`，expected inputs 为 `combo_yellow_orb -> combo_red_orb -> combo_blue_orb / 3851`，`builtInReports.length=5`，panel 在视口内，console error/warn `0`。截图：`/tmp/human-protocol-config-graph-overlay.png`。
- Level 02 config QA：新增 `level_02_residential_simulation`，按“恢复前厅 -> 无限压迫大厅 -> 开着的 Boss 小房间拿钥匙 -> 锁着的灯控小房间打灯 -> 家庭门禁出口”实现。新增并验证 `initialInventory`、`map.pickups`、`keyItems.requiresObjectiveId`、通用房间/门碰撞、自定义房间刷怪点、`waves.interruptsActiveWave`。Vite SSR validation：6 个内置关卡全部 `ok=true/errors=0/warnings=0/exitInteractionReady=true`；In-app Browser smoke：`?debug=0&level=level_02_residential_simulation` 首屏显示 `居住模拟间 02`，点击 `进入生活区` 后有 canvas、铁棒/手枪 UI、任务 `进入生活区` 和开局对白。
- Level 02 side-door repair QA：修复 `DoorSystem` 对 config 门碰撞默认 `yaw=0` 的旧假设，侧门现在按 yaw 计算 AABB；开门后门板和门禁面板隐藏，第二关小房间/门洞放大，避免 Boss 被窄门卡住。代码级断言：灯控门仍要求 `level_02_family_key`，钥匙仍要求 `level_02_defeat_host`，旋转后的灯控门碰撞 halfSize 为 `[0.19, 1.55, 1.85]`，开着的 Boss 门无碰撞；`npm run build` passed，Vite SSR validation：6 个内置关卡全部 `ok=true/errors=0/warnings=0/exitInteractionReady=true`，`git diff --check` passed；In-app Browser `1280x720` smoke 进入 Level 02 后 canvas 正常、console error/warn `0`。
- Campaign Level 01 -> 02 QA：`ConfigPackStore` 增加 `campaignLevelIds=[level_01_maintenance_bay, level_02_residential_simulation]`，`GameWorld` 支持同 runtime `loadLevel/loadNextCampaignLevel`，胜利页出现 `进入下一关：居住模拟间`，换关时重置生成障碍并重挂 canvas，避免第一关门/墙残留到第二关。第一关胜利文案改成电梯下行到白色生活层，第二关标题文案接上“电梯门打开，外面不是出口”。代码级全流程 QA：boot Level01 -> start -> victory/settlement -> load Level02 title -> start Level02 -> Boss 前灯控门/钥匙均不可用 -> Boss objective 后拿钥匙开灯控门 -> 错打灯记录失败 -> 暖/白/蓝正确序列解锁出口 -> Level02 victory，全部断言通过。`npm run build:platform` passed，dist `4.85MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `423.7KB / 1.50MB`，CSS gzip `28.5KB / 256KB`；Vite SSR validation：6 个内置关卡全部 `ok=true/errors=0/warnings=0/exitInteractionReady=true`；`git diff --check` passed。UI smoke：in-app Browser route 本轮不可用，fallback Chrome extension 验证 Level01/Level02 title、第二关衔接文案、进入生活区后 canvas/任务/实验铁棒可见，console error/warn `0`，截图 `/tmp/human-protocol-level2-entry-ui-qa.png`。
- Config room beauty loop QA：新增 `RoomAestheticConfig` 和 `RoomAestheticLayer`，生成房间会基于 `room.aesthetic` 或 mood/material 自动得到 `maintenance/residential/sterile/hazard/exit` 风格；每个房间自动生成地面边线、地面分割、墙面分层板、角柱、顶灯、暖色居住区横条、危险房间警示 tick。Level01/Level02 官方房间已显式标注 aesthetic，作为后续本地机器人生成 config 的审美样本。`npm run build:platform` passed，dist `4.85MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `425.4KB / 1.50MB`，CSS gzip `28.5KB / 256KB`；Vite SSR validation：6 个内置关卡全部 `ok=true/errors=0/warnings=0/exitInteractionReady=true`；`git diff --check` passed。Visual QA：in-app Browser native pipe 本轮不可用，fallback Chrome extension 打开 `?level=level_02_residential_simulation`，进入生活区后 canvas/任务可见，console error/warn `0`，截图 `/tmp/human-protocol-room-beauty-final.png`。
- Config room beauty loop v2：按 ImageGen 概念图继续加强生成房间美术，新增地面金属板/导向线、墙面竖向 rhythm、顶梁、风格化远墙实体板、生活区/维修区/无菌区/危险区边墙剪影；修正墙面装饰埋进墙体的问题，把 wall dressing 统一推到房间内侧可见表面；关闭门增加实体门板、中缝、斜撑和状态光条，避免第一眼像黑色平板；`maintenance_bay_glass_wall` 改为更暗的金属玻璃基色，只保留细 cyan 光。`npm run build:platform` passed，dist `4.86MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `426.8KB / 1.50MB`，CSS gzip `28.5KB / 256KB`；Vite SSR validation：6 个内置关卡全部 `ok=true/errors=0/warnings=0/exitInteractionReady=true`；`git diff --check` passed。Visual QA：in-app Browser 竖屏 guard 正常，横屏 viewport 切换时连接中断后改用 Chrome extension fallback；Level02 进入生活区后 canvas `1` 个、landscape guard `none`、console error/warn `0`，截图 `/tmp/human-protocol-room-beauty-v9-visible-dressing.png`；参考概念图 `/Users/zhengkaizhang/.codex/generated_images/019e794c-495d-7c32-b216-5d32eb9fbbe6/ig_0bf7dc80fe12b8fa016a1ccece7d648195a131aac811b8e541.png`。
- Image2 general environment asset pass：生成并接入 4 张通用环境 atlas：`src/assets/environment/environment-trim-sheet-01.jpg`、`floor-wall-surface-atlas-01.jpg`、`room-backdrops-01.jpg`、`props-decal-atlas-01.jpg`，压缩后合计约 `1.7MB`；`First90Textures` 和 `preloadGameAssets` 已加载这些资源，`MapGeometryRenderer` 已用 cropped atlas planes 给 config 房间添加湿地面磨损、墙面远景、cyan/amber trim、风口、关闭门板纹理和终端屏贴花。调节后把 atlas 从“大照片墙”降成低透明材质层，居住区墙板拆成左右两段避开门洞，config 门增加实体门缝、斜撑、横肋、锁体、铆钉和小屏幕，Level02 出生点后移到 `z=14.6` 让第一眼有空间纵深；同时压暗 residential/glass wall 大色块，只保留灯带和门禁作重点。资产来源、原始生成图和 prompt 方向记录在 `src/assets/environment/README.md`。`npm run build:platform` passed，dist `6.56MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `428.4KB / 1.50MB`，CSS gzip `28.5KB / 256KB`，file count `19 / 1500`；Chrome visual QA：Level02 进入生活区后 canvas 正常，console error/warn `0`，截图 `/tmp/human-protocol-environment-tuned-final.png`。下一步建议：继续把 Level02 大厅和 Boss 房间做成两个 hero dressing preset，让 Boss 门、灯控房、家庭出口各有一眼能辨认的视觉主题。
- Door/key usability QA：门交互提示从“门禁面板小点半径”改成按门板局部坐标计算，整个门宽和门前后区域都能触发提示；`DoorFrame` 增加地面门槛和两侧状态灯，让开门/锁门在远处更像真正门洞。`LevelKeyItemDefinition` 新增 `dropFromArchetypeId`，钥匙仍可用 `roomId + position` 静态配置，也可绑定某个怪死亡掉落；Level02 的 `level_02_family_key` 绑定 `custodian_elite`，Boss 死后钥匙会偏向玩家侧掉到地面，避免被 Boss 尸体或掉落物盖住。钥匙视觉从小卡片光圈改为更大的实体门禁模块：地面阴影、金属卡体、把手、发光识别条和小立柱；`family_access_card` scale 提到 `1.35`，拾取半径提到 `2.2`。Level02 房间整体放大：恢复前厅、生活大厅、Boss 小房间、灯控小房间、三道门、出口交互和 spawn groups 都同步调整。`npm run build:platform` passed，dist `6.57MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `429.1KB / 1.50MB`，CSS gzip `28.5KB / 256KB`，file count `19 / 1500`；Chrome visual QA：Level02 首屏空间更宽，门框/门槛清晰，console error/warn `0`，截图 `/tmp/human-protocol-door-key-qa-final.png`。
- Config clue surface QA：`hit_sequence.clue` 新增 `surfaces`，可把颜色顺序放到任意房间的 `floor` 或 `wall`，并可用 `revealOnRoomEnter / roomEnterLabel / roomEnterDetail` 控制玩家进房间时只闪一次半透明线索；`code_lock` 的数字线索新增 `surface` 和 `size`，后期可以把方位数字放到指定房间地板或墙壁。Level02 灯控顺序已从“靠近灯控卡片读取”改为灯控室地面三段色块 `暖 -> 白 -> 蓝`，并删除必读灯控终端，避免玩家误以为要找一个很小的位置。`ConfigValidator` 会检查 clue surface 的房间、尺寸、材质和 sequence target 引用，`PuzzleGraph` 也会把 `clueSurface:floor@roomId` 写入说明。`npm run build:platform` passed，dist `6.57MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `430.3KB / 1.50MB`，CSS gzip `28.5KB / 256KB`；Chrome CDP SwiftShader smoke：6 个内置关卡均 `errors=0/warnings=0/exitInteractionReady=true`，Level02 title 有 `canvas=1`，`level_02_light_sequence.clue.surfaces.length=1`，`light_order` interaction 已为 `[]`，进入游戏后 `mode=playing`，无 JS exception；仅截图时出现 headless SwiftShader `ReadPixels` 性能 warning。
- Key/death feel QA：KeyItemMarker 从薄卡片改为接近急救包体量的实体门禁模块：更厚主箱体、顶部把手、前置识别灯、底部锁扣、四角护块和更明显落地阴影，Boss 掉落的 `level_02_family_key` 不再读作小贴片。生命 UI 修正为“活着最低显示 1%，死亡才显示 0%”，并把 `DeathReviveSystem` 的 fatal threshold 提到最大生命的 `0.5%`，避免玩家看到 0% 但仍未进入死亡。`npm run build` passed；Chrome CDP SwiftShader QA：Level02 模拟钥匙掉落后 key item 可用且 canvas 正常；第一关清空拾取物后把生命设为 `0.4%`，下一帧进入 `mode=death`、`health=0`、`deathReason=combat`。
- Runtime Event v1 / Level02 upgrade QA：新增 `LevelDefinition.events`，用 `trigger + actions` 统一表达后续关卡事件结果；当前 action 支持对白、消息、奖励 pulse、spawn warning、镜头震动、音频、特效、`add_memory` 记忆经验、`open_upgrade` 三选一升级、启动波次、开门/开出口、完成目标、发钥匙、加电池和 tempo surge。Level02 已把家政主管半血压迫、Boss 击杀后 `+18` 记忆与 `core_plating / rail_overcharge / field_medicine` 三选一、灯控成功后 `+10` 记忆全部写成 config。`npm run build` passed；Vite SSR QA：6 个内置关卡全部 `ok=true/errors=0/warnings=0`，模拟 `level_02_carekeeper_host` wave completed 后 `mode=upgrade`、`triggeredEventIds=[level_02_host_reward_upgrade]`、`memoryFragments=18`、`pendingUpgradeIds=[core_plating, rail_overcharge, field_medicine]`。
- Choice / environment / boss phase config QA：新增 `LevelDefinition.choices / environmentStates / bossPhases`。`open_choice` 会进入通用剧情选择 UI，选择结果写入 `mapProgress.selectedChoiceIds` 并可作为 `memory_choice / choice_selected` 门锁；`set_environment_state` 会激活低成本房间 tint/glow/point light，用于“伪装剥落、警报、核心启动”等状态；`bossPhases` 按 archetype + 血量阈值触发 action，第一关和第二关主管半血反馈已从硬编码迁到 config。Level02 增加 `level_02_memory_route_preview` 路线选择样例和 `level_02_family_mask_off / level_02_route_choice_pressure` 环境状态。`npm run build` passed；Vite SSR QA：6 个内置关卡全部 `ok=true/errors=0/warnings=0`，模拟 Boss 半血触发 `level_02_host_half_pressure`，灯控完成激活 `level_02_family_mask_off`，选择 `preserve_human_layer` 后 `selectedChoiceIds[level_02_memory_route_preview]=preserve_human_layer` 且回到 `playing`。
- Config/schema refactor QA：检查后清理旧半血特例，删除 schema 里没有 runtime 真实入口的 `enemy_health_below` 和敌人 `hasTriggeredHalfHealth` 状态，统一用 `bossPhases` 表达血量阶段；`ConfigValidator` 改为一处 `createLevelReferenceSets` 引用集合，`RuntimeEvent / Choice / EnvironmentState / BossPhase / DoorLock` 共用同一套引用校验；补齐 `inventory_count` 门锁的 runtime 与 graph 支持，后续 Level03 可直接做“收集 3 个展项档案开中央门”。`npm run build:platform` passed，dist `6.59MB / 20MB`，最大文件 BGM `1.98MB / 8MB`，JS gzip `434.3KB / 1.50MB`，CSS gzip `28.6KB / 256KB`；Vite SSR validation：6 个内置关卡全部 `ok=true/errors=0/warnings=0/exitReady=true`；`git diff --check` passed。
- Enemy tier config QA：新增 `src/game/config/enemyTiers.ts` 和 `EnemySpawnDefinition.tier`，wave config 可把任意 `archetype` 标成 `elite / leader / boss`，自动套用血量、伤害、速度、攻击 CD、威胁权重、半径、体型、灯色和 texture atlas；`visual` 可覆盖 `bodyColor / armorColor / coreColor / warningColor / textureAtlasKey / scaleMultiplier / lightIntensityMultiplier`。`bossPhases` 也可用 `tier` 限定，只触发某个等级的同 archetype。小怪只在 `tier=normal` 时走 InstancedMesh，精英/头领/大Boss 走详细渲染和实体等级装甲件。`npm run build` passed。
- Campaign route / timed environment QA：新增 `campaignRoutes`、`choice.options[].routeDeltas`、runtime action `adjust_campaign_route`，选择路线会写入 localStorage 用户档案 `campaignRouteProfile`，记录 route score、最近 80 次剧情选择和 dominant route；`set_environment_state` 与 `environmentStates` 新增 `duration`，`EnvironmentStateSystem` 自动清理过期房间 tint/glow。Level02 的 `level_02_memory_route_preview` 已写入 `human_layer / repair_logic / unknown_signal` 三条长期路线，`level_02_route_choice_pressure` 默认持续 `8.5s`。`npm run build:platform` passed，dist `6.61MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `438.3KB / 1.50MB`，CSS gzip `28.7KB / 256KB`；Vite SSR validation：6 个内置关卡全部 `ok=true/errors=0/warnings=0`，模拟选择 `preserve_human_layer` 后 `humanScore=1`、`dominant=human_layer`、`choiceHistory=1`，定时环境状态 `8.5s` 后自动失效；`git diff --check` passed。
- Level03-05 config v1：新增 `src/game/config/levels/levels03To05.ts` 并接入 campaign 顺序。Level03 `人类博物馆`：工具/声纹/身体三展厅，3 份档案芯片开中央档案门，档案头领战后离开。Level04 `记忆诊所`：童年椅/救援椅/身体椅顺序读取，剧情三选一继续写 `campaignRouteProfile`，治疗头领战后离开。Level05 `回收核心`：北/东/西三锁臂顺序断开，进回收平台打回收母机，身份档案门作为 demo v1 出口；本轮明确不做 Boss 行为变体和最终 ending 专属页。SSR validation：9 个内置关卡全部 `ok=true/errors=0/warnings=0/exitReady=true`，campaign 顺序为 `01 -> 02 -> 03 -> 04 -> 05`。
- Campaign 01-05 runtime pass-through QA：新增 `npm run smoke:campaign`，用 Vite SSR 加载真实 `GameWorld`，先跑 9 个内置关卡 config validation，再按每关 `objectiveChain` 逐步调用运行时接口跑主线：故事拾取、开门、进房间、拿钥匙、打颜色球、打 wave/Boss、三选一升级/剧情选择、解锁出口、进入 transition 并完成 victory。5 个 campaign 关卡全部到达 `victory`：Level01 `3` 个目标、Level02 `7` 个目标、Level03 `8` 个目标、Level04 `6` 个目标、Level05 `10` 个目标。`npm run smoke:campaign` passed；`npm run build:platform` passed，dist `6.66MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `448.5KB / 1.50MB`，CSS gzip `28.7KB / 256KB`，file count `19 / 1500`；`git diff --check` passed。下一步建议：补一次手玩/视觉 QA，因为自动脚本验证的是 config 逻辑链，不等于玩家路径、镜头和战斗节奏都已经完美。
- Config pack import/export QA：新增 localStorage custom pack 系统和 title 页“本地关卡”折叠面板。现在可选择官方/本地关卡、导出当前关卡 pack、导出基础 pack、粘贴或选择 JSON 导入、校验保存、删除本地 pack；导入支持完整 `hp.config.v1` pack 或单个 `LevelDefinition`。`npm run smoke:campaign` 新增 custom pack import check：复制 `smoke_key_door_lab` 为 `qa_generated_key_door_lab`，通过 JSON 解析和 pack validation；Browser QA 在 `1280x720` 下打开本地关卡面板，验证 `9` 个官方选项、导入 QA pack 后选项变 `10` 且选中本地关，删除后回到 `9` 个选项和第一关，console error/warn `0`，截图 `/tmp/human-protocol-config-pack-final-qa.png`。`npm run build:platform` passed，dist `6.67MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `451.0KB / 1.50MB`，CSS gzip `29.1KB / 256KB`。
- Mobile landscape/settings/i18n QA：移动端横屏入口升级为“首屏尝试 + 任意 pointer/touch 手势后再尝试 fullscreen + `screen.orientation.lock("landscape")`”，竖屏仍显示横屏 guard；title 和 playing 都有右上 `设置 / Settings` 入口，可打开暂停设置调音量和语言。新增 `LevelLocalization` 和 `UpgradeLocalization`：官方 1-5 关标题、flow、目标、对白、剧情选择、出口、波次提示、门锁/钥匙/奖励/密码/打灯反馈、升级卡和本地关卡工具现在会随中文/英文切换。浏览器移动横屏 QA 在连接断开前已验证 `844x390` 下设置入口可点、切到 English 后 title/HUD/本地关卡工具更新、console error/warn `0`；本轮后续 Browser native pipe 断开，使用 `npm run build`、`npm run smoke:campaign`、`npm run build:platform` 和 `git diff --check` 兜底。最新平台包：dist `6.71MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `463.8KB / 1.50MB`，CSS gzip `29.3KB / 256KB`。
- Mobile settings + real i18n QA：移动端首次触摸/点击会尝试进入 fullscreen 并执行 `screen.orientation.lock("landscape")`，竖屏仍用 guard 阻止误玩；title 和 playing 都新增右上角系统设置按钮，暂停/设置面板可切换语言、音量和继续游戏。新增 `LevelLocalization`，官方 1-5 关的标题、flow、目标链、wave 提示、对白、选择、出口提示和 HUD 标签都能随中文/英文切换；本地关卡面板也跟随语言切换。In-app Browser 在断连前验证 `844x390` 移动横屏：设置按钮可点开，切到 English 后标题变 `Maintenance Bay 01`、开始按钮变 `Enter Bay`、HUD 变 `Health/Stamina`、console error/warn `0`。最终命令 QA：`npm run build` passed；`npm run smoke:campaign` passed；`npm run build:platform` passed，dist `6.70MB / 20MB`，largest `1.98MB / 8MB`，JS gzip `461.9KB / 1.50MB`，CSS gzip `29.3KB / 256KB`；`git diff --check` passed。
- Real playthrough QA skill：新增 `npm run qa:playthrough`，用真实 runtime systems 从 Level01 一路打到 Level05，不再只靠直接完成目标；本地 QA/debug 可用无伤模式专注解谜和流程。真实通关发现并修复第一关“先捡枪会提前完成 arm_self 但波次不启动”的目标条件 bug，`GameWorld` 现在要求 `objective.requiredIds` 满足后才完成目标；Level03 入口改为已开门/进房触发，避免玩家出生后看到全关门卡住；默认玩家 title 不再显示本地关卡导入/下载工具，只有 `?config=1`、`?debug=config` 或 dev `?debug=1` 才显示。QA 结果：`npm run qa:playthrough` passed，真实打完 1-5，击杀 `46/4/8/9/14`，全程 health `100%`；`npm run smoke:campaign` passed；`npm run build` passed；`git diff --check` passed；In-app Browser 当前 `?debug=0&level=level_03_human_museum` 验证 canvas `1`、config/graph/download/local-level 文案均未显示、console error/warn `0`。
- Better player/art QA + config skin QA：新增 `room.skinKey` / `door.skinKey`，美术不再只靠散落的 `materialKey/visualKey`，而是可通过 config 选择房间皮肤、门皮肤和后续关卡主题。`AssetResolver` 现在统一提供 `maintenance_bay_hero / service_exit_red / sterile_blue_lab / hazard_yellow_service / residential_sim_dark` 等 room skin，以及 `service_elevator_hero / yellow_access_service / cyan_lab_access / residential_access_clean / red_locked_blast` 等 door skin；`ConfigValidator` 会对未知 skin 给 warning。第一关被设为当前 demo hero art 样板：维修舱主房间使用 `maintenance_bay_hero`，电梯房使用 `service_exit_red`，出口门使用 `service_elevator_hero`，并强制 `renderFloor/renderWalls/high detail`，同时保留 `collisionWalls:false`，不改变当前首关战斗动线。新增 `npm run art:qa`，会检查 1-5 关所有房间都能解析材质/aesthetic、所有门都有 visual 或 skin、第一关每个 room/door 都有 hero-grade skin。QA 结果：`npm run art:qa` passed；`npm run qa:playthrough` passed，真实跑完 `level_01_maintenance_bay -> level_05_reclamation_core`；`npm run smoke:campaign` passed；`npm run build` passed；`git diff --check` passed。In-app Browser clean server `5178` DOM QA：第一关 title 和 playing 都有 canvas，默认玩家界面没有本地关卡/下载/config graph 面板；WebGL 截图接口本轮 `Page.captureScreenshot` 超时，所以视觉截图未作为最终证据，后续仍建议手玩看第一关灯光、门框、地面和武器遮挡。
- Article/quiz room puzzle config QA：新增 reusable `articles` 与 `quizzes` config 系统，支持文章阅读 overlay、阅读完成事件 `article_read`、问答 overlay、答对事件 `quiz_completed`、答错事件 `quiz_failed`、错答 actions 和 `start_wave.repeat`。`ConfigValidator` 会检查文章/题目 room、interaction、article 依赖、唯一正确答案、3-5 选项建议和 outcome actions，PuzzleGraph 会模拟 `article_read / quiz_completed` 以及正答 actions。Level05 已新增 `实验档案室`、实体 `archive_book` 互动物、《最后人类实验》三页档案、`H-0 记录校验` 三选一题，错答刷 `4` 个校正单位，答对后触发 `回收主机` Boss。新增文章/问答 overlay 使用现有高级面板样式并支持中英文。QA：`npm run smoke:campaign` passed，Level05 主线变为 `12` 个目标；`npm run qa:playthrough` passed，真实跑完 1-5，Level05 kills `18`（包含错答校正单位）；`npm run build` passed；`git diff --check` passed。
- Door switch config + asset handoff QA：新增 reusable `switches[]` config 系统，支持 `switch` interaction、`switch_activated` 目标事件、`activeSwitchStateIds / activatedSwitchIds / switchActivationCounts` runtime state，以及 switch state actions 直接开门、关门、锁门、解锁出口、播报、镜头震动和奖励 pulse。新增 `smoke_door_switch_lab` 验证“一次开关关闭并锁住入口，同时打开出口”的最小门组改道闭环；`ConfigValidator` 和 PuzzleGraph 已检查 switch room、interaction、state、initialState、actions 引用，并能模拟主路径。补充 `docs/human-protocol-current-asset-requirements.md`，给建模 agent 明确第一人称武器、门开关、档案书、问答面板、拾取物、敌人和 5 关 room kit 的当前 asset key 与预算。QA：`npm run qa:playthrough` passed，真实跑完 1-5；`npm run smoke:campaign` passed，10 个内置关卡 validation 通过并验证 door switch runtime；`npm run build` passed；`git diff --check` passed。
- Big screen / formula puzzle config QA：新增 reusable `bigScreens[]` config 系统，支持 `big_screen` interaction、`big_screen_state` 目标事件、`set_big_screen_state` runtime action、`activeBigScreenStateIds / activatedBigScreenIds` runtime state，以及 `off / digits / color_sequence / formula / text` 显示模式。`code_lock.code.source` 新增 `formula`，可配置 `expression / answer / display / hint / padLength / resultMode`，密码面板会显示来自 keypad/screen/article 的短提示。Level04 `记忆诊所` 已把身体椅线索改成大屏公式：读完身体椅后点亮 `level_04_body_formula_screen`，显示 `3 + 8 - 5 = 6`，治疗门禁输入 `386`。新增 `smoke_big_screen_formula_combo` 验证“开观察屏看黄/红/蓝 -> 打颜色球 -> 公式屏亮 -> 输入 040 -> 出口解锁”。补充 `human-protocol-config-room-puzzle-systems.md`、`human-protocol-current-asset-requirements.md` 和 `human-protocol-modeling-agent-config-handoff.md`，明确大屏资产 `terminal_puzzle_big_screen` 怎样通过 `modelKey/visualKey` 与 config 链接。QA：`npm run smoke:campaign` passed，11 个内置关卡 validation 通过并验证 big screen runtime；`npm run qa:playthrough` passed，真实跑完 1-5；`npm run build` passed。

## 16. 未来 5 关结构

详细后 4 关密室逃生剧本已写入 `docs/human-protocol-levels-02-05-script.md`。后续实现时以该文件为准。

长期方向已写入 `docs/human-protocol-config-generated-escape-room-architecture.md`。从 Level 02 开始，关卡应尽量走 config-driven 路线：房间、门锁、互动物、波次、掉落和剧情都先落到 config，再接入系统。不要继续把后 4 关全部硬写进 `levelManifest.ts`，否则后期“玩家一句话生成一段人生密室”的系统会多一次迁移。

每个后续官方关卡都要同时作为本地机器人训练样本保存：人类设计意图、玩家一句话、导演 prompt、可运行 config、validation report、QA/repair notes。

5 关 demo 结构：

1. `Maintenance Bay / 维修舱`
   - 已实现第一关核心闭环。
   - 玩家只知道机器人在“回收对象”，还不知道自己是什么。

2. `Residential Simulation / 居住模拟间`
   - 假家庭、没有脸的相框、睡眠舱。
   - 核心线索：所谓“家”是为了测试人类反应的样板间。

3. `Human Museum / 人类博物馆`
   - 人类展柜、重复声纹、白色身体展品。
   - 核心线索：`最后人类` 不是一个人，是反复加载的展项/协议。

4. `Memory Clinic / 记忆诊所`
   - 治疗椅、投影人声、真假记忆选择。
   - 核心线索：`我是人` 是一层可以被镇静和重写的记忆层。

5. `Reclamation Core / 回收核心`
   - 三锁臂密室、回收母机、最终档案。
   - Demo 结尾揭示：玩家是一个相信自己是人类的机器人。

5 关 demo 结束要有“结束了，但想继续”的感觉：

- 免费 demo 讲完第一个完整反转。
- 结尾显示但锁住三条后续路线：
  - `保留人类层`
  - `接受维修`
  - `重建人类`

## 17. 第一阶段完成定义

当以下条件都满足，才算核心第一关完成：

- 玩家可以在手机横屏完整打通第一关。
- 第一关包含开局、波次、升级、威胁环、精英、出口、胜利。
- 死亡后可以复活或重开。
- 没有最终资产也能看懂敌人、武器、危险方向。
- 每个系统都有配置入口，不是写死在 renderer 里。
- 后续替换贴图/模型不需要改战斗逻辑。

这一版完成后，再进入资产阶段：武器概念、机器人敌人、维修舱、UI 皮肤、音效和 trailer。
