# Human Protocol Complex Map Config Plan

这份文档回答一个问题：当前第一关暂时是简单单房间战斗，但后续如果第一关或任何关卡要扩成多个房间、门、钥匙、机关和终点，应该怎么改才不会把系统写死。

一次性系统能力边界见：`docs/human-protocol-one-time-runtime-systems.md`。简单说：代码只写一次“交互、开门、房间导演、目标追踪、验证器”等通用动词；后续关卡只生成 room/door/key/interaction/objective config。

## 1. 核心思考

不要一上来做大型 3D 地图编辑器，也不要先做 navmesh。这个游戏是 mobile-first 第一人称密室逃生，最合适的底层不是开放世界，而是：

```text
Room Graph -> Door Lock -> Interaction -> Objective -> Exit
```

也就是每个关卡先被拆成几个清楚的房间节点。房间之间通过门连接，门由钥匙、终端、波次、生存、Boss 死亡或记忆选择解锁。玩家做的事情不是“在大地图里迷路”，而是不断理解：

- 我在哪个房间。
- 这扇门为什么打不开。
- 我要拿什么或触发什么。
- 门开后有什么危险变化。
- 终点在哪。

当前第一关只是暂时按单房间实现，因为它先负责教战斗和世界观；schema 不限制第一关。以后如果第一关要改成“醒来房间 -> 武器间 -> 维修主舱 -> 电梯间”，同样可以用这套 room graph config。Level 02 只是第一个最适合验证复杂地图的试点：2-4 个房间、1-2 把门、1 个关键物、2-3 个互动物、1 个出口。

## 2. 已经先补上的格式

当前代码已经先补了复杂地图 config 类型：

```text
src/game/config/schema/levelConfig.ts
```

新增的可配置积木：

- `LevelMapConfig`：一张关卡地图。
- `LevelRoomDefinition`：房间节点，包含范围、气氛、材质 key、进入对白。
- `LevelDoorDefinition`：门，包含位置、尺寸、默认状态、锁条件、门禁面板位置。
- `LevelKeyItemDefinition`：钥匙/门禁卡/记忆碎片等关键物。
- `LevelInteractionDefinition`：终端、检查点、门禁面板、记忆回声、钥匙拾取、出口。
- `LevelObjectiveDefinition`：目标链，描述玩家当前该做什么、怎么开始、怎么完成。

当前第一关也已经登记成最简单的 map，这不是设计限制，只是当前内容版本：

- `maintenance_bay_floor`：维修主舱。
- `service_elevator_room`：维修电梯。
- `service_elevator_door`：由 `survive_maintenance_lockdown` 目标解锁。
- `pickup_iron_rod` / `pickup_pistol` / `use_service_elevator`：作为未来 InteractionSystem 的样例。

现在 runtime 仍然用旧系统跑第一关，所以玩法不会变；但数据已经能作为 Level 01 多房间版或 Level 02 的模板。

## 3. 后续真正要改的系统

### 3.1 MapProgressState

在 `GameSessionState` 或新的 `MapProgressState` 里保存关卡进度：

```ts
interface MapProgressState {
  currentRoomId: string;
  openedDoorIds: string[];
  unlockedDoorIds: string[];
  collectedKeyItemIds: string[];
  completedInteractionIds: string[];
  activeObjectiveId: string | null;
  completedObjectiveIds: string[];
}
```

这个状态必须能存档、重开、复活后恢复。后续本地机器人生成的关卡也只改 config，不改状态结构。

### 3.2 InteractionSystem v1

新增：

```text
src/game/systems/InteractionSystem.ts
```

它只做一件事：检测玩家附近/准星附近的 config 互动物，然后根据类型执行标准动作。

第一版支持：

- `pickup_key`：拿钥匙、门禁卡、记忆片段。
- `pickup_story`：拿铁棒、手枪这类剧情物。
- `inspect`：检查相框、培养舱、尸袋、机器人日志。
- `terminal`：读终端，可能完成目标或开门。
- `door_panel`：尝试开门，没条件就提示原因。
- `repair_panel`：短时间按住修复面板。
- `memory_echo`：触发中屏闪现剧情。
- `exit`：进入终点。

UI 上不要做复杂提示。移动端只需要一个清楚的交互按钮；桌面端准星对准后显示 `E`。

