# Human Protocol 通用墙面门控手把计划

Status: planning only, June 2026.

本文记录一个通用机制：墙面手把 / 电梯按钮式门控开关。它不是 Level 4 专属家具，而是所有关卡和 `/build` 都可以使用的 config-driven 机关。

## 目标体验

玩家看到一个贴在墙上的门控按钮或短把手。靠近后出现 `E 使用门控`。按下后：

1. 武器临时收起。
2. 第一人称右手伸出，像按电梯门按钮一样按下去，或者轻压短把手。
3. 手接触按钮的瞬间触发 switch 状态切换。
4. 一扇门打开，另一扇门关闭，或者按 config 控制多扇门。
5. 镜头可以切到门前，看见每扇关键门约 2 秒的开关动画。
6. 回到玩家视角，武器恢复。

默认交互不是一次性。玩家可以反复按同一个手把：

- 第一次：`state_a -> state_b`。
- 第二次：`state_b -> state_a`。
- 后续继续循环。
- 只有 config 显式写 `oneShot: true` 时才只能用一次。

## 设计原则

- 代码只拥有通用动词：按手把、切状态、开门、关门、播放镜头。
- config 拥有关卡名词：哪个手把、哪些门、哪个状态、镜头顺序、提示文案。
- `/build` 必须能添加、移动、保存、导入、导出这个机关。
- 手把是墙面挂载物，不是自由漂浮 prop。房间移动或墙移动时，手把跟着墙走。
- validator 必须能判断玩家是否仍然可以通关，不能只检查 ID 是否存在。

## Config 需求

### Door lock 新类型

建议新增 `switch_state` 门锁：

```ts
lock: {
  type: "switch_state",
  switchId: "door_switch_a",
  stateId: "route_b",
  lockedMessage: "门控线路未切到本侧。"
}
```

含义：门只有在指定 switch state 下可打开。

注意：对简单的“一开一关门组”，可以只用 switch actions 管门状态，不一定每扇门都加 `switch_state` lock。`switch_state` lock 更适合需要强约束的门，比如只有当线路切到 B 时这扇门才允许玩家手动打开。

### Switch presentation

现有 `switches[]` 应扩展表现层字段，而不是新增平行机制：

```ts
{
  id: "door_switch_a",
  roomId: "control_room",
  interactionId: "door_switch_a_interaction",
  initialStateId: "route_a",
  oneShot: false,
  cycling: { mode: "next", wrap: true },
  presentation: {
    kind: "wall_button",
    modelKey: "hp_wall_door_switch_button_v1",
    handPose: "elevator_button_press",
    hideWeapon: true,
    useDurationSec: 0.65,
    commitAtSec: 0.34,
    doorRevealSec: 2,
    revealMode: "door_front"
  },
  states: [
    {
      id: "route_a",
      label: "候诊通道",
      actions: [
        { type: "open_door", doorId: "waiting_door" },
        { type: "close_door", doorId: "treatment_door" }
      ]
    },
    {
      id: "route_b",
      label: "治疗通道",
      actions: [
        { type: "close_door", doorId: "waiting_door" },
        { type: "open_door", doorId: "treatment_door" }
      ]
    }
  ]
}
```

### Wall mount

手把在 builder source 里应该以墙面挂载存储：

```ts
wallMount: {
  roomId: "control_room",
  side: "north",
  offset: 0.42,
  height: 1.15,
  inset: 0.06
}
```

含义：

- `roomId`: 挂在哪个房间。
- `side`: 房间哪面墙。
- `offset`: 沿墙横向位置，建议使用归一化 `-1..1` 或米制局部坐标，最终实现时统一。
- `height`: 离地高度，电梯按钮建议 1.1-1.25m。
- `inset`: 离墙面偏移，避免 z-fighting 或穿墙。

拖动手把时只允许沿墙移动。房间移动、缩放、旋转、auto-align 后，手把世界坐标应由 wall mount 重新计算。

## `/build` 需求

### Door Inspector

门的锁类型增加：

- 中文：`可切换门控`
- 英文：`Toggle Door Switch`

选择后：

- 如果附近没有 switch，提供 `创建墙面手把`。
- 如果已有 switch，允许选择一个 switch + state。
- 显示当前门受哪些 switch actions 影响。
- 能跳转选中绑定的手把。

### Switch Inspector

新增一个墙面手把 inspector，或复用 route switch inspector 的输出列表。第一版建议只支持两态：

- `route_a`
- `route_b`

每个 state 可配置：

- 打开哪些门。
- 关闭哪些门。
- 是否解锁 / 锁定某些门。
- 玩家提示文案。
- door reveal 顺序。
- 是否 `oneShot`，默认 false。

### Canvas / Preview

2D builder 里：

- 手把显示在墙边，不显示在房间中央。
- 选中时显示绑定线到受控门。
- 拖动时沿墙吸附。

3D builder preview 里：

- 手把贴墙显示。
- 当前状态灯红 / 青 / 暗。
- 可以点选。
- 如果手把引用的 modelKey 缺失，用明确 debug proxy，但 QA 必须报错，不能静默当成方块。

## Runtime 需求

### Hand interaction state

新增一个短暂交互状态，例如：

```ts
activeHandInteraction: {
  interactionId: string;
  switchId: string;
  handPose: "elevator_button_press" | "lever_push_down";
  elapsed: number;
  duration: number;
  commitAt: number;
  committed: boolean;
  hideWeapon: boolean;
}
```

