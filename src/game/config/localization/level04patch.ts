// Supplemental English for level 04: fields/strings added after the original inline
// dictionary was written (new puzzles, props, env states, route copy). Deep-merged
// over baseEnglishByLevel / baseEnglishTextByLevel in ../LevelLocalization.ts.
import type { LevelEnglishCopy, TextDictionary } from "../LevelLocalization";

export const level04ExtraEnglish: LevelEnglishCopy = {
  exit: {
    transitionMessage: "Every therapy light goes dark. A heavier reclamation drone rumbles in the distance.",
  },
  objectives: {
    level_04_calibrate_sedation: {
      title: "Calibrate the sedation line",
      detail: "The body chair's door is dosed from the sedation tower. Push all three gauges into the green and the door deems you fit to continue therapy.",
      hudLabel: "Sedation",
    },
  },
  // Wave presentation (objectiveTitle/objectiveDetail/startMessage) is resolved at
  // runtime by localizedWavePresentation, NOT by the text dictionary, so these must
  // live in structured copy or the HUD/start banner would still render Chinese.
  waves: {
    level_04_waiting_pressure: {
      label: "Clinic security",
      objectiveTitle: "Finish reading the chairs",
      objectiveDetail: "Do not stay in the waiting hall",
      startMessage: "Clinic security activated.",
      startWarning: { label: "Clinic security", detail: "Do not stay in the waiting hall" },
    },
    level_04_therapist_host: {
      label: "Therapist host",
      objectiveTitle: "Take down the therapist host",
      objectiveDetail: "Do not let it push you back among the chairs",
      startMessage: "Therapist host activated.",
      startWarning: { label: "Therapist host", detail: "Take it down, then leave" },
    },
  },
};

export const level04ExtraText: TextDictionary = {
  // Door labels
  "童年椅门": "Childhood chair door",
  "救援椅门": "Rescue chair door",
  "身体椅门": "Body chair door",
  "出院电梯门": "Discharge elevator door",
  // Lock / unlock messages
  "先读取童年治疗椅。": "Read the childhood therapy chair first.",
  "救援椅门已打开。": "Rescue chair door opened.",
  "镇静管路未校准，治疗门保持密封。": "Sedation line uncalibrated. The therapy door stays sealed.",
  "身体椅门已打开。": "Body chair door opened.",
  "治疗主管仍在线。": "The therapist host is still online.",
  // Pickup / interaction labels
  "救援投影": "Rescue projection",
  "身体投影": "Body projection",
  "镇静塔操作台": "Sedation tower console",
  "进入出口电梯": "Enter the exit elevator",
  // Exit unlock warning / cinematic
  "出口电梯已开": "Exit elevator open",
  "离开治疗剧场": "Leave the therapy theater",
  "出口电梯正在接管关卡切换。": "The exit elevator is taking over the level transition.",
  // Sedation puzzle
  "镇静管路校准": "Sedation line calibration",
  "镇静塔的三路药剂互相牵制：氧化剂推供流，镇静剂加深度，冷却液压管温。三块表全部进绿区——窗口期过了塔会自动泄药复位。": "The tower's three agents counter each other: oxidizer pushes flow, sedative deepens it, coolant lowers line temperature. Get all three gauges into the green; once the window passes the tower auto-purges and resets.",
  "氧化剂": "Oxidizer",
  "镇静剂": "Sedative",
  "冷却液": "Coolant",
  "供流": "Flow",
  "镇静深度": "Sedation depth",
  "管温": "Line temp",
  "镇静塔泄药复位。": "Sedation tower purged and reset.",
  // Guidance label / detail
  "候诊区中央，窗口期内完成": "Center of the waiting area, finish within the window",
  // Spawn warnings
  "管路报警": "Line alarm",
  "候诊区安保被惊动": "Waiting-area security alerted",
  // Reward pulses
  "管路校准完成": "Line calibration complete",
  "身体椅门接受了你的剂量": "The body chair door accepted your dose",
  "治疗档案 +28": "Therapy record +28",
  "人类层记录进入缓存": "Human-layer record entered the cache",
  "路线加深": "Route deepened",
  "痛觉记录 +8": "Pain record +8",
  "你保留了反应": "You kept your reaction",
  // Upgrade / environment messages
  "治疗主管离线。身体把镇静信号改成强化。": "Therapist host offline. The body rewrites the sedation signal into a surge.",
  "镇静闪烁": "Sedation flicker",
  // Spawn source labels
  "候诊厅": "Waiting hall",
  "身体治疗椅": "Body therapy chair",
  // Wave / death-beat warnings
  "诊所安保": "Clinic security",
  "击倒后离开诊所": "Take it down, then leave the clinic",
  "治疗主管离线": "Therapist host offline",
  "诊所后门已开": "The rear clinic door is open",
  "击倒后离开": "Take it down, then leave",
  // Wave presentation / start messages
  "诊所安保启动。": "Clinic security activated.",
  "诊所继续部署维护单位。": "The clinic keeps deploying maintenance units.",
  "不要停在候诊厅": "Do not stay in the waiting hall",
  "别被推回椅子间": "Do not let it push you back among the chairs",
  "治疗主管启动。": "Therapist host activated.",
  // Revive message
  "你在治疗椅旁醒来，灯光还在闪。": "You wake beside the therapy chair. The lights are still flickering.",
  // Keypad direction labels
  "西 3": "West 3",
  "东 8": "East 8",
};