### 3.3 DoorSystem v1

门不要只是视觉效果，必须变成实体：

- 关着时加入碰撞。
- 开门时移除或缩小碰撞。
- 开门有 0.8-1.5 秒动画。
- 门打不开时中屏短句提示原因。
- 门打开时触发音效、灯光、镜头轻震。

门锁逻辑统一读 `DoorLockDefinition`：

- `key_item`：需要钥匙。
- `objective_complete`：需要目标完成。
- `survive_wave`：撑过波次。
- `repair_panel`：修复面板。
- `memory_choice`：做一次剧情选择。
- `boss_dead`：Boss 死亡。

### 3.4 RoomDirectorSystem

新增房间导演系统：

- 玩家进入房间时触发对白、灯光、远景机器人、波次。
- 玩家离开房间时关闭不必要的细节，节约性能。
- 当前房间和相邻房间保持高质量，远房间降级或不渲染。

这个系统对性能很重要。多房间地图不要所有东西同时渲染，只渲染：

- 当前房间。
- 相邻可见房间。
- 门缝/玻璃后需要看到的剪影。

### 3.5 MapGeometryRenderer

后续地图不能再只靠背景图。需要从 config 生成低成本几何：

- floor plane。
- wall panels。
- door frame。
- simple props。
- invisible collision blocks。
- spawn source marker。
- exit volume。

贴图仍然用 atlas 和材质 preset，不要每面墙都独立贴图。复杂地图的高级感来自灯、门框、玻璃、标识、湿地面反光和遮挡，不是堆模型。

### 3.6 WaveDirectorSystem 接房间

现在波次主要从固定 spawn group 出怪。后续要变成：

```text
spawnGroupId -> roomId + position + layout
```

规则：

- 怪尽量从玩家没盯着的门、管道、玻璃舱后出现。
- 不要在玩家背后凭空刷。
- 同屏普通敌人仍控制 3-4 个。
- 多房间时，追击敌人可以跨门，但远房间敌人要休眠。

## 4. 一个多房间钥匙关卡长什么样

Level 02 可以这样组织：

```text
Observation Hall
  -> locked door: family_door
  -> needs key: family_access_card

Kitchen Simulation
  -> inspect nutrient dispenser
  -> pickup family_access_card
  -> first quiet horror line

Sleep Pod Room
  -> terminal reveals no human sleep record
  -> triggers small wave

Exit Corridor
  -> door opens after card + sleep pod terminal
  -> chase to elevator
```

对应 config 结构：

```ts
map: {
  rooms: [
    { id: "observation_hall", label: "观察走廊", mood: "uneasy", ... },
    { id: "kitchen_sim", label: "厨房模拟间", mood: "quiet", ... },
    { id: "sleep_pod_room", label: "睡眠舱", mood: "reveal", ... },
    { id: "exit_corridor", label: "出口走廊", mood: "combat", ... }
  ],
  doors: [
    {
      id: "family_door",
      fromRoomId: "observation_hall",
      toRoomId: "kitchen_sim",
      defaultState: "locked",
      lock: { type: "key_item", keyItemId: "family_access_card" }
    },
    {
      id: "exit_door",
      fromRoomId: "sleep_pod_room",
      toRoomId: "exit_corridor",
      defaultState: "locked",
      lock: { type: "objective_complete", objectiveId: "read_sleep_record" }
    }
  ],
  keyItems: [
    {
      id: "family_access_card",
      label: "家庭门禁片",
      roomId: "kitchen_sim",
      position: [3.2, 0, -4.5],
      requiredForDoorIds: ["family_door"],
      visualKey: "access_card_yellow"
    }
  ],
  interactions: [
    { id: "inspect_dispenser", type: "inspect", roomId: "kitchen_sim", ... },
    { id: "read_sleep_record", type: "terminal", roomId: "sleep_pod_room", ... },
    { id: "use_exit", type: "exit", roomId: "exit_corridor", ... }
  ]
}
```

## 5. 以后如何 config 生成多房间模式

生成多房间关卡时，本地机器人或人类策划不直接写代码，只输出一份合法 config。推荐生成顺序是固定的：