流程：

1. `InteractionSystem` 发现当前 interaction 是 physical switch。
2. 玩家按 `E`。
3. world 进入 hand interaction，不立即触发 switch。
4. viewmodel 收武器，右手伸出按按钮。
5. 到 `commitAt` 时调用 `activateSwitch` 或 `chooseSwitchState`。
6. 根据 state actions 开门 / 关门。
7. 启动 door reveal queue。
8. hand animation 和 reveal 结束后回到普通 playing。

### Door reveal queue

现有 focus reveal 已能看门。需要扩展成队列：

```ts
doorRevealQueue: [
  { doorId: "waiting_door", mode: "close", durationSec: 2 },
  { doorId: "treatment_door", mode: "open", durationSec: 2 }
]
```

规则：

- 默认只 reveal 被 config 标记的重要门，避免每次切换拖太久。
- 如果同时开关多门，最多展示 2 扇；其余用声音和状态灯反馈。
- door close 也要可见，不能只支持 opening reveal。
- 关门碰撞要安全：玩家或敌人在门洞时，应延迟碰撞恢复，或让门先视觉关闭但物理闭合等门洞清空。

### Viewmodel

第一版不做复杂 IK。用第一人称手部 montage：

- 武器透明/下沉。
- 右手从右下进入。
- 食指/手掌按按钮。
- 按下瞬间触发状态。
- 手缩回，武器恢复。

后续可增加精确对准 3D 按钮位置，但第一版以稳定和移动端可读为优先。

## Validator 需求

现有静态 graph simulation 对普通锁链够用，但对“开一扇、关一扇、可反复切换”的状态机不够强。需要 bounded BFS。

搜索状态至少包含：

- 当前玩家房间。
- 已打开门集合。
- 已解锁门集合。
- switch 当前 state。
- one-shot switch 是否已使用。
- 已拿 key。
- 已完成 puzzle / objective。
- exit 是否 unlocked。

搜索动作：

- 通过已打开 / 可打开门移动到相邻房间。
- 使用当前房间内可达 switch。
- 拿 key。
- 完成可达 puzzle。
- 触发 objective / runtime events。
- 使用 exit interaction。

终止条件：

- 找到 exit interaction 且 exit unlocked：通过。
- 状态数超过上限：报复杂度 warning，并输出已探索状态数。
- 无新状态且未到出口：失败。

必须报错：

- `switch_state` 引用不存在的 switch 或 state。
- switch action 引用不存在的 door。
- wall mount 引用不存在的 room / wall side。
- 手把被自己控制的锁门隔在不可达区域。
- one-shot switch 一按就把玩家锁死。
- 关键门从未在任何状态组合里打开。
- exit room 可达但 exit interaction 的 prerequisites 永远不满足。

## 资产需求

第一批通用 modelKey：

- `hp_wall_door_switch_button_v1`
- `hp_wall_door_switch_lever_v1`

第一版优先按钮，不优先拉杆。

按钮资产要求：

- 尺寸：约 0.34m 宽、0.54m 高、0.08m 深。
- 挂载高度：默认离地 1.15m。
- 轮廓：远看像墙上的电梯门控按钮，不像普通终端屏。
- 可动节点：`button_cap`。
- 状态灯节点：`status_light_red`、`status_light_cyan` 或一个可切 material 的 `status_light`。
- 材质槽：`body_metal`、`edge_trim`、`button_surface`、`status_emissive`、`tiny_warning_decal`。
- 不烘关卡文字；标签和提示走 runtime copy。
- 碰撞：只做很薄的墙面交互热点，不阻挡玩家。

拉杆资产要求：

- 尺寸：约 0.28m 宽、0.62m 高、0.16m 深。
- 可动节点：`lever_handle`，支持上 / 下两个状态。
- 把手不能长到挡路；只作为墙面可视机关。

生产线：

1. blueprint 写清尺寸、状态、材质槽、碰撞。
2. math-first 检查高度、按钮大小、第一人称可读距离、墙面不穿帮。
3. Blender 生成 GLB，保留 `.blend`。
4. Image2 atlas 生成金属、状态灯、细节贴图。
5. 记录 provenance 和 prompts。
6. 转 builder asset pack。
7. emit registry/catalog/footprint。
8. rebuild Raw WebGPU builder resource pack。
9. thumbnails + builder WGPU QA。

## 最小落地顺序

1. Schema：加 `switch_state` lock、switch presentation、wallMount。
2. Builder types：加 `BuilderWallDoorSwitch` 或扩展现有 route switch family。
3. Build Page：能从 Door Inspector 创建/绑定手把。
4. Compiler：Builder wall switch -> Level interaction + Level switch + optional door `switch_state` lock。
5. Runtime：hand interaction montage + repeatable switch cycling。
6. Door reveal queue：支持 open/close 约 2 秒展示。
7. Validator：bounded BFS，证明可通关。
8. Smoke level：一个手把，A/B 两态，一开一关，必须能反复切换且通关。
9. 资产 pipeline：通用按钮 GLB/Image2/pack/registry/Raw/thumbnail/QA。
10. 再把机制用于 L4 或其它 official builder level。

## 非目标

- 第一版不做复杂 IK。
- 第一版不做三态以上路线迷宫，先做两态 A/B。
- 第一版不把手把写死给 Level 4。
- 不用 UI 弹窗替代 3D 手按动作。
- 不手改 generated Raw WebGPU JSON。
