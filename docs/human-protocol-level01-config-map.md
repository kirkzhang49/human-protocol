# Human Protocol Level 01 Config Map

本文档记录第一关 `Maintenance Bay / 维修舱` 已经 config 化的内容，以及后续要改关卡时应该动哪里。

## 入口

当前第一关可以直接使用：

```text
src/game/config/ConfigPackStore.ts
src/game/config/schema/levelConfig.ts
src/game/config/levelManifest.ts
```

运行时入口：

```ts
import { activeLevelConfig } from "./game/config/ConfigPackStore";
```

`GameWorld` 现在通过 `activeLevelConfig` 读取第一关，不再直接把第一关内容散写在系统里。

## 已经 Config 化

### 关卡基础

位置：`src/game/config/levelManifest.ts`

- level id
- title
- player spawn point
- initial wave start delay
- 是否必须先拾取剧情武器再开波次

### 出口和胜利

- 电梯位置
- 电梯半径
- 出口解锁文案
- 出口距离标签
- 解锁对白 trigger
- 解锁提示 UI
- 进入电梯后的 transition 文案
- 胜利 message

### 地图 / 门 / 互动 / 目标链

- `map.rooms`：当前第一关登记为 `maintenance_bay_floor` 和 `service_elevator_room`。
- `map.doors`：`service_elevator_door` 现在是 config door，含位置、尺寸、默认锁定状态、解锁文案和门禁面板位置。
- `map.interactions`：`pickup_iron_rod`、`pickup_pistol`、`use_service_elevator` 已登记。
- `objectiveChain`：`arm_self`、`survive_maintenance_lockdown`、`reach_service_elevator` 已登记，并由 HUD 优先读取当前 config objective。
- runtime：`ObjectiveTrackerSystem`、`InteractionSystem`、`DoorSystem` 已接入 game loop；桌面用 `E` 交互，移动端有 contextual interact button。

### 波次和刷怪

- wave id
- start delay
- 初始敌人组
- 增援组
- 增援间隔
- 每组最大次数
- elite 存活条件
- 同类 maxAlive 限制
- wave reward
- completion dialogue trigger
- exit chase 定时开门时间

### 出生组

- spawn group id
- spawn group UI label
- spawn layout 类型
- 增援来源 label

目前 position 计算仍由引擎函数执行，但使用 config 的 spawn group id / layout。后续如果要做更多地图，可以把 layout 参数继续拆进 config。

### 剧情对白

- level start
- 拾取铁棒
- 拾取手枪
- first contact
- first kill
- lockdown
- wave complete
- rear warning
- memory flash
- elite intro
- exit chase
- exit unlocked
- exit entered

对白数据仍在 `src/game/config/dialogueScripts.ts`，由 `levelManifest.ts` 引入到第一关 config。

### 剧情镜头 Beat

每个 beat 现在由 config 控制：

- wave id
- trigger time
- dialogue trigger
- warning UI
- reward pulse
- camera shake / FOV kick / rumble
- effect type / position / direction / lifetime / intensity
- audio cue
- tempo surge duration

已 config 的 beats：

- `wave_01_lockdown`
- `wave_02_memory_flash`
- `wave_02_last_gate`
- `elite_title_slam`
- `elite_second_phase`
- `elite_final_push`
- `exit_chase_start`

### 拾取物

- 开局铁棒位置
- 开局手枪位置
- 拾取半径
- 拾取后授予的 weapon / flag
- 拾取后 wave start delay
- 拾取对白
- 拾取 reward pulse
- 拾取 warning
- 拾取 audio

### 动态掉落

- 动态掉落最大同屏数量
- 动态掉落存在时间
- 各类 pickup 收集半径
- 急救箱最低缺血才收集
- 急救箱基础恢复量
- 急救箱掉率
- 低血掉率加成
- 低血 pity
- 急救箱 active drop limit
- 应急电池最大持有
- 应急电池掉率
- 应急电池 pity
- elite 掉率
- 各 archetype 掉率

### 经济和升级节奏

- 每种敌人给多少 Memory fragments
- kill streak window
- Memory Cache milestones
- Memory Cache 奖励类型
- 前两次 curated upgrade rolls
- 连杀 tempo surge 阈值和奖励

### 复活

- 最大复活次数
- 复活 HP 比例
- 复活给多少 Memory
- revive surge duration
- tempo surge duration
- 复活冲击半径
- 复活冲击伤害
- 复活击退
- 复活 reward pulse
- 复活 message

### 战斗限制

- 哪些敌人算 small enemy
- elite archetype id
- 普通情况下最多几个小怪
- elite 存活时最多几个小怪

### Boss 死亡 Beat

- 触发 archetype
- 死亡 warning
- warning duration
- camera impact
- dash burst intensity

### HUD / Flow 文案

- wave labels
- mission objective title/detail
- upgrade objective
- title screen copy
- title screen signal strip
- start button
- death screen copy
- revive buttons
- transition screen copy
- victory screen copy
- x2 memory button
- replay button
- environment pressure by wave/mode

## 仍然留在代码里的内容

这些暂时不应该为了 config 化而拆：

- 第一人称移动、手机/桌面输入、pointer lock。
- 武器实际判定和弹道实现。
- upgrade effect 的具体执行函数。
- enemy AI 行为实现。
- renderer 里的具体 mesh 结构、材质、贴图采样。
- Web Audio synth 实现。
- CrazyGames / itch platform adapter。
- 物理碰撞和障碍体积。

这些属于 engine / renderer / platform，不是第一关内容。后续要给本地机器人生成自由度时，应该先让 config 选择已有行为和 visualKey，而不是让 config 生成新代码。

## 下一步

1. 做 `InteractionSystem v1`，把门锁、检查终端、相框、睡眠舱这类互动统一成 config。
2. 做 Level 02 config sample。
3. 给每个官方关卡保存：
   - `player_sentence`
   - `director_prompt`
   - `level.config`
   - `validation_report`
   - `repair_notes`

## Verification

- `npm run build` passed.
- `npm run build:platform` passed.
- Package budget passed: `dist` about `4.60MB`, largest file `1.98MB`, JS gzip about `350.5KB`, CSS gzip about `26.6KB`.
- Dev server smoke via `curl 'http://127.0.0.1:5173/?debug=0'` returned the Vite app HTML.
- Browser automation note: Playwright browser executable was unavailable in the local cache, and system Chrome headless launch timed out, so visual smoke should be rerun from the in-app browser or a working Playwright install.