```text
1. 先生成 rooms
2. 再生成 doors，把 rooms 连成图
3. 再生成 keyItems，保证钥匙不在自己锁住的门后面
4. 再生成 interactions，告诉玩家每个房间能做什么
5. 再生成 objectiveChain，串起玩家目标
6. 再生成 waves，把战斗挂到房间进入、门打开、目标完成等触发点
7. 最后生成 exit，保证从出生房间可达
```

一个多房间 config 的最小骨架：

```ts
const generatedLevel = {
  id: "level_generated_residential_escape",
  title: "住宅模拟间",
  spawnPoint: [0, 0, 8],
  map: {
    id: "residential_simulation_map",
    schemaVersion: "hp.map.v1",
    rooms: [
      { id: "wake_room", label: "醒来房间", bounds: { center: [0, 0, 6], size: [7, 4, 7] }, mood: "quiet" },
      { id: "hallway", label: "家庭走廊", bounds: { center: [0, 0, -1], size: [5, 4, 9] }, mood: "uneasy" },
      { id: "kitchen", label: "厨房模拟间", bounds: { center: [-6, 0, -4], size: [7, 4, 7] }, mood: "reveal" },
      { id: "exit_room", label: "出口电梯间", bounds: { center: [0, 0, -11], size: [6, 4, 5] }, mood: "combat" }
    ],
    doors: [
      {
        id: "hallway_door",
        label: "走廊门",
        fromRoomId: "wake_room",
        toRoomId: "hallway",
        position: [0, 0, 2.2],
        size: [2.8, 3.2, 0.35],
        yaw: 0,
        defaultState: "closed",
        lock: { type: "none" },
        visualKey: "plain_lab_door"
      },
      {
        id: "kitchen_door",
        label: "厨房门禁",
        fromRoomId: "hallway",
        toRoomId: "kitchen",
        position: [-3.1, 0, -4],
        size: [2.8, 3.2, 0.35],
        yaw: 1.57,
        defaultState: "locked",
        lock: { type: "key_item", keyItemId: "yellow_access_card", lockedMessage: "缺少黄色门禁片。" },
        visualKey: "yellow_access_door"
      },
      {
        id: "exit_door",
        label: "出口门",
        fromRoomId: "hallway",
        toRoomId: "exit_room",
        position: [0, 0, -8],
        size: [3.4, 3.2, 0.35],
        yaw: 0,
        defaultState: "locked",
        lock: { type: "objective_complete", objectiveId: "read_sleep_record", lockedMessage: "家庭档案未确认。" },
        visualKey: "service_elevator_door"
      }
    ],
    keyItems: [
      {
        id: "yellow_access_card",
        label: "黄色门禁片",
        roomId: "wake_room",
        position: [1.6, 0, 4.2],
        collectRadius: 1.5,
        visualKey: "yellow_access_card",
        requiredForDoorIds: ["kitchen_door"],
        dialogueTrigger: "access_card_picked"
      }
    ],
    interactions: [
      { id: "inspect_photo", type: "inspect", roomId: "kitchen", position: [-7.2, 0, -3.1], radius: 1.7, visualKey: "faceless_photo", completesObjectiveId: "inspect_family_proof" },
      { id: "read_sleep_record", type: "terminal", roomId: "kitchen", position: [-5.5, 0, -6.5], radius: 1.7, visualKey: "sleep_record_terminal", completesObjectiveId: "read_sleep_record" },
      { id: "use_exit", type: "exit", roomId: "exit_room", position: [0, 0, -12.5], radius: 2.1, visualKey: "exit_panel" }
    ],
    navigation: {
      criticalPathRoomIds: ["wake_room", "hallway", "kitchen", "exit_room"],
      optionalRoomIds: [],
      maxBacktrackSeconds: 12,
      mobileReadableDoorCount: 2
    }
  },
  objectiveChain: [
    {
      id: "find_access_card",
      type: "collect_key",
      title: "找门禁片",
      detail: "打开走廊侧门。",
      requiredIds: ["yellow_access_card"],
      startsWhen: { type: "level_start" },
      completesWhen: { type: "key_collected", id: "yellow_access_card" },
      nextObjectiveId: "inspect_family_proof"
    },
    {
      id: "inspect_family_proof",
      type: "inspect_all",
      title: "确认住户档案",
      detail: "厨房里有一张没有脸的照片。",
      requiredIds: ["inspect_photo"],
      startsWhen: { type: "door_opened", id: "kitchen_door" },
      completesWhen: { type: "interaction_completed", id: "inspect_photo" },
      nextObjectiveId: "read_sleep_record"
    },
    {
      id: "read_sleep_record",
      type: "custom",
      title: "读取睡眠记录",
      detail: "终端说你从未睡过。",
      requiredIds: ["read_sleep_record"],
      startsWhen: { type: "interaction_completed", id: "inspect_photo" },
      completesWhen: { type: "interaction_completed", id: "read_sleep_record" },
      nextObjectiveId: "reach_exit"
    },
    {
      id: "reach_exit",
      type: "reach_exit",
      title: "进入出口电梯",
      detail: "门开了，别回头。",
      requiredIds: ["exit_door"],
      startsWhen: { type: "door_opened", id: "exit_door" },
      completesWhen: { type: "interaction_completed", id: "use_exit" }
    }
  ]
};
```

