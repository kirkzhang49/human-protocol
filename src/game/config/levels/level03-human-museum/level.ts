import { validateLevelConfig } from "../../ConfigValidator";
import type { LevelDefinition } from "../../schema/levelConfig";
import type { OfficialBuilderDocument } from "../../../../build/official-builder/OfficialBuilderTypes";
import { requireOfficialBuilderLevel } from "../officialBuilderRuntime";
import level03OfficialBuilderDocumentJson from "./level.official.builder.json";
import { level03Switches } from "./logic";
import { level03Map } from "./map";
import { level03Events, level03Objectives } from "./objectives";
import { level03Presentation } from "./presentation";
import { level03Puzzles } from "./puzzles";
import { level03Articles, level03Dialogues } from "./story";
import {
  level03BossPhases,
  level03CinematicBeats,
  level03CombatLimits,
  level03EnemyDeathBeats,
  level03EnvironmentStates,
  level03SpawnGroups,
  level03Waves,
} from "./waves";

export const legacyLevel03HumanMuseum = {
  id: "level_03_human_museum",
  title: "人类博物馆",
  authoringProfile: "internal",
  authoringMetadata: {
  "builderEnvironment": {
    "lighting": {
      "ambient": 0.42,
      "keyColor": "#dbefff",
      "keyIntensity": 0.88,
      "fog": 0.18,
      "bloom": 0.28,
      "shadow": 0.62
    },
    "rooms": {
      "level_03_entry_hall": {
        "surfaceKitId": "hp:human_museum_gallery_shell_v1",
        "floorPresetId": "floor_photo_marble",
        "wallPresetId": "wall_hp_museum_limestone_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "floor": {
            "presetId": "floor_photo_marble"
          },
          "wall": {
            "presetId": "wall_hp_museum_limestone_panel"
          },
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      },
      "level_03_gallery_lobby": {
        "surfaceKitId": "hp:human_museum_gallery_shell_v1",
        "floorPresetId": "floor_photo_marble",
        "wallPresetId": "wall_hp_museum_limestone_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "floor": {
            "presetId": "floor_photo_marble"
          },
          "wall": {
            "presetId": "wall_hp_museum_limestone_panel"
          },
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      },
      "level_03_tool_exhibit": {
        "surfaceKitId": "hp:human_museum_gallery_shell_v1",
        "floorPresetId": "floor_photo_marble",
        "wallPresetId": "wall_hp_museum_limestone_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "floor": {
            "presetId": "floor_photo_marble"
          },
          "wall": {
            "presetId": "wall_hp_museum_limestone_panel"
          },
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      },
      "level_03_voice_exhibit": {
        "surfaceKitId": "hp:human_museum_gallery_shell_v1",
        "floorPresetId": "floor_photo_marble",
        "wallPresetId": "wall_hp_museum_limestone_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "floor": {
            "presetId": "floor_photo_marble"
          },
          "wall": {
            "presetId": "wall_hp_museum_limestone_panel"
          },
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      },
      "level_03_body_exhibit": {
        "surfaceKitId": "hp:human_museum_gallery_shell_v1",
        "floorPresetId": "floor_photo_marble",
        "wallPresetId": "wall_hp_museum_limestone_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "floor": {
            "presetId": "floor_photo_marble"
          },
          "wall": {
            "presetId": "wall_hp_museum_limestone_panel"
          },
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      },
      "level_03_central_archive": {
        "surfaceKitId": "hp:human_museum_gallery_shell_v1",
        "floorPresetId": "floor_photo_marble",
        "wallPresetId": "wall_hp_museum_limestone_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "floor": {
            "presetId": "floor_photo_marble"
          },
          "wall": {
            "presetId": "wall_hp_museum_limestone_panel"
          },
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      },
      "level_03_official_exit_room": {
        "floorPresetId": "floor_dark_rubber",
        "wallPresetId": "wall_dark_metal_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      },
      "room_kqrkp0": {
        "surfaceKitId": "hp:human_museum_gallery_shell_v1",
        "floorPresetId": "floor_photo_marble",
        "wallPresetId": "wall_hp_museum_limestone_panel",
        "ceilingPresetId": "ceiling_hp_museum_coffered_limestone",
        "ceilingVisible": true,
        "wallHeight": 3.36,
        "ceilingHeight": 3.36,
        "surfaceOverrides": {
          "floor": {
            "presetId": "floor_photo_marble"
          },
          "wall": {
            "presetId": "wall_hp_museum_limestone_panel"
          },
          "ceiling": {
            "presetId": "ceiling_hp_museum_coffered_limestone"
          }
        }
      }
    }
  },
  "builderRouteSwitches": [
    {
      "id": "route_z43akm",
      "label": "管制路由台",
      "roomId": "room_kqrkp0",
      "keyRoomId": "level_03_gallery_lobby",
      "keyPosition": [
        -5.04,
        0.86
      ],
      "position": [
        9.35,
        -15.65
      ],
      "rotationY": 0,
      "outputs": [
        {
          "id": "route_out_yf",
          "kind": "open_door",
          "doorId": "level_03_official_exit_door",
          "label": "开启中央档案室—闭馆电梯"
        }
      ]
    }
  ]
},
  spawnPoint: [
  0,
  0,
  12
],
  initialInventory: {
  "hasRod": true,
  "hasPistol": true,
  "coreCells": 0,
  "equipWeapon": "railLance"
},
  initialWaveStartDelay: 0,
  requiresStoryPickupsBeforeWaves: false,
  exit: {
  "id": "level_03_official_exit",
  "position": [
    0,
    0,
    -20.1
  ],
  "radius": 2.2,
  "unlockedLabel": "撤离电梯",
  "distanceLabel": "撤离电梯",
  "unlockMessage": "撤离电梯已通电。",
  "unlockDialogueTrigger": "builder_exit_unlocked",
  "unlockWarning": {
    "label": "出口已通电",
    "detail": "撤离电梯可以使用了"
  },
  "cinematic": {
    "type": "elevator_walk_in",
    "duration": 5.6,
    "walkInDuration": 1.55,
    "doorOpenTime": 0.08,
    "doorCloseTime": 2.15,
    "buttonPressTime": 4,
    "buttonPressDuration": 2,
    "whiteOutTime": 4.85,
    "enterPosition": [
      0,
      0,
      -20.9
    ],
    "faceYaw": 1.641599759364805,
    "doorId": "level_03_official_exit_door",
    "message": "撤离电梯正在接管撤离流程。"
  },
  "transitionMessage": "电梯门合拢，展厅标签逐个熄灭。",
  "transitionDialogueTrigger": "builder_exit_transition",
  "victoryMessage": "馆藏记录：最后人类不是人名，是一套行为协议。"
},
  map: level03Map,
  puzzles: level03Puzzles,
  switches: level03Switches,
  objectiveChain: level03Objectives,
  articles: level03Articles,
  waves: level03Waves,
  events: level03Events,
  environmentStates: level03EnvironmentStates,
  bossPhases: level03BossPhases,
  dialogues: level03Dialogues,
  spawnGroups: level03SpawnGroups,
  cinematicBeats: level03CinematicBeats,
  pickups: {
  "maxActiveDynamicPickups": 6,
  "dynamicLifetimeSec": 62,
  "storyPickups": [],
  "collectRadii": {
    "coreCell": 2.45,
    "repairKit": 2.25,
    "ironRod": 1.65,
    "pistol": 1.65
  },
  "repairKit": {
    "minMissingHealthToCollect": 3,
    "healAmount": 24,
    "rewardLabel": "拾取修复箱"
  },
  "coreCell": {
    "maxHeld": 1,
    "pickupLabel": "拾取应急电池",
    "pickupDetailPrefix": "物品",
    "useLabel": "应急电池释放",
    "useDetail": "一次性清场冲击",
    "preservedLabel": "电池余电",
    "preservedDetail": "这枚电池没有完全耗尽",
    "upgradeInsertedLabel": "应急电池装入",
    "emptyUseReward": {
      "label": "没有应急电池",
      "detail": "电池很少，留给被包围时",
      "rarity": "common"
    }
  },
  "drops": {
    "coreCell": {
      "activeDropLimit": 1,
      "pityKills": 18,
      "minKillsForPity": 16,
      "eliteChance": 0.58,
      "archetypeChances": {
        "clamp_bot": {
          "minKills": 12,
          "chance": 0.07
        },
        "repair_drone": {
          "minKills": 16,
          "chance": 0.018
        }
      }
    },
    "repairKit": {
      "activeDropLimit": 1,
      "minMissingHealth": 14,
      "eliteChance": 0.26,
      "baseChance": 0.01,
      "archetypeChanceBonus": {
        "clamp_bot": 0.02
      },
      "missingHealthThreshold": 0.34,
      "missingHealthBonus": 0.03,
      "lowHealthBonuses": [
        {
          "healthRatioAtMost": 0.4,
          "bonus": 0.09
        },
        {
          "healthRatioAtMost": 0.24,
          "bonus": 0.16
        }
      ],
      "lowHealthPity": [
        {
          "healthRatioAtMost": 0.22,
          "kills": 4
        },
        {
          "healthRatioAtMost": 0.32,
          "kills": 7
        }
      ]
    }
  }
},
  economy: {
  "memoryFragments": {
    "default": 1,
    "byArchetype": {
      "custodian_elite": 18,
      "signal_turret": 3,
      "clamp_bot": 6,
      "repair_drone": 3
    }
  },
  "killStreakWindowSec": 3.8,
  "memoryCacheMilestones": [
    {
      "amount": 10,
      "label": "体力恢复",
      "reward": "energy",
      "rarity": "rare"
    },
    {
      "amount": 28,
      "label": "呼吸变稳",
      "reward": "heat",
      "rarity": "rare"
    },
    {
      "amount": 52,
      "label": "生命上限恢复",
      "reward": "health",
      "rarity": "epic"
    }
  ],
  "curatedUpgradeRolls": [
    [
      "rail_double_line",
      "wide_target_cone",
      "thermal_buffer",
      "field_medicine"
    ]
  ],
  "tempoSurge": {
    "eliteDuration": 6.5,
    "normalThreshold": 5,
    "tier2Threshold": 10,
    "tier1Duration": 4.4,
    "tier2Duration": 5.8,
    "tier1HeatRefund": 7,
    "tier2HeatRefund": 12,
    "tier1EnergyRefund": 7,
    "tier2EnergyRefund": 12
  }
},
  revive: {
  "maxRevives": 1,
  "hpRatio": 0.7,
  "memoryFragments": 12,
  "reviveSurgeSec": 9.5,
  "tempoSurgeSec": 5.5,
  "blastRadius": 6.5,
  "blastDamage": 80,
  "blastKnockback": 6,
  "rewardPulse": {
    "label": "第二口气",
    "detail": "+线索 + 短暂爆发",
    "rarity": "story"
  },
  "rewardPulseDuration": 2.4,
  "message": "你在博物馆地板上醒来。灯墙还在等你。"
},
  combatLimits: level03CombatLimits,
  enemyDeathBeats: level03EnemyDeathBeats,
  presentation: level03Presentation,
} as const satisfies LevelDefinition;

export const level03HumanMuseum = requireOfficialBuilderLevel(
  level03OfficialBuilderDocumentJson as unknown as OfficialBuilderDocument,
  "Level 3",
);
export const level03HumanMuseumValidationReport = validateLevelConfig(level03HumanMuseum);
export const legacyLevel03HumanMuseumValidationReport = validateLevelConfig(legacyLevel03HumanMuseum);
