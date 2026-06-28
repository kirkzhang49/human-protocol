import type { LevelPuzzleDefinition } from "../../schema/levelConfig";

export const level02Puzzles: readonly LevelPuzzleDefinition[] = [
    {
      id: "level_02_care_room_puzzle",
      type: "circuit_grid",
      label: "工具档案校准",
      roomId: "level_02_care_room",
      interactionId: "level_02_care_panel",
      guidance: "把维修台左侧供能接到门禁节点。主管离线后再改接，灯控室门才会放行。",
      columns: 4,
      rows: 3,
      sources: [{ x: 0, y: 1, label: "维修台" }],
      targets: [{ x: 3, y: 1, label: "灯控门禁" }],
      cells: [
        { x: 0, y: 1, kind: "cross", locked: true },
        { x: 1, y: 1, kind: "straight", rotation: 0 },
        { x: 2, y: 1, kind: "straight", rotation: 0 },
        { x: 3, y: 1, kind: "cross", locked: true },
        { x: 1, y: 0, kind: "blocked" },
        { x: 1, y: 2, kind: "blocked" },
        { x: 2, y: 0, kind: "blocked" },
        { x: 2, y: 2, kind: "blocked" },
      ],
      fail: {
        message: "门禁回路没有闭合。",
        cameraImpact: { shake: 0.14, fovKick: 0.6 },
        audio: { key: "enemy_hit", intensity: 0.36 },
      },
      success: {
        opensDoorId: "level_02_light_room_door",
        dialogueTrigger: "level_02_care_panel_done",
        rewardPulse: { label: "维修台校准", detail: "灯控室门已解锁", rarity: "rare" },
        rewardPulseDuration: 1.45,
        cameraImpact: { shake: 0.26, fovKick: 1.2 },
        audio: { key: "system_exit_open", intensity: 0.72 },
      },
    },
    // Remaster: the lamp hit-sequence became an observation-wall match. The id
    // is kept so the exit-door lock, objective chain, and events stay stable.
    {
      id: "level_02_light_sequence",
      type: "surveillance_match",
      label: "家庭作息比对",
      roomId: "level_02_light_room",
      interactionId: "level_02_observation_panel",
      guidance: "观察台回放四段“家人”作息。照片墙和婴儿床的标签知道每个人属于哪里——第四段只有雪花。",
      channels: [
        { id: "routine_father", label: "作息A", symbol: "◐", feedDetail: "系着围裙，在厨台前重复同一个切菜动作。", answerOptionId: "spot_kitchen" },
        { id: "routine_mother", label: "作息B", symbol: "◑", feedDetail: "坐在沙发正中，面向电视，三小时没有变换姿势。", answerOptionId: "spot_sofa" },
        { id: "routine_child", label: "作息C", symbol: "◒", feedDetail: "婴儿床栏杆后的轮廓。监护天线指示灯常亮。", answerOptionId: "spot_crib" },
        { id: "routine_static", label: "作息D", symbol: "▩", feedDetail: "信号源存在，画面却是空的。计时器仍在走。", answerOptionId: "spot_none" },
      ],
      options: [
        { id: "spot_kitchen", label: "样板厨台", symbol: "◐" },
        { id: "spot_sofa", label: "观察沙发", symbol: "◑" },
        { id: "spot_crib", label: "婴儿床", symbol: "◒" },
        { id: "spot_none", label: "查无此人", symbol: "▩" },
      ],
      maxMistakes: 3,
      fail: {
        message: "比对失败，作息重新洗牌。",
        cameraImpact: { shake: 0.18, fovKick: 0.7 },
        audio: { key: "enemy_hit", intensity: 0.42 },
        actions: [
          { type: "spawn_warning", warning: { label: "比对重置", detail: "客厅安保频率上升" }, duration: 1.45 },
          { type: "tempo_surge", duration: 2.4 },
        ],
      },
      success: {
        opensDoorId: "level_02_family_exit_door",
        unlockExit: true,
        dialogueTrigger: "level_02_light_sequence_done",
        rewardPulse: { label: "家庭门禁解除", detail: "客厅尽头的门打开了", rarity: "epic" },
        rewardPulseDuration: 1.75,
        cameraImpact: { shake: 0.48, fovKick: 2.3, rumble: 0.24, rumbleDuration: 0.28 },
        effects: [{ type: "dashBurst", position: [0, 0, -7.9], direction: [0, 0, 1], lifetime: 0.48, intensity: 2.1 }],
        audio: { key: "system_exit_open", intensity: 1 },
      },
    },
  ];