这段只是结构样例，不是要把 Level 02 固定成这个版本。真正运行时会再由 `InteractionSystem`、`DoorSystem`、`RoomDirectorSystem`、`WaveDirectorSystem` 读取它。

## 6. 生成器必须遵守的图规则

本地机器人生成多房间 config 后，必须先通过 validator：

- 出生房间必须存在。
- 出口房间必须可达。
- 每个门连接的两个房间必须存在。
- 需要钥匙的门，钥匙不能放在这扇门后面唯一可达区域。
- 关键路径不要超过 4-6 个房间，demo 单关优先 2-4 个房间。
- 每个房间最多 2 个重要门，避免手机玩家看不懂。
- 每个目标都必须有完成触发。
- 每个互动物都必须在它声明的房间 bounds 里。
- 每个锁住的门都必须有 `lockedMessage`，告诉玩家缺什么。

简单说：生成器生成的是“房间图”，validator 负责确认这个图不是死路。

## 7. Mobile-first 复杂地图规则

复杂不等于迷路。手机上最怕玩家不知道去哪，所以必须有硬规则：

- 一个房间最多同时让玩家看到 2 个重要门。
- 每 15-30 秒要有一个明确反馈：门响、广播、拾取、灯光变化、敌人出现。
- 钥匙必须是大物件，不做找针小游戏。
- 钥匙和对应门要有同色视觉语言，例如黄色门禁片对应黄色门灯。
- 走回头路不超过 10-15 秒。
- 所有门打不开都必须告诉玩家缺什么。
- 出口永远要比普通门更有仪式感：光、声音、地面引导线、镜头轻带向。

## 8. Config Validator 要加的检查

复杂地图必须先能被自动检查，不然本地机器人生成会经常坏：

- 每个 `door.fromRoomId/toRoomId` 都存在。
- 每个锁需要的 `keyItemId/objectiveId/waveId` 都存在。
- 从出生房间能走到出口房间。
- 必要钥匙不能放在被自己锁住的门后面。
- 主路径门数量不超过 mobile 预算。
- 每个目标都能完成，不能缺触发条件。
- 每个互动物都在某个 room bounds 内。
- 每个房间至少有一个可读 label 或视觉主题。

## 9. 推荐执行顺序

不要一次把所有都做完。最稳的顺序：

1. `InteractionSystem v1`：先让 config interaction 可以被检测和完成。
2. `MapProgressState`：存钥匙、门、目标状态。
3. `DoorSystem v1`：实体门、门禁提示、开门动画。
4. `MapGeometryRenderer v1`：用 config 生成简单房间、墙、门框和碰撞。
5. `RoomDirectorSystem v1`：进房间触发对白、刷怪、灯光和性能降级。
6. Level 02 用 3-4 个房间验证。
7. 加 `ConfigValidator`，防止 AI 生成死路。

一句话结论：

> 当前第一关暂时是单房间战斗教程，但不是 schema 限制；第一关、Level 02 或玩家生成关卡都可以用同一套 room graph 做多房间密室。先把门、钥匙、互动物和目标链做成 config runtime，再谈更复杂地图。这样后面本地机器人生成“人生密室”时，只是在组合房间和门锁，不是在生成代码。
