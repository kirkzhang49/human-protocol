// Supplemental English for level 01: fields/strings added after the original inline
// dictionary was written (new puzzles, props, env states, route copy). Deep-merged
// over baseEnglishByLevel / baseEnglishTextByLevel in ../LevelLocalization.ts.
import type { LevelEnglishCopy, TextDictionary } from "../LevelLocalization";

export const level01ExtraEnglish: LevelEnglishCopy = {
  // Power-reroute objective added after the inline dictionary was written. Title,
  // detail and hudLabel render via localizedObjective (structured), not configText.
  objectives: {
    level_01_route_power: {
      title: "Reroute the bay power",
      detail: "The elevator lost power. The tool-alcove distribution panel can route mains back to the elevator and main lights.",
      hudLabel: "Reroute Power",
    },
  },
  // Wave presentation copy renders via localizedWavePresentation (structured). The
  // same zh also gets caught by the inline coverage walk, so it is mirrored into
  // level01ExtraText below.
  waves: {
    first_contact: {
      label: "First Contact",
    },
    wave_01: {
      label: "Lockdown Response",
      objectiveTitle: "Hold the reroute gain",
      objectiveDetail: "Restored power woke the lockdown squad",
      startWarning: { label: "Lockdown Response", detail: "Push forward. Do not stray far from the tool alcove" },
    },
    wave_02: {
      label: "Pincer Wave",
      objectiveTitle: "Hold against the pincer",
      objectiveDetail: "They will come from the flank and rear",
      startWarning: { label: "Pincer Wave", detail: "The flank-rear door is open too" },
    },
    elite_wave: {
      objectiveTitle: "Drive back the supervisor",
      objectiveDetail: "Do not stay in close range",
      startWarning: { detail: "Close-range danger" },
    },
    exit_chase: {
      label: "Exit Chase",
      objectiveTitle: "Run for the elevator",
      objectiveDetail: "More behind you",
      startWarning: { detail: "Fight and run" },
    },
  },
};

export const level01ExtraText: TextDictionary = {
  // Doors / interactions / pickups / decals (configText-rendered labels).
  "工具间门": "Tool alcove door",
  "配电重接面板": "Power reroute panel",
  "修复箱": "Repair crate",
  "人体比例参考": "Body proportion reference",
  "手部资产参考": "Hand asset reference",
  "脊柱映射参考": "Spine mapping reference",
  // Power-reroute objective guidance (configText via buildGuidance).
  "工具间配电面板": "Tool alcove power panel",
  "顺着电缆槽走到西侧工具间": "Follow the cable run to the west tool alcove",
  // Circuit-grid puzzle copy.
  "维修舱配电重接": "Maintenance bay power reroute",
  "市电从左侧进。把导线转到位，同时喂给维修电梯和主照明——工具挂板下的线路图就是接法。": "Mains enters from the left. Turn the lines into place to feed the service elevator and main lights at once — the wiring diagram under the tool board shows the run.",
  "市电": "Mains",
  "电梯": "Elevator",
  "照明": "Lighting",
  "回路没有闭合。": "The circuit is not closed.",
  "供电恢复": "Power restored",
  "电梯亮了——广播也注意到了": "The elevator lit up — and the broadcast noticed",
  // Environment-state labels.
  "维修主照明": "Bay main lighting",
  "应急低照明": "Emergency low lighting",
  "维修封锁暗场": "Lockdown blackout",
  "电梯锁定红灯": "Elevator locked, red light",
  "电梯开放蓝灯": "Elevator open, blue light",
  // Cinematic reward pulses / spawn warnings.
  "门锁死了": "The door is sealed",
  "你见过这里": "You have seen this place",
  "别恋战，进电梯": "Do not linger. Get in the elevator",
  // Exit cinematic message.
  "维修电梯正在接管关卡切换。": "The service elevator is taking over the level transition.",
  // Wave start messages.
  "维修单位正在部署。": "Maintenance units deploying.",
  "增援维修单位已部署。": "Reinforcement maintenance units deployed.",
  "维修主管正在接近。": "The maintenance supervisor is approaching.",
  // Wave labels / objective text mirrored from the structured waves block so the
  // inline coverage walk also resolves them.
  "初次接触": "First Contact",
  "封锁响应": "Lockdown Response",
  "夹击波": "Pincer Wave",
  "出口追击": "Exit Chase",
  "守住配电成果": "Hold the reroute gain",
  "供电恢复惊动了封锁队": "Restored power woke the lockdown squad",
  "正面推进，别离工具间太远": "Push forward. Do not stray far from the tool alcove",
  "顶住夹击": "Hold against the pincer",
  "侧后方会来": "They will come from the flank and rear",
  "侧后方的门也开了": "The flank-rear door is open too",
  "击退主管": "Drive back the supervisor",
  "别贴太久": "Do not stay in close range",
  "近身危险": "Close-range danger",
  "跑向电梯": "Run for the elevator",
  "背后还有": "More behind you",
  "边打边跑": "Fight and run",
};
