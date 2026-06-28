// Supplemental English for level 02: fields/strings added after the original inline
// dictionary was written (new puzzles, props, env states, route copy). Deep-merged
// over baseEnglishByLevel / baseEnglishTextByLevel in ../LevelLocalization.ts.
import type { LevelEnglishCopy, TextDictionary } from "../LevelLocalization";

export const level02ExtraEnglish: LevelEnglishCopy = {
  presentationObjectives: {
    default: { title: "Open the family gate", detail: "Clear the lobby, enter the right room, calibrate the lock." },
    exitUnlocked: { title: "Cross the living-room exit", detail: "Enter the elevator.", progressLabel: "Exit open", progressText: "Go" },
  },
  objectives: {
    level_02_clear_living: {
      title: "Clear the living simulation",
      detail: "Destroy the domestic units in the lobby to unlock the right-side maintenance room.",
      hudLabel: "Clear",
    },
    level_02_open_care_room: {
      title: "Open domestic maintenance",
      detail: "Once the lobby is safe, open the right-side maintenance room.",
      hudLabel: "Right Door",
    },
    level_02_defeat_carekeeper: {
      title: "Drop the domestic host",
      detail: "The host guards the maintenance desk. Disable it, then use the desk.",
      hudLabel: "Host",
    },
    level_02_solve_care_panel: {
      title: "Calibrate the maintenance desk",
      detail: "Route the desk circuit into the lighting-room lock.",
      hudLabel: "Desk",
    },
    level_02_open_light_room: {
      title: "Open lighting control",
      detail: "After the desk is calibrated, open the lighting room across the lobby.",
      hudLabel: "Lighting Room",
    },
    level_02_solve_lights: {
      title: "Match the household routine",
      detail: "The desk replays four routines; the fourth does not belong to this home.",
      hudLabel: "Routine Match",
    },
    level_02_reach_exit: {
      title: "Cross the family gate",
      detail: "Once the lighting order is confirmed, the far door is open. Enter the elevator.",
      hudLabel: "Escape",
    },
  },
  waves: {
    level_02_living_swarm: {
      label: "Living-room clear",
      objectiveTitle: "Clear the living simulation",
      objectiveDetail: "The right door unlocks after the room is clear",
      startMessage: "Domestic units are approaching.",
      startWarning: { label: "Living-room clear", detail: "Destroy the domestic units" },
    },
    level_02_carekeeper_host: {
      objectiveTitle: "Drop the domestic host",
      objectiveDetail: "The host guards the maintenance desk",
      startMessage: "The domestic host is online.",
      startWarning: { detail: "Disable it, then use the desk" },
    },
  },
  dialogues: {
    level_02_light_locked_01: {
      line: "Family lighting room locked. Waiting for maintenance-desk calibration.",
    },
    level_02_living_clear_01: {
      speaker: "Door System",
      line: "Living simulation threat cleared. Right-side maintenance room unlocked.",
    },
    level_02_care_room_open_01: {
      speaker: "Nearby Broadcast",
      line: "Domestic maintenance open. Host unit restoring.",
    },
    level_02_care_room_01: {
      line: "The host is inside. Disable it first, then use the maintenance desk.",
    },
    level_02_host_spawn_01: {
      line: "Unauthorized maintenance. Beginning gentle reclamation.",
    },
    level_02_host_down_01: {
      line: "Host offline. The maintenance desk can reroute the lighting lock.",
    },
    level_02_care_panel_done_01: {
      speaker: "Door System",
      line: "Maintenance desk calibrated. Family lighting control released.",
    },
    level_02_light_room_open_01: {
      line: "Lighting room open. Restore illumination in household order.",
    },
  },
};

