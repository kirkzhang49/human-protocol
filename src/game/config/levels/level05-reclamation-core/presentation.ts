import type { LevelPresentationConfig } from "../../schema/levelConfig";
import { campaignPresentationBase } from "../../shared/campaignDefaults";

export const level05Presentation: LevelPresentationConfig = {
  ...campaignPresentationBase,
  defaultWaveStartMessage: "",
  reinforcementMessage: "",
  waveLabels: {},
  objectives: {
    ...campaignPresentationBase.objectives,
    default: { title: "穿过回收核心", detail: "前往撤离电梯" },
    exitUnlocked: { title: "进入撤离电梯", detail: "电梯已经接管", progressLabel: "撤离电梯", progressText: "进入" },
  },
  flow: {
    ...campaignPresentationBase.flow,
    title: {
      system: "回收核心",
      heading: "回收核心 05",
      body: "回收中庭保留终局入口。剧情文字暂不接入。",
      signalStrip: ["空中庭", "空内台", "撤离电梯"],
      startButton: "进入核心",
    },
    transition: { system: "撤离电梯", heading: "出口接管" },
    victory: {
      system: "撤离记录",
      heading: "核心出口",
      body: "终局空间已保留，等待视频接入。",
      doubleMemoryButton: "看广告 x2 积分",
      doubleMemoryClaimedButton: "x2 积分已领取",
      replayButton: "再次进入核心",
    },
  },
  waves: [],
  spawnSourceLabels: campaignPresentationBase.spawnSourceLabels,
  reinforcementWarningDuration: 1.45,
  environmentPressure: {
    title: 0.44,
    death: 0.9,
    idle: 0.5,
    exitUnlocked: 0.82,
    byWave: {},
  },
};
