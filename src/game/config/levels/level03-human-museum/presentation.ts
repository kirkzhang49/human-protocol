import type { LevelPresentationConfig } from "../../schema/levelConfig";

export const level03Presentation = {
  "defaultWaveStartMessage": "展厅安保正在启动。",
  "reinforcementMessage": "展厅继续投放维修单位。",
  "waveLabels": {
    "level_03_lobby_patrol": "展厅安保",
    "wave_level_03_body_exhibit": "身体展柜安保",
    "wave_level_03_central_archive": "策展主管"
  },
  "objectives": {
    "upgrade": {
      "title": "选一种活法",
      "detail": "只能选一项",
      "progressLabel": "升级上线",
      "progressText": "选 1 个"
    },
    "preRod": {
      "title": "捡起铁棒",
      "detail": "别空手"
    },
    "prePistol": {
      "title": "捡起手枪",
      "detail": "拿到枪，门会锁"
    },
    "default": {
      "title": "拿展项档案",
      "detail": "中门还暗着"
    },
    "exitUnlocked": {
      "title": "进闭馆电梯",
      "detail": "别恋战",
      "progressLabel": "撤离",
      "progressText": "冲"
    }
  },
  "flow": {
      "title": {
        "system": "博物馆",
        "heading": "人类博物馆 03",
        "body": "灯箱把工具、声音、身体和协议分开展示。每个展柜都像在等你对号。",
        "signalStrip": [
          "工具展柜",
          "求救声音",
          "协议档案"
        ],
      "startButton": "进入博物馆"
    },
    "death": {
      "system": "急救失败",
      "heading": "你倒下了",
      "itchSuffix": "itch 版本无广告。",
      "reviveOfferPrefix": "醒来后有几秒肾上腺素爆发。",
      "cacheReadyText": "补给已备好。",
      "reviveButtonRewarded": "看广告急救",
      "reviveButtonLocal": "急救",
      "restartButton": "重开本关",
      "restartAfterReviveUsedButton": "重新开始"
    },
    "transition": {
      "system": "出口电梯",
      "heading": "展柜之外"
    },
      "victory": {
        "system": "档案片段",
        "heading": "馆藏记录",
        "body": "最后人类不是人名。馆藏只保留一套会拿工具、会求救、会逃生的行为协议。",
      "doubleMemoryButton": "看广告 x2 积分",
      "doubleMemoryClaimedButton": "x2 积分已领取",
      "replayButton": "再次进入博物馆"
    }
  },
  "waves": [
    {
      "id": "level_03_lobby_patrol",
      "label": "展厅安保",
      "objectiveTitle": "拿展项档案",
      "objectiveDetail": "别停在主展厅",
      "startMessage": "展厅安保启动。",
      "startWarning": {
        "label": "展厅安保",
        "detail": "先拿档案"
      },
      "startWarningDuration": 2
    },
    {
      "id": "wave_level_03_body_exhibit",
      "label": "身体展柜安保",
      "objectiveTitle": "解开四色展柜",
      "objectiveDetail": "第一色在声纹展厅",
      "startMessage": "身体展柜安保启动。",
      "startWarning": {
        "label": "四色展柜",
        "detail": "声纹黄，身体白蓝红"
      },
      "startWarningDuration": 2.1,
      "startAudio": {
        "key": "elite_warning",
        "intensity": 0.72
      }
    },
    {
      "id": "wave_level_03_central_archive",
      "label": "策展主管",
      "objectiveTitle": "击倒策展主管",
      "objectiveDetail": "它守着右侧管制房间",
      "startMessage": "中央档案室锁定。",
      "startWarning": {
        "label": "策展主管",
        "detail": "击倒后去右侧管制房间"
      },
      "startWarningDuration": 2.35,
      "startDialogueTrigger": "level_03_curator_spawn",
      "startAudio": {
        "key": "elite_warning",
        "intensity": 1
      },
      "startCamera": {
        "shake": 0.5,
        "fovKick": 2.8
      }
    }
  ],
  "spawnSourceLabels": {
    "front": "前方入口",
    "front_arc": "前方入口",
    "side_rear": "侧后方夹击",
    "front_gate": "正门重型单位",
    "turret_rail": "左右轨道炮台",
    "around_ring": "四周通道",
    "rear_ring": "后方追击队",
    "level03_lobby_ring": "主展厅",
    "sg_level_03_body_exhibit": "身体展柜",
    "sg_level_03_central_archive": "中央档案室"
  },
  "reinforcementWarningDuration": 1.45,
  "environmentPressure": {
    "title": 0.38,
    "death": 0.94,
    "idle": 0.44,
    "exitUnlocked": 0.82,
    "byWave": {
      "level_03_lobby_patrol": 0.72,
      "wave_level_03_body_exhibit": 0.82,
      "wave_level_03_central_archive": 0.98
    }
  }
} as const satisfies LevelPresentationConfig;
