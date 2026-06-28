import type { LevelPresentationConfig } from "../../schema/levelConfig";
import { campaignPresentationBase } from "../../shared/campaignDefaults";

export const level02Presentation: LevelPresentationConfig = {
    ...campaignPresentationBase,
    defaultWaveStartMessage: "家政单位正在接近。",
    reinforcementMessage: "家政单位正在重组。",
    waveLabels: {
      level_02_living_swarm: "生活区清剿",
      level_02_carekeeper_host: "家政主管",
    },
    objectives: {
      ...campaignPresentationBase.objectives,
      default: { title: "打开家庭门禁", detail: "清大厅，进右房，校准门禁" },
      exitUnlocked: { title: "穿过客厅出口", detail: "进入电梯", progressLabel: "出口已开", progressText: "走" },
    },
    flow: {
      ...campaignPresentationBase.flow,
      title: {
        system: "生活区",
        heading: "居住模拟间 02",
        body: "电梯门打开，外面不是出口，是一套会记住你反应的样板间。",
        signalStrip: ["家庭门禁", "旧作息", "照护校准"],
        startButton: "进入生活区",
      },
      transition: {
        system: "家庭门禁",
        heading: "门后没有家",
      },
      victory: {
        system: "档案片段",
        heading: "居住记录",
        body: "这里没有住户。相框、厨房和灯，只是在确认你会不会回头找家。",
        doubleMemoryButton: "看广告 x2 积分",
        doubleMemoryClaimedButton: "x2 积分已领取",
        replayButton: "再来一次",
      },
    },
    waves: [
      {
        id: "level_02_living_swarm",
        label: "生活区清剿",
        objectiveTitle: "清掉生活模拟大厅",
        objectiveDetail: "右门会在清剿后解锁",
        startMessage: "家政单位正在接近。",
        startWarning: { label: "生活区清剿", detail: "击毁大厅家政单位" },
        startWarningDuration: 2.15,
        startDialogueTrigger: "level_02_living_entry",
        startAudio: { key: "assist_reorient", intensity: 0.72 },
      },
      {
        id: "level_02_carekeeper_host",
        label: "家政主管",
        objectiveTitle: "击倒家政主管",
        objectiveDetail: "主管守着维修台",
        startMessage: "家政主管启动。",
        startWarning: { label: "家政主管", detail: "击倒后使用维修台" },
        startWarningDuration: 2.25,
        startDialogueTrigger: "level_02_host_spawn",
        startAudio: { key: "elite_warning", intensity: 1.12 },
        startCamera: { shake: 0.52, fovKick: 2.8 },
      },
    ],
    spawnSourceLabels: {
      ...campaignPresentationBase.spawnSourceLabels,
      level02_living_ring: "生活区四周",
      level02_boss_room: "家政维修间",
      level02_exit_door: "家庭门禁后方",
    },
    environmentPressure: {
      title: 0.18,
      death: 0.92,
      idle: 0.3,
      exitUnlocked: 0.86,
      byWave: {
        level_02_living_swarm: 0.68,
        level_02_carekeeper_host: 0.9,
      },
    },
  };