export const level02ExtraText: TextDictionary = {
  "找开着的小房间": "Find the open side room",
  // Exit unlock warning + cinematic (inline)
  "出口电梯已开": "Exit elevator open",
  "穿过客厅尽头的门": "Take the door at the far end of the living room",
  "出口电梯正在接管关卡切换。": "The exit elevator is taking over level transfer.",
  // Map: door + interaction labels, story reward pulses
  "尽头电梯门": "Far elevator door",
  "家政维修间门": "Domestic maintenance door",
  "家庭灯控室门": "Family lighting control door",
  "先清掉生活模拟大厅里的家政单位。": "Clear the domestic units in the living simulation first.",
  "大厅威胁清除，家政维修间已解锁。": "Lobby threat cleared. Domestic maintenance unlocked.",
  "先完成家政维修间的工具档案校准。": "Complete the domestic maintenance calibration first.",
  "无脸照片墙": "Faceless photo wall",
  "全家福备注": "Family portrait note",
  "爸爸：厨台。妈妈：沙发。孩子：婴儿床。": "Dad: kitchen counter. Mom: sofa. Child: crib.",
  "监听婴儿床": "Listen to the crib",
  "婴儿床标签": "Crib label",
  "登记成员：3。监护信道：4。": "Registered members: 3. Monitor channels: 4.",
  "家政维修台": "Domestic maintenance desk",
  "家庭观察台": "Family observation desk",
  "进入出口电梯": "Enter the exit elevator",
  // Puzzle: maintenance panel
  "工具档案校准": "Tool archive calibration",
  "把维修台左侧供能接到门禁节点。主管离线后再改接，灯控室门才会放行。": "Route the desk power into the lock node. After the host is offline, reroute it to release lighting control.",
  "维修台": "Maintenance desk",
  "灯控门禁": "Lighting lock",
  "门禁回路没有闭合。": "The lock circuit is not closed.",
  "维修台校准": "Maintenance desk calibrated",
  "灯控室门已解锁": "Lighting control unlocked",
  // Puzzle: surveillance match (label, guidance, channels, options, fail)
  "家庭作息比对": "Family routine match",
  "观察台回放四段“家人”作息。照片墙和婴儿床的标签知道每个人属于哪里——第四段只有雪花。": "The desk replays four \"family\" routines. The photo wall and crib labels know where each one belongs - the fourth is only static.",
  "作息A": "Routine A",
  "系着围裙，在厨台前重复同一个切菜动作。": "Wearing an apron, repeating the same chopping motion at the counter.",
  "作息B": "Routine B",
  "坐在沙发正中，面向电视，三小时没有变换姿势。": "Sitting dead center on the sofa, facing the TV, unmoved for three hours.",
  "作息C": "Routine C",
  "婴儿床栏杆后的轮廓。监护天线指示灯常亮。": "A shape behind the crib rails. The monitor antenna light stays on.",
  "作息D": "Routine D",
  "信号源存在，画面却是空的。计时器仍在走。": "The signal source exists, but the feed is empty. The timer keeps running.",
  "样板厨台": "Show kitchen counter",
  "观察沙发": "Observation sofa",
  "查无此人": "No such person",
  "比对失败，作息重新洗牌。": "Match failed. Routines reshuffled.",
  "比对重置": "Match reset",
  "客厅安保频率上升": "Living-room security frequency rising",
  // Objective guidance labels/details (inline)
  "照片墙": "Photo wall",
  "客厅尽头": "Far end of the living room",
  "客厅西侧": "West side of the living room",
  "第四段只有雪花": "The fourth is only static",
  "清大厅，进右房，校准门禁": "Clear the lobby, enter the right room, calibrate the lock",
  "进入电梯": "Enter the elevator",
  "生活区清剿": "Living-room clear",
  "清掉生活模拟大厅": "Clear the living simulation",
  "右门会在清剿后解锁": "The right door unlocks after the room is clear",
  "击毁大厅家政单位": "Destroy the domestic units",
  "大厅东侧": "East side of the lobby",
  "右门": "Right door",
  "击倒家政主管": "Drop the domestic host",
  "主管守着维修台": "The host guards the maintenance desk",
  "家政主管启动。": "The domestic host is online.",
  "击倒后使用维修台": "Disable it, then use the desk",
  "压住它，维修台快能用了": "Keep pressure on it. The desk is almost usable",
  "维修台可以校准了": "The maintenance desk can be calibrated",
  // Wave presentation (inline)
  "右侧维修间": "Right-side maintenance room",
  "击倒后校准维修台": "Calibrate the desk after disabling it",
};
