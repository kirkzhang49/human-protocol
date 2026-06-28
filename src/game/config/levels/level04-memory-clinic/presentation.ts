import type { LevelPresentationConfig } from "../../schema/levelConfig";
import { campaignPresentationBase } from "../../shared/campaignDefaults";

export const level04Presentation: LevelPresentationConfig = {
  ...campaignPresentationBase,
  defaultWaveStartMessage: "",
  reinforcementMessage: "",
  waveLabels: {},
  objectives: {
    ...campaignPresentationBase.objectives,
    default: { title: "穿过记忆诊所", detail: "核对三段记忆" },
    exitUnlocked: { title: "进入出院电梯", detail: "记录未关闭", progressLabel: "出院电梯", progressText: "进入" },
  },
  flow: {
    ...campaignPresentationBase.flow,
    title: {
      system: "记忆诊所",
      heading: "记忆诊所 04",
      body: "这里不治疗伤口，只校准你相信过的记忆。",
      signalStrip: ["候诊白线", "童年回放", "出院记录"],
      startButton: "进入诊所",
    },
    transition: { system: "出院电梯", heading: "记录未关闭" },
    victory: {
      system: "治疗记录",
      heading: "记忆留置",
      body: "诊所没有治好你，只确认这些记忆会跟着你走。",
      doubleMemoryButton: "看广告 x2 积分",
      doubleMemoryClaimedButton: "x2 积分已领取",
      replayButton: "再次进入诊所",
    },
  },
  waves: [],
  spawnSourceLabels: campaignPresentationBase.spawnSourceLabels,
  reinforcementWarningDuration: 1.45,
  environmentPressure: {
    title: 0.32,
    death: 0.82,
    idle: 0.38,
    exitUnlocked: 0.72,
    byWave: {},
  },
};
